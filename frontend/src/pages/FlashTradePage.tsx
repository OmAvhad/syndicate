import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseEther,
  keccak256,
  encodePacked,
  stringToHex,
  verifyTypedData,
  type Hex,
  type Address,
} from 'viem'
import { baseSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import {
  Key,
  Shield,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Zap,
  TrendingUp,
  Layers,
  ArrowRight,
  Sliders,
  Radio,
  FileCode,
  Terminal,
  Activity,
  ChevronRight,
  AlertCircle,
  Clock,
  Sparkles,
  HelpCircle,
  Info,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// TECHNICAL INFO TOOLTIP COMPONENT FOR TEAM EDUCATION
// ─────────────────────────────────────────────────────────────────────────────
function InfoTooltip({ text, title }: { text: string; title?: string }) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <span className="relative inline-flex items-center ml-1 group align-middle">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          setIsOpen(!isOpen)
        }}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="text-text-muted hover:text-accent p-0.5 rounded cursor-help transition-colors"
        aria-label={title || 'Technical Info'}
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 rounded-md bg-[#1C2227] border border-border-strong text-text-primary text-[11px] shadow-2xl z-50 pointer-events-none animate-fadeIn leading-relaxed text-left block">
          {title && <span className="font-bold text-accent block mb-1 text-xs">{title}</span>}
          <span className="text-text-secondary leading-normal block">{text}</span>
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-[#1C2227] block" />
        </span>
      )}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PRELOADED TESTNET WALLET CREDENTIALS (from past work on Base Sepolia)
// ─────────────────────────────────────────────────────────────────────────────
const PRELOADED_ACCOUNTS = [
  {
    id: 'burner',
    label: '🔥 Burner Wallet (Index 1)',
    shortLabel: 'Burner (Index 1)',
    badge: 'Anonymous Trader',
    role: 'Single-Use Execution Burner',
    address: '0x2e5Bade58a9D3C939C45269AfC5b0e26b66b57F9',
    privateKey:
      '0x188fe782457952a2218796912dafea24d0554d167afd17796d576faa77633875' as Hex,
    description: 'Untraceable single-use wallet for anonymous order execution.',
  },
  {
    id: 'treasury',
    label: '🏦 Treasury Wallet (Index 0)',
    shortLabel: 'Treasury (Index 0)',
    badge: 'Funding Sponsor',
    role: 'Broadcaster & Funding Treasury',
    address: '0x9C14b0Ffe97c3074C71314D3a330b5F847bf2294',
    privateKey:
      '0xd8b5ae7e766afb0c8acaf43b2a973083ab128e595da9be91ca1f66fac72a0c55' as Hex,
    description: 'Holds primary testnet ETH balance on Base Sepolia.',
  },
]

// Base Sepolia Contracts & Parameters
const WETH_BASE_SEPOLIA: Address = '0x4200000000000000000000000000000000000006'
const DEFINITIVE_FLASH_VERIFYING_CONTRACT: Address =
  '0x1111111111111111111111111111111111111111'
const BASE_SEPOLIA_CHAIN_ID = 84532
const RPC_ENDPOINT = 'https://sepolia.base.org'

// Minimal WETH ABI for live onchain deposit (wrap) and withdraw (unwrap)
const WETH_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'wad', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

type OrderType = 'bracket' | 'twap' | 'limit' | 'market'
type TradeSide = 'BUY' | 'SELL'

interface SimulationResult {
  quoteId: string
  orderType: OrderType
  side: TradeSide
  targetAsset: string
  amountEth: string
  amountUsd: string
  entryPrice: string
  takeProfitPrice: string
  stopLossPrice: string
  slippageBps: number
  feeBps: number
  leaderFeeUsd: string
  platformFeeUsd: string
  eip712Signature: string
  signatureValid: boolean
  commitmentHash: string
  salt: string
  rotatingTag: string
  timestamp: string
}

interface OnchainResult {
  txHash: string
  blockNumber: number
  gasUsed: string
  effectiveGasPrice?: string
  status: 'success' | 'reverted'
  explorerUrl: string
  to: string
  from: string
  valueWei: string
  valueEth: string
  calldata: string
  leg?: 'ENTRY_DEPOSIT' | 'TAKE_PROFIT_EXIT' | 'STOP_LOSS_EXIT'
  oraclePrice?: string
}

export default function FlashTradePage() {
  // Selected Account state
  const [selectedAccIndex, setSelectedAccIndex] = useState(0)
  const [customKey, setCustomKey] = useState('')
  const [isCustomMode, setIsCustomMode] = useState(false)
  const [showPrivateKey, setShowPrivateKey] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [copiedJson, setCopiedJson] = useState(false)
  const [activeJsonTab, setActiveJsonTab] = useState<'eip712' | 'onchain' | 'arkiv'>('eip712')
  const [showTeamPrimer, setShowTeamPrimer] = useState(true)

  // Balances & RPC state
  const [ethBalance, setEthBalance] = useState<string>('0.0000')
  const [wethBalance, setWethBalance] = useState<string>('0.0000')
  const [burnerBalances, setBurnerBalances] = useState({ eth: '0.0030', weth: '0.0000' })
  const [treasuryBalances, setTreasuryBalances] = useState({ eth: '0.1460', weth: '0.0010' })
  const [latestBlock, setLatestBlock] = useState<number | null>(null)
  const [isLoadingBalance, setIsLoadingBalance] = useState<boolean>(false)

  // Trade inputs
  const [orderType, setOrderType] = useState<OrderType>('bracket')
  const [tradeSide, setTradeSide] = useState<TradeSide>('BUY')
  const [amountEth, setAmountEth] = useState<string>('0.0005')
  const [ethPriceUsd] = useState<number>(3000)
  const [limitPrice, setLimitPrice] = useState<string>('3000.00')
  const [takeProfitPrice, setTakeProfitPrice] = useState<string>('3300.00')
  const [stopLossPrice, setStopLossPrice] = useState<string>('2850.00')
  const [slippageBps, setSlippageBps] = useState<number>(50) // 0.5%
  const [twapBuckets, setTwapBuckets] = useState<number>(3)
  const [twapInterval, setTwapInterval] = useState<number>(60) // seconds

  // Live simulated market price & trigger state
  const [currentMarketPrice, setCurrentMarketPrice] = useState<number>(3000)

  const parsedTP = parseFloat(takeProfitPrice) || 3300
  const parsedSL = parseFloat(stopLossPrice) || 2850
  const parsedEntry = parseFloat(limitPrice) || 3000

  const triggerState = useMemo(() => {
    const pnlPctNum = ((currentMarketPrice - parsedEntry) / parsedEntry) * 100
    const pnlPct = pnlPctNum.toFixed(1)
    const pnlUsd = ((currentMarketPrice - parsedEntry) * (parseFloat(amountEth) || 0)).toFixed(2)

    if (currentMarketPrice >= parsedTP) {
      return {
        status: 'TAKE_PROFIT' as const,
        label: '🎯 TAKE-PROFIT TRIGGERED',
        badgeVariant: 'success' as const,
        textColor: 'text-semantic-success',
        borderColor: 'border-semantic-success/40 bg-semantic-success/10',
        pnlPct: `+${pnlPct}%`,
        pnlUsd: `+$${pnlUsd}`,
        action: `Flash detects market price ($${currentMarketPrice.toLocaleString()}) >= Take-Profit target ($${parsedTP.toLocaleString()}). Automatically executes closing sell order onchain. Profit secured!`,
      }
    }
    if (currentMarketPrice <= parsedSL) {
      return {
        status: 'STOP_LOSS' as const,
        label: '🛡️ STOP-LOSS TRIGGERED',
        badgeVariant: 'danger' as const,
        textColor: 'text-semantic-danger',
        borderColor: 'border-semantic-danger/40 bg-semantic-danger/10',
        pnlPct: `${pnlPct}%`,
        pnlUsd: `$${pnlUsd}`,
        action: `Flash detects market price ($${currentMarketPrice.toLocaleString()}) <= Stop-Loss floor ($${parsedSL.toLocaleString()}). Fires defensive market exit sell to prevent further loss. Risk capped!`,
      }
    }
    return {
      status: 'MONITORING' as const,
      label: '⏳ POSITION OPEN — ACTIVE MONITORING',
      badgeVariant: 'info' as const,
      textColor: 'text-semantic-info',
      borderColor: 'border-border bg-surface',
      pnlPct: `${pnlPctNum >= 0 ? '+' : ''}${pnlPct}%`,
      pnlUsd: `${pnlPctNum >= 0 ? '+' : ''}$${pnlUsd}`,
      action: `Current price ($${currentMarketPrice.toLocaleString()}) is within bounds ($${parsedSL.toLocaleString()} - $${parsedTP.toLocaleString()}). Flash solvers continuously monitor price feeds with $0 gas overhead.`,
    }
  }, [currentMarketPrice, parsedTP, parsedSL, parsedEntry, amountEth])

  // Execution states
  const [isSimulating, setIsSimulating] = useState<boolean>(false)
  const [isExecutingOnchain, setIsExecutingOnchain] = useState<boolean>(false)
  const [isExecutingTrigger, setIsExecutingTrigger] = useState<boolean>(false)
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null)
  const [onchainResult, setOnchainResult] = useState<OnchainResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])

  // Helper log recorder
  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false })
    setLogs((prev) => [...prev, `[${time}] ${msg}`])
  }, [])

  // Active private key and account derivation
  const activePrivateKey = useMemo(() => {
    if (isCustomMode && customKey.trim().startsWith('0x')) {
      return customKey.trim() as Hex
    }
    return PRELOADED_ACCOUNTS[selectedAccIndex].privateKey
  }, [isCustomMode, customKey, selectedAccIndex])

  const account = useMemo(() => {
    try {
      return privateKeyToAccount(activePrivateKey)
    } catch {
      return privateKeyToAccount(PRELOADED_ACCOUNTS[0].privateKey)
    }
  }, [activePrivateKey])

  // Public client
  const publicClient = useMemo(() => {
    return createPublicClient({
      chain: baseSepolia,
      transport: http(RPC_ENDPOINT),
    })
  }, [])

  // Fetch balances for all preloaded and active accounts
  const fetchBalances = useCallback(async () => {
    setIsLoadingBalance(true)
    try {
      const [block, bEth, bWeth, tEth, tWeth] = await Promise.all([
        publicClient.getBlockNumber(),
        publicClient.getBalance({ address: PRELOADED_ACCOUNTS[0].address as Address }),
        publicClient.readContract({
          address: WETH_BASE_SEPOLIA,
          abi: WETH_ABI,
          functionName: 'balanceOf',
          args: [PRELOADED_ACCOUNTS[0].address as Address],
        }),
        publicClient.getBalance({ address: PRELOADED_ACCOUNTS[1].address as Address }),
        publicClient.readContract({
          address: WETH_BASE_SEPOLIA,
          abi: WETH_ABI,
          functionName: 'balanceOf',
          args: [PRELOADED_ACCOUNTS[1].address as Address],
        }),
      ])

      setLatestBlock(Number(block))
      const bEthStr = Number(formatEther(bEth)).toFixed(5)
      const bWethStr = Number(formatEther(bWeth)).toFixed(5)
      const tEthStr = Number(formatEther(tEth)).toFixed(5)
      const tWethStr = Number(formatEther(tWeth)).toFixed(5)

      setBurnerBalances({ eth: bEthStr, weth: bWethStr })
      setTreasuryBalances({ eth: tEthStr, weth: tWethStr })

      if (isCustomMode && account?.address) {
        const [cEth, cWeth] = await Promise.all([
          publicClient.getBalance({ address: account.address }),
          publicClient.readContract({
            address: WETH_BASE_SEPOLIA,
            abi: WETH_ABI,
            functionName: 'balanceOf',
            args: [account.address],
          }),
        ])
        setEthBalance(Number(formatEther(cEth)).toFixed(5))
        setWethBalance(Number(formatEther(cWeth)).toFixed(5))
      } else if (selectedAccIndex === 0) {
        setEthBalance(bEthStr)
        setWethBalance(bWethStr)
      } else {
        setEthBalance(tEthStr)
        setWethBalance(tWethStr)
      }
    } catch (err: unknown) {
      console.error('Failed to fetch balances:', err)
    } finally {
      setIsLoadingBalance(false)
    }
  }, [publicClient, selectedAccIndex, isCustomMode, account?.address])

  useEffect(() => {
    fetchBalances()
  }, [fetchBalances])

  // Calculated USD values
  const parsedEthAmount = parseFloat(amountEth) || 0
  const totalUsdValue = (parsedEthAmount * ethPriceUsd).toFixed(2)
  const feeBps = 30 // 0.3%
  const feeUsd = ((parseFloat(totalUsdValue) * feeBps) / 10000).toFixed(3)
  const leaderFeeUsd = (parseFloat(feeUsd) * 0.67).toFixed(3)
  const platformFeeUsd = (parseFloat(feeUsd) * 0.33).toFixed(3)

  // Copy helper
  const handleCopy = (text: string, type: 'key' | 'addr') => {
    navigator.clipboard.writeText(text)
    if (type === 'key') {
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    } else {
      setCopiedAddress(true)
      setTimeout(() => setCopiedAddress(false), 2000)
    }
  }

  // Generate active JSON representations
  const eip712JsonPayload = useMemo(() => {
    return {
      domain: {
        name: 'Definitive Flash',
        version: '1',
        chainId: BASE_SEPOLIA_CHAIN_ID,
        verifyingContract: DEFINITIVE_FLASH_VERIFYING_CONTRACT,
      },
      types: {
        Order: [
          { name: 'quoteId', type: 'string' },
          { name: 'funder', type: 'address' },
          { name: 'side', type: 'string' },
          { name: 'amount', type: 'string' },
          { name: 'orderType', type: 'string' },
          { name: 'takeProfit', type: 'string' },
          { name: 'stopLoss', type: 'string' },
          { name: 'feeBps', type: 'uint256' },
        ],
      },
      primaryType: 'Order',
      message: {
        quoteId: simulationResult?.quoteId || 'q_flash_base_sepolia_draft',
        funder: account.address,
        side: tradeSide,
        amount: amountEth,
        orderType,
        takeProfit: `$${takeProfitPrice}`,
        stopLoss: `$${stopLossPrice}`,
        feeBps: feeBps.toString(),
      },
      signature: simulationResult?.eip712Signature || '(Run Simulation to Sign with Private Key)',
      status: simulationResult ? 'VALIDATED_AND_CRYPTOGRAPHICALLY_SIGNED' : 'DRAFT_PREVIEW',
    }
  }, [simulationResult, account.address, tradeSide, amountEth, orderType, takeProfitPrice, stopLossPrice])

  const onchainTxJsonPayload = useMemo(() => {
    let weiVal = '0'
    try {
      weiVal = parseEther(amountEth || '0').toString()
    } catch {
      weiVal = '0'
    }

    const isExit = onchainResult?.leg === 'TAKE_PROFIT_EXIT' || onchainResult?.leg === 'STOP_LOSS_EXIT'

    return {
      network: 'Base Sepolia Testnet',
      chainId: BASE_SEPOLIA_CHAIN_ID,
      rpcEndpoint: RPC_ENDPOINT,
      executionLeg: onchainResult?.leg || 'ENTRY_COLLATERAL_DEPOSIT',
      oracleTriggerPrice: onchainResult?.oraclePrice || `$${currentMarketPrice.toLocaleString()}`,
      transactionPayload: isExit
        ? {
            from: account.address,
            to: WETH_BASE_SEPOLIA,
            targetContract: 'Wrapped Ether (WETH9)',
            function: 'withdraw(uint256 wad)',
            functionSelector: '0x2e1a7d4d',
            action: onchainResult?.leg === 'TAKE_PROFIT_EXIT' ? 'Settle & Close Take-Profit' : 'Defensive Stop-Loss Exit',
            valueEth: '0 ETH (Unwrapping WETH position)',
            calldata: onchainResult?.calldata || '0x2e1a7d4d...',
          }
        : {
            from: account.address,
            to: WETH_BASE_SEPOLIA,
            targetContract: 'Wrapped Ether (WETH9)',
            function: 'deposit()',
            functionSelector: '0xd0e30db0',
            action: 'Wrap ETH into tradeable collateral',
            valueEth: `${amountEth} ETH`,
            valueWei: weiVal,
            calldata: '0xd0e30db0',
          },
      executionStatus: onchainResult ? 'MINED_ONCHAIN' : 'PREPARED_READY_TO_BROADCAST',
      receipt: onchainResult
        ? {
            transactionHash: onchainResult.txHash,
            blockNumber: onchainResult.blockNumber,
            gasUsed: onchainResult.gasUsed,
            effectiveGasPrice: onchainResult.effectiveGasPrice || 'N/A',
            status: onchainResult.status,
            basescanUrl: onchainResult.explorerUrl,
          }
        : null,
    }
  }, [account.address, amountEth, onchainResult, currentMarketPrice])

  const arkivJsonPayload = useMemo(() => {
    return {
      protocol: 'SyndicateCopy Privacy Engine',
      boardTarget: 'Arkiv Rabdi Testnet (Chain ID: 7794095)',
      sealedEntity: {
        type: 'SyndicateSealedPromise',
        tradeSequence: 17,
        broadcaster: account.address,
        commitmentHash:
          simulationResult?.commitmentHash ||
          '0xa8b193d3aadd0a03d43c52fac82ae76252c86afe7c1240ea9474b055eb6e3180 (Draft)',
        secretSalt:
          simulationResult?.salt ||
          '0x0f478c45255170bc28fa2ec9d6ac9b435f29903d76c2bd639c17e041f827bd42 (Draft)',
        rotatingTag: simulationResult?.rotatingTag || 't_669c1b34c5a6824a (Draft)',
        timeToLiveSeconds: 600,
        encryptionStandard: 'AES-256-GCM + 512-Byte Fixed Padding',
      },
      anonymityGuarantee:
        'Zero-Link: No onchain link exists between this burner wallet and the leader profile until post-trade reveal.',
    }
  }, [account.address, simulationResult])

  const currentDisplayJson = useMemo(() => {
    if (activeJsonTab === 'eip712') return JSON.stringify(eip712JsonPayload, null, 2)
    if (activeJsonTab === 'onchain') return JSON.stringify(onchainTxJsonPayload, null, 2)
    return JSON.stringify(arkivJsonPayload, null, 2)
  }, [activeJsonTab, eip712JsonPayload, onchainTxJsonPayload, arkivJsonPayload])

  const handleCopyJson = () => {
    navigator.clipboard.writeText(currentDisplayJson)
    setCopiedJson(true)
    setTimeout(() => setCopiedJson(false), 2000)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SIMULATION: Construct and Cryptographically Sign Definitive Flash Intent
  // ───────────────────────────────────────────────────────────────────────────
  const handleSimulateFlashTrade = async () => {
    setIsSimulating(true)
    setErrorMessage(null)
    addLog(`🚀 Starting Definitive Flash trade simulation for ${tradeSide} ${amountEth} ETH...`)

    try {
      const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(RPC_ENDPOINT),
      })

      const quoteId = `q_flash_base_sepolia_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`
      addLog(`Created Flash Quote ID: ${quoteId}`)

      // EIP-712 Typed Data specification matching Definitive Flash v1
      const domain = {
        name: 'Definitive Flash',
        version: '1',
        chainId: BASE_SEPOLIA_CHAIN_ID,
        verifyingContract: DEFINITIVE_FLASH_VERIFYING_CONTRACT,
      } as const

      const types = {
        Order: [
          { name: 'quoteId', type: 'string' },
          { name: 'funder', type: 'address' },
          { name: 'side', type: 'string' },
          { name: 'amount', type: 'string' },
          { name: 'orderType', type: 'string' },
          { name: 'takeProfit', type: 'string' },
          { name: 'stopLoss', type: 'string' },
          { name: 'feeBps', type: 'uint256' },
        ],
      } as const

      const message = {
        quoteId,
        funder: account.address,
        side: tradeSide,
        amount: amountEth,
        orderType,
        takeProfit: `$${takeProfitPrice}`,
        stopLoss: `$${stopLossPrice}`,
        feeBps: BigInt(feeBps),
      } as const

      addLog(`Signing Definitive Flash EIP-712 Order Intent with hardcoded private key...`)
      const signature = await walletClient.signTypedData({
        domain,
        types,
        primaryType: 'Order',
        message,
      })
      addLog(`Signature generated: ${signature.slice(0, 24)}...`)

      // Cryptographic verification
      const isValid = await verifyTypedData({
        address: account.address,
        domain,
        types,
        primaryType: 'Order',
        message,
        signature,
      })
      addLog(`EIP-712 Signature verified against wallet: ${isValid ? '✅ VALID' : '❌ INVALID'}`)

      // Syndicate Sealed Promise: commitment = keccak256(walletAddress + tradeSeq + salt)
      const tradeSeq = 17n
      const salt = `0x${Array.from({ length: 32 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('')}` as Hex
      const commitmentHash = keccak256(
        encodePacked(['address', 'uint256', 'bytes32'], [account.address, tradeSeq, salt])
      )
      addLog(`Generated Syndicate pre-trade commitment hash: ${commitmentHash.slice(0, 22)}...`)

      // Rotating HMAC tag simulation
      const rotatingTag = `t_${Math.random().toString(36).substring(2, 10)}`
      addLog(`Computed Arkiv signal rotating tag for followers: ${rotatingTag}`)

      setSimulationResult({
        quoteId,
        orderType,
        side: tradeSide,
        targetAsset: 'WETH (Base Sepolia)',
        amountEth,
        amountUsd: `$${totalUsdValue}`,
        entryPrice: `$${limitPrice}`,
        takeProfitPrice: `$${takeProfitPrice}`,
        stopLossPrice: `$${stopLossPrice}`,
        slippageBps,
        feeBps,
        leaderFeeUsd: `$${leaderFeeUsd}`,
        platformFeeUsd: `$${platformFeeUsd}`,
        eip712Signature: signature,
        signatureValid: isValid,
        commitmentHash,
        salt,
        rotatingTag,
        timestamp: new Date().toLocaleTimeString(),
      })

      addLog(`✅ Definitive Flash order simulation completed successfully!`)
    } catch (err: unknown) {
      const e = err as Error
      console.error('Simulation error:', e)
      setErrorMessage(`Simulation failed: ${e.message}`)
      addLog(`❌ Simulation error: ${e.message}`)
    } finally {
      setIsSimulating(false)
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ONCHAIN EXECUTION: Execute Real Base Sepolia Transaction with Hardcoded Key
  // ───────────────────────────────────────────────────────────────────────────
  const handleExecuteOnchain = async () => {
    setIsExecutingOnchain(true)
    setErrorMessage(null)
    addLog(`⚡ Initiating real onchain transaction on Base Sepolia using wallet ${account.address.slice(0, 8)}...`)

    try {
      const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(RPC_ENDPOINT),
      })

      const valueToSend = parseEther(amountEth)

      // Verify wallet has enough ETH
      const currentBal = await publicClient.getBalance({ address: account.address })
      if (currentBal < valueToSend) {
        throw new Error(
          `Insufficient ETH on Base Sepolia. Required: ${amountEth} ETH, Available: ${formatEther(currentBal)} ETH`
        )
      }

      addLog(`Submitting transaction to WETH contract (${WETH_BASE_SEPOLIA}): deposit() with ${amountEth} ETH...`)

      const txHash = await walletClient.writeContract({
        address: WETH_BASE_SEPOLIA,
        abi: WETH_ABI,
        functionName: 'deposit',
        value: valueToSend,
      })

      addLog(`Tx broadcasted to mempool: ${txHash}`)
      addLog(`Waiting for Base Sepolia block confirmation...`)

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
      addLog(`✅ Confirmed in Block #${receipt.blockNumber}! Gas used: ${receipt.gasUsed.toString()}`)

      const explorerUrl = `https://sepolia.basescan.org/tx/${txHash}`

      setOnchainResult({
        txHash,
        blockNumber: Number(receipt.blockNumber),
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice ? `${formatEther(receipt.effectiveGasPrice)} ETH` : undefined,
        status: receipt.status === 'success' ? 'success' : 'reverted',
        explorerUrl,
        to: WETH_BASE_SEPOLIA,
        from: account.address,
        valueWei: valueToSend.toString(),
        valueEth: `${amountEth} ETH`,
        calldata: '0xd0e30db0', // function selector for deposit()
        leg: 'ENTRY_DEPOSIT',
        oraclePrice: `$${currentMarketPrice.toLocaleString()}`,
      })

      // Refresh balances immediately
      await fetchBalances()
      addLog(`🎉 Onchain trade complete! Updated balances retrieved.`)
    } catch (err: unknown) {
      const e = err as Error
      console.error('Onchain execution error:', e)
      setErrorMessage(`Onchain execution error: ${e.message}`)
      addLog(`❌ Onchain error: ${e.message}`)
    } finally {
      setIsExecutingOnchain(false)
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ONCHAIN TRIGGER EXECUTION: Settle Take-Profit or Stop-Loss on Base Sepolia
  // ───────────────────────────────────────────────────────────────────────────
  const handleExecuteTriggerExit = async () => {
    setIsExecutingTrigger(true)
    setErrorMessage(null)
    const isTP = triggerState.status === 'TAKE_PROFIT'
    const legName = isTP ? 'TAKE_PROFIT_EXIT' : 'STOP_LOSS_EXIT'
    const legLabel = isTP ? '🎯 Take-Profit Target' : '🛡️ Stop-Loss Floor'

    addLog(`⚡ Flash Keeper triggered for ${legLabel} at Oracle Price $${currentMarketPrice.toLocaleString()}!`)
    addLog(`Initiating real onchain exit settlement on Base Sepolia using wallet ${account.address.slice(0, 8)}...`)

    try {
      const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(RPC_ENDPOINT),
      })

      // Query current WETH balance
      const currentWeth = await publicClient.readContract({
        address: WETH_BASE_SEPOLIA,
        abi: WETH_ABI,
        functionName: 'balanceOf',
        args: [account.address],
      })

      let wadToWithdraw = currentWeth

      // If user hasn't deposited yet, execute an entry wrap first so we have collateral to close
      if (currentWeth === 0n) {
        const depositVal = parseEther(amountEth || '0.0005')
        addLog(`No WETH held in wallet. Auto-wrapping ${amountEth} ETH into WETH collateral first...`)
        const depHash = await walletClient.writeContract({
          address: WETH_BASE_SEPOLIA,
          abi: WETH_ABI,
          functionName: 'deposit',
          value: depositVal,
        })
        addLog(`Wrap broadcasted: ${depHash}. Waiting for confirmation...`)
        await publicClient.waitForTransactionReceipt({ hash: depHash })
        addLog(`✅ Collateral locked in WETH! Now firing solver trigger exit...`)
        wadToWithdraw = depositVal
      }

      addLog(`Calling WETH.withdraw(${formatEther(wadToWithdraw)} WETH) to unwrap position back to native ETH...`)

      const txHash = await walletClient.writeContract({
        address: WETH_BASE_SEPOLIA,
        abi: WETH_ABI,
        functionName: 'withdraw',
        args: [wadToWithdraw],
      })

      addLog(`Exit tx broadcasted to mempool: ${txHash}`)
      addLog(`Waiting for Base Sepolia block confirmation...`)

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
      addLog(`✅ EXIT CONFIRMED in Block #${receipt.blockNumber}! Gas used: ${receipt.gasUsed.toString()}`)
      addLog(`🎉 Position closed at $${currentMarketPrice.toLocaleString()}! Funds unwrapped and 30 bps protocol fee recorded.`)

      const explorerUrl = `https://sepolia.basescan.org/tx/${txHash}`

      setOnchainResult({
        txHash,
        blockNumber: Number(receipt.blockNumber),
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice ? `${formatEther(receipt.effectiveGasPrice)} ETH` : undefined,
        status: receipt.status === 'success' ? 'success' : 'reverted',
        explorerUrl,
        to: WETH_BASE_SEPOLIA,
        from: account.address,
        valueWei: '0',
        valueEth: `0 ETH (Unwrapped ${formatEther(wadToWithdraw)} WETH)`,
        calldata: `0x2e1a7d4d (withdraw ${formatEther(wadToWithdraw)} WETH)`,
        leg: legName,
        oraclePrice: `$${currentMarketPrice.toLocaleString()}`,
      })

      await fetchBalances()
      addLog(`✨ Balances refreshed: WETH unwrapped back into native ETH!`)
    } catch (err: unknown) {
      const e = err as Error
      console.error('Trigger exit error:', e)
      setErrorMessage(`Trigger exit error: ${e.message}`)
      addLog(`❌ Trigger exit failed: ${e.message}`)
    } finally {
      setIsExecutingTrigger(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary selection:bg-accent-soft selection:text-accent pb-20">
      {/* ── Top Navigation Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 h-16 border-b border-border bg-bg/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 group">
              <span className="w-2.5 h-2.5 rounded-full bg-[#A8322D] shadow-[0_0_12px_rgba(168,50,45,0.8)] inline-block" />
              <span className="font-display font-extrabold text-lg tracking-tight text-text-primary group-hover:text-accent transition-colors">
                SyndicateCopy
              </span>
            </Link>
            <span className="text-border-strong text-sm">/</span>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill bg-accent-soft border border-accent/25 text-xs font-semibold text-accent">
              <Zap className="w-3 h-3 fill-accent" />
              <span>Flash Advanced Orders</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Testnet Status Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-pill bg-surface-raised border border-border text-xs text-text-secondary">
              <span className="w-2 h-2 rounded-full bg-semantic-success animate-pulse" />
              <span className="font-medium text-text-primary">Base Sepolia</span>
              {latestBlock && (
                <span className="font-mono text-[11px] text-text-muted">#{latestBlock}</span>
              )}
            </div>

            {/* Quick Home Link */}
            <Link to="/">
              <Button variant="ghost" size="sm" className="text-xs">
                WorldAuth Home
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Page Hero ──────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="accent">ETHGlobal Mumbai Hack Demo</Badge>
              <Badge variant="muted">Definitive Flash Track</Badge>
              <Badge variant="info">Internal Team Demo</Badge>
            </div>
            <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-text-primary tracking-tight">
              Definitive Flash Trade Terminal
            </h1>
            <p className="text-text-secondary text-sm sm:text-base mt-1.5 max-w-2xl">
              Simulate and execute advanced orders on Base Sepolia testnet. Hardcoded burner credentials allow testing without login or custody.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://sepolia.basescan.org"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-accent transition-colors"
            >
              BaseScan Explorer
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* ── Internal Team Primer Accordion ─────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6">
        <div className="rounded-lg border border-accent/30 bg-surface-raised p-4 transition-all">
          <div
            className="flex items-center justify-between cursor-pointer select-none"
            onClick={() => setShowTeamPrimer(!showTeamPrimer)}
          >
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-4 h-4 text-accent" />
              <span className="font-display font-bold text-sm text-text-primary">
                🧠 Team Primer: How Flash Copy Trading Works in 60 Seconds
              </span>
              <Badge variant="accent" className="text-[10px] py-0">
                Click to {showTeamPrimer ? 'Collapse' : 'Expand'}
              </Badge>
            </div>
            <button className="text-text-muted hover:text-text-primary transition-colors p-1">
              {showTeamPrimer ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {showTeamPrimer && (
            <div className="flex flex-col gap-3 mt-3 pt-3 border-t border-border/60 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 rounded bg-surface border border-border/70 flex flex-col gap-1.5">
                  <span className="font-bold text-accent flex items-center gap-1">
                    1. Zero-Link Burner
                  </span>
                  <p className="text-text-secondary text-[11px] leading-relaxed">
                    Traders fund single-use wallets from a private pool. Public sees trades on BaseScan, but zero onchain link to who made them.
                  </p>
                </div>

                <div className="p-3 rounded bg-surface border border-border/70 flex flex-col gap-1.5">
                  <span className="font-bold text-accent flex items-center gap-1">
                    2. Flash Bracket Order
                  </span>
                  <p className="text-text-secondary text-[11px] leading-relaxed">
                    1 order carries buy entry, stop-loss (-5%), and take-profit (+10%). Definitive Flash settles orders automatically when prices hit.
                  </p>
                </div>

                <div className="p-3 rounded bg-surface border border-border/70 flex flex-col gap-1.5">
                  <span className="font-bold text-accent flex items-center gap-1">
                    3. Follower TWAP Slicing
                  </span>
                  <p className="text-text-secondary text-[11px] leading-relaxed">
                    Follower copies are sliced across time buckets (e.g. 3 chunks over 3 mins), blunting price spikes so MEV bots can't frontrun.
                  </p>
                </div>

                <div className="p-3 rounded bg-surface border border-border/70 flex flex-col gap-1.5">
                  <span className="font-bold text-accent flex items-center gap-1">
                    4. 30 bps Protocol Fee
                  </span>
                  <p className="text-text-secondary text-[11px] leading-relaxed">
                    Every trade attaches a 0.3% fee: 67% goes directly to the leader's private address; 33% funds the platform treasury.
                  </p>
                </div>
              </div>

              {/* Row 2: Custody, Reverse Swaps, Authority & Testnet Simulation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-border/40">
                <div className="p-3 rounded bg-surface border border-border/70 flex flex-col gap-1.5">
                  <span className="font-bold text-semantic-info flex items-center gap-1">
                    5. Non-Custodial Authority
                  </span>
                  <p className="text-text-secondary text-[11px] leading-relaxed">
                    You never send money to Flash. Tokens stay in your wallet; your signed EIP-712 intent strictly limits what solvers can execute.
                  </p>
                </div>

                <div className="p-3 rounded bg-surface border border-border/70 flex flex-col gap-1.5">
                  <span className="font-bold text-semantic-info flex items-center gap-1">
                    6. The Reverse Swap
                  </span>
                  <p className="text-text-secondary text-[11px] leading-relaxed">
                    When TP/SL hits, the solver routes the exit swap (or WETH.withdraw) onchain, converting the asset back into cash for your wallet.
                  </p>
                </div>

                <div className="p-3 rounded bg-surface border border-border/70 flex flex-col gap-1.5">
                  <span className="font-bold text-semantic-info flex items-center gap-1">
                    7. Autonomous Keepers
                  </span>
                  <p className="text-text-secondary text-[11px] leading-relaxed">
                    Cloud solver bots watch Pyth/Chainlink 24/7 and pay gas to execute your trade while you sleep, rewarded by protocol tip fees.
                  </p>
                </div>

                <div className="p-3 rounded bg-surface border border-border/70 flex flex-col gap-1.5">
                  <span className="font-bold text-semantic-info flex items-center gap-1">
                    8. Testnet Oracle Simulation
                  </span>
                  <p className="text-text-secondary text-[11px] leading-relaxed">
                    We simulate oracle price moves (Bull $3,350 / Bear $2,800), and then fire real onchain WETH withdraw settlements on Base Sepolia!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── LEFT COLUMN: Wallet Credentials & Trade Controls (7 cols) ───── */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* 1. HARDCODED WALLET CARD */}
          <Card className="border-border-strong bg-surface">
            <CardHeader className="pb-3 border-b border-border/70">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-accent" />
                  <CardTitle className="text-base font-bold font-display flex items-center">
                    Hardcoded Testnet Wallet
                    <InfoTooltip
                      title="Zero-Link Burner Architecture"
                      text="In SyndicateCopy, each trade runs from a fresh single-use burner wallet. Index 0 acts as the treasury/gas sponsor; Index 1 executes the trade anonymously onchain without exposing the leader's main wallet."
                    />
                  </CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchBalances}
                  disabled={isLoadingBalance}
                  className="h-7 text-xs text-text-muted hover:text-text-primary"
                >
                  <RefreshCw
                    className={cn('w-3 h-3 mr-1', isLoadingBalance && 'animate-spin')}
                  />
                  Refresh
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-4 flex flex-col gap-4">
              <p className="text-[11px] text-text-muted -mt-2">
                Preloaded testnet credentials derived from the hackathon seed mnemonic. No login or MetaMask required.
              </p>

              {/* Account Selector Tabs with Real-Time Balances */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PRELOADED_ACCOUNTS.map((acc, idx) => {
                  const isBurner = acc.id === 'burner'
                  const bal = isBurner ? burnerBalances : treasuryBalances
                  const isSelected = !isCustomMode && selectedAccIndex === idx

                  return (
                    <button
                      key={acc.id}
                      onClick={() => {
                        setSelectedAccIndex(idx)
                        setIsCustomMode(false)
                      }}
                      className={cn(
                        'p-2.5 rounded-md text-xs transition-all duration-fast cursor-pointer border text-left flex flex-col gap-1',
                        isSelected
                          ? 'bg-accent/15 text-text-primary border-accent shadow-[0_0_12px_rgba(198,243,106,0.15)] ring-1 ring-accent'
                          : 'bg-surface-raised text-text-secondary border-border hover:border-border-strong hover:text-text-primary'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold flex items-center gap-1.5 text-text-primary">
                          {acc.label}
                        </span>
                        <span
                          className={cn(
                            'text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded font-bold',
                            isSelected
                              ? 'bg-accent text-text-inverse'
                              : 'bg-surface text-text-muted border border-border/60'
                          )}
                        >
                          {isSelected ? '● ACTIVE' : acc.badge}
                        </span>
                      </div>
                      <div className="flex items-center justify-between font-mono text-[11px] pt-1 border-t border-border/40">
                        <span className="text-text-secondary">ETH: <strong className="text-text-primary">{bal.eth}</strong></span>
                        <span className="text-text-secondary">WETH: <strong className={bal.weth !== '0.00000' ? 'text-accent font-bold' : 'text-text-muted'}>{bal.weth}</strong></span>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Custom Key Toggle Button */}
              <div className="flex items-center justify-end -mt-1">
                <button
                  onClick={() => setIsCustomMode(!isCustomMode)}
                  className={cn(
                    'px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer border',
                    isCustomMode
                      ? 'bg-accent text-text-inverse border-accent'
                      : 'bg-surface text-text-muted border-border hover:text-text-primary'
                  )}
                >
                  {isCustomMode ? '✓ Using Custom Key' : '+ Use Custom Private Key'}
                </button>
              </div>

              {/* Custom Key input if custom selected */}
              {isCustomMode && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Custom Private Key (32-byte hex)
                  </label>
                  <input
                    type="password"
                    value={customKey}
                    onChange={(e) => setCustomKey(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-3 py-2 rounded-md font-mono text-xs bg-surface-raised border border-border focus:border-accent focus:outline-none"
                  />
                </div>
              )}

              {/* Address Row */}
              <div className="p-3 rounded-md bg-surface-raised border border-border flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span className="font-semibold uppercase tracking-wider text-[11px]">
                    Wallet Address (Base Sepolia)
                  </span>
                  <a
                    href={`https://sepolia.basescan.org/address/${account.address}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
                  >
                    View on BaseScan
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <code className="font-mono text-xs sm:text-sm text-text-primary break-all select-all font-semibold">
                    {account.address}
                  </code>
                  <button
                    onClick={() => handleCopy(account.address, 'addr')}
                    className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                    title="Copy Address"
                  >
                    {copiedAddress ? (
                      <Check className="w-3.5 h-3.5 text-semantic-success" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Private Key Display */}
              <div className="p-3 rounded-md bg-surface-raised border border-border flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold uppercase tracking-wider text-[11px]">
                      Hardcoded Private Key
                    </span>
                    <Badge variant="warning" className="text-[10px] py-0">
                      Testnet Only
                    </Badge>
                  </div>
                  <button
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                    className="inline-flex items-center gap-1 text-[11px] text-text-secondary hover:text-text-primary cursor-pointer"
                  >
                    {showPrivateKey ? (
                      <>
                        <EyeOff className="w-3 h-3" /> Hide
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3" /> Show
                      </>
                    )}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <code className="font-mono text-xs text-semantic-warning break-all select-all">
                    {showPrivateKey
                      ? activePrivateKey
                      : `${activePrivateKey.slice(0, 10)}••••••••••••••••••••••••••••••••••••••••••••••••${activePrivateKey.slice(-8)}`}
                  </code>
                  <button
                    onClick={() => handleCopy(activePrivateKey, 'key')}
                    className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                    title="Copy Private Key"
                  >
                    {copiedKey ? (
                      <Check className="w-3.5 h-3.5 text-semantic-success" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Balances Display */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-md bg-surface-raised border border-border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      Base Sepolia ETH
                    </span>
                    <InfoTooltip
                      title="Native Testnet ETH"
                      text="Native gas currency on Base Sepolia. Used for transaction gas fees and wrapped into WETH for trade execution."
                    />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono font-bold text-lg text-text-primary">
                      {ethBalance}
                    </span>
                    <span className="text-xs text-text-muted">ETH</span>
                  </div>
                </div>

                <div className="p-3 rounded-md bg-surface-raised border border-border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      Wrapped WETH Token
                    </span>
                    <InfoTooltip
                      title="Wrapped Ether (WETH)"
                      text="Standard ERC-20 token version of ETH. Smart contract orderbooks and Flash settlement routers require ERC-20 tokens rather than native ETH."
                    />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono font-bold text-lg text-accent">
                      {wethBalance}
                    </span>
                    <span className="text-xs text-text-muted">WETH</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. DEFINITIVE FLASH TRADE ORDER INPUTS */}
          <Card className="border-border-strong bg-surface">
            <CardHeader className="pb-3 border-b border-border/70">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-accent" />
                  <CardTitle className="text-base font-bold font-display flex items-center">
                    Definitive Flash Order Parameters
                    <InfoTooltip
                      title="Definitive Flash Protocol"
                      text="A specialized decentralized order engine. It allows smart-order execution (such as Brackets and TWAP) via offchain signed intents, eliminating the high gas costs of onchain orderbooks."
                    />
                  </CardTitle>
                </div>
                <Badge variant="accent">Flash Advanced v1</Badge>
              </div>
            </CardHeader>

            <CardContent className="pt-4 flex flex-col gap-5">
              <p className="text-[11px] text-text-muted -mt-2">
                Configure advanced order types. Definitive Flash settles orders conditionally when market targets are met.
              </p>

              {/* Order Type Tabs */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted flex items-center">
                    Order Type (Definitive Flash Architecture)
                    <InfoTooltip
                      title="Order Type Selection"
                      text="Bracket = Leader trade with auto TP/SL; TWAP = Follower trade sliced across multiple minutes to defeat MEV bots; Limit = Fixed price execution; Market = Immediate execution."
                    />
                  </label>
                  <span className="text-[10px] text-accent font-mono font-semibold">
                    {orderType === 'bracket' && '⚡ Leader 3-in-1 Entry'}
                    {orderType === 'twap' && '🛡️ Follower Sliced Copy'}
                    {orderType === 'limit' && '🎯 Targeted Trigger'}
                    {orderType === 'market' && '⚡ Immediate Swap'}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 p-1 rounded-md bg-surface-raised border border-border">
                  {(
                    [
                      { id: 'bracket', label: 'Bracket Order' },
                      { id: 'twap', label: 'TWAP Split' },
                      { id: 'limit', label: 'Limit' },
                      { id: 'market', label: 'Market' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setOrderType(t.id)}
                      className={cn(
                        'py-2 px-1 text-center rounded text-xs font-semibold transition-all duration-fast cursor-pointer',
                        orderType === t.id
                          ? 'bg-accent text-text-inverse shadow-sm'
                          : 'text-text-secondary hover:text-text-primary'
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <p className="text-[11px] text-text-secondary mt-0.5">
                  {orderType === 'bracket' &&
                    'Bracket Order: Bundles Buy Entry + Stop-Loss (-5%) + Take-Profit (+10%) in 1 signature. Executes automatically without keeping an app open.'}
                  {orderType === 'twap' &&
                    'TWAP Split: Slices an order into smaller chunks over multiple minutes. Prevents frontrunning MEV bots from jumping ahead of followers.'}
                  {orderType === 'limit' &&
                    'Limit Order: Executes only when the market price touches or improves upon your specified limit price.'}
                  {orderType === 'market' &&
                    'Market Order: Immediate onchain swap against current pool liquidity at prevailing prices.'}
                </p>
              </div>

              {/* Side & Asset Pair */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Side */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted flex items-center">
                    Trade Direction
                    <InfoTooltip
                      title="Trade Direction"
                      text="BUY / LONG expects ETH price to climb toward your Take-Profit target. SELL / SHORT exits or protects capital."
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setTradeSide('BUY')}
                      className={cn(
                        'py-2 rounded-md text-xs font-bold transition-all cursor-pointer border',
                        tradeSide === 'BUY'
                          ? 'bg-semantic-success/20 text-semantic-success border-semantic-success/40'
                          : 'bg-surface-raised text-text-secondary border-border hover:border-border-strong'
                      )}
                    >
                      BUY / LONG
                    </button>
                    <button
                      onClick={() => setTradeSide('SELL')}
                      className={cn(
                        'py-2 rounded-md text-xs font-bold transition-all cursor-pointer border',
                        tradeSide === 'SELL'
                          ? 'bg-semantic-danger/20 text-semantic-danger border-semantic-danger/40'
                          : 'bg-surface-raised text-text-secondary border-border hover:border-border-strong'
                      )}
                    >
                      SELL / SHORT
                    </button>
                  </div>
                </div>

                {/* Pair */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted flex items-center">
                    Execution Pair
                    <InfoTooltip
                      title="Target Pair"
                      text="Target asset is Wrapped Ether (WETH) on Base Sepolia paired against USDC pricing index ($3,000.00/ETH)."
                    />
                  </label>
                  <div className="px-3.5 py-2 rounded-md bg-surface-raised border border-border text-xs flex items-center justify-between">
                    <span className="font-semibold text-text-primary">ETH / WETH</span>
                    <span className="font-mono text-text-muted text-[11px]">Base Sepolia (84532)</span>
                  </div>
                </div>
              </div>

              {/* Trade Amount */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted flex items-center">
                    Trade Amount (ETH)
                    <InfoTooltip
                      title="Trade Amount"
                      text="Nominal trade size in ETH. For this testnet demo, converted 1:1 into WETH on Base Sepolia."
                    />
                  </label>
                  <span className="text-xs text-text-secondary font-mono">
                    ≈ ${totalUsdValue} USD (@ ${ethPriceUsd.toLocaleString()})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    value={amountEth}
                    onChange={(e) => setAmountEth(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 rounded-md font-mono text-sm bg-surface-raised border border-border focus:border-accent focus:outline-none"
                    placeholder="0.0005"
                  />
                  <div className="flex items-center gap-1">
                    {['0.0001', '0.0005', '0.001', '0.005'].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setAmountEth(amt)}
                        className={cn(
                          'px-2.5 py-2 rounded text-xs font-mono transition-colors border cursor-pointer',
                          amountEth === amt
                            ? 'bg-accent/15 text-accent border-accent/40 font-bold'
                            : 'bg-surface-raised text-text-muted border-border hover:border-border-strong hover:text-text-primary'
                        )}
                      >
                        {amt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Conditional Inputs: Bracket Order (Take-Profit & Stop-Loss) */}
              {orderType === 'bracket' && (
                <div className="p-4 rounded-md bg-surface-raised border border-border flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-accent" />
                      Bracket Targets (Take-Profit & Stop-Loss)
                      <InfoTooltip
                        title="Automated Bracket Triggers"
                        text="Definitive Flash monitors the onchain price oracle and automatically submits a closing order when either the Take-Profit or Stop-Loss threshold is breached."
                      />
                    </span>
                    <span className="text-[11px] text-text-muted">
                      Attached to single entry transaction
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-semantic-success flex items-center">
                          Take-Profit Target ($)
                          <InfoTooltip
                            title="Take-Profit Target"
                            text="Flash automatically submits a sell order when ETH price climbs to this ceiling (+10%) to lock in profit."
                          />
                        </span>
                        <span className="text-semantic-success font-mono">+10.0%</span>
                      </div>
                      <input
                        type="number"
                        value={takeProfitPrice}
                        onChange={(e) => setTakeProfitPrice(e.target.value)}
                        className="px-3 py-1.5 rounded bg-surface border border-border font-mono text-xs focus:border-semantic-success focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-semantic-danger flex items-center">
                          Stop-Loss Target ($)
                          <InfoTooltip
                            title="Stop-Loss Target"
                            text="Protective stop: Flash automatically sells to limit downside risk if ETH drops to this floor (-5%)."
                          />
                        </span>
                        <span className="text-semantic-danger font-mono">-5.0%</span>
                      </div>
                      <input
                        type="number"
                        value={stopLossPrice}
                        onChange={(e) => setStopLossPrice(e.target.value)}
                        className="px-3 py-1.5 rounded bg-surface border border-border font-mono text-xs focus:border-semantic-danger focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Visual Risk / Reward representation */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between text-[11px] text-text-muted mb-1 font-mono">
                      <span className="text-semantic-danger">SL: ${stopLossPrice}</span>
                      <span className="text-text-primary font-bold">Entry: ${limitPrice}</span>
                      <span className="text-semantic-success">TP: ${takeProfitPrice}</span>
                    </div>
                    <div className="h-2 w-full rounded-pill bg-surface flex overflow-hidden border border-border">
                      <div className="w-[33%] bg-semantic-danger/40 h-full" />
                      <div className="w-[4px] bg-accent h-full" />
                      <div className="w-[67%] bg-semantic-success/40 h-full" />
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-text-muted mt-1">
                      <span>Risk: $150/ETH</span>
                      <span className="font-bold text-accent">Risk:Reward 1:2.0</span>
                      <span>Reward: $300/ETH</span>
                    </div>
                  </div>

                  {/* Interactive Price Movement & Trigger Simulation Engine */}
                  <div className="p-3 rounded-md bg-surface border border-border mt-2 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-accent" />
                        Price Movement & Trigger Check
                        <InfoTooltip
                          title="How Triggers Work"
                          text="In production, Flash monitors onchain Chainlink / Pyth price feeds. When market price hits or breaches your TP or SL threshold, Flash settlement routers execute the closing leg automatically."
                        />
                      </span>
                      <span className="font-mono font-bold text-xs text-text-primary">
                        Oracle Price: ${currentMarketPrice.toLocaleString()}
                      </span>
                    </div>

                    {/* Scenario Buttons */}
                    <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setCurrentMarketPrice(3350)}
                        className={cn(
                          'p-1.5 rounded font-semibold transition-all border cursor-pointer text-center',
                          currentMarketPrice === 3350
                            ? 'bg-semantic-success/20 text-semantic-success border-semantic-success/50'
                            : 'bg-surface-raised text-text-muted border-border hover:border-border-strong hover:text-text-primary'
                        )}
                      >
                        🚀 Bull Move ($3,350)
                      </button>

                      <button
                        type="button"
                        onClick={() => setCurrentMarketPrice(3020)}
                        className={cn(
                          'p-1.5 rounded font-semibold transition-all border cursor-pointer text-center',
                          currentMarketPrice === 3020
                            ? 'bg-semantic-info/20 text-semantic-info border-semantic-info/50'
                            : 'bg-surface-raised text-text-muted border-border hover:border-border-strong hover:text-text-primary'
                        )}
                      >
                        ⚖️ Neutral ($3,020)
                      </button>

                      <button
                        type="button"
                        onClick={() => setCurrentMarketPrice(2800)}
                        className={cn(
                          'p-1.5 rounded font-semibold transition-all border cursor-pointer text-center',
                          currentMarketPrice === 2800
                            ? 'bg-semantic-danger/20 text-semantic-danger border-semantic-danger/50'
                            : 'bg-surface-raised text-text-muted border-border hover:border-border-strong hover:text-text-primary'
                        )}
                      >
                        📉 Bear Dump ($2,800)
                      </button>
                    </div>

                    {/* Range slider */}
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[10px] text-text-muted font-mono">
                        <span>$2,600 (Bear)</span>
                        <span className="text-accent font-semibold">Drag slider to test live trigger logic</span>
                        <span>$3,600 (Bull)</span>
                      </div>
                      <input
                        type="range"
                        min="2600"
                        max="3600"
                        step="10"
                        value={currentMarketPrice}
                        onChange={(e) => setCurrentMarketPrice(Number(e.target.value))}
                        className="w-full accent-accent cursor-pointer"
                      />
                    </div>

                    {/* Dynamic Trigger Status Result */}
                    <div
                      className={cn(
                        'p-2.5 rounded border text-[11px] flex flex-col gap-2 transition-all',
                        triggerState.borderColor
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            'font-bold tracking-tight text-xs flex items-center gap-1',
                            triggerState.textColor
                          )}
                        >
                          {triggerState.label}
                        </span>
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className={triggerState.textColor}>
                            PnL: {triggerState.pnlUsd} ({triggerState.pnlPct})
                          </span>
                        </div>
                      </div>
                      <p className="text-text-secondary text-[11px] leading-relaxed">
                        {triggerState.action}
                      </p>

                      {/* Onchain Trigger Execution Button when Condition is Met! */}
                      {triggerState.status !== 'MONITORING' && (
                        <div className="pt-2 border-t border-border/50 flex flex-col gap-1.5">
                          <button
                            type="button"
                            onClick={handleExecuteTriggerExit}
                            disabled={isExecutingTrigger || isExecutingOnchain || isSimulating}
                            className={cn(
                              'w-full py-2 px-3 rounded font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm',
                              triggerState.status === 'TAKE_PROFIT'
                                ? 'bg-semantic-success text-text-inverse hover:brightness-110 shadow-semantic-success/20'
                                : 'bg-semantic-danger text-text-inverse hover:brightness-110 shadow-semantic-danger/20'
                            )}
                          >
                            {isExecutingTrigger ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                Settling Exit on Base Sepolia...
                              </>
                            ) : triggerState.status === 'TAKE_PROFIT' ? (
                              <>
                                <Zap className="w-3.5 h-3.5 fill-current" />
                                ⚡ Execute Take-Profit Exit on Base Sepolia (${currentMarketPrice.toLocaleString()})
                              </>
                            ) : (
                              <>
                                <Shield className="w-3.5 h-3.5" />
                                🛡️ Execute Stop-Loss Exit on Base Sepolia (${currentMarketPrice.toLocaleString()})
                              </>
                            )}
                          </button>
                          <span className="text-[10px] text-text-muted text-center leading-tight">
                            <strong>Live Onchain Settlement:</strong> Calls WETH.withdraw() on Base Sepolia to close position and return capital.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Conditional Inputs: TWAP Order */}
              {orderType === 'twap' && (
                <div className="p-4 rounded-md bg-surface-raised border border-border flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-accent" />
                      Follower TWAP Order Splitting
                      <InfoTooltip
                        title="TWAP Anti-Frontrunning Logic"
                        text="Followers get signals via Arkiv, wait a random 0-90s delay, and split copies into 3+ slices so trading bots cannot predict bursts."
                      />
                    </span>
                    <span className="text-[11px] text-text-muted">Anti-Frontrunning Shield</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-text-muted font-semibold">
                        Split Buckets
                      </label>
                      <select
                        value={twapBuckets}
                        onChange={(e) => setTwapBuckets(Number(e.target.value))}
                        className="px-3 py-1.5 rounded bg-surface border border-border text-xs focus:outline-none"
                      >
                        <option value={2}>2 slices</option>
                        <option value={3}>3 slices (Default)</option>
                        <option value={5}>5 slices</option>
                        <option value={10}>10 slices</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-text-muted font-semibold">
                        Interval (seconds)
                      </label>
                      <input
                        type="number"
                        value={twapInterval}
                        onChange={(e) => setTwapInterval(Number(e.target.value))}
                        className="px-3 py-1.5 rounded bg-surface border border-border font-mono text-xs focus:outline-none"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-text-secondary leading-relaxed">
                    Arjun’s order is spread over {((twapBuckets * twapInterval) / 60).toFixed(1)} minutes into {twapBuckets} smaller chunks ({(parsedEthAmount / twapBuckets).toFixed(5)} ETH each) to prevent sudden price spikes and prevent frontrunning bots from jumping in.
                  </p>
                </div>
              )}

              {/* Protocol Fee Breakdown (Definitive Integrator Fee) */}
              <div className="p-3 rounded-md bg-surface-raised border border-border flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-text-primary flex items-center">
                    Flash Integrator Fee (0.3% / 30 bps)
                    <InfoTooltip
                      title="30 bps Protocol Fee"
                      text="0.30% fee attached directly to the Flash settlement order. 67% goes to the leader's private address; 33% funds the platform treasury."
                    />
                  </span>
                  <span className="text-[11px] text-text-muted">
                    Split: 67% Leader Private Note (${leaderFeeUsd}) • 33% Platform (${platformFeeUsd})
                  </span>
                </div>
                <span className="font-mono font-bold text-accent">${feeUsd} USD</span>
              </div>

              {/* Error Banner */}
              {errorMessage && (
                <div className="p-3 rounded-md bg-semantic-danger/10 border border-semantic-danger/30 text-xs text-semantic-danger flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* ACTION BUTTONS WITH TECHNICAL EXPLANATIONS */}
              <div className="flex flex-col gap-2 pt-2 border-t border-border/70">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  Action Trigger: Choose Simulation or Real Blockchain Execution
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Simulate Button & Note */}
                  <div className="flex flex-col gap-1.5">
                    <Button
                      onClick={handleSimulateFlashTrade}
                      disabled={isSimulating || isExecutingOnchain}
                      className="w-full flex items-center justify-center gap-2"
                    >
                      {isSimulating ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Simulating...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 fill-text-inverse" />
                          Simulate Flash Order
                        </>
                      )}
                    </Button>
                    <span className="text-[10px] text-text-muted text-center leading-tight">
                      <strong>$0 Gas • Offchain:</strong> Signs EIP-712 typed intent + generates Arkiv sealed hash.
                    </span>
                  </div>

                  {/* Execute Button & Note */}
                  <div className="flex flex-col gap-1.5">
                    <Button
                      variant="secondary"
                      onClick={handleExecuteOnchain}
                      disabled={isSimulating || isExecutingOnchain}
                      className="w-full flex items-center justify-center gap-2 border-accent/30 hover:border-accent text-accent"
                    >
                      {isExecutingOnchain ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-accent" />
                          Broadcasting via {isCustomMode ? 'Custom' : PRELOADED_ACCOUNTS[selectedAccIndex].shortLabel}...
                        </>
                      ) : (
                        <>
                          <Radio className="w-4 h-4 text-accent" />
                          Execute via {isCustomMode ? 'Custom' : PRELOADED_ACCOUNTS[selectedAccIndex].shortLabel}
                        </>
                      )}
                    </Button>
                    <span className="text-[10px] text-text-muted text-center leading-tight">
                      <strong>Real Tx • Gas Used:</strong> Calls WETH.deposit({amountEth} ETH) from {account.address.slice(0, 6)}...{account.address.slice(-4)}.
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT COLUMN: Simulation Results & Onchain Receipts (5 cols) ─── */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* SIMULATION RESULT CARD */}
          <Card className="border-border-strong bg-surface">
            <CardHeader className="pb-3 border-b border-border/70">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-accent" />
                  <CardTitle className="text-base font-bold font-display">
                    Definitive Flash Execution Result
                  </CardTitle>
                </div>
                {simulationResult && (
                  <Badge variant="success" className="text-[10px]">
                    EIP-712 Signed
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              {simulationResult ? (
                <div className="flex flex-col gap-4 text-xs">
                  {/* Quote & Intent Summary */}
                  <div className="p-3 rounded-md bg-surface-raised border border-border flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted uppercase tracking-wider text-[10px] font-semibold">
                        Quote ID
                      </span>
                      <code className="font-mono text-accent text-[11px]">
                        {simulationResult.quoteId}
                      </code>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/50">
                      <div>
                        <span className="text-text-muted text-[10px] block">Order Intent</span>
                        <span className="font-bold text-text-primary">
                          {simulationResult.side} {simulationResult.amountEth} ETH
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted text-[10px] block">Order Type</span>
                        <span className="font-bold text-text-primary uppercase">
                          {simulationResult.orderType}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/50">
                      <div>
                        <span className="text-text-muted text-[10px] block">Take-Profit Target</span>
                        <span className="font-mono font-bold text-semantic-success">
                          {simulationResult.takeProfitPrice}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted text-[10px] block">Stop-Loss Target</span>
                        <span className="font-mono font-bold text-semantic-danger">
                          {simulationResult.stopLossPrice}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Cryptographic EIP-712 Signature */}
                  <div className="p-3 rounded-md bg-surface-raised border border-border flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted font-semibold text-[10px] uppercase tracking-wider">
                        EIP-712 Typed Signature
                      </span>
                      <span className="text-semantic-success font-semibold text-[10px] flex items-center gap-1">
                        <Check className="w-3 h-3" /> Validated
                      </span>
                    </div>
                    <code className="font-mono text-[11px] text-text-secondary break-all bg-bg p-2 rounded border border-border/50">
                      {simulationResult.eip712Signature}
                    </code>
                  </div>

                  {/* Syndicate Sealed Promise (Arkiv Specs) */}
                  <div className="p-3 rounded-md bg-surface-raised border border-border flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted font-semibold text-[10px] uppercase tracking-wider">
                        Syndicate Sealed Promise Commitment
                      </span>
                      <Badge variant="muted" className="text-[10px] py-0">
                        Arkiv Pre-Trade
                      </Badge>
                    </div>
                    <code className="font-mono text-[11px] text-[#E0675F] break-all bg-bg p-2 rounded border border-border/50">
                      {simulationResult.commitmentHash}
                    </code>
                    <div className="flex justify-between items-center text-[10px] text-text-muted mt-1">
                      <span>Rotating Tag: {simulationResult.rotatingTag}</span>
                      <span>TTL: 10 minutes</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center gap-2 text-text-muted">
                  <Zap className="w-8 h-8 stroke-[1.5] text-text-muted/40" />
                  <p className="text-xs max-w-xs">
                    Click <strong>"Simulate Flash Order"</strong> to generate the signed Definitive Flash EIP-712 intent and pre-trade commitment.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ONCHAIN RECEIPT CARD */}
          {onchainResult && (
            <Card className="border-semantic-success/40 bg-surface">
              <CardHeader className="pb-3 border-b border-border/70">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-semantic-success" />
                    <CardTitle className="text-base font-bold font-display text-semantic-success">
                      Live Base Sepolia Receipt
                    </CardTitle>
                  </div>
                  <Badge variant="success">Confirmed</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 flex flex-col gap-3 text-xs">
                <div className="p-3 rounded-md bg-surface-raised border border-border flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted text-[11px]">Block Number</span>
                    <span className="font-mono font-bold text-text-primary">
                      #{onchainResult.blockNumber}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted text-[11px]">Gas Used</span>
                    <span className="font-mono text-text-primary">{onchainResult.gasUsed}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-border">
                    <span className="text-text-muted text-[11px]">Transaction Hash</span>
                    <a
                      href={onchainResult.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-accent text-[11px] inline-flex items-center gap-1 hover:underline"
                    >
                      {onchainResult.txHash.slice(0, 10)}...{onchainResult.txHash.slice(-8)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <a
                  href={onchainResult.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full"
                >
                  <Button variant="secondary" size="sm" className="w-full text-xs gap-1.5">
                    View Verified Transaction on BaseScan
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </a>
              </CardContent>
            </Card>
          )}

          {/* 3. LIVE JSON TRANSACTION & PROTOCOL PAYLOADS */}
          <Card className="border-border-strong bg-surface">
            <CardHeader className="pb-3 border-b border-border/70">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-accent" />
                  <CardTitle className="text-base font-bold font-display flex items-center">
                    Transaction Data & JSON Payloads
                    <InfoTooltip
                      title="Cryptographic Payloads"
                      text="Raw inspectable data: 1) EIP-712 offchain intent for Flash solvers, 2) Base Sepolia onchain transaction and calldata, 3) Arkiv decentralized commitment."
                    />
                  </CardTitle>
                </div>
                <button
                  onClick={handleCopyJson}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-surface-raised hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer border border-border"
                  title="Copy formatted JSON"
                >
                  {copiedJson ? (
                    <>
                      <Check className="w-3 h-3 text-semantic-success" />
                      <span className="text-semantic-success">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy JSON</span>
                    </>
                  )}
                </button>
              </div>
            </CardHeader>

            <CardContent className="pt-3 flex flex-col gap-3">
              {/* Payload Selector Tabs */}
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-md bg-surface-raised border border-border text-[11px]">
                <button
                  onClick={() => setActiveJsonTab('eip712')}
                  className={cn(
                    'py-1.5 px-1 text-center rounded font-semibold transition-all cursor-pointer',
                    activeJsonTab === 'eip712'
                      ? 'bg-accent text-text-inverse shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  )}
                >
                  EIP-712 Intent
                </button>

                <button
                  onClick={() => setActiveJsonTab('onchain')}
                  className={cn(
                    'py-1.5 px-1 text-center rounded font-semibold transition-all cursor-pointer',
                    activeJsonTab === 'onchain'
                      ? 'bg-accent text-text-inverse shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  )}
                >
                  Onchain EVM Tx
                </button>

                <button
                  onClick={() => setActiveJsonTab('arkiv')}
                  className={cn(
                    'py-1.5 px-1 text-center rounded font-semibold transition-all cursor-pointer',
                    activeJsonTab === 'arkiv'
                      ? 'bg-accent text-text-inverse shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  )}
                >
                  Arkiv Envelope
                </button>
              </div>

              {/* Explanatory subtitle */}
              <p className="text-[11px] text-text-muted">
                {activeJsonTab === 'eip712' &&
                  'The exact EIP-712 structured data signed offchain by the wallet. Verified by Flash settlement contracts without gas cost.'}
                {activeJsonTab === 'onchain' &&
                  'Raw EVM transaction parameters (target, value, method selector, calldata, gas) sent to the Base Sepolia RPC node.'}
                {activeJsonTab === 'arkiv' &&
                  'The pre-trade cryptographic commitment and rotating HMAC tag posted to Arkiv for decentralized zero-link verification.'}
              </p>

              {/* Code block */}
              <div className="relative group">
                <pre className="p-3.5 rounded-md bg-bg border border-border font-mono text-[11px] leading-relaxed text-[#C6F36A] max-h-64 overflow-y-auto overflow-x-auto select-all">
                  <code>{currentDisplayJson}</code>
                </pre>
              </div>
            </CardContent>
          </Card>

          {/* PROTOCOL VERIFICATION LOGS DRAWER */}
          <Card className="border-border bg-surface">
            <CardHeader className="pb-2 border-b border-border/70">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-text-muted" />
                  <CardTitle className="text-xs font-bold uppercase tracking-wider font-mono text-text-secondary">
                    Protocol Execution Logs
                  </CardTitle>
                </div>
                {logs.length > 0 && (
                  <button
                    onClick={() => setLogs([])}
                    className="text-[10px] text-text-muted hover:text-text-primary"
                  >
                    Clear
                  </button>
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-3">
              <div className="h-48 overflow-y-auto font-mono text-[11px] leading-relaxed flex flex-col gap-1 p-2 rounded bg-bg border border-border select-all">
                {logs.length === 0 ? (
                  <span className="text-text-muted/50 italic">
                    Ready. Click 'Simulate' or 'Execute' to view cryptographic steps...
                  </span>
                ) : (
                  logs.map((log, index) => (
                    <div
                      key={index}
                      className={cn(
                        'break-all',
                        log.includes('✅') || log.includes('Confirmed')
                          ? 'text-semantic-success'
                          : log.includes('❌')
                            ? 'text-semantic-danger'
                            : log.includes('🚀') || log.includes('Flash')
                              ? 'text-accent'
                              : 'text-text-secondary'
                      )}
                    >
                      {log}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
