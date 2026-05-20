import { useState } from 'react'
import type { Topic, ScoringState, SavedSession } from '@/types'
import { useApiSettings } from '@/contexts/ApiSettingsContext'
import { scoreEssay } from '@/lib/api'
import { addCollection } from '@/lib/storage'
import { HeroSection } from '@/components/HeroSection'
import { TopicInput } from '@/components/TopicInput'
import { WritingArea } from '@/components/WritingArea'
import { ScoreDisplay } from '@/components/ScoreDisplay'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export function PracticePage() {
  const { settings, isConfigured } = useApiSettings()
  const [topic, setTopic] = useState<Topic | null>(null)
  const [selectedTaskType, setSelectedTaskType] = useState<'task1' | 'task2'>('task2')
  const [essay, setEssay] = useState('')
  const [scoring, setScoring] = useState<ScoringState>({
    status: 'idle',
    result: null,
    error: null,
  })

  const handleScore = async () => {
    if (!topic || !essay.trim() || !isConfigured) return
    setScoring({ status: 'loading', result: null, error: null })
    try {
      const result = await scoreEssay(settings, topic, essay)
      setScoring({ status: 'success', result, error: null })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.'
      setScoring({ status: 'error', result: null, error: msg })
    }
  }

  const handleSave = () => {
    if (!topic || !scoring.result) return
    const session: SavedSession = {
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
      topic,
      essay,
      wordCount: essay.trim().split(/\s+/).length,
      scoringResult: scoring.result,
    }
    addCollection(session)
  }

  return (
    <>
      <HeroSection />
      <main id="practice" className="container py-12 lg:py-16">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-xl">Essay Topic</CardTitle>
              <CardDescription>
                Upload an image of the topic or type it in manually
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TopicInput 
                onTopicSet={setTopic} 
                selectedTaskType={selectedTaskType}
                onTaskTypeChange={setSelectedTaskType}
              />
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-xl">Your Essay</CardTitle>
              <CardDescription>
                {selectedTaskType === 'task1' 
                  ? 'Write your response below. Aim for 150+ words for Task 1'
                  : 'Write your response below. Aim for 250+ words for Task 2'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WritingArea
                topic={topic}
                selectedTaskType={selectedTaskType}
                essay={essay}
                onEssayChange={setEssay}
                onRequestScore={handleScore}
                isScoring={scoring.status === 'loading'}
                isConfigured={isConfigured}
              />
            </CardContent>
          </Card>
        </div>

        {/* Scoring error */}
        {scoring.status === 'error' && (
          <div className="mt-8 rounded-lg border border-destructive/30 bg-destructive/5 p-5 animate-fade-in">
            <p className="text-sm font-medium text-destructive">{scoring.error}</p>
          </div>
        )}

        {/* Scoring results */}
        {scoring.status === 'success' && scoring.result && (
          <div className="mt-8">
            <ScoreDisplay result={scoring.result} onSave={handleSave} />
          </div>
        )}
      </main>
    </>
  )
}
