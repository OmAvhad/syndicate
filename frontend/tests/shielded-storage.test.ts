import 'fake-indexeddb/auto'
import { beforeEach, expect, test, vi } from 'vitest'
import { MnemonicKeystore } from '@kohaku-eth/plugins'
import { createWallet, readWallet, PoolDatabase, exportPoolBackup, importPoolBackup, scopeKey } from '../src/lib/shielded/storage'

const scope = { userId: 'leader', walletAddress: `0x${'12'.repeat(20)}` }
class MemoryStorage {
  data = new Map<string, string>()
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, value) }
  removeItem(key: string) { this.data.delete(key) }
  clear() { this.data.clear() }
}
beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  vi.stubGlobal('navigator', { locks: { request: (_key: string, _options: unknown, action: (lock: object) => unknown) => action({}) } })
})
test('reopening retains spending/viewing derivation; followers have independent keys', async () => {
  const first = createWallet(scope)
  const restored = readWallet(scope)!
  expect(createWallet(scope).mnemonic).toBe(first.mnemonic)
  for (const path of ["m/44'/1984'/0'/0'/0'", "m/420'/1984'/0'/0'/0'"]) {
    expect(await new MnemonicKeystore(restored.mnemonic).deriveAt(path)).toBe(await new MnemonicKeystore(first.mnemonic).deriveAt(path))
  }
  expect(createWallet({ ...scope, userId: 'follower' }).mnemonic).not.toBe(first.mnemonic)
})
test('corrupt recovery material fails without silently rotating keys', () => {
  localStorage.setItem(`${scopeKey(scope)}:wallet`, '{broken')
  expect(() => createWallet(scope)).toThrow('cannot be read')
  expect(localStorage.getItem(`${scopeKey(scope)}:wallet`)).toBe('{broken')
})
test('backup restores keys and complete private note state, and refuses overwrite', async () => {
  const wallet = createWallet(scope)
  const db = await PoolDatabase.open(scope)
  await db.set('11155111:private-note', JSON.stringify({ random: 'note-randomness', leafIndex: 42 }))
  db.close()
  const backup = await exportPoolBackup(scope)
  await expect(importPoolBackup(scope, backup)).rejects.toThrow('already has')
  localStorage.clear()
  await importPoolBackup(scope, backup)
  expect(readWallet(scope)?.mnemonic).toBe(wallet.mnemonic)
  const reopened = await PoolDatabase.open(scope)
  expect(await reopened.get('11155111:private-note')).toContain('note-randomness')
  reopened.close()
  await expect(importPoolBackup({ ...scope, walletAddress: `0x${'34'.repeat(20)}` }, backup)).rejects.toThrow('different funding wallet')
})
