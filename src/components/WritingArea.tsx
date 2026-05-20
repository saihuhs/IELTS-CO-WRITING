import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Clock, RotateCcw, Sparkles, Loader2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Topic } from '@/types'
import { IeltsEditor } from '@/components/editor/IeltsEditor'
import type { IeltsEditorHandle } from '@/components/editor/IeltsEditor'
import { useApiSettings } from '@/contexts/ApiSettingsContext'
import { measureAutocompleteTTFT } from '@/lib/editor-api'

interface WritingAreaProps {
  topic: Topic | null
  selectedTaskType: 'task1' | 'task2'
  essay: string
  onEssayChange: (value: string) => void
  onRequestScore: () => void
  isScoring: boolean
  isConfigured: boolean
}

export function WritingArea({ topic, selectedTaskType, essay, onEssayChange, onRequestScore, isScoring, isConfigured }: WritingAreaProps) {
  const { settings } = useApiSettings()
  const [isAutoEnabled, setIsAutoEnabled] = useState(true)
  const [imageOpen, setImageOpen] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [tickMs, setTickMs] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [hasStartedWriting, setHasStartedWriting] = useState(false)
  const [showResumePrompt, setShowResumePrompt] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const wordCount = essay.trim() ? essay.trim().split(/\s+/).length : 0
  
  const minWords = selectedTaskType === 'task1' ? 150 : 250
  const editorRef = useRef<IeltsEditorHandle | null>(null)
  const writingAreaRef = useRef<HTMLDivElement | null>(null)
  const footerBarRef = useRef<HTMLDivElement | null>(null)
  const startedAtRef = useRef<number | null>(null)

  const [aiProbe, setAiProbe] = useState<
    | { status: 'idle' }
    | { status: 'testing' }
    | { status: 'ok'; ttftMs: number }
    | { status: 'slow'; ttftMs: number }
    | { status: 'error'; message: string }
  >({ status: 'idle' })

  const getAiProbeTip = (message: string) => {
    const lower = message.toLowerCase()
    if (lower.includes('429')) return '429 通常表示触发了限流/配额；自动补全是高频请求，更容易被限流。'
    if (lower.includes('401')) return '401 通常表示 API Key 无效/过期或没有权限访问该模型。'
    if (lower.includes('timeout')) return 'Timeout 通常表示网络/模型拥堵导致首 token 迟迟未返回。'
    if (lower.includes('no content token received')) {
      return '探测请求收到了结束信号，但没有拿到任何可展示的生成 token：常见原因是 stream/SSE 返回格式不兼容、内容字段不在 delta.content、或链路拦截了流式数据。'
    }
    return '检查失败可能来自网络、限流、或该接口对流式返回的兼容问题。'
  }

  const probeRef = useRef<{ key: string; at: number } | null>(null)

  const topicProbeKey = useMemo(() => {
    if (!topic) return ''
    const topicSig =
      topic.type === 'text'
        ? `text:${topic.content.length}`
        : `image:${topic.content.length}`
    return `${settings.baseUrl}|${settings.model}|${topic.taskType}|${topicSig}`
  }, [settings.baseUrl, settings.model, topic])

  useEffect(() => {
    if (!isConfigured || !topic) {
      setAiProbe({ status: 'idle' })
      return
    }

    const now = Date.now()
    if (probeRef.current?.key === topicProbeKey && now - probeRef.current.at < 10 * 60 * 1000) return
    probeRef.current = { key: topicProbeKey, at: now }

    setAiProbe({ status: 'testing' })
    const controller = new AbortController()

    measureAutocompleteTTFT(settings, topic, controller.signal, 8000)
      .then((r) => {
        if ('ttftMs' in r) {
          if (r.ttftMs >= 2500) setAiProbe({ status: 'slow', ttftMs: r.ttftMs })
          else setAiProbe({ status: 'ok', ttftMs: r.ttftMs })
        } else {
          setAiProbe({ status: 'error', message: r.error })
        }
      })
      .catch((e: any) => {
        setAiProbe({ status: 'error', message: e?.message || 'Unknown error' })
      })

    return () => controller.abort()
  }, [isConfigured, topic, topicProbeKey, settings])
  
  const getWordCountColor = useCallback(() => {
    if (wordCount === 0) return 'text-muted-foreground'
    if (wordCount < minWords - 100) return 'text-destructive'
    if (wordCount < minWords) return 'text-accent'
    return 'text-primary'
  }, [wordCount, minWords])

  const formatElapsedTime = useCallback((totalMs: number) => {
    const totalSeconds = Math.max(0, Math.floor(totalMs / 1000))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) {
      return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
    }

    return [minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
  }, [])

  const currentElapsedMs = elapsedMs + (isTimerRunning && startedAtRef.current ? tickMs - startedAtRef.current : 0)

  const resetWritingTimer = useCallback(() => {
    startedAtRef.current = null
    setElapsedMs(0)
    setTickMs(0)
    setIsTimerRunning(false)
    setHasStartedWriting(false)
    setShowResumePrompt(false)
    setIsFinished(false)
  }, [])

  const pauseWritingTimer = useCallback((shouldPrompt: boolean) => {
    if (isFinished) return // 如果已经结束，不处理任何暂停或弹窗

    const start = startedAtRef.current
    if (start !== null) {
      const now = Date.now()
      setElapsedMs((prev) => prev + (now - start))
      setTickMs(now)
      startedAtRef.current = null
    }
    setIsTimerRunning(false)
    if (shouldPrompt && hasStartedWriting) {
      setShowResumePrompt(true)
    }
  }, [hasStartedWriting, isFinished])

  const resumeWritingTimer = useCallback(() => {
    if (isFinished) return // 如果已经结束，不再恢复计时

    if (startedAtRef.current !== null) return
    const now = Date.now()
    startedAtRef.current = now
    setTickMs(now)
    setIsTimerRunning(true)
    setHasStartedWriting(true)
    setShowResumePrompt(false)
  }, [isFinished])

  const stopWritingTimer = useCallback(() => {
    // 点击 Get AI Score 时调用：彻底停止计时
    setIsFinished(true)
    const start = startedAtRef.current
    if (start !== null) {
      const now = Date.now()
      setElapsedMs((prev) => prev + (now - start))
      setTickMs(now)
      startedAtRef.current = null
    }
    setIsTimerRunning(false)
    setShowResumePrompt(false)
  }, [])

  const handleEditorFocus = useCallback(() => {
    resumeWritingTimer()
  }, [resumeWritingTimer])

  const handleEditorBlur = useCallback(() => {
    if (isFinished) return

    window.setTimeout(() => {
      const active = document.activeElement
      // 如果焦点还在写作区或者底部的按钮工具栏内，不暂停
      if (active && (writingAreaRef.current?.contains(active) || footerBarRef.current?.contains(active))) return
      pauseWritingTimer(true)
    }, 0)
  }, [pauseWritingTimer, isFinished])

  const handleResumeWriting = useCallback(() => {
    resumeWritingTimer()
    window.setTimeout(() => {
      editorRef.current?.focus()
    }, 0)
  }, [resumeWritingTimer])

  const handleResetEssay = useCallback(() => {
    onEssayChange('')
    resetWritingTimer()
  }, [onEssayChange, resetWritingTimer])

  const handleScoreRequest = useCallback(() => {
    stopWritingTimer()
    onRequestScore()
  }, [stopWritingTimer, onRequestScore])

  const canScore = isConfigured && wordCount >= 50 && !isScoring

  useEffect(() => {
    if (!isTimerRunning) return

    const interval = window.setInterval(() => {
      setTickMs(Date.now())
    }, 1000)

    return () => window.clearInterval(interval)
  }, [isTimerRunning])

  useEffect(() => {
    const handlePageBlur = () => {
      pauseWritingTimer(true)
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        pauseWritingTimer(true)
      }
    }

    window.addEventListener('blur', handlePageBlur)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('blur', handlePageBlur)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [pauseWritingTimer])

  useEffect(() => {
    resetWritingTimer()
  }, [topic?.type, topic?.content, selectedTaskType, resetWritingTimer])

  if (!topic) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
          <Clock className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="mt-4 text-sm font-medium text-muted-foreground">
          Set a topic above to start writing
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          You can type or upload an image of your IELTS prompt
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Topic Display */}
      <div className="rounded-lg border bg-secondary/50 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Your Topic
          </p>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-background border text-muted-foreground">
            {selectedTaskType === 'task1' ? 'Task 1 (Min 150 words)' : 'Task 2 (Min 250 words)'}
          </span>
        </div>
        {topic.type === 'text' ? (
          <p className="text-sm leading-relaxed text-foreground">{topic.content}</p>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => setImageOpen(true)}
              className="block w-full cursor-zoom-in hover:opacity-90 transition-opacity"
              title="Click to zoom in"
            >
              <img
                src={topic.content}
                alt="IELTS writing topic"
                className="max-h-[250px] mx-auto rounded-md object-contain border"
              />
            </button>
          </div>
        )}
      </div>

      {/* Writing Area */}
      <div ref={writingAreaRef} className="flex flex-col rounded-lg border border-input bg-background overflow-hidden">
        {/* Editor Toolbar/Header */}
        <div className="flex items-center justify-between bg-muted/30 px-4 py-2 border-b">
          <span className="text-xs font-medium text-muted-foreground">Editor</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatElapsedTime(currentElapsedMs)}
            </div>
            {aiProbe.status === 'testing' && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Checking AI...
              </div>
            )}
            {(aiProbe.status === 'ok' || aiProbe.status === 'slow') && (
              <div className={`flex items-center gap-1.5 text-[11px] ${aiProbe.status === 'slow' ? 'text-amber-700' : 'text-muted-foreground'}`}>
                <div className={`h-1.5 w-1.5 rounded-full ${aiProbe.status === 'slow' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                {aiProbe.status === 'slow' ? `Slow (~${Math.round(aiProbe.ttftMs / 100) / 10}s)` : `~${Math.round(aiProbe.ttftMs / 100) / 10}s`}
              </div>
            )}
            {aiProbe.status === 'error' && (
              <div className="relative flex items-center gap-1.5 text-[11px] text-destructive group">
                <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
                AI error
                {aiProbe.message && (
                  <div className="absolute right-0 top-full mt-2 hidden w-[360px] rounded-md border bg-popover p-2 text-[11px] text-muted-foreground shadow-lg group-hover:block z-50">
                    <div className="text-foreground font-medium">AI check failed</div>
                    <div className="mt-1 break-words">{aiProbe.message}</div>
                    <div className="mt-2 break-words">Base URL: {settings.baseUrl}</div>
                    <div className="break-words">Model: {settings.model}</div>
                    <div className="mt-2 break-words">
                      Tip: {getAiProbeTip(aiProbe.message)}
                    </div>
                  </div>
                )}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAutoEnabled(!isAutoEnabled)}
              className={`h-7 px-2 gap-1.5 text-[11px] transition-colors ${
                isAutoEnabled 
                  ? 'text-primary hover:bg-primary/5 hover:text-primary' 
                  : 'text-muted-foreground'
              }`}
            >
              <Wand2 className={`h-3 w-3 ${isAutoEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
              {isAutoEnabled ? 'AI Assist: ON' : 'AI Assist: OFF'}
            </Button>
          </div>
        </div>
        
        {/* Editor Content */}
        <div className="relative w-full">
          <IeltsEditor
            ref={editorRef}
            value={essay}
            onChange={onEssayChange}
            topic={topic}
            isConfigured={isConfigured && isAutoEnabled}
            onEditorFocus={handleEditorFocus}
            onEditorBlur={handleEditorBlur}
          />
          {showResumePrompt && (
            <div className="absolute inset-0 z-20 flex items-start justify-center bg-background/35 px-4 pt-6 backdrop-blur-[1px]">
              <div className="w-full max-w-sm rounded-lg border bg-popover p-4 shadow-lg">
                <p className="text-sm font-medium text-foreground">Wait for you to continue writing!</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  The timer is paused. Click yes to return to the editor and keep writing.
                </p>
                <div className="mt-3 flex justify-end">
                  <Button size="sm" onClick={handleResumeWriting}>
                    yes
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Bar */}
      <div ref={footerBarRef} className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Words:</span>
            <span className={`text-sm font-semibold tabular-nums ${getWordCountColor()}`}>
              {wordCount}
            </span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
            <span className="text-xs text-muted-foreground">
              {wordCount < 50 ? 'Write at least 50 words to score' : wordCount < minWords - 100 ? 'Keep writing...' : wordCount < minWords ? 'Almost there!' : 'Great length!'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetEssay}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <Button
            variant="premium"
            size="sm"
            onClick={handleScoreRequest}
            disabled={!canScore}
            className="gap-1.5"
          >
            {isScoring ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Scoring...</>
            ) : (
              <><Sparkles className="h-3.5 w-3.5" /> Get AI Score</>
            )}
          </Button>
        </div>
      </div>

      {!isConfigured && wordCount > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Configure your API key in Settings to enable AI scoring
        </p>
      )}

      {/* Image Zoom Modal */}
      {imageOpen && topic.type === 'image' && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6 animate-fade-in"
          onClick={() => setImageOpen(false)}
        >
          <div className="max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end mb-3">
              <Button variant="secondary" size="sm" onClick={() => setImageOpen(false)}>
                Close
              </Button>
            </div>
            <div className="rounded-lg bg-background p-3">
              <img
                src={topic.content}
                alt="IELTS writing topic (large)"
                className="max-h-[85vh] w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
