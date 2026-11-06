import { test, expect } from '@playwright/test'
test('history shows both roles, actual P/L, exits and Arkiv claim state', async ({ page }) => {
  const user = { id: 'history-test', username: 'history', nullifierHash: 'human', walletAddress: `0x${'12'.repeat(20)}`, createdAt: new Date().toISOString() }
  const leaderId = '111111111111111111111111'
  const copyId = '222222222222222222222222'
  let claimed = false
  await page.addInitScript(user => { localStorage.setItem('world-id-token', 'test'); localStorage.setItem('world-id-user', JSON.stringify(user)) }, user)
  await page.route('**/api/**', route => {
    const url = route.request().url()
    let data: unknown = { success: true, signals: [] }
    if (url.includes('/user/profile')) data = user
    if (url.includes('/trades/history')) data = { total: 2, trades: [
      { _id: leaderId, tradeIndex: 1, symbol: 'ETH/USDC', status: 'CLOSED', side: 'BUY', createdAt: user.createdAt, entryUsdcUnits: '3000000', exitUsdcUnits: '3341000', realizedPnlUnits: '341000', receiptsVerified: true, promiseId: 'pretrade' },
      { _id: copyId, isCopyTrade: true, tradeIndex: 1, symbol: 'ETH/USDC', status: 'EXECUTED', side: 'BUY', createdAt: user.createdAt, entryUsdcUnits: '2000000', receiptsVerified: true, target: 3350, stopLoss: 2800 },
    ] }
    if (url.includes('/claims/status')) data = { statuses: { [leaderId]: claimed ? '0xclaim' : null, [copyId]: null } }
    if (url.endsWith('/claim')) { claimed = true; data = { success: true, entityKey: '0xclaim' } }
    return route.fulfill({ json: data })
  })
  await page.goto('/history')
  await expect(page.getByText('Leader trade #1 · ETH/USDC')).toBeVisible()
  await expect(page.getByText('Follower copy #1 · ETH/USDC')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Bull exit · $3350' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Bear exit · $2800' })).toBeVisible()
  await expect(page.getByText('0.341 USDC', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Claim Promise', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Promise claimed', exact: true })).toBeDisabled()
  expect(claimed).toBe(true)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
