import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import api from '@/lib/api'
import { truncateHash } from '@/lib/utils'
import { getBaseScanAddressUrl, getMetaMaskEncryptionPublicKey } from '@/lib/network'
import { Wallet, Loader2, Check, Copy, ExternalLink, X, RefreshCw, KeyRound, ShieldCheck } from 'lucide-react'

// Typing for MetaMask window.ethereum provider
interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  on?: (eventName: string, handler: (...args: unknown[]) => void) => void
  removeListener?: (eventName: string, handler: (...args: unknown[]) => void) => void
  isMetaMask?: boolean
}

declare global {
  interface Window {
    ethereum?: EthereumProvider
  }
}

interface WalletConnectButtonProps {
  className?: string
  variant?: 'compact' | 'full' | 'card'
  onSuccess?: (address: string) => void
}

type ConnectState = 'idle' | 'requesting' | 'saving' | 'confirmed' | 'error'

export default function WalletConnectButton({
  className,
  variant = 'compact',
  onSuccess,
}: WalletConnectButtonProps) {
  const { user, refreshUser } = useAuth()
  const [state, setState] = useState<ConnectState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [isEnablingEncryption, setIsEnablingEncryption] = useState(false)

  const walletAddress = user?.walletAddress
  const encryptionPublicKey = user?.encryptionPublicKey

  // Listen to accountsChanged in MetaMask if window.ethereum is present
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum && window.ethereum.on) {
      const handleAccountsChanged = async (accounts: unknown) => {
        const accs = accounts as string[]
        if (accs && accs.length > 0) {
          const newAddress = accs[0].toLowerCase()
          // If already linked to a different address, we can sync or notify
          if (walletAddress && newAddress !== walletAddress.toLowerCase()) {
            try {
              await api.post('/api/user/wallet', { walletAddress: newAddress })
              await refreshUser()
            } catch (err) {
              console.warn('[MetaMask] Failed to auto-sync switched address:', err)
            }
          }
        }
      }

      window.ethereum.on('accountsChanged', handleAccountsChanged)
      return () => {
        if (window.ethereum?.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
        }
      }
    }
  }, [walletAddress, refreshUser])

  const connectWallet = async () => {
    setErrorMessage(null)

    // Check for Ethereum provider
    if (typeof window === 'undefined' || !window.ethereum) {
      setState('error')
      setErrorMessage('MetaMask is not installed. Please install MetaMask to connect your wallet.')
      return
    }

    try {
      // 1. Prompt MetaMask to connect accounts (honest state: requesting)
      setState('requesting')
      const accounts = (await window.ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[]

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts selected in MetaMask.')
      }

      const selectedAddress = accounts[0].toLowerCase()

      // 2. Request ECIES Encryption Public Key from MetaMask (eth_getEncryptionPublicKey)
      let encPubKey: string | null = null
      try {
        encPubKey = await getMetaMaskEncryptionPublicKey(selectedAddress)
      } catch (pkErr) {
        console.warn('[Wallet] User postponed MetaMask encryption public key request:', pkErr)
      }

      // 3. Persist the wallet address and encryption public key to backend (honest state: saving)
      setState('saving')
      const res = await api.post('/api/user/wallet', {
        walletAddress: selectedAddress,
        encryptionPublicKey: encPubKey,
      })

      if (res.data?.success) {
        await refreshUser()
        setState('confirmed')
        if (onSuccess) onSuccess(selectedAddress)

        // Reset to idle after 2.5s
        setTimeout(() => setState('idle'), 2500)
      } else {
        throw new Error(res.data?.error || 'Failed to save wallet address')
      }
    } catch (err: unknown) {
      const e = err as { code?: number; message?: string; response?: { data?: { error?: string } } }
      setState('error')

      if (e?.code === 4001) {
        // EIP-1193 userRejectedRequest error
        setErrorMessage('Connection cancelled in MetaMask.')
      } else if (e?.code === -32002) {
        setErrorMessage('Request already pending in MetaMask. Please open your extension.')
      } else {
        const msg = e?.response?.data?.error || e?.message || 'Failed to connect MetaMask.'
        setErrorMessage(msg)
      }
    }
  }

  const disconnectWallet = async () => {
    setIsDisconnecting(true)
    setErrorMessage(null)
    try {
      await api.delete('/api/user/wallet')
      await refreshUser()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string }
      setErrorMessage(e?.response?.data?.error || e?.message || 'Failed to disconnect wallet.')
    } finally {
      setIsDisconnecting(false)
    }
  }

  const enableEncryption = async () => {
    if (!walletAddress) return
    setIsEnablingEncryption(true)
    setErrorMessage(null)
    try {
      const pk = await getMetaMaskEncryptionPublicKey(walletAddress)
      const res = await api.post('/api/user/wallet', {
        walletAddress,
        encryptionPublicKey: pk,
      })
      if (res.data?.success) {
        await refreshUser()
      } else {
        throw new Error(res.data?.error || 'Failed to update encryption key')
      }
    } catch (err: unknown) {
      const e = err as { code?: number; message?: string; response?: { data?: { error?: string } } }
      if (e?.code === 4001) {
        setErrorMessage('Encryption key request rejected in MetaMask.')
      } else {
        setErrorMessage(e?.response?.data?.error || e?.message || 'Failed to authorize encryption key in MetaMask.')
      }
    } finally {
      setIsEnablingEncryption(false)
    }
  }

  const copyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // If wallet is connected:
  if (walletAddress) {
    if (variant === 'compact') {
      return (
        <div className={`flex items-center gap-1.5 ${className || ''}`}>
          <button
            onClick={copyAddress}
            className="copy-chip inline-flex items-center gap-1.5 text-xs py-1 px-2.5 bg-surface-raised border border-border hover:border-accent transition-colors"
            title="Click to copy connected wallet address"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-semantic-success shadow-[0_0_8px_rgba(121,217,154,0.6)]" />
            <span className="mono tnum text-text-primary">{truncateHash(walletAddress, 6)}</span>
            {copied ? (
              <Check className="w-3 h-3 text-semantic-success" />
            ) : (
              <Copy className="w-3 h-3 text-text-muted hover:text-accent" />
            )}
          </button>
        </div>
      )
    }

    return (
      <div className={`surface-raised p-4 rounded-md border border-border ${className || ''}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-surface border border-border flex items-center justify-center text-accent shrink-0">
              <Wallet className="w-4 h-4 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-text-primary">MetaMask Connected</span>
                <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="mono tnum text-xs text-text-secondary">
                  {walletAddress}
                </span>
                <button
                  type="button"
                  onClick={copyAddress}
                  className="text-text-muted hover:text-accent p-0.5 transition-colors"
                  title="Copy full public address"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-semantic-success" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <a
                  href={getBaseScanAddressUrl(walletAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-muted hover:text-accent p-0.5 transition-colors"
                  title="View on BaseScan"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={connectWallet}
              disabled={state === 'requesting' || state === 'saving'}
              className="text-xs font-semibold px-3 py-1.5 rounded-sm bg-surface hover:bg-surface-hover border border-border text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Switch
            </button>
            <button
              type="button"
              onClick={disconnectWallet}
              disabled={isDisconnecting}
              className="text-xs font-semibold px-3 py-1.5 rounded-sm bg-surface hover:bg-semantic-danger/10 border border-border hover:border-semantic-danger/30 text-semantic-danger transition-colors flex items-center gap-1"
            >
              {isDisconnecting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <X className="w-3 h-3" />
              )}
              Disconnect
            </button>
          </div>
        </div>

        {/* ECIES Decryption Status Row */}
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            {encryptionPublicKey ? (
              <>
                <ShieldCheck className="w-4 h-4 text-semantic-success" />
                <span className="text-text-secondary">
                  MetaMask <strong className="text-text-primary">eth_decrypt</strong> active
                </span>
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4 text-semantic-warning" />
                <span className="text-text-secondary">
                  Private-key decryption not enabled
                </span>
              </>
            )}
          </div>

          {!encryptionPublicKey && (
            <button
              type="button"
              onClick={enableEncryption}
              disabled={isEnablingEncryption}
              className="py-1 px-2.5 rounded-sm bg-accent text-text-inverse font-semibold text-[11px] hover:bg-[#d4f885] transition-colors flex items-center gap-1 shadow-sm"
            >
              {isEnablingEncryption ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Authorizing...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-3 h-3" />
                  <span>Enable eth_decrypt</span>
                </>
              )}
            </button>
          )}
        </div>

        {errorMessage && (
          <p className="text-xs text-semantic-danger mt-2">{errorMessage}</p>
        )}
      </div>
    )
  }

  // If wallet is not connected:
  return (
    <div className={`flex flex-col gap-2 ${className || ''}`}>
      <button
        type="button"
        onClick={connectWallet}
        disabled={state === 'requesting' || state === 'saving'}
        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md font-semibold text-xs text-text-inverse bg-accent hover:bg-[#d4f885] active:translate-y-0 transition-all duration-fast cursor-pointer disabled:opacity-60 shadow-[0_2px_12px_rgba(198,243,106,0.18)]"
      >
        {state === 'requesting' ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-text-inverse" />
            <span>Confirm in MetaMask...</span>
          </>
        ) : state === 'saving' ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-text-inverse" />
            <span>Saving Public Key...</span>
          </>
        ) : state === 'confirmed' ? (
          <>
            <Check className="w-3.5 h-3.5 text-text-inverse" />
            <span>Wallet Linked!</span>
          </>
        ) : (
          <>
            <Wallet className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>Connect MetaMask Wallet</span>
          </>
        )}
      </button>

      {errorMessage && (
        <div className="rounded-md border border-semantic-danger/30 bg-semantic-danger/10 p-2.5 text-xs text-semantic-danger">
          {errorMessage}
        </div>
      )}
    </div>
  )
}

