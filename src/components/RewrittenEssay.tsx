import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RewrittenEssayProps {
  essay: string
}

function renderInlineBold(text: string) {
  const parts: Array<{ type: 'text' | 'bold'; value: string }> = []
  const regex = /\*\*([^*]+)\*\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'bold', value: match[1] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) })
  }
  return parts.map((p, i) =>
    p.type === 'bold' ? (
      <strong key={i} className="font-semibold text-foreground">
        {p.value}
      </strong>
    ) : (
      <span key={i}>{p.value}</span>
    ),
  )
}

function renderMarkdownLite(text: string) {
  const paragraphs = text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean)
  return (
    <div className="space-y-4">
      {paragraphs.map((p, i) => (
        <p key={i} className="font-serif text-sm leading-[1.8] text-foreground">
          {renderInlineBold(p)}
        </p>
      ))}
    </div>
  )
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
            {renderMarkdownLite(essay)}
          </div>
        </div>
      )}
    </div>
  )
}
