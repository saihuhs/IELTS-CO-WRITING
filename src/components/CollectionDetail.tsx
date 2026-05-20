import type { SavedSession } from '@/types'
import { ScoreDisplay } from '@/components/ScoreDisplay'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

interface CollectionDetailProps {
  session: SavedSession
}

export function CollectionDetail({ session }: CollectionDetailProps) {
  const [imageOpen, setImageOpen] = useState(false)

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
          <div>
            <button
              type="button"
              onClick={() => setImageOpen(true)}
              className="block w-full"
            >
              <img
                src={session.topic.content}
                alt="IELTS writing topic"
                className="max-h-[220px] w-full rounded-md object-contain border"
              />
            </button>
          </div>
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

      {imageOpen && session.topic.type === 'image' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
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
                src={session.topic.content}
                alt="IELTS writing topic (large)"
                className="max-h-[80vh] w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
