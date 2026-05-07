import { useState, useCallback } from 'react'
import { Clock, RotateCcw, Sparkles, Loader2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Topic } from '@/types'
import { IeltsEditor } from '@/components/editor/IeltsEditor'

interface WritingAreaProps {
  topic: Topic | null
  essay: string
  onEssayChange: (value: string) => void
  onRequestScore: () => void
  isScoring: boolean
  isConfigured: boolean
}

export function WritingArea({ topic, essay, onEssayChange, onRequestScore, isScoring, isConfigured }: WritingAreaProps) {
  const [isAutoEnabled, setIsAutoEnabled] = useState(true)
  const wordCount = essay.trim() ? essay.trim().split(/\s+/).length : 0
  
  const minWords = topic?.taskType === 'task1' ? 150 : 250
  
  const getWordCountColor = useCallback(() => {
    if (wordCount === 0) return 'text-muted-foreground'
    if (wordCount < minWords - 100) return 'text-destructive'
    if (wordCount < minWords) return 'text-accent'
    return 'text-primary'
  }, [wordCount, minWords])

  const canScore = isConfigured && wordCount >= 50 && !isScoring

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
            {topic.taskType === 'task1' ? 'Task 1 (Min 150 words)' : 'Task 2 (Min 250 words)'}
          </span>
        </div>
        {topic.type === 'text' ? (
          <p className="text-sm leading-relaxed text-foreground">{topic.content}</p>
        ) : (
          <img
            src={topic.content}
            alt="IELTS writing topic"
            className="max-h-[250px] rounded-md object-contain"
          />
        )}
      </div>

      {/* Writing Area */}
      <div className="flex flex-col rounded-lg border border-input bg-background overflow-hidden">
        {/* Editor Toolbar/Header */}
        <div className="flex items-center justify-between bg-muted/30 px-4 py-2 border-b">
          <span className="text-xs font-medium text-muted-foreground">Editor</span>
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
        
        {/* Editor Content */}
        <div className="w-full">
          <IeltsEditor
            value={essay}
            onChange={onEssayChange}
            topic={topic}
            isConfigured={isConfigured && isAutoEnabled}
          />
        </div>
      </div>

      {/* Footer Bar */}
      <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
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
            onClick={() => onEssayChange('')}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <Button
            variant="premium"
            size="sm"
            onClick={onRequestScore}
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
    </div>
  )
}
