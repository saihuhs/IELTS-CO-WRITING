import type { CriterionScore } from '@/types'
import { ScoreBadge, getProgressColor } from '@/components/ScoreBadge'
import { Lightbulb } from 'lucide-react'

interface ScoreCriterionProps {
  data: CriterionScore
  language?: 'en' | 'zh'
}

export function ScoreCriterion({ data, language = 'en' }: ScoreCriterionProps) {
  const pct = (data.score / 9) * 100
  const feedbackText = language === 'zh' && data.feedback_zh ? data.feedback_zh : data.feedback
  const suggestionsList = language === 'zh' && data.suggestions_zh ? data.suggestions_zh : data.suggestions

  return (
    <div className="rounded-lg border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {data.criterion}
          </p>
          <p className="text-sm font-medium text-foreground">{data.label}</p>
        </div>
        <ScoreBadge score={data.score} />
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-secondary">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${getProgressColor(data.score)}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">{feedbackText}</p>

      {suggestionsList.length > 0 && (
        <div className="space-y-1.5 rounded-md bg-secondary/50 p-3">
          <div className="flex items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5 text-accent" />
            <span className="text-xs font-semibold text-foreground">Suggestions</span>
          </div>
          <ul className="space-y-1">
            {suggestionsList.map((s, i) => (
              <li key={i} className="text-xs leading-relaxed text-muted-foreground pl-5 relative before:content-['•'] before:absolute before:left-1.5 before:text-accent">
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
