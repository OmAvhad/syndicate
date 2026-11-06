import { expect, test, vi } from 'vitest'
import { createQueuedRpc, isRateLimited } from '../src/lib/sepoliaRpc'
test('concurrent duplicate chain reads share a request; gas price is briefly cached', async () => {
  const upstream = vi.fn().mockResolvedValue('0x123')
  const rpc = createQueuedRpc(upstream, async () => {})
  const args = { method: 'eth_gasPrice', params: [] }
  expect(await Promise.all([rpc(args), rpc(args)])).toEqual(['0x123', '0x123'])
  await rpc(args)
  expect(upstream).toHaveBeenCalledTimes(1)
})
test('429 triggers backoff and does not overlap another chain request', async () => {
  const wait = vi.fn().mockResolvedValue(undefined)
  const upstream = vi.fn().mockRejectedValueOnce({ status: 429 }).mockResolvedValue('ok')
  const rpc = createQueuedRpc(upstream, wait)
  expect(await rpc({ method: 'eth_getLogs', params: [] })).toBe('ok')
  expect(wait).toHaveBeenCalledWith(2000)
  expect(upstream).toHaveBeenCalledTimes(2)
})
test('persistent throttling stops with an actionable error and never caches the failure', async () => {
  const upstream = vi.fn().mockRejectedValue({ cause: { status: 429 } })
  const rpc = createQueuedRpc(upstream, async () => {})
  await expect(rpc({ method: 'eth_blockNumber' })).rejects.toThrow('rate limited')
  expect(upstream).toHaveBeenCalledTimes(5)
  expect(isRateLimited({ message: 'execution reverted' })).toBe(false)
})
