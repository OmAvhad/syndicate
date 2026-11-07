import { beforeEach, afterEach, expect, it, vi } from 'vitest'
const fakes = vi.hoisted(() => ({ send: vi.fn(), receipt: vi.fn(), wait: vi.fn(), prepare: vi.fn(), sign: vi.fn(), read: vi.fn(), post: vi.fn(), getBalance: vi.fn() }))
vi.mock('../src/lib/api', () => ({ default: { defaults: { baseURL: 'http://localhost:3001' }, post: fakes.post } }))
vi.mock('../src/lib/baseBurner', () => ({
  BASE_MAINNET_RPC: 'http://localhost:9999', BASE_USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', BASE_WETH: '0x4200000000000000000000000000000000000006',
  baseTradeStorageKey: (address: string) => address, ensureBaseMainnetNetwork: vi.fn(),
  baseMainnetPublicClient: { readContract: fakes.read, getBalance: fakes.getBalance },
}))
vi.mock('viem/account-abstraction', () => ({
  entryPoint08Address: '0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108',
  getUserOperationHash: () => `0x${'aa'.repeat(32)}`,
  toSimple7702SmartAccount: async () => ({ isDeployed: async () => true, signUserOperation: fakes.sign }),
  createBundlerClient: () => ({ getSupportedEntryPoints: async () => ['0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108'], getUserOperationReceipt: fakes.receipt, sendUserOperation: fakes.send, waitForUserOperationReceipt: fakes.wait, prepareUserOperation: fakes.prepare }),
}))
import { prepareBaseUserOperation } from '../src/lib/basePimlico'
import { BASE_USDC, BASE_WETH } from '../src/lib/baseBurner'
import { decodeFunctionData, erc20Abi } from 'viem'
beforeEach(() => {
  vi.clearAllMocks()
  const state = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => state.get(key) ?? null, setItem: (key: string, value: string) => state.set(key, value) })
  fakes.post.mockImplementation(async (url: string) => ({ data: url.includes('/session') ? { path: '/api/pool/bundler/test' } : { result: { fast: { maxFeePerGas: '0x2', maxPriorityFeePerGas: '0x1' } } } }))
  fakes.read.mockResolvedValue(500000n)
  fakes.getBalance.mockResolvedValue(50000000000000n)
  fakes.prepare.mockResolvedValue({ sender: '0x1111111111111111111111111111111111111111', callGasLimit: 100000n, verificationGasLimit: 100000n, preVerificationGas: 50000n, maxFeePerGas: 2n })
  fakes.sign.mockResolvedValue('0x1234')
  fakes.receipt.mockResolvedValue(null)
  fakes.send.mockResolvedValue(`0x${'aa'.repeat(32)}`)
  fakes.wait.mockResolvedValue({ success: true, userOpHash: `0x${'aa'.repeat(32)}`, receipt: { transactionHash: `0x${'bb'.repeat(32)}` } })
})
afterEach(() => vi.unstubAllGlobals())
const testKey = `0x${'01'.repeat(32)}` as const
it('batches USDC entry and WETH protection approvals in a burner-signed UserOperation and reuses its saved bytes on retry', async () => {
  const result = await prepareBaseUserOperation(testKey, BASE_USDC, 500000n, 200000000000000n)
  const { calls } = fakes.prepare.mock.calls[0][0]
  expect(calls.map((call: { to: string }) => call.to)).toEqual([BASE_USDC, BASE_WETH])
  expect(decodeFunctionData({ abi: erc20Abi, data: calls[0].data }).args).toEqual(['0x5d00000873b6BF41539e6f5365B0Ff7d3c368f78', 500000n])
  expect(result.transactionHash).toBe(`0x${'bb'.repeat(32)}`)
  expect(fakes.sign).toHaveBeenCalledOnce()
  const signed = fakes.send.mock.calls[0][0]
  await prepareBaseUserOperation(testKey, BASE_USDC, 500000n, 200000000000000n)
  expect(fakes.send.mock.calls[1][0]).toEqual(signed)
  expect(fakes.prepare).toHaveBeenCalledOnce()
  expect(fakes.sign).toHaveBeenCalledOnce()
})
it('stops before signing or submission when the burner cannot cover the estimated gas budget', async () => {
  fakes.getBalance.mockResolvedValue(0n)
  await expect(prepareBaseUserOperation(testKey, BASE_USDC, 500000n)).rejects.toThrow('more Base ETH')
  expect(fakes.send).not.toHaveBeenCalled()
  expect(fakes.sign).not.toHaveBeenCalled()
})
