import 'fake-indexeddb/auto'
import { beforeEach, expect, test, vi } from 'vitest'
import { createWallet, saveWallet } from '../src/lib/shielded/storage'
import { invalidateCachedBalance, readCachedBalance } from '../src/lib/shielded/balanceCache'
const mocks = vi.hoisted(() => ({ notes: vi.fn(), balance: vi.fn(), lock: vi.fn() }))
vi.mock('@kohaku-eth/provider/viem', () => ({ viem: () => ({}) }))
vi.mock('@kohaku-eth/railgun', () => ({
  ensureInitialized: async () => {},
  createRailgunPlugin: async () => ({ instanceId: async () => '0zk-test', notes: mocks.notes, balance: mocks.balance }),
}))
import { syncPool, POOL_TOKENS } from '../src/lib/shielded/pool'
const scope = { userId: 'sync-user', walletAddress: `0x${'12'.repeat(20)}` }
beforeEach(() => {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) })
  mocks.lock.mockReset().mockImplementation((_key, _options, fn) => Promise.resolve().then(() => fn({})))
  vi.stubGlobal('navigator', { locks: { request: mocks.lock } })
  const wallet = createWallet(scope)
  saveWallet(scope, { ...wallet, shieldedAddress: '0zk-test' })
  mocks.balance.mockReset()
  mocks.notes.mockReset().mockResolvedValue([
    { asset: { __type: 'erc20', contract: POOL_TOKENS.USDC.address }, amount: 1_000_000n },
    { asset: { __type: 'erc20', contract: POOL_TOKENS.USDC.address }, amount: 2_000_000n },
  ])
})
test('overlapping StrictMode refreshes share one sync and wait for the lock', async () => {
  const first = syncPool(scope)
  const duplicate = syncPool(scope)
  expect(first).toBe(duplicate)
  const view = await first
  expect(mocks.notes).toHaveBeenCalledTimes(1)
  expect(mocks.balance).not.toHaveBeenCalled()
  expect(mocks.lock.mock.calls[0][1]).toEqual({ mode: 'exclusive' })
  expect(view.balances.find(b => b.symbol === 'USDC')).toMatchObject({ amount: '3', notes: 2 })
})
test('recent page navigation uses cached data; manual refresh and invalidation force syncing', async () => {
  await syncPool(scope)
  expect(readCachedBalance(scope)?.balances[1].amount).toBe('3')
  await syncPool(scope)
  expect(mocks.notes).toHaveBeenCalledTimes(1)
  await syncPool(scope, { force: true })
  expect(mocks.notes).toHaveBeenCalledTimes(2)
  invalidateCachedBalance(scope)
  expect(readCachedBalance(scope)).toBeNull()
  await syncPool(scope)
  expect(mocks.notes).toHaveBeenCalledTimes(3)
})
