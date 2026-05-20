import type { ApiSettings, Topic, ScoringResult } from '@/types'
import { SCORING_SYSTEM_PROMPT } from '@/lib/scoring-prompt'

type MessageContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    >

interface ChatMessage {
  role: 'system' | 'user'
  content: MessageContent
}

/**
 * Compress an image data URL to reduce size for API transmission.
 * Resizes to max 1200px on longest side and converts to JPEG.
 */
function compressImage(dataUrl: string, maxDim = 1200, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas not supported')); return }
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = dataUrl
  })
}



function buildVisionContent(imageDataUrl: string, essayText: string): MessageContent {
  return [
    {
      type: 'image_url' as const,
      image_url: { url: imageDataUrl },
    },
    {
      type: 'text' as const,
      text: SCORING_SYSTEM_PROMPT + '\n\n' + `The image above shows the IELTS Writing Task topic (which may contain charts, graphs, diagrams, or text prompts).\n\n${essayText}`,
    },
  ]
}
function buildTextOnlyContent(
  essay: string,
  wordCount: number,
  topicText?: string,
  taskType?: Topic['taskType'],
): string {
  const taskLabel = taskType === 'task1' ? 'Task 1' : 'Task 2'
  const essayBlock = `Here is the student's essay (${wordCount} words):\n\n${essay}`
  if (topicText) {
    return `IELTS Writing ${taskLabel} Topic:\n${topicText}\n\n${essayBlock}`
  }
  // Fallback for image topics when vision is not supported
  return `The topic was provided as an image that this model cannot read. Please evaluate the essay based on its internal coherence, argument quality, language use, and structure. Assume the essay is relevant to its intended topic.\n\n${essayBlock}`
}

function extractJSON(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) return codeBlockMatch[1].trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) return jsonMatch[0]
  return text
}

function validateResult(data: unknown): ScoringResult {
  const obj = data as Record<string, unknown>
  if (typeof obj.overallBand !== 'number') throw new Error('Missing overallBand')
  if (!Array.isArray(obj.criteria) || obj.criteria.length !== 4) throw new Error('Expected 4 criteria')
  const teacherFeedback = obj.teacherFeedback as any
  const hasTeacherFeedback =
    teacherFeedback &&
    typeof teacherFeedback === 'object' &&
    typeof teacherFeedback.kelly === 'string' &&
    typeof teacherFeedback.jieming === 'string'
  const hasGeneralFeedback = typeof obj.generalFeedback === 'string'
  if (!hasTeacherFeedback && !hasGeneralFeedback) {
    throw new Error('Missing teacherFeedback/generalFeedback')
  }
  if (!Array.isArray(obj.vocabularyAlternatives)) throw new Error('Missing vocabularyAlternatives')
  if (typeof obj.rewrittenEssay !== 'string') throw new Error('Missing rewrittenEssay')
  return obj as unknown as ScoringResult
}

function isVisionUnsupportedError(status: number, body: string): boolean {
  if (status !== 400) return false
  const lower = body.toLowerCase()
  return lower.includes('image_url') ||
    lower.includes('unknown variant') ||
    lower.includes('image is not supported') ||
    lower.includes('does not support image') ||
    lower.includes('invalid_request_error')
}

async function callApi(
  settings: ApiSettings,
  messages: ChatMessage[],
  signal: AbortSignal,
): Promise<{ ok: boolean; status: number; body: string; json?: Record<string, unknown> }> {
  const url = `${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`
  
  const payload: Record<string, any> = {
    model: settings.model,
    messages,
    temperature: 0.3,
  }

  // GLM-4.6V-Flash supports max_tokens, but let's make it very large
  payload.max_tokens = 8192

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify(payload),
    signal,
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return { ok: false, status: res.status, body }
  }

  const json = await res.json()
  return { ok: true, status: res.status, body: '', json }
}

export async function scoreEssay(
  settings: ApiSettings,
  topic: Topic,
  essay: string,
): Promise<ScoringResult> {
  const wordCount = essay.trim().split(/\s+/).length
  const essayText = `Here is the student's essay (${wordCount} words):\n\n${essay}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 90000)

  try {
    // For text topics, always use text-only format
    if (topic.type === 'text') {
      const messages: ChatMessage[] = [
        { role: 'system', content: SCORING_SYSTEM_PROMPT },
        { role: 'user', content: buildTextOnlyContent(essay, wordCount, topic.content, topic.taskType) },
      ]
      const result = await callApi(settings, messages, controller.signal)
      if (!result.ok) {
        if (result.status === 401) throw new Error('Invalid API key. Check your settings.')
        if (result.status === 429) throw new Error('Rate limited. Please wait a moment and try again.')
        throw new Error(`API error (${result.status}): ${result.body.slice(0, 200)}`)
      }
      const content: string = (result.json as any)?.choices?.[0]?.message?.content ?? ''
      if (!content) throw new Error('Empty response from AI model.')
      return validateResult(JSON.parse(extractJSON(content)))
    }

    // For image topics: try vision first, fallback to text-only
    const compressed = await compressImage(topic.content).catch(() => topic.content)
    const visionMessages: ChatMessage[] = [
      { role: 'user', content: buildVisionContent(compressed, essayText) },
    ]

    const visionResult = await callApi(settings, visionMessages, controller.signal)

    if (visionResult.ok) {
      const content: string = (visionResult.json as any)?.choices?.[0]?.message?.content ?? ''
      if (!content) throw new Error('Empty response from AI model.')
      return validateResult(JSON.parse(extractJSON(content)))
    }

    // If vision is not supported, fallback to text-only
    if (isVisionUnsupportedError(visionResult.status, visionResult.body)) {
      const fallbackMessages: ChatMessage[] = [
        { role: 'system', content: SCORING_SYSTEM_PROMPT },
        { role: 'user', content: buildTextOnlyContent(essay, wordCount, undefined, topic.taskType) },
      ]
      const fallbackResult = await callApi(settings, fallbackMessages, controller.signal)
      if (!fallbackResult.ok) {
        if (fallbackResult.status === 401) throw new Error('Invalid API key. Check your settings.')
        if (fallbackResult.status === 429) throw new Error('Rate limited. Please wait a moment and try again.')
        throw new Error(`API error (${fallbackResult.status}): ${fallbackResult.body.slice(0, 200)}`)
      }
      const content: string = (fallbackResult.json as any)?.choices?.[0]?.message?.content ?? ''
      if (!content) throw new Error('Empty response from AI model.')
      return validateResult(JSON.parse(extractJSON(content)))
    }

    // Other errors
    if (visionResult.status === 401) throw new Error('Invalid API key. Check your settings.')
    if (visionResult.status === 429) throw new Error('Rate limited. Please wait a moment and try again.')
    throw new Error(`API error (${visionResult.status}): ${visionResult.body.slice(0, 200)}`)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out (90s). The model may be overloaded — try again.')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}
