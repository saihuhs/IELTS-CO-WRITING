import { useEffect, useRef, useState, useCallback } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import type { ApiSettings, Topic } from '@/types'
import { useApiSettings } from '@/contexts/ApiSettingsContext'
import { streamAutocomplete, checkSentence } from '@/lib/editor-api'

// Import custom extensions
import { ghostTextField, ghostTextPlugin, acceptGhostTextKeymap, setGhostText } from './ghostText'
import { correctionsField, addCorrection, removeCorrection, clearCorrections } from './corrections'

interface IeltsEditorProps {
  value: string
  onChange: (val: string) => void
  topic: Topic | null
  isConfigured: boolean
}

export function IeltsEditor({ value, onChange, topic, isConfigured }: IeltsEditorProps) {
  const { settings } = useApiSettings()
  const viewRef = useRef<EditorView | null>(null)
  
  // Abort controllers for API requests
  const autocompleteAbort = useRef<AbortController | null>(null)
  const correctionAbort = useRef<AbortController | null>(null)

  // Track the last analyzed text length to avoid re-checking
  const lastAnalyzedIndex = useRef<number>(0)

  const handleCreateEditor = (view: EditorView) => {
    viewRef.current = view
  }

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

    const timeout = setTimeout(async () => {
      const view = viewRef.current
      if (!view) return

      const state = view.state
      const pos = state.selection.main.head
      const textBeforeCursor = state.doc.sliceString(0, pos)
      
      // Only trigger if we have at least some words
      if (textBeforeCursor.trim().length === 0) return

      // Abort previous autocomplete request
      if (autocompleteAbort.current) autocompleteAbort.current.abort()
      autocompleteAbort.current = new AbortController()

      try {
        const stream = streamAutocomplete(settings, topic, textBeforeCursor, autocompleteAbort.current.signal)
        let suggestion = ''
        for await (const chunk of stream) {
          suggestion += chunk
          // Dynamically update ghost text as it streams
          view.dispatch({
            effects: setGhostText.of(suggestion)
          })
        }
      } catch (e: any) {
        if (e.name !== 'AbortError') console.error('Autocomplete error:', e)
      }
    }, 800) // Trigger 800ms after user stops typing

    return () => {
      clearTimeout(timeout)
      if (autocompleteAbort.current) autocompleteAbort.current.abort()
    }
  }, [value, isConfigured, settings, topic])

  // Sentence Correction Check on Punctuation
  const handleUpdate = useCallback((viewUpdate: any) => {
    if (!isConfigured || !viewRef.current) return
    if (viewUpdate.docChanged) {
      // Clear ghost text on any document change
      viewUpdate.view.dispatch({ effects: setGhostText.of(null) })

      const state = viewUpdate.state
      const docStr = state.doc.toString()
      const pos = state.selection.main.head

      // Check if user just typed a sentence-ending punctuation + space or newline
      const lastChar = docStr[pos - 1]
      const prevChar = docStr[pos - 2]
      
      const isSentenceEnd = (lastChar === ' ' || lastChar === '\n') && ['.', '!', '?'].includes(prevChar)
      
      // Handle deletions that move cursor before our analyzed index
      if (pos < lastAnalyzedIndex.current) {
        lastAnalyzedIndex.current = Math.max(0, pos - 100)
      }
      
      if (isSentenceEnd && pos > lastAnalyzedIndex.current) {
        // Find the actual start of the sentence by looking backwards
        let sentenceStart = pos - 2
        while (sentenceStart > 0) {
          const char = docStr[sentenceStart]
          if (['.', '!', '?', '\n'].includes(char)) {
            sentenceStart += 1
            break
          }
          sentenceStart--
        }
        
        const textToAnalyze = docStr.substring(sentenceStart, pos - 1).trim()
        const actualStartIndex = docStr.indexOf(textToAnalyze, sentenceStart)
        const endIndex = actualStartIndex + textToAnalyze.length

        lastAnalyzedIndex.current = pos // Update analyzed index to prevent re-checking

        if (textToAnalyze.split(/\s+/).length > 3) {
          // Abort previous correction request to avoid overlaps
          if (correctionAbort.current) correctionAbort.current.abort()
          correctionAbort.current = new AbortController()

          checkSentence(settings, textToAnalyze, correctionAbort.current.signal)
            .then((result) => {
              if (result && result.hasErrorOrBasic && result.improved) {
                const id = crypto.randomUUID()
                viewRef.current?.dispatch({
                  effects: addCorrection.of({
                    id,
                    from: actualStartIndex,
                    to: endIndex,
                    original: textToAnalyze,
                    improved: result.improved,
                    explanation: result.explanation
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

  return (
    <div className="relative min-h-[300px] w-full bg-background overflow-hidden text-base">
      <CodeMirror
        value={value}
        onChange={onChange}
        theme="light"
        height="100%"
        minHeight="300px"
        extensions={[
          markdown(),
          EditorView.lineWrapping,
          ghostTextField,
          ghostTextPlugin,
          acceptGhostTextKeymap,
          correctionsField,
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
    </div>
  )
}
