import { baseSepolia } from 'viem/chains'

export const BASE_SEPOLIA_CHAIN_ID_DEC = baseSepolia.id // 84532
export const BASE_SEPOLIA_CHAIN_ID_HEX = `0x${baseSepolia.id.toString(16)}` // 0x14a34

export const BASE_SEPOLIA_PARAMS = {
  chainId: BASE_SEPOLIA_CHAIN_ID_HEX,
  chainName: 'Base Sepolia Testnet',
  nativeCurrency: {
    name: 'Sepolia Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: ['https://sepolia.base.org'],
  blockExplorerUrls: ['https://sepolia.basescan.org'],
}

/**
 * Checks if MetaMask is on Base Sepolia, and automatically prompts
 * to switch or add the network if not.
 */
export async function ensureBaseSepoliaNetwork(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask is not installed.')
  }

  try {
    const currentChainId = await window.ethereum.request({
      method: 'eth_chainId',
    })

    if (currentChainId === BASE_SEPOLIA_CHAIN_ID_HEX) {
      return true
    }

    // Try switching to Base Sepolia
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_SEPOLIA_CHAIN_ID_HEX }],
      })
      return true
    } catch (switchError: unknown) {
      const e = switchError as { code?: number; message?: string }

      // 4902 means the chain has not been added to MetaMask yet
      if (e?.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [BASE_SEPOLIA_PARAMS],
        })
        return true
      }
      throw switchError
    }
  } catch (err) {
    console.error('[Network] Failed to switch to Base Sepolia:', err)
    throw err
  }
}

export function getBaseScanTxUrl(hash: string): string {
  return `https://sepolia.basescan.org/tx/${hash}`
}

export function getBaseScanAddressUrl(address: string): string {
  return `https://sepolia.basescan.org/address/${address}`
}

export function getArkivExplorerUrl(keyOrHash?: string): string {
  if (!keyOrHash) return 'https://rabdi.explorer.arkiv.network'
  return `https://rabdi.explorer.arkiv.network/search?q=${encodeURIComponent(keyOrHash)}`
}

export function getArkivDataExplorerUrl(): string {
  return 'https://data.arkiv.network'
}

/**
 * Requests the user's Curve25519 encryption public key via MetaMask (eth_getEncryptionPublicKey).
 * This key is registered on the backend to encrypt trade signals using ECIES (x25519-xsalsa20-poly1305).
 */
export async function getMetaMaskEncryptionPublicKey(address: string): Promise<string> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask is not installed.')
  }

  const encryptionPublicKey = (await window.ethereum.request({
    method: 'eth_getEncryptionPublicKey',
    params: [address],
  })) as string

  return encryptionPublicKey
}

/**
 * Decrypts an ECIES payload encrypted for this wallet using MetaMask's private key (eth_decrypt).
 * @param encryptedHex - The 0x-prefixed hex string of the encrypted payload JSON.
 * @param address - The recipient account address in MetaMask holding the private key.
 */
export async function decryptWithMetaMask<T = unknown>(encryptedHex: string, address: string): Promise<T> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask is not installed.')
  }

  if (!/^0x[0-9a-f]{40}$/i.test(address)) throw new Error('Invalid follower wallet address.')
  if (!/^0x(?:[0-9a-f]{2})+$/i.test(encryptedHex)) throw new Error('The encrypted signal is malformed. Request a fresh leader signal.')
  try {
    const bytes = new Uint8Array(encryptedHex.slice(2).match(/../g)!.map(pair => parseInt(pair, 16)))
    const payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    if (payload.version !== 'x25519-xsalsa20-poly1305' || typeof payload.nonce !== 'string' || atob(payload.nonce).length !== 24 || typeof payload.ephemPublicKey !== 'string' || atob(payload.ephemPublicKey).length !== 32 || typeof payload.ciphertext !== 'string' || atob(payload.ciphertext).length < 16) throw new Error('Invalid encrypted envelope')
  } catch { throw new Error('The signal cannot be read by MetaMask: invalid encrypted payload. Request a fresh leader signal.') }
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[]
  if (accounts[0]?.toLowerCase() !== address.toLowerCase()) {
    throw new Error(`Select the follower wallet ${address} in MetaMask before decrypting. The active account is different.`)
  }

  const decryptedUtf8 = (await window.ethereum.request({
    method: 'eth_decrypt',
    params: [encryptedHex, address],
  })) as string

  try {
    return JSON.parse(decryptedUtf8) as T
  } catch {
    return decryptedUtf8 as unknown as T
  }
}
