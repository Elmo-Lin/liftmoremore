import { BRAND } from '../config/brand'

export const STORAGE_KEYS = {
  data: `${BRAND.storagePrefix}:data:v1`,
  session: `${BRAND.storagePrefix}:session:v1`,
} as const

export function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeJSON(key: string, value: unknown) {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
