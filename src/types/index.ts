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
  feedback_zh?: string
  suggestions: string[]
  suggestions_zh?: string[]
}

export interface VocabularyAlternative {
  original: string
  improved: string
  explanation: string
  explanation_zh?: string
}

export interface TeacherFeedback {
  kelly: string
  kelly_zh?: string
  jieming: string
  jieming_zh?: string
}

export interface ScoringResult {
  overallBand: number
  criteria: CriterionScore[]
  generalFeedback?: string
  teacherFeedback?: TeacherFeedback
  vocabularyAlternatives: VocabularyAlternative[]
  rewrittenEssay: string
}

export interface SavedSession {
  id: string
  savedAt: string
  topic: Topic
  title?: string
  essay: string
  wordCount: number
  scoringResult: ScoringResult
}

export interface ScoringState {
  status: 'idle' | 'loading' | 'success' | 'error'
  result: ScoringResult | null
  error: string | null
}
