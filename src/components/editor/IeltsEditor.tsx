import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useCallback } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView } from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import { Sparkles, Loader2 } from 'lucide-react'
import type { Topic } from '@/types'
import { useApiSettings } from '@/contexts/ApiSettingsContext'
import { streamAutocomplete, checkSentence, polishSelection } from '@/lib/editor-api'

// Import custom extensions
import { ghostTextField, ghostTextPlugin, acceptGhostTextKeymap, setGhostText, inlinePolishField, inlinePolishPlugin, acceptInlinePolishKeymap, setInlinePolish, normalizeInsertionSpacing } from './ghostText'
import { correctionsField, addCorrection, removeCorrection, acceptCorrectionKeymap } from './corrections'

interface IeltsEditorProps {
  value: string
  onChange: (val: string) => void
  topic: Topic | null
  isConfigured: boolean
  onEditorFocus?: () => void
  onEditorBlur?: () => void
}

export interface IeltsEditorHandle {
  focus: () => void
}

export const IeltsEditor = forwardRef<IeltsEditorHandle, IeltsEditorProps>(function IeltsEditor(
  { value, onChange, topic, isConfigured, onEditorFocus, onEditorBlur }: IeltsEditorProps,
  ref
) {
  const { settings } = useApiSettings()
  const viewRef = useRef<EditorView | null>(null)
  
  // Abort controllers for API requests
  const autocompleteAbort = useRef<AbortController | null>(null)
  const correctionAbort = useRef<AbortController | null>(null)

  // Track the last analyzed text length to avoid re-checking
  const lastAnalyzedIndex = useRef<number>(0)

  const [selectionTooltip, setSelectionTooltip] = useState<{
    show: boolean
    top: number
    left: number
    from: number
    to: number
    text: string
    contextBefore: string
    contextAfter: string
  } | null>(null)
  
  const [polishState, setPolishState] = useState<{
    loading: boolean
    suggestions: string[]
  }>({ loading: false, suggestions: [] })

  const [polishTarget, setPolishTarget] = useState<{
    from: number
    to: number
    text: string
    contextBefore: string
    contextAfter: string
  } | null>(null)
  const [polishLoading, setPolishLoading] = useState(false)
  
  const polishAbort = useRef<AbortController | null>(null)

  const handleCreateEditor = (view: EditorView) => {
    viewRef.current = view
  }

  useImperativeHandle(ref, () => ({
    focus: () => {
      viewRef.current?.focus()
    },
  }), [])

  // Custom event listener to accept grammar corrections
  useEffect(() => {
    const handleAcceptCorrection = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string, replacement: string }>
      const { id, replacement } = customEvent.detail
      const view = viewRef.current
      if (!view) return

      // Find the range of the strikethrough text to replace
      const state = view.state
      const corrections = state.field(correctionsField, false)
      if (!corrections) return

      // Iterate decorations to find the mark with matching ID
      let foundFrom = -1
      let foundTo = -1
      corrections.between(0, state.doc.length, (from, to, value) => {
        if (value.spec.id === id && value.spec.class === 'cm-correction-strikethrough') {
          foundFrom = from
          foundTo = to
        }
      })

      if (foundFrom !== -1 && foundTo !== -1) {
        // Apply replacement and remove correction
        view.dispatch({
          changes: { from: foundFrom, to: foundTo, insert: replacement },
          effects: removeCorrection.of(id)
        })
        // Remove the extra space added by widget automatically since we replace the original text
      }
    }

    const dom = viewRef.current?.dom
    dom?.addEventListener('accept-correction', handleAcceptCorrection)
    return () => dom?.removeEventListener('accept-correction', handleAcceptCorrection)
  }, [viewRef.current])

  // Debounced Autocomplete
  useEffect(() => {
    if (!isConfigured || !viewRef.current) return

    const sanitizeAutocomplete = (text: string) => {
      let out = text
      out = out.replace(/<think>[\s\S]*?<\/think>/gi, '')
      out = out.replace(/<think[\s\S]*/gi, '')
      out = out.replace(/<\/think>/gi, '')
      
      const hadLeadingSpace = /^\s/.test(out)

      out = out.replace(/\r?\n/g, ' ')
      out = out.replace(/^\s*(?:\d+[\).\]]|[-*•])\s*/g, '')
      out = out.replace(/^\s*(overall|firstly|secondly|thirdly|in conclusion|to conclude|to sum up|to summarize)\s*[:,]?\s*/i, '')
      out = out.replace(/^[,.\s]+/, '')
      out = out.replace(/[.!?].*$/, '')
      out = out.replace(/\s+/g, ' ')
      out = out.trimEnd()
      
      out = hadLeadingSpace ? ` ${out.trimStart()}` : out.trim()
      if (!out) return ''
      
      const words = out.trim().split(' ')
      const limited = words.slice(0, 12).join(' ')
      return hadLeadingSpace && !limited.startsWith(' ') ? ` ${limited}` : limited
    }

    const applyCaseRule = (suggestion: string, textBeforeCursor: string) => {
      if (!suggestion) return ''
      let i = textBeforeCursor.length - 1
      while (i >= 0 && /\s/.test(textBeforeCursor[i])) i--
      const last = i >= 0 ? textBeforeCursor[i] : ''
      const atSentenceStart = !last || ['.', '!', '?', '\n'].includes(last)

      const first = suggestion[0]
      if (!/[a-zA-Z]/.test(first)) return suggestion
      if (atSentenceStart && /[a-z]/.test(first)) return first.toUpperCase() + suggestion.slice(1)
      if (!atSentenceStart && /[A-Z]/.test(first)) return first.toLowerCase() + suggestion.slice(1)
      return suggestion
    }

    const keepOnlyReasonable = (cleaned: string, raw: string) => {
      if (cleaned) return cleaned
      const fallback = sanitizeAutocomplete(raw)
      if (fallback) return fallback
      return ''
    }

    const tokenizeWords = (text: string) => text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? []

    const getIntroWords = (textBeforeCursor: string) => {
      const m = textBeforeCursor.match(/^[\s\S]*?[.!?]/)
      const intro = (m ? m[0] : textBeforeCursor).slice(0, 400)
      return tokenizeWords(intro)
    }

    const introducesNewEntityNearCursor = (suggestion: string, textBeforeCursor: string, textAfterCursor: string) => {
      const stop = new Set([
        'the','a','an','of','to','in','on','at','by','for','with','as','is','are','was','were','be','been','being',
        'it','this','that','these','those','and','or','but','from','into','over','under','between','during','while',
        'however','although','whereas','overall','firstly','secondly','thirdly','then','also','more','most','less','least'
      ])
      const descriptor = new Set([
        'significant','notable','remarkable','clear','obvious','steady','gradual','sharp','slight','substantial','dramatic',
        'overall','generally','similarly','respectively','approximately','around','nearly','roughly'
      ])

      const recentContext = tokenizeWords(
        (textBeforeCursor.slice(Math.max(0, textBeforeCursor.length - 400)) + ' ' + textAfterCursor.slice(0, 80))
      )
      const recentSet = new Set(recentContext)

      const words = tokenizeWords(suggestion)
      for (const w of words.slice(0, 12)) {
        if (stop.has(w) || descriptor.has(w)) continue
        return !recentSet.has(w)
      }
      return false
    }

    const stripIntroPrefixIfNeeded = (suggestion: string, introWords: string[]) => {
      const words = tokenizeWords(suggestion)
      if (words.length < 4 || introWords.length < 4) return suggestion

      let k = 0
      while (k < Math.min(12, words.length, introWords.length) && words[k] === introWords[k]) k++
      if (k < 4) return suggestion

      const parts = suggestion.split(/\s+/)
      const stripped = parts.slice(k).join(' ').trimStart()
      return stripped
    }

    const isHighIntroRepeat = (suggestion: string, textBeforeCursor: string) => {
      const stop = new Set([
        'the','a','an','of','to','in','on','at','by','for','with','as','is','are','was','were','be','been','being',
        'it','this','that','these','those','and','or','but','from','into','over','under','between','during'
      ])

      const introWords = getIntroWords(textBeforeCursor)
      const sugWords = tokenizeWords(suggestion)
      if (introWords.length < 6 || sugWords.length < 4) return false

      const n = Math.min(12, sugWords.length)
      const phrase = sugWords.slice(0, n).join(' ')
      const introStr = introWords.join(' ')

      const hasNonStop = sugWords.slice(0, n).some((w) => !stop.has(w))
      if (!hasNonStop) return false

      return introStr.includes(phrase)
    }

    const isEgregiousRepeat = (suggestion: string, textBeforeCursor: string) => {
      const stop = new Set([
        'the','a','an','of','to','in','on','at','by','for','with','as','is','are','was','were','be','been','being',
        'it','this','that','these','those','and','or','but','from','into','over','under','between','during'
      ])
      const words = tokenizeWords(suggestion)
      if (words.length < 4) return false
      if (stop.has(words[0]!) && stop.has(words[1]!) && stop.has(words[2]!) && stop.has(words[3]!)) return false

      const prefix4 = `${words[0]} ${words[1]} ${words[2]} ${words[3]}`
      const recent = tokenizeWords(textBeforeCursor).slice(-600)
      if (recent.length < 4) return false
      for (let i = 0; i <= recent.length - 4; i++) {
        const gram = `${recent[i]} ${recent[i + 1]} ${recent[i + 2]} ${recent[i + 3]}`
        if (gram === prefix4) return true
      }
      return false
    }

    const stripOverlappingPrefix = (suggestion: string, textBeforeCursor: string) => {
      if (!suggestion) return ''
      
      const sugLower = suggestion.toLowerCase()
      const ctxTrimmed = textBeforeCursor.trimEnd().toLowerCase()
      
      const maxOverlap = Math.min(sugLower.length, ctxTrimmed.length, 120)
      for (let len = maxOverlap; len > 0; len--) {
        if (ctxTrimmed.slice(-len) === sugLower.slice(0, len)) {
          const remainder = suggestion.slice(len)
          const hadSpace = /^\s/.test(remainder)
          return hadSpace ? ` ${remainder.trimStart()}` : remainder.trimStart()
        }
      }
      
      const getWords = (text: string) => text.toLowerCase().match(/[a-z0-9]+/g) || []
      const sugWords = getWords(suggestion)
      const ctxWords = getWords(textBeforeCursor.slice(-150))
      
      const maxWords = Math.min(sugWords.length, ctxWords.length, 12)
      for (let w = maxWords; w > 0; w--) {
        const ctxTail = ctxWords.slice(-w).join(' ')
        const sugHead = sugWords.slice(0, w).join(' ')
        if (ctxTail === sugHead) {
          let wordCount = 0
          let matchIndex = 0
          for (let i = 0; i < suggestion.length; i++) {
            if (/[a-zA-Z0-9]/.test(suggestion[i])) {
              while (i < suggestion.length && /[a-zA-Z0-9]/.test(suggestion[i])) {
                i++
              }
              wordCount++
              if (wordCount === w) {
                matchIndex = i
                break
              }
            }
          }
          const remainder = suggestion.slice(matchIndex)
          const hadSpace = /^\s/.test(remainder)
          const cleaned = remainder.replace(/^[^a-zA-Z0-9]+/, '')
          return hadSpace ? ` ${cleaned}` : cleaned
        }
      }
      
      return suggestion
    }

    const applyImeMode = (suggestion: string, textBeforeCursor: string) => {
      if (!suggestion) return suggestion
      const prevChar = textBeforeCursor.slice(-1)
      const prevIsWord = /[A-Za-z0-9]/.test(prevChar)

      if (prevIsWord) {
        const hadLeadingSpace = suggestion.startsWith(' ')
        const words = suggestion.trim().split(/\s+/)
        
        // If the AI already provided a space, it's definitely a new word.
        if (hadLeadingSpace) return suggestion

        if (words.length > 0) {
          // If the first word of the suggestion is a very common starting word,
          // it's almost certainly a new word, not a word fragment.
          const commonNewWords = new Set([
            'the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with',
            'as', 'this', 'that', 'these', 'those', 'it', 'they', 'he', 'she', 'we', 'you', 'I',
            'their', 'his', 'her', 'our', 'my', 'your', 'its', 'and', 'but', 'or', 'so', 'because',
            'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how', 'what',
            'not', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
            'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must'
          ])
          
          if (commonNewWords.has(words[0].toLowerCase())) {
            // It's a new word, but missing a space. Let's add it!
            return ` ${suggestion.trimStart()}`
          }

          // Otherwise, assume it's completing the current word (IME mode)
          // and we only want the rest of this word.
          return words[0]
        }
      }
      return suggestion
    }

    const ensureLeadingSpaceIfNewWord = (suggestion: string) => {
      // Trust the AI to provide the correct spacing based on the prompt instructions.
      // If we blindly add a space, we break the AI's ability to complete word fragments.
      return suggestion
    }

    const timeout = setTimeout(async () => {
      const view = viewRef.current
      if (!view) return

      const state = view.state
      const pos = state.selection.main.head
      const textBeforeCursor = state.doc.sliceString(0, pos)
      const textAfterCursor = state.doc.sliceString(pos)
      const lastSentenceWords = textBeforeCursor.split(/[.!?]\n?/).pop()?.trim().split(/\s+/) || []

      // Only trigger if we have at least 3 words in the current sentence
      // This prevents the AI from trying to generate a whole sentence from scratch
      if (lastSentenceWords.length < 3 || !lastSentenceWords[0]) return

      // Abort previous autocomplete request
      if (autocompleteAbort.current) autocompleteAbort.current.abort()

      const retryHint2 =
        'Hard rule: do NOT restate the introduction. Focus on describing key features/trends/comparisons from the prompt image and continue ONLY the current sentence fragment.'
      const retryHintNewEntity =
        'You introduced a new subject/entity not present near the cursor. Continue the most recent subject already written, and provide only a verb phrase/predicate to complete the current clause.'

      const runAttempt = async (attempt: 1 | 2 | 3) => {
        if (autocompleteAbort.current) autocompleteAbort.current.abort()
        autocompleteAbort.current = new AbortController()

        let abortedForRetry = false
        try {
          const stream = streamAutocomplete(
            settings,
            topic,
            textBeforeCursor,
            textAfterCursor,
            autocompleteAbort.current.signal,
            attempt === 2 ? retryHintNewEntity : attempt === 3 ? retryHint2 : undefined
          )
          let suggestion = ''
          for await (const chunk of stream) {
            suggestion += chunk
            
            let cleanedSuggestion = sanitizeAutocomplete(suggestion)
            cleanedSuggestion = applyImeMode(cleanedSuggestion, textBeforeCursor)
            cleanedSuggestion = stripOverlappingPrefix(cleanedSuggestion, textBeforeCursor)
            cleanedSuggestion = applyCaseRule(cleanedSuggestion, textBeforeCursor)
            cleanedSuggestion = ensureLeadingSpaceIfNewWord(cleanedSuggestion)

            cleanedSuggestion = keepOnlyReasonable(cleanedSuggestion, suggestion)

            if (cleanedSuggestion) {
              const introWords = getIntroWords(textBeforeCursor)
              if (isHighIntroRepeat(cleanedSuggestion, textBeforeCursor)) {
                if (attempt < 3) {
                  abortedForRetry = true
                  view.dispatch({ effects: setGhostText.of(null) })
                  autocompleteAbort.current?.abort()
                  break
                }
                cleanedSuggestion = stripIntroPrefixIfNeeded(cleanedSuggestion, introWords)
              }
            }

            if (cleanedSuggestion && attempt === 1 && introducesNewEntityNearCursor(cleanedSuggestion, textBeforeCursor, textAfterCursor)) {
              abortedForRetry = true
              view.dispatch({ effects: setGhostText.of(null) })
              autocompleteAbort.current?.abort()
              break
            }

            if (cleanedSuggestion && attempt === 1 && isEgregiousRepeat(cleanedSuggestion, textBeforeCursor)) {
              abortedForRetry = true
              view.dispatch({ effects: setGhostText.of(null) })
              autocompleteAbort.current?.abort()
              break
            }

            if (cleanedSuggestion) {
              view.dispatch({
                effects: setGhostText.of(cleanedSuggestion)
              })
            }
          }
        } catch (e: any) {
          if (e.name !== 'AbortError' && !abortedForRetry) console.error('Autocomplete error:', e)
        } finally {
          if (abortedForRetry && attempt < 3) {
            const next = (attempt + 1) as 2 | 3
            await runAttempt(next)
          }
        }
      }

      await runAttempt(1)
    }, 800) // Trigger 800ms after user stops typing

    return () => {
      clearTimeout(timeout)
      if (autocompleteAbort.current) autocompleteAbort.current.abort()
    }
  }, [value, isConfigured, settings, topic])

  // Sentence Correction Check on Punctuation & Selection Polish
  const handleUpdate = useCallback((viewUpdate: any) => {
    if (!isConfigured || !viewRef.current) return
    
    // --- Selection Polish Logic ---
    if (viewUpdate.selectionSet) {
      const isSettingPolish = viewUpdate.transactions.some((tr: any) =>
        tr.effects.some((e: any) => e.is(setInlinePolish) && e.value !== null)
      )

      const state = viewUpdate.state
      const mainSelection = state.selection.main
      
      if (isSettingPolish) {
        // The inline polish was just set, do not clear it
      } else if (!mainSelection.empty && mainSelection.to - mainSelection.from > 1) {
        const text = state.sliceDoc(mainSelection.from, mainSelection.to).trim()
        if (text) {
          const contextBefore = state.sliceDoc(Math.max(0, mainSelection.from - 200), mainSelection.from)
          const contextAfter = state.sliceDoc(mainSelection.to, Math.min(state.doc.length, mainSelection.to + 200))
          
          const wordCount = text.split(/\s+/).filter(Boolean).length
          if (wordCount <= 3) {
            const view = viewRef.current
            const editorRect = view.dom.getBoundingClientRect()
            const endCoords = view.coordsAtPos(mainSelection.to)
            if (endCoords) {
              const tooltipHeight = 260
              const bottomTop = endCoords.bottom - editorRect.top + 5
              const topTop = endCoords.top - editorRect.top - tooltipHeight - 8
              const safeTop = bottomTop + tooltipHeight > editorRect.height ? Math.max(0, topTop) : bottomTop

              setSelectionTooltip({
                show: true,
                top: safeTop,
                left: Math.min(endCoords.left - editorRect.left, editorRect.width - 250),
                from: mainSelection.from,
                to: mainSelection.to,
                text,
                contextBefore,
                contextAfter
              })
              setPolishState({ loading: false, suggestions: [] })
              setPolishTarget(null)
              setPolishLoading(false)
              if (polishAbort.current) polishAbort.current.abort()
              viewRef.current.dispatch({ effects: setInlinePolish.of(null) })
            }
          } else {
            setSelectionTooltip(null)
            setPolishState({ loading: false, suggestions: [] })
            setPolishTarget({ from: mainSelection.from, to: mainSelection.to, text, contextBefore, contextAfter })
            setPolishLoading(false)
            if (polishAbort.current) polishAbort.current.abort()
            viewRef.current.dispatch({ effects: setInlinePolish.of(null) })
          }
        }
      } else {
        setPolishTarget(null)
        setPolishLoading(false)
        if (polishAbort.current) polishAbort.current.abort()
        setSelectionTooltip(null)
        setPolishState({ loading: false, suggestions: [] })
        viewRef.current.dispatch({ effects: setInlinePolish.of(null) })
      }
    }

    // --- Correction Logic ---
    if (viewUpdate.docChanged) {
      // Clear ghost text on any document change
      viewUpdate.view.dispatch({ effects: setGhostText.of(null) })

      const state = viewUpdate.state
      const docStr = state.doc.toString()
      const pos = state.selection.main.head

      // Check if user just typed a sentence-ending punctuation + space or newline
      // Or if they typed a space after a word (to trigger word-by-word checking, but maybe batch by chunks)
      const lastChar = docStr[pos - 1]
      const prevChar = docStr[pos - 2]
      
      // We trigger sentence check if they finish a sentence: ". "
      const isSentenceEnd = (lastChar === ' ' || lastChar === '\n') && ['.', '!', '?'].includes(prevChar)
      
      // We ALSO want to trigger check when they type a punctuation mark WITHOUT a space, e.g. "word."
      // But only if they pause typing (handled by another effect or just trigger immediately?)
      // For now, let's also trigger if lastChar is punctuation and we haven't checked it.
      const isPunctuationEnd = ['.', '!', '?'].includes(lastChar)
      const shouldCheck = isSentenceEnd || isPunctuationEnd
      
      // Handle deletions that move cursor before our analyzed index
      if (pos < lastAnalyzedIndex.current) {
        lastAnalyzedIndex.current = Math.max(0, pos - 100)
      }
      
      // Also trigger if they pause typing for 800ms? 
      // Actually, let's keep it simple: trigger on sentence end, but ALSO fix the native spellcheck issue.
      
      if (shouldCheck && pos > lastAnalyzedIndex.current) {
        // Find the actual start of the sentence by looking backwards
        let sentenceStart = pos - (isSentenceEnd ? 2 : 1)
        while (sentenceStart > 0) {
          const char = docStr[sentenceStart]
          if (['.', '!', '?', '\n'].includes(char)) {
            sentenceStart += 1
            break
          }
          sentenceStart--
        }
        
        const textToAnalyze = docStr.substring(sentenceStart, pos - (isSentenceEnd ? 1 : 0)).trim()
        const actualStartIndex = docStr.indexOf(textToAnalyze, sentenceStart)
        const endIndex = actualStartIndex + textToAnalyze.length

        lastAnalyzedIndex.current = pos // Update analyzed index to prevent re-checking

        if (textToAnalyze.split(/\s+/).length > 3) {
          // Abort previous correction request to avoid overlaps
          if (correctionAbort.current) correctionAbort.current.abort()
          correctionAbort.current = new AbortController()

          // Automatically fix spacing issues in the analyzed text so AI doesn't get confused
          const normalizedTextToAnalyze = textToAnalyze.replace(/([a-zA-Z])([.!?])([a-zA-Z])/g, '$1$2 $3')

          checkSentence(settings, normalizedTextToAnalyze, correctionAbort.current.signal)
            .then((result) => {
              if (result && result.hasErrorOrBasic && result.improved) {
                const id = crypto.randomUUID()
                viewRef.current?.dispatch({
                  effects: addCorrection.of({
                    id,
                    from: actualStartIndex,
                    to: endIndex,
                    original: textToAnalyze,
                    improved: result.improved
                  })
                })
              }
            })
            .catch((e) => {
              if (e.name !== 'AbortError') console.error('Correction error:', e)
            })
        }
      }
    }
  }, [isConfigured, settings])

  useEffect(() => {
    if (!selectionTooltip?.show || !selectionTooltip.text || polishState.suggestions.length > 0 || polishState.loading) return

    const timeout = setTimeout(async () => {
      if (polishAbort.current) polishAbort.current.abort()
      polishAbort.current = new AbortController()

      setPolishState({ loading: true, suggestions: [] })
      
      try {
        const result = await polishSelection(settings, selectionTooltip.text, selectionTooltip.contextBefore, selectionTooltip.contextAfter, polishAbort.current.signal, 'tooltip')
        const suggestions = (result?.suggestions ?? []).map(s => s.trim()).filter(Boolean).slice(0, 3)
        if (suggestions.length > 0) {
          setPolishState({ loading: false, suggestions })
        } else {
          setPolishState({ loading: false, suggestions: [] })
          setSelectionTooltip(null)
        }
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          console.error('Polish error:', e)
          setPolishState({ loading: false, suggestions: [] })
          setSelectionTooltip(null)
        }
      }
    }, 450)

    return () => clearTimeout(timeout)
  }, [selectionTooltip, settings, polishState.suggestions.length, polishState.loading])

  // Polish Trigger
  useEffect(() => {
    if (!polishTarget?.text || polishLoading) return

    const timeout = setTimeout(async () => {
      if (polishAbort.current) polishAbort.current.abort()
      polishAbort.current = new AbortController()

      setPolishLoading(true)
      
      try {
        const result = await polishSelection(settings, polishTarget.text, polishTarget.contextBefore, polishTarget.contextAfter, polishAbort.current.signal, 'inline')
        const suggestion = result?.suggestions?.[0]?.trim()
        if (!suggestion) {
          setPolishLoading(false)
          setPolishTarget(null)
          return
        }

        const view = viewRef.current
        if (!view) return
        view.dispatch({
          selection: { anchor: polishTarget.to },
          effects: setInlinePolish.of({ text: suggestion, from: polishTarget.from, to: polishTarget.to })
        })
        setPolishLoading(false)
        setPolishTarget(null)
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          console.error('Polish error:', e)
          setPolishLoading(false)
          setPolishTarget(null)
        }
      }
    }, 600) // Wait 600ms after selection is stable before fetching

    return () => clearTimeout(timeout)
  }, [polishTarget, settings, polishLoading])

  const acceptPolishSuggestion = (suggestion: string) => {
    if (!viewRef.current || !selectionTooltip) return
    const view = viewRef.current
    const insert = normalizeInsertionSpacing(view, selectionTooltip.from, selectionTooltip.to, suggestion)
    view.dispatch({
      changes: { from: selectionTooltip.from, to: selectionTooltip.to, insert },
      selection: { anchor: selectionTooltip.from + insert.length }
    })
    setSelectionTooltip(null)
    setPolishState({ loading: false, suggestions: [] })
  }

  return (
    <div className="relative w-full bg-background text-base">
      <CodeMirror
        value={value}
        onChange={onChange}
        theme="light"
        height="420px"
        minHeight="300px"
        spellCheck={true}
        extensions={[
          EditorView.contentAttributes.of({ spellcheck: 'true' }),
          EditorView.domEventHandlers({
            focus: () => {
              onEditorFocus?.()
              return false
            },
            blur: () => {
              onEditorBlur?.()
              return false
            },
          }),
          markdown(),
          EditorView.lineWrapping,
          ghostTextField,
          ghostTextPlugin,
          inlinePolishField,
          inlinePolishPlugin,
          acceptInlinePolishKeymap,
          acceptGhostTextKeymap,
          correctionsField,
          acceptCorrectionKeymap,
          EditorView.updateListener.of(handleUpdate)
        ]}
        onCreateEditor={handleCreateEditor}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
          dropCursor: false,
          allowMultipleSelections: false,
          indentOnInput: false,
          syntaxHighlighting: false,
          bracketMatching: false,
          closeBrackets: true,
          autocompletion: false,
          rectangularSelection: false,
          crosshairCursor: false,
        }}
        className="h-full w-full [&_.cm-editor]:font-sans [&_.cm-editor]:text-base [&_.cm-scroller]:font-sans [&_.cm-content]:p-4"
      />

      {selectionTooltip?.show && (
        <div 
          className="absolute z-[100] flex flex-col gap-1.5 p-2 bg-popover border shadow-lg rounded-md w-max max-w-[300px] animate-in fade-in zoom-in-95 duration-150"
          style={{ top: selectionTooltip.top, left: selectionTooltip.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="flex items-center gap-1.5 px-1 pb-1 border-b border-border/50">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">AI Polish</span>
          </div>
          
          {polishState.loading ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
              {polishState.suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => acceptPolishSuggestion(suggestion)}
                  className="text-left text-sm px-2 py-1.5 rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors break-words"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
})
