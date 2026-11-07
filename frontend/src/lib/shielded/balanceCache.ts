import { readWallet, scopeKey, type PoolScope } from './storage'
import type { PoolView } from './pool'

export function readCachedBalance(scope: PoolScope): PoolView | null {
  try {
    const wallet = readWallet(scope)
    const raw = localStorage.getItem(`${scopeKey(scope)}:balance`)
    if (!wallet?.shieldedAddress || !raw) return null
    const view = JSON.parse(raw) as PoolView
    if (view.address !== wallet.shieldedAddress || !Array.isArray(view.balances) || !Number.isFinite(Date.parse(view.syncedAt))) return null
    return view
  } catch { return null }
}
export function cacheBalance(scope: PoolScope, view: PoolView) {
  localStorage.setItem(`${scopeKey(scope)}:balance`, JSON.stringify(view))
}
export function invalidateCachedBalance(scope: PoolScope) {
  localStorage.setItem(`${scopeKey(scope)}:balance`, '')
}
