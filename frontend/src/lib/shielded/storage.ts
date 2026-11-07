import { generateMnemonic, validateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'

export const POOL_CHAIN_ID = 11155111
export interface PoolScope { userId: string; walletAddress: string }
export interface LocalPoolWallet {
  version: 1
  chainId: typeof POOL_CHAIN_ID
  walletAddress: string
  mnemonic: string
  keyIndex: 0
  createdAt: string
  shieldedAddress?: string
}
export interface DepositRecord {
  id: string
  symbol: string
  amount: string
  createdAt: string
  expectedDepositTransactions: number
  transactions: { hash: `0x${string}`; kind: 'approval' | 'deposit'; status: 'pending' | 'confirmed' | 'reverted' }[]
  status: 'preparing' | 'pending' | 'confirmed' | 'interrupted'
}

export function scopeKey(scope: PoolScope): string {
  if (!scope.userId || !/^0x[0-9a-f]{40}$/i.test(scope.walletAddress)) throw new Error('Link a wallet before opening your shielded balance.')
  return `syndicate:shielded:v1:${POOL_CHAIN_ID}:${encodeURIComponent(scope.userId)}:${scope.walletAddress.toLowerCase()}`
}

function validateWallet(value: unknown, scope: PoolScope): LocalPoolWallet {
  const wallet = value as LocalPoolWallet
  if (!wallet || wallet.version !== 1 || wallet.chainId !== POOL_CHAIN_ID || wallet.keyIndex !== 0 ||
      typeof wallet.walletAddress !== 'string' || wallet.walletAddress.toLowerCase() !== scope.walletAddress.toLowerCase() ||
      typeof wallet.mnemonic !== 'string' || !validateMnemonic(wallet.mnemonic, wordlist) || typeof wallet.createdAt !== 'string') {
    throw new Error('Invalid shielded wallet backup or a different funding wallet/network. Existing keys have not been changed.')
  }
  return wallet
}

export function readWallet(scope: PoolScope, storage: Storage = localStorage): LocalPoolWallet | null {
  const raw = storage.getItem(`${scopeKey(scope)}:wallet`)
  if (!raw) return null
  try { return validateWallet(JSON.parse(raw), scope) }
  catch { throw new Error('Saved shielded keys cannot be read. Restore your backup; do not create a replacement wallet.') }
}

export function saveWallet(scope: PoolScope, wallet: LocalPoolWallet, storage: Storage = localStorage): void {
  validateWallet(wallet, scope)
  const key = `${scopeKey(scope)}:wallet`
  const previous = readWallet(scope, storage)
  if (previous && previous.mnemonic !== wallet.mnemonic) throw new Error('A different shielded wallet already exists. Refusing to overwrite its keys.')
  const raw = JSON.stringify(wallet)
  storage.setItem(key, raw)
  if (storage.getItem(key) !== raw) throw new Error('Could not persist recovery keys. No deposit will be requested.')
}

// Call within withPoolLock: initialization must not race across tabs.
export function createWallet(scope: PoolScope, storage: Storage = localStorage): LocalPoolWallet {
  const existing = readWallet(scope, storage)
  if (existing) return existing
  const wallet: LocalPoolWallet = {
    version: 1, chainId: POOL_CHAIN_ID, walletAddress: scope.walletAddress.toLowerCase(),
    mnemonic: generateMnemonic(wordlist, 256), keyIndex: 0, createdAt: new Date().toISOString(),
  }
  saveWallet(scope, wallet, storage)
  return wallet
}

export function readDeposits(scope: PoolScope): DepositRecord[] {
  const raw = localStorage.getItem(`${scopeKey(scope)}:deposits`)
  return raw ? JSON.parse(raw) : []
}
export function saveDeposits(scope: PoolScope, records: DepositRecord[]): void {
  localStorage.setItem(`${scopeKey(scope)}:deposits`, JSON.stringify(records))
}

export function withPoolLock<T>(scope: PoolScope, action: () => Promise<T>): Promise<T> {
  if (!navigator.locks) throw new Error('Open this app in a secure browser context (HTTPS or localhost) with Web Locks support.')
  // Serialize work across tabs, including background balance reads. A same-tab
  // StrictMode refresh must not be mistaken for a conflicting transaction.
  return navigator.locks.request(scopeKey(scope), { mode: 'exclusive' }, () => action())
}

// The full SDK database includes decrypted notes and their randomness, tree positions,
// and sync state. IndexedDB avoids localStorage's small quota for the Merkle tree.
export class PoolDatabase {
  readonly _brand = 'Storage' as const
  private constructor(private db: IDBDatabase) {}

  static open(scope: PoolScope): Promise<PoolDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(`${scopeKey(scope)}:notes`, 1)
      request.onupgradeneeded = () => request.result.createObjectStore('entries')
      request.onerror = () => reject(new Error('Cannot open local note storage. Check browser storage permissions.'))
      request.onblocked = () => reject(new Error('Close other dashboard tabs and try again.'))
      request.onsuccess = () => resolve(new PoolDatabase(request.result))
    })
  }

  get(key: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const request = this.db.transaction('entries').objectStore('entries').get(key)
      request.onsuccess = () => resolve(request.result ?? null)
      request.onerror = () => reject(request.error)
    })
  }

  set(key: string, value: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('entries', 'readwrite')
      tx.objectStore('entries').put(value, key)
      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(tx.error ?? new Error('Saving private notes failed.'))
      tx.onerror = () => reject(tx.error)
    })
  }

  snapshot(): Promise<[string, string][]> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('entries')
      const entries: [string, string][] = []
      const cursor = tx.objectStore('entries').openCursor()
      cursor.onsuccess = () => {
        const item = cursor.result
        if (item) { entries.push([String(item.key), item.value]); item.continue() }
      }
      tx.oncomplete = () => resolve(entries)
      tx.onerror = () => reject(tx.error)
    })
  }

  restore(entries: [string, string][]): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('entries', 'readwrite')
      const store = tx.objectStore('entries')
      store.clear()
      for (const [key, value] of entries) store.put(value, key)
      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(tx.error)
      tx.onerror = () => reject(tx.error)
    })
  }

  close() { this.db.close() }
}

export async function exportPoolBackup(scope: PoolScope): Promise<string> {
  return withPoolLock(scope, async () => {
    const wallet = readWallet(scope)
    if (!wallet) throw new Error('Create a shielded wallet first.')
    const db = await PoolDatabase.open(scope)
    try {
      return JSON.stringify({ format: 'syndicate-shielded-backup-v1', wallet, database: await db.snapshot() }, null, 2)
    } finally { db.close() }
  })
}

export async function importPoolBackup(scope: PoolScope, raw: string): Promise<void> {
  return withPoolLock(scope, async () => {
    const backup = JSON.parse(raw)
    if (backup.format !== 'syndicate-shielded-backup-v1' || !Array.isArray(backup.database) ||
        backup.database.some((item: unknown) => !Array.isArray(item) || item.length !== 2 || item.some(v => typeof v !== 'string'))) {
      throw new Error('Invalid shielded wallet backup file.')
    }
    const wallet = validateWallet(backup.wallet, scope)
    const existing = readWallet(scope)
    if (existing) throw new Error('This browser already has a shielded wallet for this account. Restore in a fresh browser profile to avoid replacing current notes.')
    const db = await PoolDatabase.open(scope)
    try {
      await db.restore(backup.database)
      saveWallet(scope, wallet)
    } finally { db.close() }
  })
}
