// wasm-bindgen can throw from its task queue instead of rejecting the promise.
// Capture prover traps while this operation is active so the UI/DB lock releases.
export function withProverErrorBoundary<T>(operation: () => Promise<T>): Promise<T> {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return operation()
  let cleanup = () => {}
  return new Promise<T>((resolve, reject) => {
    const onError = (event: ErrorEvent) => {
      const stack = String(event.error?.stack || '')
      if (!/url parse/i.test(event.message) && !/railgun.*wasm|index_bg\.wasm/i.test(stack)) return
      reject(new Error('The proof engine stopped unexpectedly. Reload this page and retry with the saved burner. No funding operation was submitted by this attempt.'))
    }
    window.addEventListener('error', onError)
    cleanup = () => window.removeEventListener('error', onError)
    Promise.resolve().then(operation).then(resolve, reject)
  }).finally(() => cleanup())
}
