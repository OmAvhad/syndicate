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


test('Base history reconciles live protective results and uses Base receipts without manual demo exits', async ({ page }) => {
  const user = { id: 'base-history', username: 'base', walletAddress: `0x${'12'.repeat(20)}`, createdAt: new Date().toISOString() }
  const hash = `0x${'ab'.repeat(32)}`
  const trade = { _id: '333333333333333333333333', network: 'BASE_MAINNET', side: 'BUY', symbol: 'WETH/USDC', tradeIndex: 1, createdAt: user.createdAt, status: 'EXECUTED', receiptsVerified: true, entryUsdcUnits: '500000', wethUnits: '200000000000000', target: 2001, stopLoss: 1999, promiseId: 'promise-base', executionTxHash: hash }
  await page.addInitScript(user => { localStorage.setItem('world-id-token', 'test'); localStorage.setItem('world-id-user', JSON.stringify(user)) }, user)
  await page.route('**/api/**', route => {
    const url = route.request().url()
    let data: unknown = { success: true, signals: [] }
    if (url.includes('/user/profile')) data = user
    if (url.includes('/trades/history')) data = { total: 1, trades: [trade] }
    if (url.includes('/sync-base')) data = { success: true, trade: { ...trade, status: 'CLOSED', exitType: 'protective', exitUsdcUnits: '480000', realizedPnlUnits: '-20000', closedAt: user.createdAt, exitPayoutTxHash: `0x${'cd'.repeat(32)}` } }
    if (url.includes('/claims/status')) data = { statuses: { [trade._id]: null } }
    return route.fulfill({ json: data })
  })
  await page.goto('/history')
  await expect(page.getByText('-0.02 USDC', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Entry settlement receipt' })).toHaveAttribute('href', `https://basescan.org/tx/${hash}`)
  await expect(page.getByRole('button', { name: /Bull exit|Bear exit/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Claim Promise', exact: true })).toBeEnabled()
})


test('Base terminal shows the fixed wallet and executes directly without funding controls', async ({ page }) => {
  const user = { id: 'base-terminal', username: 'leader', walletAddress: `0x${'12'.repeat(20)}`, createdAt: new Date().toISOString() }
  await page.addInitScript(user => { localStorage.setItem('world-id-token', 'test'); localStorage.setItem('world-id-user', JSON.stringify(user)) }, user)
  await page.route('**/api/**', route => route.fulfill({ json: route.request().url().includes('/user/profile') ? user : { success: true, signals: [], followers: [] } }))
  await page.route('https://mainnet.base.org/**', route => {
    const request = route.request().postDataJSON()
    return route.fulfill({ json: { jsonrpc: '2.0', id: request.id, result: request.method === 'eth_chainId' ? '0x2105' : `0x${'0'.repeat(64)}` } })
  })
  await page.route('https://flash.definitive.fi/v1/quote', route => {
    const request = route.request().postDataJSON()
    return route.fulfill({ json: { quoteId: 'quote-test', from: { amount: '0.5' }, to: { amount: '0.0002', notional: '0.4' }, ...(request.attachedBracket ? { attachedBracket: { evm: { orderTypedData: '{}' } } } : {}) } })
  })
  await page.goto('/trade')
  await expect(page.getByRole('button', { name: 'Execute 0.50 USDC via Definitive' })).toBeEnabled()
  await expect(page.getByRole('link', { name: '0x4DF9aB442f076cf039B0C322Aae89Cc4990dE50D', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Add demo gas|Fund Burner|Sweep Funds/ })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Prototype funding route' })).toHaveCount(0)
  await expect(page.locator('input[value="2001.0000"]')).toHaveAttribute('readonly', '')
  await expect(page.locator('input[value="1999.0000"]')).toHaveAttribute('readonly', '')
  await expect(page.getByText('Your shielded trading balance', { exact: true })).toHaveCount(0)
})
