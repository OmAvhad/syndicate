import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn(), receipt: vi.fn(), sign: vi.fn(), request: vi.fn() }))
vi.mock('viem', async () => ({ ...await vi.importActual('viem'), createWalletClient: () => ({ writeContract: mocks.write, signTypedData: mocks.sign }) }))
vi.mock('../src/lib/baseBurner', () => ({ BASE_WETH: '0x4200000000000000000000000000000000000006', ensureBaseMainnetNetwork: async () => true, baseTradeStorageKey: (address: string) => address, baseMainnetPublicClient: { readContract: mocks.read, waitForTransactionReceipt: mocks.receipt } }))
vi.mock('../src/lib/basePimlico', () => ({ readBaseTrade: () => ({}) }))
import { BASE_LEADER_WALLET, prepareDirectBaseTrade, signBaseWalletOrder } from '../src/lib/directBaseWallet'
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('window', { ethereum: { request: mocks.request } })
  mocks.request.mockResolvedValue([BASE_LEADER_WALLET])
  mocks.read.mockImplementation(async ({ functionName }) => functionName === 'balanceOf' ? 500000n : 0n)
  mocks.write.mockResolvedValue(`0x${'aa'.repeat(32)}`)
  mocks.receipt.mockResolvedValue({ status: 'success' })
  mocks.sign.mockResolvedValue('0x1234')
})
afterEach(() => vi.unstubAllGlobals())
it('approves entry and protection directly from the fixed wallet without sending funding transfers', async () => {
  await prepareDirectBaseTrade(BASE_LEADER_WALLET, USDC, 500000n, 200000000000000n)
  expect(mocks.write).toHaveBeenCalledTimes(2)
  expect(mocks.write.mock.calls[0][0]).toMatchObject({ address: USDC, functionName: 'approve', args: ['0x5d00000873b6BF41539e6f5365B0Ff7d3c368f78', 500000n] })
  expect(mocks.write.mock.calls[1][0].args[1]).toBe(400000000000000n)
  expect(mocks.request.mock.calls.every(([request]) => request.method === 'eth_requestAccounts')).toBe(true)
})
it('rejects the wrong MetaMask account before approvals or signatures', async () => {
  mocks.request.mockResolvedValue(['0x2222222222222222222222222222222222222222'])
  await expect(prepareDirectBaseTrade(BASE_LEADER_WALLET, USDC, 500000n)).rejects.toThrow('Select')
  await expect(signBaseWalletOrder(BASE_LEADER_WALLET, '{}')).rejects.toThrow('Select')
  expect(mocks.write).not.toHaveBeenCalled()
  expect(mocks.sign).not.toHaveBeenCalled()
})
it('stops when the fixed wallet lacks tokens instead of funding it', async () => {
  mocks.read.mockResolvedValue(0n)
  await expect(prepareDirectBaseTrade(BASE_LEADER_WALLET, USDC, 500000n)).rejects.toThrow('Fund this address externally')
  expect(mocks.write).not.toHaveBeenCalled()
})
