import React, { createContext, useContext, useState, type ReactNode } from 'react'
import type { Leader, TradeExecution, CopyAllocation } from '../types/trade'

const INITIAL_LEADERS: Leader[] = [
  {
    id: 'leader_priya',
    name: '0xPriya (Alpha Desk)',
    address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    badge: 'LEADER #1',
    winRate: 84.6,
    monthlyRoi: 38.2,
    totalCopiers: 184,
    riskLevel: 'Low',
    shieldedAum: '142.5 ETH',
    description: 'High-conviction swing trades in ETH/USDC with strict 1.5% max drawdowns.',
    pairs: ['ETH/USDC', 'WBTC/USDC'],
    isVerified: true,
  },
  {
    id: 'leader_zkwhale',
    name: '0xZK_Whale',
    address: '0x1234567890abcdef1234567890abcdef12345678',
    badge: 'ZK SPECIALIST',
    winRate: 77.1,
    monthlyRoi: 29.4,
    totalCopiers: 96,
    riskLevel: 'Medium',
    shieldedAum: '88.0 ETH',
    description: 'Algorithmic momentum trader leveraging Railgun relayer batch execution.',
    pairs: ['ETH/DAI', 'ETH/USDT'],
    isVerified: true,
  },
  {
    id: 'leader_arbitrage',
    name: '0xRelayArb',
    address: '0x8899aabbccddeeff00112233445566778899aabb',
    badge: 'HIGH FREQ',
    winRate: 91.2,
    monthlyRoi: 19.8,
    totalCopiers: 312,
    riskLevel: 'Low',
    shieldedAum: '310.2 ETH',
    description: 'Cross-pool flash arbitrage with zero directional market exposure.',
    pairs: ['ETH/USDC', 'USDC/USDT'],
    isVerified: true,
  },
]

const INITIAL_EXECUTIONS: TradeExecution[] = [
  {
    id: 'tx_exec_101',
    leaderId: 'leader_priya',
    leaderName: '0xPriya',
    action: 'BUY',
    pair: 'ETH/USDC',
    amountEth: 0.25,
    priceUsd: 2640.5,
    timestamp: 'Just now',
    status: 'EXECUTED',
    isSimulated: true,
    nullifierCommitment: '0x9a8b...12ef',
    relayerFee: '0.001 ETH',
  },
  {
    id: 'tx_exec_102',
    leaderId: 'leader_priya',
    leaderName: '0xPriya',
    action: 'SELL',
    pair: 'ETH/USDC',
    amountEth: 0.25,
    priceUsd: 2695.0,
    timestamp: '2h ago',
    status: 'CONFIRMED',
    isSimulated: true,
    nullifierCommitment: '0x43bc...a891',
    relayerFee: '0.001 ETH',
  },
  {
    id: 'tx_exec_103',
    leaderId: 'leader_zkwhale',
    leaderName: '0xZK_Whale',
    action: 'BUY',
    pair: 'ETH/DAI',
    amountEth: 0.5,
    priceUsd: 2620.1,
    timestamp: '1d ago',
    status: 'CONFIRMED',
    isSimulated: true,
    nullifierCommitment: '0x55aa...33bb',
    relayerFee: '0.001 ETH',
  },
]

interface TradeContextType {
  shieldedBalance: number
  isConcealed: boolean
  leaders: Leader[]
  activeAllocation: CopyAllocation | null
  executions: TradeExecution[]
  toggleConceal: () => void
  depositToPool: (amount: number) => void
  withdrawFromPool: (amount: number) => void
  allocateToLeader: (leaderId: string, amount: number, slippage: number, stopLoss: number) => void
  stopCopying: () => void
  executeSimulatedTrade: () => void
}

const TradeContext = createContext<TradeContextType | null>(null)

export function TradeProvider({ children }: { children: ReactNode }) {
  const [shieldedBalance, setShieldedBalance] = useState<number>(2.45)
  const [isConcealed, setIsConcealed] = useState<boolean>(false)
  const [leaders] = useState<Leader[]>(INITIAL_LEADERS)
  const [activeAllocation, setActiveAllocation] = useState<CopyAllocation | null>({
    leaderId: 'leader_priya',
    allocatedEth: 1.0,
    maxSlippagePercent: 0.5,
    stopLossPercent: 10,
    active: true,
    startedAt: '2 days ago',
  })
  const [executions, setExecutions] = useState<TradeExecution[]>(INITIAL_EXECUTIONS)

  const toggleConceal = () => setIsConcealed((prev) => !prev)

  const depositToPool = (amount: number) => {
    setShieldedBalance((prev) => Number((prev + amount).toFixed(4)))
  }

  const withdrawFromPool = (amount: number) => {
    if (amount <= shieldedBalance) {
      setShieldedBalance((prev) => Number((prev - amount).toFixed(4)))
    }
  }

  const allocateToLeader = (leaderId: string, amount: number, slippage: number, stopLoss: number) => {
    setActiveAllocation({
      leaderId,
      allocatedEth: amount,
      maxSlippagePercent: slippage,
      stopLossPercent: stopLoss,
      active: true,
      startedAt: 'Just now',
    })
  }

  const stopCopying = () => {
    setActiveAllocation(null)
  }

  const executeSimulatedTrade = () => {
    const activeLeader = leaders.find((l) => l.id === activeAllocation?.leaderId) || leaders[0]
    const actions: ('BUY' | 'SELL')[] = ['BUY', 'SELL']
    const randomAction = actions[Math.floor(Math.random() * actions.length)]
    const randomAmount = Number((0.1 + Math.random() * 0.3).toFixed(2))

    const newExec: TradeExecution = {
      id: 'tx_exec_' + Date.now(),
      leaderId: activeLeader.id,
      leaderName: activeLeader.name.split(' ')[0],
      action: randomAction,
      pair: 'ETH/USDC',
      amountEth: randomAmount,
      priceUsd: 2650 + Math.floor(Math.random() * 40 - 20),
      timestamp: 'Just now',
      status: 'EXECUTED',
      isSimulated: true,
      nullifierCommitment: '0x' + Math.random().toString(16).substring(2, 10) + '...zk',
      relayerFee: '0.0008 ETH',
    }

    setExecutions((prev) => [newExec, ...prev])
  }

  return (
    <TradeContext.Provider
      value={{
        shieldedBalance,
        isConcealed,
        leaders,
        activeAllocation,
        executions,
        toggleConceal,
        depositToPool,
        withdrawFromPool,
        allocateToLeader,
        stopCopying,
        executeSimulatedTrade,
      }}
    >
      {children}
    </TradeContext.Provider>
  )
}

export function useTrade() {
  const context = useContext(TradeContext)
  if (!context) {
    throw new Error('useTrade must be used within a TradeProvider')
  }
  return context
}

