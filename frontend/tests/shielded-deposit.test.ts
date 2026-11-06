import 'fake-indexeddb/auto'
import { beforeEach, expect, test, vi } from 'vitest'
import { createWallet, readDeposits } from '../src/lib/shielded/storage'

const mocks = vi.hoisted(() => ({
  receipt: vi.fn(), request: vi.fn(), prepare: vi.fn(),
  pool: `0x${'ab'.repeat(20)}`, hash: `0x${'cd'.repeat(32)}`,
}))
vi.mock('viem', async original => ({ ...await original<typeof import('viem')>(), createPublicClient: () => ({
  waitForTransactionReceipt: mocks.receipt, readContract: async () => 0n,
}) }))
vi.mock('@kohaku-eth/provider/viem', () => ({ viem: () => ({}) }))
vi.mock('@kohaku-eth/railgun', () => ({
  ensureInitialized: async () => {},
  chainConfig: () => ({ railgunSmartWallet: mocks.pool, relayAdaptContract: mocks.pool }),
  createRailgunPlugin: async () => ({ instanceId: async () => '0zk-test', prepareShield: mocks.prepare }),
}))
import { depositToPool, parseDepositAmount } from '../src/lib/shielded/pool'
const scope = { userId: 'deposit-test', walletAddress: `0x${'12'.repeat(20)}` }
beforeEach(() => {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) })
  vi.stubGlobal('navigator', { locks: { request: (_key: string, _options: unknown, action: (lock: object) => unknown) => action({}) } })
  mocks.request.mockReset().mockImplementation(async ({ method }) => {
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [scope.walletAddress]
    if (method === 'eth_chainId') return '0xaa36a7'
    if (method === 'eth_sendTransaction') return mocks.hash
    throw new Error(`Unexpected method ${method}`)
  })
  vi.stubGlobal('window', { ethereum: { request: mocks.request } })
  localStorage.setItem('world-id-user', JSON.stringify({ id: scope.userId, walletAddress: scope.walletAddress }))
  createWallet(scope)
  mocks.prepare.mockReset().mockResolvedValue([{ to: mocks.pool, data: '0x1234', value: 1000n }])
  mocks.receipt.mockReset().mockResolvedValue({ status: 'success' })
})
test('rejects excess decimal precision instead of rounding deposits', () => {
  expect(() => parseDepositAmount('USDC', '1.0000001')).toThrow()
  expect(parseDepositAmount('USDC', '1.000001')).toBe(1000001n)
})
test('saves the real submitted transaction before receipt confirmation', async () => {
  mocks.receipt.mockImplementation(async () => {
    expect(readDeposits(scope)[0].transactions[0].status).toBe('pending')
    return { status: 'success' }
  })
  await depositToPool(scope, 'ETH', '0.001', () => {})
  expect(mocks.prepare).toHaveBeenCalledWith({ asset: { __type: 'native' }, amount: 1000000000000000n })
  expect(readDeposits(scope)[0].status).toBe('confirmed')
})
test('a reverted deposit never records success', async () => {
  mocks.receipt.mockResolvedValue({ status: 'reverted' })
  await expect(depositToPool(scope, 'ETH', '0.001', () => {})).rejects.toThrow('reverted')
  expect(readDeposits(scope)[0].status).toBe('interrupted')
})
test('a receipt timeout preserves the pending hash for later reconciliation', async () => {
  mocks.receipt.mockRejectedValue(new Error('RPC timeout'))
  await expect(depositToPool(scope, 'ETH', '0.001', () => {})).rejects.toThrow('RPC timeout')
  expect(readDeposits(scope)[0].transactions[0]).toMatchObject({ hash: mocks.hash, status: 'pending' })
})
test('a switched funding wallet stops before sending a deposit', async () => {
  mocks.request.mockImplementation(async ({ method }) => method === 'eth_chainId' ? '0xaa36a7' : [`0x${'34'.repeat(20)}`])
  await expect(depositToPool(scope, 'ETH', '0.001', () => {})).rejects.toThrow('linked funding wallet')
  expect(mocks.prepare).not.toHaveBeenCalled()
})
