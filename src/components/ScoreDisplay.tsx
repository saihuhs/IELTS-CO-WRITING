import { useState } from 'react'
import { Bookmark, BookmarkCheck, ArrowRight } from 'lucide-react'
import type { ScoringResult } from '@/types'
import { Button } from '@/components/ui/button'
import { ScoreBadge } from '@/components/ScoreBadge'
import { ScoreCriterion } from '@/components/ScoreCriterion'
import { RewrittenEssay } from '@/components/RewrittenEssay'

interface ScoreDisplayProps {
  result: ScoringResult
  onSave?: () => void
  readOnly?: boolean
}

export function ScoreDisplay({ result, onSave, readOnly = false }: ScoreDisplayProps) {
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    onSave?.()
    setSaved(true)
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header: overall score */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Overall Band Score
            </p>
            <div className="flex items-center gap-4">
              <ScoreBadge score={result.overallBand} size="lg" />
            </div>
          </div>
          {!readOnly && onSave && (
            <Button
              variant={saved ? 'secondary' : 'outline'}
              size="sm"
              onClick={handleSave}
              disabled={saved}
              className="gap-1.5"
            >
              {saved ? (
                <><BookmarkCheck className="h-4 w-4" /> Saved</>
              ) : (
                <><Bookmark className="h-4 w-4" /> Save to Collection</>
              )}
            </Button>
          )}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {result.generalFeedback}
        </p>
      </div>

      {/* 4 criteria grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {result.criteria.map((c) => (
          <ScoreCriterion key={c.criterion} data={c} />
        ))}
      </div>

      {/* Vocabulary improvements */}
      {result.vocabularyAlternatives.length > 0 && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b">
            <p className="text-sm font-semibold text-foreground">Vocabulary Improvements</p>
          </div>
          <div className="divide-y">
            {result.vocabularyAlternatives.map((v, i) => (
              <div key={i} className="grid grid-cols-[1fr,auto,1fr] items-start gap-3 px-5 py-3">
                <div>
                  <p className="text-sm text-destructive/80 line-through">{v.original}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-primary">{v.improved}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{v.explanation}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rewritten essay */}
      <RewrittenEssay essay={result.rewrittenEssay} />
    </div>
  )
}
