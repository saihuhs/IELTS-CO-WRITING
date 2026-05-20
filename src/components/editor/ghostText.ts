import { StateField, StateEffect } from '@codemirror/state'
import { Decoration, DecorationSet, EditorView, WidgetType, keymap } from '@codemirror/view'

// An effect to update the current ghost text suggestion
export const setGhostText = StateEffect.define<string | null>()
export const setInlinePolish = StateEffect.define<{ text: string; from: number; to: number } | null>()

export function normalizeInsertionSpacing(view: EditorView, from: number, to: number, text: string) {
  const docStr = view.state.doc.toString()
  const prevChar = docStr[from - 1] || ''
  const nextChar = docStr[to] || ''

  const prevIsWord = /[A-Za-z0-9]/.test(prevChar)
  const nextIsWord = /[A-Za-z0-9]/.test(nextChar)

  const startsWord = /^[A-Za-z0-9]/.test(text)
  const endsWord = /[A-Za-z0-9]$/.test(text)

  const isCursorInsideWord = prevIsWord && nextIsWord
  // If we are replacing/inserting multiple words (contains a space), we definitely need spacing around it.
  const isMultiWord = text.trim().includes(' ')
  const isWordContinuation = prevIsWord && !text.startsWith(' ') && startsWord && !isCursorInsideWord && !isMultiWord

  let out = text
  if (!isWordContinuation && prevIsWord && startsWord && !out.startsWith(' ')) {
    out = ` ${out}`
  }
  if (!isWordContinuation && nextIsWord && endsWord && !out.endsWith(' ')) {
    out = `${out} `
  }
  return out
}

// State field that holds the current suggestion string
export const ghostTextField = StateField.define<string | null>({
  create() {
    return null
  },
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setGhostText)) {
        return e.value
      }
    }
    // Clear suggestion if the user types or moves the cursor
    if (tr.docChanged || tr.selection) {
      return null
    }
    return value
  },
  provide: (f) =>
    EditorView.decorations.from(f, (val) => {
      if (!val) return Decoration.none
      return ghostTextDecorations(val)
    }),
})

export const inlinePolishField = StateField.define<{ text: string; from: number; to: number } | null>({
  create() {
    return null
  },
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setInlinePolish)) {
        return e.value
      }
    }
    if (tr.docChanged) {
      return null
    }
    if (tr.selection && value) {
      const head = tr.state.selection.main.head
      if (head !== value.to) return null
    }
    return value
  },
  provide: (f) =>
    EditorView.decorations.from(f, (val) => {
      if (!val) return Decoration.none
      return inlinePolishDecorations(val)
    }),
})

function ghostTextDecorations(_text: string): DecorationSet {
  // We apply the decoration dynamically via a ViewPlugin, 
  // because we need the current cursor position from the view.
  return Decoration.none // This is handled in ghostTextPlugin
}

class GhostWidget extends WidgetType {
  constructor(readonly text: string, readonly pos: number) {
    super()
  }

  toDOM(view: EditorView) {
    const span = document.createElement('span')
    span.className = 'cm-ghost-text'

    span.textContent = normalizeInsertionSpacing(view, this.pos, this.pos, this.text)

    span.style.opacity = '0.4'
    span.style.color = '#9ca3af' // muted-foreground
    span.style.fontStyle = 'italic'
    span.style.pointerEvents = 'none'
    return span
  }
}

function inlinePolishDecorations(_val: { text: string; from: number; to: number }): DecorationSet {
  return Decoration.none
}

class InlinePolishWidget extends WidgetType {
  constructor(readonly text: string, readonly from: number, readonly to: number) {
    super()
  }

  toDOM(view: EditorView) {
    const span = document.createElement('span')
    span.className = 'cm-ghost-text'
    span.textContent = normalizeInsertionSpacing(view, this.from, this.to, this.text)
    span.style.opacity = '0.4'
    span.style.color = '#9ca3af'
    span.style.fontStyle = 'italic'
    span.style.pointerEvents = 'none'
    return span
  }
}

// Plugin to render the ghost text exactly at the cursor
import { ViewPlugin, ViewUpdate } from '@codemirror/view'

export const ghostTextPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = this.getDeco(view)
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.transactions.some((tr) =>
          tr.effects.some((e) => e.is(setGhostText))
        )
      ) {
        this.decorations = this.getDeco(update.view)
      }
    }

    getDeco(view: EditorView) {
      const suggestion = view.state.field(ghostTextField, false)
      if (!suggestion) return Decoration.none

      const pos = view.state.selection.main.head
      return Decoration.set([
        Decoration.widget({
          widget: new GhostWidget(suggestion, pos),
          side: 1, // Draw it after the cursor
        }).range(pos),
      ])
    }
  },
  {
    decorations: (v) => v.decorations,
  }
)

export const inlinePolishPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = this.getDeco(view)
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.transactions.some((tr) =>
          tr.effects.some((e) => e.is(setInlinePolish))
        )
      ) {
        this.decorations = this.getDeco(update.view)
      }
    }

    getDeco(view: EditorView) {
      const val = view.state.field(inlinePolishField, false)
      if (!val) return Decoration.none

      return Decoration.set([
        Decoration.widget({
          widget: new InlinePolishWidget(val.text, val.from, val.to),
          side: 1,
        }).range(val.to),
      ])
    }
  },
  { decorations: (v) => v.decorations }
)

// Keymap extension to accept the ghost text when pressing Tab
import { Prec } from '@codemirror/state'

export const acceptInlinePolishKeymap = Prec.highest(keymap.of([
  {
    key: 'Tab',
    run: (view: EditorView) => {
      const polish = view.state.field(inlinePolishField, false)
      if (!polish) return false

      const insert = normalizeInsertionSpacing(view, polish.from, polish.to, polish.text)
      view.dispatch({
        changes: { from: polish.from, to: polish.to, insert },
        selection: { anchor: polish.from + insert.length },
        effects: [setInlinePolish.of(null), setGhostText.of(null)],
      })
      return true
    },
  },
]))

export const acceptGhostTextKeymap = Prec.highest(keymap.of([
  {
    key: 'Tab',
    run: (view: EditorView) => {
      const suggestion = view.state.field(ghostTextField, false)
      if (suggestion) {
        const pos = view.state.selection.main.head

        const textToInsert = normalizeInsertionSpacing(view, pos, pos, suggestion)
        view.dispatch({
          changes: { from: pos, insert: textToInsert },
          selection: { anchor: pos + textToInsert.length },
          effects: setGhostText.of(null), // Clear the suggestion
        })
        return true // Prevent default Tab behavior
      }
      return false
    },
  },
]))
