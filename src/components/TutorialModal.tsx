import { X, Key, Keyboard, Languages, Award } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TutorialModalProps {
  isOpen: boolean
  onClose: () => void
}

export function TutorialModal({ isOpen, onClose }: TutorialModalProps) {
  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-background shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-xl font-bold text-foreground">How it Works</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-muted">
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="max-h-[70vh] overflow-y-auto p-6">
          <div className="grid gap-8 sm:grid-cols-2">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Key className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">1. Setup API Key</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Click the gear icon in the top right to configure your API key. Supports any OpenAI-compatible API (e.g. Zhipu, DeepSeek). It's 100% free if you bring your own key!
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Keyboard className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">2. Immersive Writing</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Pause typing to see grey <strong>ghost text</strong> predictions. Press <code>Tab</code> to accept. 
                  End a sentence to get instant grammar checks (red underlines with green suggestions).
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Languages className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">3. Smart Polish & Translate</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Select English text to get advanced vocabulary replacements or sentence rewrites. Select Chinese text to get perfect context-aware English translations.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">4. Dual-Teacher Scoring</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Click "Get AI Score" to receive detailed feedback from a Native teacher (language) and an IELTS examiner (structure). Click "Translate to Chinese" to read it easily.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t bg-muted/30 px-6 py-4">
          <Button className="w-full" onClick={onClose}>
            Got it, let's start!
          </Button>
        </div>
      </div>
    </div>
  )
}
