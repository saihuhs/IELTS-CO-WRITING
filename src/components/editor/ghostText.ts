import { StateField, StateEffect } from '@codemirror/state'
import { Decoration, DecorationSet, EditorView, WidgetType, keymap } from '@codemirror/view'

// An effect to update the current ghost text suggestion
export const setGhostText = StateEffect.define<string | null>()

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

function ghostTextDecorations(text: string): DecorationSet {
  // We apply the decoration dynamically via a ViewPlugin, 
  // because we need the current cursor position from the view.
  return Decoration.none // This is handled in ghostTextPlugin
}

class GhostWidget extends WidgetType {
  constructor(readonly text: string) {
    super()
  }

  toDOM(view: EditorView) {
    const span = document.createElement('span')
    span.className = 'cm-ghost-text'
    
    // Visually add a space if needed to match what Tab will insert
    const pos = view.state.selection.main.head
    const docStr = view.state.doc.toString()
    const prevChar = docStr[pos - 1] || ''
    const suggestionStartsWithLetter = /^[a-zA-Z]/.test(this.text)
    const prevCharIsLetter = /[a-zA-Z]/.test(prevChar)
    
    span.textContent = (suggestionStartsWithLetter && prevCharIsLetter) 
      ? ` ${this.text}` 
      : this.text

    span.style.opacity = '0.4'
    span.style.color = '#9ca3af' // muted-foreground
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
          widget: new GhostWidget(suggestion),
          side: 1, // Draw it after the cursor
        }).range(pos),
      ])
    }
  },
  {
    decorations: (v) => v.decorations,
  }
)

// Keymap extension to accept the ghost text when pressing Tab
import { Prec } from '@codemirror/state'

export const acceptGhostTextKeymap = Prec.highest(keymap.of([
  {
    key: 'Tab',
    run: (view: EditorView) => {
      const suggestion = view.state.field(ghostTextField, false)
      if (suggestion) {
        const pos = view.state.selection.main.head
        
        // Ensure there's a space before the suggestion if it starts with a letter
        // and the character before the cursor is also a letter (to avoid concatenated words like "Thereis")
        const docStr = view.state.doc.toString()
        const prevChar = docStr[pos - 1] || ''
        const suggestionStartsWithLetter = /^[a-zA-Z]/.test(suggestion)
        const prevCharIsLetter = /[a-zA-Z]/.test(prevChar)
        
        const textToInsert = (suggestionStartsWithLetter && prevCharIsLetter) 
          ? ` ${suggestion}` 
          : suggestion

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
