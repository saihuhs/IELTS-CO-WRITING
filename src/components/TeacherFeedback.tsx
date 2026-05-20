import type { TeacherFeedback as TeacherFeedbackType } from '@/types'

const KELLY_AVATAR = {
  src: '/images/avatars/kelly-sunlit.png',
  alt: 'Kelly portrait avatar',
}

const JIEMING_AVATAR = {
  src: '/images/avatars/jieming-classic.png',
  alt: 'Jieming portrait avatar',
}

function renderParagraphs(text: string) {
  const parts = text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean)
  return (
    <div className="space-y-3">
      {parts.map((p, i) => (
        <p key={i} className="text-sm leading-relaxed text-muted-foreground">
          {p}
        </p>
      ))}
    </div>
  )
}

export function TeacherFeedback({ feedback, language = 'en' }: { feedback: TeacherFeedbackType, language?: 'en' | 'zh' }) {
  const kellyText = language === 'zh' && feedback.kelly_zh ? feedback.kelly_zh : feedback.kelly
  const jiemingText = language === 'zh' && feedback.jieming_zh ? feedback.jieming_zh : feedback.jieming

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border bg-background shadow-sm">
            <img
              src={KELLY_AVATAR.src}
              alt={KELLY_AVATAR.alt}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Kelly</p>
            <p className="text-xs text-muted-foreground">Native Teacher — Language & Naturalness</p>
          </div>
        </div>
        {renderParagraphs(kellyText)}
      </div>

      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border bg-background shadow-sm">
            <img
              src={JIEMING_AVATAR.src}
              alt={JIEMING_AVATAR.alt}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Jieming</p>
            <p className="text-xs text-muted-foreground">IELTS Teacher — Structure & Task</p>
          </div>
        </div>
        {renderParagraphs(jiemingText)}
      </div>
    </div>
  )
}
