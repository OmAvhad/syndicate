import { storage } from '../utils/storage'

export const DEFAULT_BACKEND_URL = 'https://syndicate-backend-n3p9.onrender.com'

let currentBackendUrl = DEFAULT_BACKEND_URL

export async function getBackendUrl(): Promise<string> {
  try {
    const saved = await storage.getItem('syndicate_backend_url')
    if (saved && saved.startsWith('http')) {
      currentBackendUrl = saved.replace(/\/+$/, '')
      return currentBackendUrl
    }
  } catch {
    // fallback
  }
  return DEFAULT_BACKEND_URL
}

export async function setBackendUrl(url: string): Promise<void> {
  const clean = url.trim().replace(/\/+$/, '')
  currentBackendUrl = clean
  await storage.setItem('syndicate_backend_url', clean)
}

export function getCurrentBackendUrl(): string {
  return currentBackendUrl
}
