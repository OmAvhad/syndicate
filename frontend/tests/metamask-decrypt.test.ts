import { expect, test, vi } from 'vitest'
import { stringToHex } from 'viem'
import { decryptWithMetaMask } from '../src/lib/network'
const address = `0x${'12'.repeat(20)}`
const envelope = stringToHex(JSON.stringify({ version: 'x25519-xsalsa20-poly1305', nonce: btoa('n'.repeat(24)), ephemPublicKey: btoa('k'.repeat(32)), ciphertext: btoa('c'.repeat(32)) }))
test('wrong selected wallet is rejected before opening a decryption request', async () => {
  const request = vi.fn().mockResolvedValue([`0x${'34'.repeat(20)}`])
  vi.stubGlobal('window', { ethereum: { request } })
  await expect(decryptWithMetaMask(envelope, address)).rejects.toThrow('active account is different')
  expect(request).toHaveBeenCalledTimes(1)
})
test('malformed ciphertext never opens a MetaMask request', async () => {
  const request = vi.fn()
  vi.stubGlobal('window', { ethereum: { request } })
  await expect(decryptWithMetaMask('0x1234', address)).rejects.toThrow('invalid encrypted payload')
  expect(request).not.toHaveBeenCalled()
})
test('a valid request uses the intended follower and correct hex envelope', async () => {
  const request = vi.fn().mockImplementation(async ({ method }) => method === 'eth_requestAccounts' ? [address] : '{"amount":3}')
  vi.stubGlobal('window', { ethereum: { request } })
  expect(await decryptWithMetaMask(envelope, address)).toEqual({ amount: 3 })
  expect(request).toHaveBeenLastCalledWith({ method: 'eth_decrypt', params: [envelope, address] })
})
