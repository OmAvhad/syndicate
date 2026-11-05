export interface Leader {
  id: string
  name: string
  address: string
  badge: string
  winRate: number
  monthlyRoi: number
  totalCopiers: number
  riskLevel: 'Low' | 'Medium' | 'High'
  shieldedAum: string
  description: string
  pairs: string[]
  isVerified: boolean
}

export interface TradeExecution {
  id: string
  leaderId: string
  leaderName: string
  action: 'BUY' | 'SELL'
  pair: string
  amountEth: number
  priceUsd: number
  timestamp: string
  status: 'EXECUTED' | 'CONFIRMED' | 'RELAYING'
  isSimulated: boolean
  nullifierCommitment: string
  relayerFee: string
}

export interface CopyAllocation {
  leaderId: string
  allocatedEth: number
  maxSlippagePercent: number
  stopLossPercent: number
  active: boolean
  startedAt: string
}

