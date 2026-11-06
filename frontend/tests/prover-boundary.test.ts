import { expect, test, vi } from 'vitest'
import { withProverErrorBoundary } from '../src/lib/shielded/proverBoundary'
test('uncaught WASM URL trap rejects the waiting operation and removes its listener', async () => {
  let listener: ((event: unknown) => void) | undefined
  const remove = vi.fn()
  vi.stubGlobal('window', { addEventListener: (_name: string, fn: (event: unknown) => void) => { listener = fn }, removeEventListener: remove })
  const pending = withProverErrorBoundary(() => new Promise(() => {}))
  listener!({ message: 'Uncaught Error: url parse', error: new Error('url parse') })
  await expect(pending).rejects.toThrow('Reload this page')
  expect(remove).toHaveBeenCalledWith('error', listener)
})
test('successful proof operations remove their listener', async () => {
  const remove = vi.fn()
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: remove })
  expect(await withProverErrorBoundary(async () => 42)).toBe(42)
  expect(remove).toHaveBeenCalledTimes(1)
})
