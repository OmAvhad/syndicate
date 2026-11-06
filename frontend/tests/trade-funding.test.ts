import 'fake-indexeddb/auto'
import { beforeEach, expect, test, vi } from 'vitest'
import { parseEther } from 'viem'
import { createWallet, type PoolScope } from '../src/lib/shielded/storage'

const mock = vi.hoisted(() => ({ send: vi.fn(), prepare: vi.fn(), sign: vi.fn(), receipt: vi.fn(), recipient: '', hash: `0x${'aa'.repeat(32)}`, tx: `0x${'bb'.repeat(32)}` }))
vi.mock('../src/lib/shielded/artifactFetch', () => ({ installArtifactFetch: () => {}, requireArtifactsReady: async () => {} }))
vi.mock('../src/lib/api', () => ({ default: { defaults: { baseURL: 'http://localhost:3001' }, post: async (path: string) => ({ data: path.endsWith('/session') ? { path: '/api/pool/bundler/test-session' } : { result: { standard: {} } } }) } }))
vi.mock('../src/lib/shielded/pool', () => ({
  POOL_TOKENS: { USDC: { address: `0x${'12'.repeat(20)}` } },
  poolPublicClient: { getGasPrice: async () => 1_000_000_000n, getBalance: async () => parseEther('1'), readContract: async () => 100_000_000n },
}))
vi.mock('@kohaku-eth/railgun', () => {
  const config = { unshieldFeeBps: 25, wrappedBaseToken: `0x${'34'.repeat(20)}` }
  const provider = { register: async () => {}, sync: async () => {},
    balance: async () => [{ asset: { type: 'Erc20', value: `0x${'12'.repeat(20)}` }, amount: 100_000_000n }, { asset: { type: 'Erc20', value: config.wrappedBaseToken }, amount: parseEther('1') }],
    transact: () => { const builder = { unshield: vi.fn(() => builder) }; return builder }, prepareUserOp: mock.prepare,
  }
  return {
    ensureInitialized: async () => {}, chainConfig: () => config,
    RailgunBuilder: class { withDatabase() { return this } withUtxoSyncer() { return this } async build() { return provider } },
    UtxoSyncer: { chained: () => ({}), subsquid: () => ({}), rpc: () => ({}) },
    RailgunSigner: { privateKey: () => ({ address: '0zk-test' }), spendingKeyPath: () => "m/0'", viewingKeyPath: () => "m/1'" },
    Signer: { privateKey: (key: string) => ({ key }) },
    SimpleSmartAccount: class { constructor(address: string) { mock.recipient = address } },
    Bundler: { pimlico: () => ({ sendUserOperation: mock.send, waitForReceipt: mock.receipt }) },
    buildUnshieldExecutionCalls: () => [],
  }
})
import { createTradingBurner, fundTradingBurner, grossForUnshield, loadTradingBurner, quoteTradeFunding, fundingShortfall, applyEstimatedFee } from '../src/lib/shielded/tradeFunding'
const scope: PoolScope = { userId: 'leader', walletAddress: `0x${'56'.repeat(20)}` }
beforeEach(() => {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) })
  vi.stubGlobal('navigator', { locks: { request: (_key: string, _options: unknown, fn: (lock: object) => unknown) => fn({}) } })
  createWallet(scope)
  localStorage.setItem('world-id-user', JSON.stringify({ id: scope.userId, walletAddress: scope.walletAddress }))
  mock.prepare.mockReset().mockImplementation(async () => ({ userOp: { sender: mock.recipient, callGasLimit: '0x5208', maxFeePerGas: '0x3b9aca00' }, sign: mock.sign }))
  mock.sign.mockReset().mockImplementation(async signer => ({ userOp: { sender: mock.recipient, signature: signer.key }, entryPoint: `0x${'78'.repeat(20)}` }))
  mock.send.mockReset().mockResolvedValue(mock.hash)
  mock.receipt.mockReset().mockImplementation(async () => ({ success: true, sender: mock.recipient, receipt: { transactionHash: mock.tx } }))
})
test('fee rounding and separate USDC/WETH shortfall checks', async () => {
  expect(grossForUnshield(1n, 25)).toBe(2n)
  const quote = await quoteTradeFunding('3.00')
  expect(fundingShortfall(quote, 0n, parseEther('1'))).toContain('USDC')
  expect(fundingShortfall(quote, 100_000_000n, 0n)).toContain('WETH')
})
test('recipient burner signs its own operation and saves actual funding evidence', async () => {
  const record = createTradingBurner(scope, '{}', await quoteTradeFunding('3.00'))
  await fundTradingBurner(scope, record, () => {})
  expect(mock.sign).toHaveBeenCalledWith({ key: record.privateKey })
  expect(mock.recipient).toBe(record.address)
  expect(record.stage).toBe('funded')
  expect(loadTradingBurner(scope)?.fundingTxHash).toBe(mock.tx)
})
test('retry after uncertain submission resends the saved signed operation using the same key', async () => {
  const record = createTradingBurner(scope, '{}', await quoteTradeFunding('3.00'))
  mock.send.mockRejectedValueOnce(new Error('timeout'))
  await expect(fundTradingBurner(scope, record, () => {})).rejects.toThrow('timeout')
  const recovered = loadTradingBurner(scope)!
  await fundTradingBurner(scope, recovered, () => {})
  expect(mock.prepare).toHaveBeenCalledTimes(1)
  expect(mock.sign).toHaveBeenCalledTimes(1)
  expect(recovered.address).toBe(record.address)
})
test('failed operation cannot become funded', async () => {
  mock.receipt.mockImplementation(async () => ({ success: false, sender: mock.recipient }))
  const record = createTradingBurner(scope, '{}', await quoteTradeFunding('3.00'))
  await expect(fundTradingBurner(scope, record, () => {})).rejects.toThrow('failed')
  expect(record.stage).toBe('submitted')
})
test('a live estimate above the preliminary cap proceeds when shielded funds cover it', async () => {
  mock.prepare.mockImplementation(async () => ({ userOp: { sender: mock.recipient, callGasLimit: '0x989680', maxFeePerGas: '0x3b9aca00' }, sign: mock.sign }))
  const record = createTradingBurner(scope, '{}', await quoteTradeFunding('3.00'))
  const preliminary = BigInt(record.quote.feeReserve)
  await fundTradingBurner(scope, record, () => {})
  expect(BigInt(record.quote.feeReserve)).toBeGreaterThan(preliminary)
  expect(record.stage).toBe('funded')
})
test('a live estimate beyond available shielded funds stops before signing or sending', async () => {
  mock.prepare.mockImplementation(async () => ({ userOp: { sender: mock.recipient, callGasLimit: '0x77359400', maxFeePerGas: '0x3b9aca00' }, sign: mock.sign }))
  const record = createTradingBurner(scope, '{}', await quoteTradeFunding('3.00'))
  await expect(fundTradingBurner(scope, record, () => {})).rejects.toThrow('Required:')
  expect(mock.sign).not.toHaveBeenCalled()
  expect(mock.send).not.toHaveBeenCalled()
})
test('fee allowance rounds up to cover SDK convergence without replacing native gas', async () => {
  const quote = await quoteTradeFunding('3.00')
  const adjusted = applyEstimatedFee(quote, 100n, 25)
  expect(adjusted.feeReserve).toBe('102')
  expect(adjusted.nativeReserve).toBe(quote.nativeReserve)
  expect(BigInt(adjusted.requiredWeth)).toBe(grossForUnshield(BigInt(quote.nativeReserve), 25) + 102n)
})
