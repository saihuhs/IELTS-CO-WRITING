import { useState } from 'react'
import { ArrowDown, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TutorialModal } from '@/components/TutorialModal'

export function HeroSection() {
  const [tutorialOpen, setTutorialOpen] = useState(false)

  const scrollToPractice = () => {
    document.getElementById('practice')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className="relative overflow-hidden">
      <div className="hero-gradient relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(226_72%_60%/0.3),transparent)]" />
        <div className="container relative grid min-h-[480px] grid-cols-1 items-center gap-8 py-16 lg:grid-cols-2 lg:py-20">
          <div className="flex flex-col gap-6 animate-fade-in">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-1.5 text-xs font-medium text-primary-foreground">
              IELTS Academic & General Training
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-primary-foreground lg:text-5xl">
              Master Your
              <br />
              IELTS Writing
            </h1>
            <p className="max-w-md text-base leading-relaxed text-primary-foreground/75">
              Upload essay topics as images or type them in directly. Practice writing under exam conditions and sharpen your skills for Band 7+.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                size="lg"
                className="gap-2"
                onClick={scrollToPractice}
              >
                Start Practicing
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="gap-2 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
                onClick={() => setTutorialOpen(true)}
              >
                <BookOpen className="h-4 w-4" />
                How it Works
              </Button>
            </div>
          </div>
          <div className="hidden lg:flex items-center justify-center animate-slide-up">
            <img
              src="/images/hero-illustration.png"
              alt="IELTS Writing Practice Illustration"
              className="w-full max-w-lg rounded-2xl opacity-90"
              loading="eager"
            />
          </div>
        </div>
      </div>

      <TutorialModal 
        isOpen={tutorialOpen} 
        onClose={() => setTutorialOpen(false)} 
      />
    </section>
  )
}