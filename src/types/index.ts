export interface ApiSettings {
  baseUrl: string
  apiKey: string
  model: string
}

export interface Topic {
  type: 'text' | 'image'
  content: string
  taskType: 'task1' | 'task2'
}

export interface CriterionScore {
  criterion: 'TR' | 'CC' | 'LR' | 'GRA'
  label: string
  score: number
  feedback: string
  suggestions: string[]
}

export interface VocabularyAlternative {
  original: string
  improved: string
  explanation: string
}

export interface ScoringResult {
  overallBand: number
  criteria: CriterionScore[]
  generalFeedback: string
  vocabularyAlternatives: VocabularyAlternative[]
  rewrittenEssay: string
}

export interface SavedSession {
  id: string
  savedAt: string
  topic: Topic
  essay: string
  wordCount: number
  scoringResult: ScoringResult
}

export interface ScoringState {
  status: 'idle' | 'loading' | 'success' | 'error'
  result: ScoringResult | null
  error: string | null
}
