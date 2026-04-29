import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RewrittenEssayProps {
  essay: string
}

export function RewrittenEssay({ essay }: RewrittenEssayProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-lg border bg-card">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-secondary/30"
      >
        <span className="text-sm font-semibold text-foreground">Band 8+ Rewritten Essay</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <div className="border-t px-5 py-4">
          <div className="rounded-md border-l-2 border-primary/30 bg-secondary/30 px-4 py-3">
            <p className="font-serif text-sm leading-[1.8] text-foreground whitespace-pre-wrap">
              {essay}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
