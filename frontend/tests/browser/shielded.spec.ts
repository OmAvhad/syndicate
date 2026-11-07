import { test, expect } from '@playwright/test'

test('dashboard creates a persistent real shielded address and renders on mobile', async ({ page }) => {
  const user = { id: 'pool-browser-review', nullifierHash: 'test-human', walletAddress: `0x${'12'.repeat(20)}`, username: 'review', createdAt: new Date().toISOString() }
  await page.addInitScript(user => {
    if (!localStorage.getItem('world-id-token')) {
      localStorage.setItem('world-id-token', 'browser-test')
      localStorage.setItem('world-id-user', JSON.stringify(user))
    }
  }, user)
  await page.route('**/api/**', route => route.fulfill({ json: route.request().url().includes('/user/profile') ? user : { success: true, following: [], followers: [], signals: [] } }))
  await page.route('https://ethereum-sepolia-rpc.publicnode.com/**', async route => {
    const request = route.request().postDataJSON()
    await route.fulfill({ json: { jsonrpc: '2.0', id: request.id, result: '0xaa36a7' } })
  })
  await page.goto('/')
  await expect(page.getByText('Your shielded funds', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Create shielded wallet' }).click()
  await expect(page.getByText('Your shielded wallet is saved on this device.', { exact: false })).toBeVisible({ timeout: 45000 })
  const address = await page.locator('p.mono').filter({ hasText: /^0zk/ }).textContent()
  expect(address).toMatch(/^0zk/)
  await page.reload()
  await expect(page.getByText(address!, { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Load funds', exact: true })).toBeDisabled()
  await page.getByLabel('Amount to deposit').fill('0.001')
  await expect(page.getByRole('button', { name: 'Load funds', exact: true })).toBeEnabled()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/shielded-dashboard-mobile.png', fullPage: true })
})
