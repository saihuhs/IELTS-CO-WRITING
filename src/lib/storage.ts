import type { ApiSettings, SavedSession } from '@/types'

const API_SETTINGS_KEY = 'ielts-api-settings'
const COLLECTIONS_KEY = 'ielts-collections'

const DEFAULT_SETTINGS: ApiSettings = {
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  model: 'deepseek-chat',
}

export function loadApiSettings(): ApiSettings {
  try {
    const raw = localStorage.getItem(API_SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveApiSettings(settings: ApiSettings): void {
  localStorage.setItem(API_SETTINGS_KEY, JSON.stringify(settings))
}

export function loadCollections(): SavedSession[] {
  try {
    const raw = localStorage.getItem(COLLECTIONS_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export function addCollection(session: SavedSession): void {
  const existing = loadCollections()
  existing.unshift(session)
  try {
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(existing))
  } catch {
    throw new Error('Storage is full. Delete some saved sessions to make room.')
  }
}

export function removeCollection(id: string): void {
  const existing = loadCollections()
  const filtered = existing.filter((s) => s.id !== id)
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(filtered))
}

export function updateCollectionMeta(
  id: string,
  meta: { title?: string },
): SavedSession | null {
  const existing = loadCollections()
  let updated: SavedSession | null = null
  const next = existing.map((s) => {
    if (s.id !== id) return s
    updated = { ...s, ...meta }
    return updated
  })
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(next))
  return updated
}
