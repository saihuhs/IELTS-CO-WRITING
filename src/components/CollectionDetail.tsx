import type { SavedSession } from '@/types'
import { ScoreDisplay } from '@/components/ScoreDisplay'

interface CollectionDetailProps {
  session: SavedSession
}

export function CollectionDetail({ session }: CollectionDetailProps) {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Original essay */}
      <div className="rounded-lg border bg-card p-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Your Topic
        </p>
        {session.topic.type === 'text' ? (
          <p className="text-sm leading-relaxed text-foreground">{session.topic.content}</p>
        ) : (
          <img
            src={session.topic.content}
            alt="IELTS writing topic"
            className="max-h-[200px] rounded-md object-contain"
          />
        )}
      </div>

      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Your Essay
          </p>
          <span className="text-xs tabular-nums text-muted-foreground">{session.wordCount} words</span>
        </div>
        <p className="text-sm leading-[1.8] text-foreground whitespace-pre-wrap">{session.essay}</p>
      </div>

      <ScoreDisplay result={session.scoringResult} readOnly />
    </div>
  )
}
