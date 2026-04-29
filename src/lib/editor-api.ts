import type { ApiSettings, Topic } from '@/types'

const AUTOCOMPLETE_SYSTEM_PROMPT = `You are a strict IELTS Band 9 writing TUTOR. 
你的核心目标是【引导和启发】学生，而不是替他们代写！
为了锻炼用户的写作能力，你**绝不能**直接生成完整的长句、分论点或替用户写完所有的观点。
你只能提供**极短的词汇搭配提示（Collocations，如 "play a pivotal role in"）、逻辑连接词（Cohesive devices，如 "Consequently,"）或下一个短语的骨架（Scaffolding，2-5个词）**，从而引导用户自己完成句子。

你的所有输出内容必须在理解题目（或图片表格）的前提之下。
根据上文的语境和雅思 7+ 分标准，直接输出极短的引导性内容（不要超过 6 个词）。

CRITICAL STRUCTURE REQUIREMENTS:
If this is a Task 1 essay, guide them towards the 4-paragraph structure (Introduction, Overview, Body 1, Body 2).
If this is a Task 2 essay, guide them towards the 5-paragraph structure (Introduction, Body 1, 2, 3, Conclusion).

IMPORTANT: 
1. MAXIMUM length is 6 words. Only provide the very next chunk/collocation.
2. Only return the exact continuation text. Do not repeat the last word unless necessary.
3. Do not include quotes, explanations, or introductory phrases.
4. Keep it natural and seamlessly connected to the prompt's ending.`

const CORRECTION_SYSTEM_PROMPT = `You are a strict IELTS Band 9 examiner.
Review the following sentence written by a student. Check for grammatical errors and basic vocabulary.
If there are errors or the vocabulary is too simple (Band 5/6 level), provide an improved Band 7+ version.
If the sentence is already excellent, return { "hasErrorOrBasic": false }.

Respond ONLY in valid JSON format:
{
  "hasErrorOrBasic": boolean,
  "original": "string",
  "improved": "string",
  "explanation": "string"
}`

/**
 * Stream the autocomplete suggestion from the AI model
 */
export async function* streamAutocomplete(
  settings: ApiSettings,
  topic: Topic | null,
  textBeforeCursor: string,
  signal: AbortSignal
): AsyncGenerator<string, void, unknown> {
  if (!settings.apiKey || !textBeforeCursor.trim()) return

  const topicTypeStr = topic?.taskType === 'task1' ? 'Task 1' : 'Task 2'
  
  let userMessages: any[] = []
  
  if (topic?.type === 'image') {
    // Need to compress image first to avoid payload too large issues
    // Using a dynamic import or accessing the global context to avoid circular dependencies
    // But since compressImage is in api.ts and we are in editor-api.ts, let's just send it
    // The topic.content for images is already a base64 data URL
    userMessages = [
      {
        type: 'text',
        text: `Topic (${topicTypeStr}): The image below shows the IELTS Writing Task topic.\n\nStudent's writing so far:\n${textBeforeCursor}`
      },
      {
        type: 'image_url',
        image_url: { url: topic.content }
      }
    ]
  } else {
    const topicText = topic ? topic.content : 'Unknown Topic'
    userMessages = [
      {
        type: 'text',
        text: `Topic (${topicTypeStr}): ${topicText}\n\nStudent's writing so far:\n${textBeforeCursor}`
      }
    ]
  }

  const url = `${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: 'system', content: AUTOCOMPLETE_SYSTEM_PROMPT },
        { role: 'user', content: userMessages }
      ],
      temperature: 0.2,
      max_tokens: 15, // We only want a very short completion (guidance)
      stream: true,
    }),
    signal,
  })

  if (!res.ok) {
    throw new Error(`API error (${res.status})`)
  }

  if (!res.body) return

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmedLine = line.trim()
        if (trimmedLine.startsWith('data: ') && trimmedLine !== 'data: [DONE]') {
          try {
            const data = JSON.parse(trimmedLine.slice(6))
            const content = data.choices?.[0]?.delta?.content
            if (content) {
              yield content
            }
          } catch (e) {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export interface SentenceCorrection {
  hasErrorOrBasic: boolean
  original?: string
  improved?: string
  explanation?: string
}

/**
 * Check a single sentence for grammatical and vocabulary improvements
 */
export async function checkSentence(
  settings: ApiSettings,
  sentence: string,
  signal: AbortSignal
): Promise<SentenceCorrection | null> {
  if (!settings.apiKey || !sentence.trim()) return null

  const url = `${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: 'system', content: CORRECTION_SYSTEM_PROMPT },
        { role: 'user', content: `Check this sentence:\n${sentence}` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
    signal,
  })

  if (!res.ok) {
    return null // Fail silently for inline corrections
  }

  const json = await res.json()
  const content = json.choices?.[0]?.message?.content ?? ''
  
  if (!content) return null

  try {
    const result = JSON.parse(content) as SentenceCorrection
    return result
  } catch (e) {
    return null
  }
}
