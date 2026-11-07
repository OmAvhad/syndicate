import { custom, http } from 'viem'
import { sepolia } from 'viem/chains'

export const SEPOLIA_RPC_URL = import.meta.env.VITE_SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'
const upstream = http(SEPOLIA_RPC_URL, { timeout: 30_000, retryCount: 0 })({ chain: sepolia })
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export function isRateLimited(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { status?: number; code?: number; message?: string; details?: string; cause?: unknown }
  return e.status === 429 || e.code === -32005 || /\b429\b|rate.?limit|too many requests/i.test(`${e.message || ''} ${e.details || ''}`) || (!!e.cause && e.cause !== error && isRateLimited(e.cause))
}

export function createQueuedRpc(request: (args: { method: string; params?: unknown }) => Promise<unknown>, wait = pause) {
  let queue: Promise<unknown> = Promise.resolve()
  let lastRequest = 0
  const pending = new Map<string, Promise<unknown>>()
  const cache = new Map<string, { value: unknown; until: number }>()
  return async (args: { method: string; params?: unknown }) => {
    const read = !/send|sign|wallet_/i.test(args.method)
    const key = JSON.stringify(args)
    const ttl = args.method === 'eth_chainId' ? 60_000 : args.method === 'eth_gasPrice' ? 10_000 : args.method === 'eth_blockNumber' ? 1_000 : 0
    const saved = cache.get(key)
    if (ttl && saved && saved.until > Date.now()) return saved.value
    if (read && pending.has(key)) return pending.get(key)
    const work = queue.catch(() => {}).then(async () => {
      await wait(Math.max(0, 400 - (Date.now() - lastRequest)))
      for (let attempt = 0; ; attempt++) {
        lastRequest = Date.now()
        try {
          const value = await request(args)
          if (ttl) cache.set(key, { value, until: Date.now() + ttl })
          notify('')
          return value
        } catch (error) {
          if (!isRateLimited(error)) { notify(''); throw error }
          if (attempt === 4) {
            notify('Sepolia RPC remains rate limited; automatic retries stopped.')
            throw new Error('Sepolia RPC remains rate limited (429). Your burner is saved. Wait before retrying or configure VITE_SEPOLIA_RPC_URL with a dedicated provider.')
          }
          const delay = 2_000 * 2 ** attempt
          notify(`Sepolia RPC rate limited; retrying in ${delay / 1000}s…`)
          await wait(delay)
        }
      }
    })
    queue = work
    if (read) pending.set(key, work)
    try { return await work } finally { if (read) pending.delete(key) }
  }
}
function notify(message: string) {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') window.dispatchEvent(new CustomEvent('syndicate:rpc-status', { detail: message }))
}
const request = createQueuedRpc(args => upstream.request(args as Parameters<typeof upstream.request>[0]))
export const sepoliaTransport = () => custom({ request: request as Parameters<typeof custom>[0]['request'] }, { retryCount: 0 })
