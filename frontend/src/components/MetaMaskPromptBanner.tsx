import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import WalletConnectButton from './WalletConnectButton'
import { Wallet, X } from 'lucide-react'

export default function MetaMaskPromptBanner() {
  const { user } = useAuth()
  const [dismissed, setDismissed] = useState(false)

  // Only display if user is authenticated via World ID but has not linked MetaMask yet
  if (!user || user.walletAddress || dismissed) {
    return null
  }

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 px-6 py-2.5 text-xs text-amber-200 animate-slideDown transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded bg-amber-500/20 text-amber-400 shrink-0">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <span className="font-extrabold text-white mr-1.5">MetaMask Not Connected:</span>
            <span className="text-amber-100/90">
              You are signed in with World ID ({user.username ? `@${user.username}` : 'Verified Human'}). Connect MetaMask to link your Ethereum address for onchain copy trading and fee payments.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <WalletConnectButton variant="compact" />
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1.5 rounded hover:bg-amber-500/20 text-amber-300 hover:text-white transition-colors cursor-pointer"
            title="Dismiss notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

