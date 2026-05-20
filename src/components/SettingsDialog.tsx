import { useEffect, useMemo, useRef, useState } from 'react'
import { Settings, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApiSettings } from '@/contexts/ApiSettingsContext'
import { measureAutocompleteTTFT } from '@/lib/editor-api'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { settings, updateSettings, isConfigured } = useApiSettings()
  const [local, setLocal] = useState(settings)
  const [showKey, setShowKey] = useState(false)
  useEffect(() => {
    if (open) setLocal(settings)
  }, [open, settings])

  const getConnTip = (message: string) => {
    const lower = message.toLowerCase()
    if (lower.includes('429')) return '429 通常表示触发了限流/配额；自动补全是高频请求，更容易被限流。'
    if (lower.includes('401')) return '401 通常表示 API Key 无效/过期或没有权限访问该模型。'
    if (lower.includes('timeout')) return 'Timeout 通常表示网络/模型拥堵导致首 token 迟迟未返回。'
    if (lower.includes('no content token received')) {
      return '探测请求收到了结束信号，但没有拿到任何可展示的生成 token：常见原因是 stream/SSE 返回格式不兼容、内容字段不在 delta.content、或链路拦截了流式数据。'
    }
    return '如果评分正常但写作时没有自动补全，常见原因是该接口对 stream/SSE 支持不完整或被网络拦截；可尝试更换模型或降低补全频率。'
  }

  const localConfigured = local.apiKey.trim().length > 0

  const [conn, setConn] = useState<
    | { status: 'idle' }
    | { status: 'testing' }
    | { status: 'ok'; ttftMs: number }
    | { status: 'slow'; ttftMs: number }
    | { status: 'error'; message: string }
  >({ status: 'idle' })

  const connKey = useMemo(() => {
    const keyLen = local.apiKey.trim().length
    return `${local.baseUrl}|${local.model}|${keyLen}`
  }, [local.baseUrl, local.model, local.apiKey])

  const lastProbeRef = useRef<{ key: string; at: number } | null>(null)

  useEffect(() => {
    if (!open) return
    if (!localConfigured) {
      setConn({ status: 'idle' })
      return
    }

    const now = Date.now()
    if (lastProbeRef.current?.key === connKey && now - lastProbeRef.current.at < 60 * 1000) return
    lastProbeRef.current = { key: connKey, at: now }

    const controller = new AbortController()
    setConn({ status: 'testing' })

    const timeout = window.setTimeout(() => {
      measureAutocompleteTTFT(local, null, controller.signal, 8000)
        .then((r) => {
          if ('ttftMs' in r) {
            if (r.ttftMs >= 2500) setConn({ status: 'slow', ttftMs: r.ttftMs })
            else setConn({ status: 'ok', ttftMs: r.ttftMs })
          } else {
            setConn({ status: 'error', message: r.error })
          }
        })
        .catch((e: any) => setConn({ status: 'error', message: e?.message || 'Unknown error' }))
    }, 500)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [open, localConfigured, connKey, local])

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
            <div className="relative flex items-center gap-1.5 group">
              {!localConfigured ? (
                <>
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <span className="text-xs text-muted-foreground">Not configured</span>
                </>
              ) : conn.status === 'testing' ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Checking...</span>
                </>
              ) : conn.status === 'ok' ? (
                <>
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="text-xs text-muted-foreground">
                    Connected · ~{Math.round(conn.ttftMs / 100) / 10}s
                  </span>
                </>
              ) : conn.status === 'slow' ? (
                <>
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <span className="text-xs text-muted-foreground">
                    Slow · ~{Math.round(conn.ttftMs / 100) / 10}s
                  </span>
                </>
              ) : conn.status === 'error' ? (
                <>
                  <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
                  <span className="text-xs text-muted-foreground">Error</span>
                </>
              ) : (
                <>
                  <div className={`h-1.5 w-1.5 rounded-full ${isConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span className="text-xs text-muted-foreground">
                    {isConfigured ? 'Configured' : 'Not configured'}
                  </span>
                </>
              )}

              {conn.status === 'error' && conn.message && (
                <div className="absolute left-0 top-full mt-2 hidden w-[340px] rounded-md border bg-popover p-2 text-[11px] text-muted-foreground shadow-lg group-hover:block z-50">
                  <div className="text-foreground font-medium">Connection check failed</div>
                  <div className="mt-1 break-words">{conn.message}</div>
                  <div className="mt-2 break-words">Base URL: {local.baseUrl}</div>
                  <div className="break-words">Model: {local.model}</div>
                  <div className="mt-2 break-words">
                    Tip: {getConnTip(conn.message)}
                  </div>
                </div>
              )}
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
