import { Platform } from 'react-native'

const memoryStorage: Record<string, string> = {}

export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key)
      }
      return memoryStorage[key] ?? null
    } catch {
      return memoryStorage[key] ?? null
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value)
      }
      memoryStorage[key] = value
    } catch {
      memoryStorage[key] = value
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key)
      }
      delete memoryStorage[key]
    } catch {
      delete memoryStorage[key]
    }
  },
}

