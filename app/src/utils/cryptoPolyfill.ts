import * as Crypto from 'expo-crypto'
import { configureIDKitRuntime } from '@worldcoin/idkit-core'

export function safeGetRandomValues<T extends Uint8Array>(array: T): T {
  try {
    return Crypto.getRandomValues(array)
  } catch {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256)
    }
    return array
  }
}

export function setupCryptoPolyfill() {
  if (typeof globalThis !== 'undefined') {
    if (!globalThis.crypto) {
      // @ts-ignore
      globalThis.crypto = {}
    }
    if (!globalThis.crypto.getRandomValues) {
      // @ts-ignore
      globalThis.crypto.getRandomValues = safeGetRandomValues
    }
  }

  try {
    configureIDKitRuntime({
      getRandomValues: safeGetRandomValues,
    })
  } catch (err) {
    console.warn('[CryptoPolyfill] configureIDKitRuntime error:', err)
  }
}

// Immediately run on import
setupCryptoPolyfill()

