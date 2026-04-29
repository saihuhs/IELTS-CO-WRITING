import { useState } from 'react'
import { Library, Trash2, ChevronDown } from 'lucide-react'
import type { SavedSession } from '@/types'
import { loadCollections, removeCollection } from '@/lib/storage'
import { Button } from '@/components/ui/button'
import { ScoreBadge } from '@/components/ScoreBadge'
import { CollectionDetail } from '@/components/CollectionDetail'
import { cn } from '@/lib/utils'

export function CollectionsPage() {
  const [sessions, setSessions] = useState<SavedSession[]>(loadCollections)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const handleDelete = (id: string) => {
    removeCollection(id)
    setSessions((prev) => prev.filter((s) => s.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    })
  }

  return (
    <main className="container py-12 lg:py-16">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Library className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold font-serif text-foreground">My Collections</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Your saved practice sessions and scores — {sessions.length} {sessions.length === 1 ? 'entry' : 'entries'}
        </p>
      </div>

      {sessions.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 p-8 text-center">
          <Library className="h-10 w-10 text-muted-foreground/50 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">No saved sessions yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Practice and save your scored essays to build your corpus
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((s) => (
            <div key={s.id} className="rounded-lg border bg-card card-elevated overflow-hidden">
              {/* Summary row */}
              <div className="flex items-center gap-4 px-5 py-4">
                <ScoreBadge score={s.scoringResult.overallBand} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {s.topic.type === 'text'
                      ? s.topic.content.slice(0, 100) + (s.topic.content.length > 100 ? '...' : '')
                      : 'Image Topic'}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">{formatDate(s.savedAt)}</span>
                    <span className="text-xs text-muted-foreground">{s.wordCount} words</span>
                    <div className="flex items-center gap-1.5">
                      {s.scoringResult.criteria.map((c) => (
                        <span key={c.criterion} className="text-xs text-muted-foreground">
                          {c.criterion}:{c.score}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => toggleExpand(s.id)} className="gap-1">
                    <ChevronDown className={cn('h-4 w-4 transition-transform', expandedId === s.id && 'rotate-180')} />
                    {expandedId === s.id ? 'Collapse' : 'Details'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(s.id)}
                    className="text-muted-foreground hover:text-destructive h-8 w-8"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Expanded detail */}
              {expandedId === s.id && (
                <div className="border-t px-5 py-5">
                  <CollectionDetail session={s} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
