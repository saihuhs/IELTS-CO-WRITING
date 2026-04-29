import { useState } from 'react'
import { Settings, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApiSettings } from '@/contexts/ApiSettingsContext'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { settings, updateSettings, isConfigured } = useApiSettings()
  const [local, setLocal] = useState(settings)
  const [showKey, setShowKey] = useState(false)

  if (!open) return null

  const handleSave = () => {
    updateSettings(local)
    onClose()
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm animate-fade-in"
      onClick={handleOverlayClick}
    >
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
            <Settings className="h-4 w-4 text-secondary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold font-serif text-foreground">API Settings</h2>
            <div className="flex items-center gap-1.5">
              <div className={`h-1.5 w-1.5 rounded-full ${isConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="text-xs text-muted-foreground">
                {isConfigured ? 'Configured' : 'Not configured'}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">API Base URL</label>
            <input
              type="text"
              value={local.baseUrl}
              onChange={(e) => setLocal({ ...local, baseUrl: e.target.value })}
              placeholder="https://api.deepseek.com/v1"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground">OpenAI-compatible endpoint</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">API Key</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={local.apiKey}
                onChange={(e) => setLocal({ ...local, apiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full rounded-md border bg-background px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Stored locally, never sent to any server except your configured API</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Model</label>
            <input
              type="text"
              value={local.model}
              onChange={(e) => setLocal({ ...local, model: e.target.value })}
              placeholder="deepseek-chat"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground">e.g. deepseek-chat, gpt-4o, claude-3-5-sonnet</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave}>Save</Button>
        </div>
      </div>
    </div>
  )
}
