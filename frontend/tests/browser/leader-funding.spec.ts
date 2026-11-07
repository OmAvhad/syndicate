import { test, expect } from '@playwright/test'

test('leader must load a shielded wallet before funding; no static burner is selected', async ({ page }) => {
  const user = { id: 'leader-empty-wallet', nullifierHash: 'human', walletAddress: `0x${'56'.repeat(20)}`, username: 'leader', createdAt: new Date().toISOString() }
  await page.addInitScript(user => {
    localStorage.setItem('world-id-token', 'browser-test')
    localStorage.setItem('world-id-user', JSON.stringify(user))
  }, user)
  await page.route('**/api/**', route => route.fulfill({ json: route.request().url().includes('/user/profile') ? user : { success: true, followers: [], signals: [] } }))
  await page.route('https://ethereum-sepolia-rpc.publicnode.com/**', async route => {
    const body = route.request().postDataJSON()
    const response = (request: { id: number; method: string }) => ({ jsonrpc: '2.0', id: request.id, result: request.method === 'eth_chainId' ? '0xaa36a7' : request.method === 'eth_gasPrice' ? '0x3b9aca00' : `0x${'0'.repeat(64)}` })
    await route.fulfill({ json: Array.isArray(body) ? body.map(response) : response(body) })
  })
  await page.goto('/trade')
  await expect(page.getByText('Your shielded trading balance', { exact: true })).toBeVisible()
  await expect(page.getByText('Create or restore your shielded wallet first.', { exact: true })).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('button', { name: 'Fund Burner, Commit Promise & Execute Trade' })).toBeDisabled()
  await expect(page.getByText('A new burner will be created automatically when you submit this trade. Its address will appear here.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Top up on dashboard' })).toHaveAttribute('href', '/')
  let artifactRequests = 0
  page.on('request', request => { if (request.url().includes('/proving-artifacts/')) artifactRequests++ })
  await page.getByRole('button', { name: /Prepare proof files \(/ }).click()
  await expect(page.getByText('Proof files · Ready', { exact: true })).toBeVisible({ timeout: 60000 })
  expect(artifactRequests).toBe(75)
  await page.reload()
  await expect(page.getByText('Proof files · Ready', { exact: true })).toBeVisible()
  expect(artifactRequests).toBe(75)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/leader-funding-mobile.png', fullPage: true })
})
