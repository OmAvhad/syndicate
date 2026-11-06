import { expect, test, vi } from 'vitest'
import { artifactDownloadUrl, installArtifactFetch, artifactsReady } from '../src/lib/shielded/artifactFetch'
const source = 'https://github.com/Robert-MacWha/privacy-protocol-artifacts/raw/refs/heads/main/artifacts/'
test('only pinned circuits map to versioned self-hosted files', () => {
  expect(artifactDownloadUrl(source + 'railgun/01x02/wasm.br')).toBe('/proving-artifacts/5dd976e5dbf059daa227819df0d3054c83ccccd9/railgun/01x02/wasm.br.artifact')
  expect(artifactDownloadUrl(source + 'railgun/02x03/proving_key.bin.br')).toContain('/proving-artifacts/')
  expect(artifactDownloadUrl(source + 'railgun/99x99/wasm.br')).toBeNull()
  expect(artifactDownloadUrl('https://example.com/railgun/01x02/wasm.br')).toBeNull()
  expect(artifactDownloadUrl(source + '../secret')).toBeNull()
})
test('proof generation only reads cache; a missing file never triggers a download', async () => {
  const original = globalThis.fetch
  const bytes = new Uint8Array([1, 2, 3])
  const fetch = vi.fn().mockImplementation(async () => new Response(bytes))
  vi.stubGlobal('fetch', fetch)
  const cached = new Map<string, Response>()
  vi.stubGlobal('caches', { open: async () => ({ match: async (key: string) => cached.get(key)?.clone() }) })
  installArtifactFetch()
  installArtifactFetch()
  expect(await artifactsReady()).toBe(false)
  await expect(globalThis.fetch(source + 'railgun/01x02/matrices.bin.br')).rejects.toThrow('cache is incomplete')
  expect(fetch).not.toHaveBeenCalled()
  cached.set(artifactDownloadUrl(source + 'railgun/01x02/matrices.bin.br')!, new Response(bytes))
  const response = await globalThis.fetch(new Request(source + 'railgun/01x02/matrices.bin.br', { headers: { Accept: 'application/octet-stream' } }))
  expect(response).toBeInstanceOf(Response)
  expect(response.url).toBe(source + 'railgun/01x02/matrices.bin.br')
  expect(() => new URL(response.url)).not.toThrow()
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
  expect(fetch).not.toHaveBeenCalled()
  await globalThis.fetch('/rpc', { method: 'POST' })
  expect(fetch.mock.calls[0]).toEqual(['/rpc', { method: 'POST' }])
  globalThis.fetch = original
})
