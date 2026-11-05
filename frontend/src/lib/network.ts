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

