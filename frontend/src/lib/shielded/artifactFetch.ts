import manifest from './artifactManifest.json'

const source = 'https://github.com/Robert-MacWha/privacy-protocol-artifacts/raw/refs/heads/main/artifacts/'
const cacheName = `syndicate-proofs-${manifest.revision}`
const paths = new Set(manifest.files.map(file => file.path))
export const artifactTotalBytes = manifest.files.reduce((sum, file) => sum + file.size, 0)
let installed = false
let preparing: Promise<void> | null = null
// Neutral extension prevents static servers from treating the payload itself as
// HTTP Brotli content-encoding. WASM performs its own Brotli decompression.
const localUrl = (path: string) => `${import.meta.env.BASE_URL || '/'}proving-artifacts/${manifest.revision}/${path}.artifact`

export function artifactDownloadUrl(url: string): string | null {
  if (!url.startsWith(source)) return null
  const path = url.slice(source.length)
  return paths.has(path) ? localUrl(path) : null
}

export async function artifactsReady(): Promise<boolean> {
  if (!globalThis.caches) return false
  const cache = await caches.open(cacheName)
  for (const file of manifest.files) if (!await cache.match(localUrl(file.path))) return false
  return true
}
export async function requireArtifactsReady(): Promise<void> {
  if (!await artifactsReady()) throw new Error('Prepare proof files on the trade page before submitting. Your burner is retained.')
}
export function prepareArtifacts(progress: (loaded: number, total: number, files: number) => void): Promise<void> {
  if (preparing) return preparing
  preparing = (async () => {
    if (!globalThis.caches) throw new Error('Persistent proof caching requires HTTPS or localhost and browser storage access.')
    const cache = await caches.open(cacheName)
    let loaded = 0, completed = 0, next = 0
    const results = await Promise.allSettled(Array.from({ length: 3 }, async () => {
      while (next < manifest.files.length) {
        const file = manifest.files[next++]
        const url = localUrl(file.path)
        if (!await cache.match(url)) {
          const response = await fetch(url)
          if (!response.ok) throw new Error(`Proof files unavailable (${response.status}). Run npm run artifacts:prepare in frontend and retry.`)
          const data = await response.arrayBuffer()
          if (data.byteLength !== file.size) throw new Error(`Invalid proof file: ${file.path}`)
          const header = new TextEncoder().encode(`blob ${data.byteLength}\0`)
          const bytes = new Uint8Array(header.length + data.byteLength)
          bytes.set(header); bytes.set(new Uint8Array(data), header.length)
          const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1', bytes))).map(b => b.toString(16).padStart(2, '0')).join('')
          if (digest !== file.blob) throw new Error(`Proof file integrity check failed: ${file.path}`)
          await cache.put(url, new Response(data, { headers: { 'Content-Type': 'application/octet-stream' } }))
        }
        loaded += file.size
        progress(loaded, artifactTotalBytes, ++completed)
      }
    }))
    const failed = results.find(result => result.status === 'rejected')
    if (failed?.status === 'rejected') throw failed.reason
    await requireArtifactsReady()
  })().finally(() => { preparing = null })
  return preparing
}

export function installArtifactFetch(): void {
  if (installed) return
  installed = true
  const originalFetch = globalThis.fetch.bind(globalThis)
  globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input)
    if (!url.startsWith(source)) return originalFetch(input, init)
    const local = artifactDownloadUrl(url)
    if (!local) throw new Error('This circuit is not in the pinned proof file set.')
    const cached = globalThis.caches ? await (await caches.open(cacheName)).match(local) : undefined
    if (!cached) throw new Error('Proof file cache is incomplete. Prepare proof files again before submitting.')
    // Cache Storage responses constructed from verified bytes have an empty URL.
    // reqwest/WASM parses Response.url even when it only needs the body; an empty
    // string traps outside its promise. Preserve the SDK's absolute request URL.
    Object.defineProperty(cached, 'url', { value: url, configurable: true })
    return cached
  }
}
