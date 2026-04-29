import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { ApiSettings } from '@/types'
import { loadApiSettings, saveApiSettings } from '@/lib/storage'

interface ApiSettingsContextValue {
  settings: ApiSettings
  updateSettings: (partial: Partial<ApiSettings>) => void
  isConfigured: boolean
}

const ApiSettingsContext = createContext<ApiSettingsContextValue | null>(null)

export function ApiSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ApiSettings>(loadApiSettings)

  const isConfigured = settings.apiKey.trim().length > 0

  const updateSettings = (partial: Partial<ApiSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }))
  }

  useEffect(() => {
    saveApiSettings(settings)
  }, [settings])

  return (
    <ApiSettingsContext.Provider value={{ settings, updateSettings, isConfigured }}>
      {children}
    </ApiSettingsContext.Provider>
  )
}

export function useApiSettings() {
  const ctx = useContext(ApiSettingsContext)
  if (!ctx) throw new Error('useApiSettings must be used within ApiSettingsProvider')
  return ctx
}
