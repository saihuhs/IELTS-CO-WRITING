import { cn } from '@/lib/utils'

interface ScoreBadgeProps {
  score: number
  size?: 'sm' | 'lg'
}

function getBandColor(score: number): string {
  if (score >= 8) return 'bg-emerald-500/15 text-emerald-700 ring-emerald-500/20'
  if (score >= 7) return 'bg-primary/10 text-primary ring-primary/20'
  if (score >= 6) return 'bg-sky-500/10 text-sky-700 ring-sky-500/20'
  if (score >= 5) return 'bg-amber-500/10 text-amber-700 ring-amber-500/20'
  return 'bg-destructive/10 text-destructive ring-destructive/20'
}

export function ScoreBadge({ score, size = 'sm' }: ScoreBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-lg ring-1 font-semibold tabular-nums',
        getBandColor(score),
        size === 'lg' ? 'px-5 py-2.5 text-3xl' : 'px-2.5 py-1 text-sm',
      )}
    >
      {score.toFixed(1)}
    </span>
  )
}

export function getProgressColor(score: number): string {
  if (score >= 8) return 'bg-emerald-500'
  if (score >= 7) return 'bg-primary'
  if (score >= 6) return 'bg-sky-500'
  if (score >= 5) return 'bg-amber-500'
  return 'bg-destructive'
}
