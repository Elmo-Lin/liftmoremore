import { BRAND } from '../config/brand'

export const STORAGE_KEYS = {
  data: `${BRAND.storagePrefix}:data:v1`,
  session: `${BRAND.storagePrefix}:session:v1`,
} as const

/** Offline demo: each demo workspace keeps its own data (the studio uses the original key). */
export const dataKey = (space?: 'studio' | 'solo' | 'self') => (!space || space === 'studio' ? STORAGE_KEYS.data : `${BRAND.storagePrefix}:data:${space}:v1`)

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
