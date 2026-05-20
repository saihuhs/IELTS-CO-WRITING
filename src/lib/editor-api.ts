import type { ApiSettings, Topic } from '@/types'

const AUTOCOMPLETE_SYSTEM_PROMPT = `You are a candidate taking the IELTS Writing test aiming for a Band 7 score. 
你的唯一目标是：紧接着用户的最后一个字母，继续往下写 2-12 个词的地道搭配（Collocations）或短语骨架。

CRITICAL RULES FOR AUTOCOMPLETE:
0. PRIORITY: (1) IELTS prompt + Task requirements (including the prompt image) > (2) current sentence fragment around cursor > (3) earlier text (only to avoid repetition).
1. NEVER REPEAT the text the user has already written. Your output will be DIRECTLY appended to the user's cursor.
2. NEVER CORRECT the user's previous text. If the user wrote "This graph illustrate", DO NOT output "This graph illustrates". Just continue from where they left off (e.g., "the trends of").
3. The user might be typing in the middle of a sentence. Pay close attention to the "Text AFTER cursor" context. Your completion MUST smoothly bridge the text before the cursor and the text after the cursor without creating duplicate words or grammatical errors.
4. IME mode: If the user's last token before the cursor looks like an unfinished word fragment (e.g., "activi"), prioritize completing ONLY that single word. Output only the missing characters. Do NOT add extra words.
   If the fragment is a complete word but is clearly the start of a key phrase already present in the topic/prompt (e.g., "Film club", "Martial arts"), you may output a leading space plus the remaining words of that phrase (1-2 words).
5. MAXIMUM length is 12 words.
6. Output ONLY the continuation words. No quotes, no explanations, no headings, no list/bullets.
7. DO NOT output any thinking or reasoning (no <think> tags or similar). If you reason, do it silently.
8. No line breaks.
9. Do NOT start with discourse markers or paragraph openers (Overall, Firstly, Secondly, In conclusion, etc.). You are completing a fragment, not writing an outline.
10. If you are continuing a sentence (most cases), do NOT start with a capital letter unless it is a proper noun.
11. Do NOT restart the introduction (e.g., do not repeat "The graph illustrates the trends of ...") if it already appeared earlier.
12. Treat distant context as low-weight: focus on the current sentence; use earlier text only as a "do-not-repeat" memory.
13. Do NOT introduce a new main subject/entity. Continue the most recent subject noun phrase already present near the cursor (e.g., "Amateur dramatics ... experienced ..."). Only mention new categories/entities if they are already written in the local context around the cursor.
14. Prefer IELTS Task 1 academic grammar: maintain clear subject→verb structure and correct agreement. Output should be a verb phrase or predicate that completes the current clause, not a new unrelated clause.
15. Recency rule: words closest to the cursor matter the most. Do not copy or restart earlier sentences. The further away a sentence is, the less you should rely on it.
16. Local grammar rule: make the next few words grammatically necessary for the LAST token(s) near the cursor.
   - After an article (a/an/the) → a noun or adjective+noun.
   - After a preposition (in/at/from/to/during/between/over/for/with) → a time/place noun phrase (e.g., "the period", "2000", "Australia").
   - After an auxiliary/linking verb (is/was/were/has/have/had) → a past participle/verb phrase that completes the clause.

Output formatting rule:
- If you are starting a NEW word after a completed word, start with exactly ONE leading space.
- If you are completing the current word fragment, do NOT start with a space.

Your output must seamlessly connect to the exact end of the user's input before the cursor, and logically lead into the text after the cursor.`

function extractOpenAIContent(data: any): string {
  const choice = data?.choices?.[0]
  const delta = choice?.delta
  return (
    delta?.content ??
    delta?.text ??
    delta?.reasoning_content ??
    choice?.message?.content ??
    choice?.text ??
    ''
  )
}

async function compressInlineImage(dataUrl: string, maxDim: number = 800, quality: number = 0.75): Promise<string> {
  if (!dataUrl.startsWith('data:')) return dataUrl

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let width = img.width
      let height = img.height
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

async function* parseOpenAIStreamResponse(res: Response): AsyncGenerator<string, void, unknown> {
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    const json = await res.json()
    const content = extractOpenAIContent(json)
    if (content) yield content
    return
  }

  if (!res.body) return

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  const findEventSep = (buf: string) => {
    const idx1 = buf.indexOf('\n\n')
    const idx2 = buf.indexOf('\r\n\r\n')
    if (idx1 === -1 && idx2 === -1) return { idx: -1, len: 0 }
    if (idx1 === -1) return { idx: idx2, len: 4 }
    if (idx2 === -1) return { idx: idx1, len: 2 }
    return idx2 < idx1 ? { idx: idx2, len: 4 } : { idx: idx1, len: 2 }
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      while (true) {
        const { idx: sep, len } = findEventSep(buffer)
        if (sep === -1) break
        const rawEvent = buffer.slice(0, sep)
        buffer = buffer.slice(sep + len)

        const lines = rawEvent.split(/\r?\n/)
        const dataLines: string[] = []
        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith('data:')) {
            const payload = trimmed.slice(5).trim()
            if (payload) dataLines.push(payload)
          } else if (trimmed.startsWith('{')) {
            dataLines.push(trimmed)
          }
        }

        for (const payload of dataLines) {
          if (payload === '[DONE]') return
          try {
            const json = JSON.parse(payload)
            const content = extractOpenAIContent(json)
            if (content) yield content
          } catch (e) {
          }
        }
      }
    }
  } finally {
    try {
      await reader.cancel()
    } catch (e) {
    }
    reader.releaseLock()
  }
}

async function fetchChatCompletionsWithFallback(
  settings: ApiSettings,
  body: Record<string, unknown>,
  signal: AbortSignal,
  accept: 'text/event-stream' | 'application/json' = 'text/event-stream'
): Promise<Response> {
  const url = `${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`

  const doFetch = async (payload: Record<string, unknown>) => {
    try {
      return await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: accept,
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal,
      })
    } catch (e: any) {
      if (signal.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }
      throw e
    }
  }

  const res = await doFetch(body)
  if (res.ok) return res

  if (res.status === 400) {
    const fallbackBody: Record<string, unknown> = {
      model: body.model,
      messages: body.messages,
      temperature: body.temperature ?? 0.1,
      stream: body.stream ?? true,
    }

    // Try without max_tokens first as a fallback, 
    // since strict models like glm-4v-flash may reject it entirely.
    const res2 = await doFetch(fallbackBody)
    if (res2.ok) return res2
  }

  return res
}

const CORRECTION_SYSTEM_PROMPT = `You are a strict IELTS Band 9 examiner.
Review the following sentence written by a student. Check ONLY for obvious grammatical errors, tense issues, or spelling mistakes.
DO NOT upgrade vocabulary. DO NOT rewrite for better style.
If there are hard errors, provide the corrected version.
If the sentence is grammatically correct (even if simple), return { "hasErrorOrBasic": false }.

Respond ONLY in valid JSON format (do not provide explanations):
{
  "hasErrorOrBasic": boolean,
  "original": "string",
  "improved": "string"
}`

const POLISH_TOOLTIP_SYSTEM_PROMPT = `You are an advanced IELTS Band 9 polishing engine.
Analyze the user's selected text and provide improvements based on the surrounding context.
1. IF THE SELECTED TEXT IS CHINESE: Translate it into highly natural, academic English that fits perfectly into the surrounding context. Provide EXACTLY 3 English translation options.
2. IF THE SELECTED TEXT IS ENGLISH:
   - If it's a SINGLE WORD: provide EXACTLY 3 advanced replacement words (Band 7+) that fit the context.
   - If it's a SHORT PHRASE (2-4 words): provide EXACTLY 3 improved alternatives that keep the meaning and fit the context.
   - If it's a SINGLE SENTENCE: rewrite it using advanced structures while keeping the original meaning intact. Provide 1-2 options.
   - If it's MULTIPLE SENTENCES: merge them into a single, highly condensed and complex sentence using appropriate logical connectors. Provide 1 option.

Respond ONLY in valid JSON format:
{
  "suggestions": ["string"]
}`

const POLISH_INLINE_SYSTEM_PROMPT = `You are an advanced IELTS Band 9 polishing engine.
Analyze the user's selected text and provide an improvement based on the surrounding context.
1. IF THE SELECTED TEXT IS CHINESE: Translate it into highly natural, academic English that fits perfectly into the surrounding context.
2. IF THE SELECTED TEXT IS ENGLISH: Rewrite the user's selected sentence into a more advanced and natural version while keeping the original meaning intact.

Return EXACTLY ONE suggestion string.

Respond ONLY in valid JSON format:
{
  "suggestions": ["string"]
}`

/**
 * Stream the autocomplete suggestion from the AI model
 */
export async function* streamAutocomplete(
  settings: ApiSettings,
  topic: Topic | null,
  textBeforeCursor: string,
  textAfterCursor: string,
  signal: AbortSignal,
  retryHint?: string
): AsyncGenerator<string, void, unknown> {
  if (!settings.apiKey || !textBeforeCursor.trim()) return

  const localBefore = textBeforeCursor.slice(Math.max(0, textBeforeCursor.length - 600))
  const introSentence = (textBeforeCursor.match(/^[\s\S]*?[.!?]/)?.[0] ?? textBeforeCursor).replace(/\s+/g, ' ').trim().slice(0, 160)
  const lastWord = (localBefore.match(/[A-Za-z']+\s*$/)?.[0] ?? '').trim()
  const wordFragment = (textBeforeCursor.match(/[A-Za-z']+$/)?.[0] ?? '')
  const articles = new Set(['a', 'an', 'the'])
  const preps = new Set(['in', 'at', 'on', 'from', 'to', 'during', 'between', 'over', 'for', 'with', 'within', 'throughout'])
  const aux = new Set(['is', 'are', 'was', 'were', 'has', 'have', 'had'])

  let cursorGrammarHint = 'Continue the current clause with a grammatical completion.'
  if (articles.has(lastWord.toLowerCase())) {
    cursorGrammarHint = 'Cursor hint: the last word is an article. Next should be a noun phrase (adjective + noun).'
  } else if (preps.has(lastWord.toLowerCase())) {
    cursorGrammarHint = 'Cursor hint: the last word is a preposition. Next should be a time/place noun phrase.'
  } else if (aux.has(lastWord.toLowerCase())) {
    cursorGrammarHint = 'Cursor hint: the last word is an auxiliary/linking verb. Next should complete the predicate with correct form.'
  }

  const topicTypeStr = topic?.taskType === 'task1' ? 'Task 1' : 'Task 2'
  
  const topicSummary = !topic
    ? 'Unknown Topic'
    : topic.type === 'text'
      ? topic.content
      : '(Image prompt attached)'

  const userTextPrompt = `Topic (${topicTypeStr}): ${topicSummary}

User's writing (LOCAL context, most important; recent only):
${localBefore}

Student's writing AFTER cursor:
${textAfterCursor || '(End of document)'}

Word fragment immediately before cursor (may be incomplete): "${wordFragment || '(none)'}"

${cursorGrammarHint}

Please provide the exact short continuation (max 12 words) that should be inserted exactly at the cursor position.
If the word fragment is incomplete, complete ONLY the current word (or the remainder of a key phrase) as described in the system rules.
Avoid repeating the introduction sentence: "${introSentence}"
${retryHint ? `\nIMPORTANT: ${retryHint}` : ''}`

  let userContent: any = userTextPrompt
  if (topic?.type === 'image') {
    let imageUrl = topic.content
    try {
      imageUrl = await compressInlineImage(topic.content)
    } catch (e) {
    }
    userContent = [
      { type: 'text', text: userTextPrompt },
      { type: 'image_url', image_url: { url: imageUrl } }
    ]
  }

  const requestBody: Record<string, unknown> = {
    model: settings.model,
    messages: [], // will be set below
    temperature: 0.1,
    max_tokens: 24,
    stop: ['\n', '\r', '.', '!', '?'],
    stream: true,
  }

  if (typeof userContent !== 'string') {
    // If it's an array (vision), prepend the system prompt to the text part
    const contentArray = [...userContent]
    for (let i = 0; i < contentArray.length; i++) {
      if (contentArray[i].type === 'text') {
        contentArray[i] = {
          ...contentArray[i],
          text: AUTOCOMPLETE_SYSTEM_PROMPT + '\n\n' + contentArray[i].text
        }
      }
    }
    requestBody.messages = [{ role: 'user', content: contentArray }]
  } else {
    requestBody.messages = [{ role: 'user', content: AUTOCOMPLETE_SYSTEM_PROMPT + '\n\n' + userContent }]
  }

  let res: Response
  try {
    res = await fetchChatCompletionsWithFallback(settings, requestBody, signal)
  } catch (e: any) {
    if (e?.name === 'AbortError') return
    res = await fetchChatCompletionsWithFallback(
      settings,
      {
        model: settings.model,
        messages: requestBody.messages,
        temperature: 0.1,
        max_tokens: 15,
        stream: false,
      },
      signal,
      'application/json'
    )
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API error (${res.status}): ${body.slice(0, 200)}`)
  }

  for await (const token of parseOpenAIStreamResponse(res)) {
    yield token
  }
}

export async function measureAutocompleteTTFT(
  settings: ApiSettings,
  topic: Topic | null,
  signal: AbortSignal,
  timeoutMs: number = 8000
): Promise<{ ttftMs: number; mode: 'stream' | 'non-stream' } | { error: string }> {
  if (!settings.apiKey) return { error: 'Missing API key' }

  const controller = new AbortController()
  const onAbort = () => controller.abort()
  signal.addEventListener('abort', onAbort)

  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const topicTypeStr = topic?.taskType === 'task1' ? 'Task 1' : 'Task 2'
    const topicSummary = !topic
      ? 'Unknown Topic'
      : topic.type === 'text'
        ? topic.content
        : '(Image prompt attached)'

    const userTextPrompt = `Topic (${topicTypeStr}): ${topicSummary}

Student's writing BEFORE cursor:
The graph illustrates the trends of

Student's writing AFTER cursor:
(End of document)

Please provide the exact short continuation (max 12 words) that should be inserted exactly at the cursor position.`

    let userContent: any = userTextPrompt
    if (topic?.type === 'image') {
      let imageUrl = topic.content
      try {
        imageUrl = await compressInlineImage(topic.content)
      } catch (e) {
      }
      userContent = [
        { type: 'text', text: userTextPrompt },
        { type: 'image_url', image_url: { url: imageUrl } }
      ]
    }

    const requestBody: Record<string, unknown> = {
      model: settings.model,
      messages: [], // will be set below
      temperature: 0.1,
      max_tokens: 16,
      stream: false,
    }

    if (typeof userContent !== 'string') {
      const contentArray = [...userContent]
      for (let i = 0; i < contentArray.length; i++) {
        if (contentArray[i].type === 'text') {
          contentArray[i] = {
            ...contentArray[i],
            text: AUTOCOMPLETE_SYSTEM_PROMPT + '\n\n' + contentArray[i].text
          }
        }
      }
      requestBody.messages = [{ role: 'user', content: contentArray }]
    } else {
      requestBody.messages = [{ role: 'user', content: AUTOCOMPLETE_SYSTEM_PROMPT + '\n\n' + userContent }]
    }

    const start = performance.now()
    const res = await fetchChatCompletionsWithFallback(
      settings,
      requestBody,
      controller.signal,
      'application/json'
    )

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { error: `API error (${res.status}): ${body.slice(0, 200)}` }
    }

    const json = await res.json().catch(() => null)
    const content = extractOpenAIContent(json)
    if (!content) return { error: 'Empty completion content' }
    return { ttftMs: Math.round(performance.now() - start), mode: 'non-stream' }
  } catch (e: any) {
    if (e?.name === 'AbortError') return { error: `Timeout (${timeoutMs}ms)` }
    return { error: e?.message || 'Unknown error' }
  } finally {
    window.clearTimeout(timeoutId)
    signal.removeEventListener('abort', onAbort)
  }
}

export interface SentenceCorrection {
  hasErrorOrBasic: boolean
  original?: string
  improved?: string
}

export interface PolishResult {
  suggestions: string[]
}

function extractJSON(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) return codeBlockMatch[1].trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) return jsonMatch[0]
  return text
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
  
  const payload: Record<string, any> = {
    model: settings.model,
    messages: [
      { role: 'system', content: CORRECTION_SYSTEM_PROMPT },
      { role: 'user', content: `Check this sentence:\n${sentence}` }
    ],
    temperature: 0.2,
    max_tokens: 1024,
  }

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
    return null // Fail silently for inline corrections
  }

  const json = await res.json()
  const content = json.choices?.[0]?.message?.content ?? ''
  
  if (!content) return null

  try {
    const result = JSON.parse(extractJSON(content)) as SentenceCorrection
    return result
  } catch (e) {
    return null
  }
}

/**
 * Polish the selected text based on its length (word, sentence, or multiple sentences)
 */
export async function polishSelection(
  settings: ApiSettings,
  selectedText: string,
  contextBefore: string,
  contextAfter: string,
  signal: AbortSignal,
  mode: 'tooltip' | 'inline' = 'tooltip'
): Promise<PolishResult | null> {
  if (!settings.apiKey || !selectedText.trim()) return null

  const url = `${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`
  const systemPrompt = mode === 'inline' ? POLISH_INLINE_SYSTEM_PROMPT : POLISH_TOOLTIP_SYSTEM_PROMPT
  
  const payload: Record<string, any> = {
    model: settings.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Text BEFORE selection: "${contextBefore}"\n\nSelected text to polish/translate: "${selectedText}"\n\nText AFTER selection: "${contextAfter}"` }
    ],
    temperature: mode === 'inline' ? 0.2 : 0.3,
    max_tokens: 1024,
  }

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
    return null
  }

  const json = await res.json()
  const content = json.choices?.[0]?.message?.content ?? ''
  
  if (!content) return null

  try {
    const result = JSON.parse(extractJSON(content)) as PolishResult
    return result
  } catch (e) {
    return null
  }
}
