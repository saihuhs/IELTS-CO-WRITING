import { StateField, StateEffect } from '@codemirror/state'
import { Decoration, DecorationSet, EditorView, WidgetType } from '@codemirror/view'

export interface CorrectionEntry {
  id: string
  from: number
  to: number
  original: string
  improved: string
  explanation?: string
}

// Effect to add a new correction
export const addCorrection = StateEffect.define<CorrectionEntry>()

// Effect to remove a correction (e.g. when user accepts it or edits the text)
export const removeCorrection = StateEffect.define<string>()

export const clearCorrections = StateEffect.define<null>()

// A StateField to track all active corrections
export const correctionsField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(corrections, tr) {
    // Map existing decorations to new document positions
    let newCorrections = corrections.map(tr.changes)

    // Apply effects
    for (const e of tr.effects) {
      if (e.is(addCorrection)) {
        const { from, to, improved } = e.value
        // Create strikethrough mark
        const strikeMark = Decoration.mark({
          class: 'cm-correction-strikethrough',
          attributes: { style: 'text-decoration: line-through; color: #ef4444; opacity: 0.7;' },
          id: e.value.id
        })
        // Create inline widget for improved text
        const replacementWidget = Decoration.widget({
          widget: new ReplacementWidget(improved, e.value.id),
          side: 1, // Draw after the strikethrough text
          id: e.value.id
        })

        newCorrections = newCorrections.update({
          add: [strikeMark.range(from, to), replacementWidget.range(to)],
        })
      } else if (e.is(removeCorrection)) {
        // Filter out decorations by id
        newCorrections = newCorrections.update({
          filter: (_f, _t, value) => value.spec.id !== e.value,
        })
      } else if (e.is(clearCorrections)) {
        newCorrections = Decoration.none
      }
    }

    return newCorrections
  },
  provide: (f) => EditorView.decorations.from(f),
})

// Widget to show the suggested replacement text (green, clickable)
class ReplacementWidget extends WidgetType {
  constructor(readonly text: string, readonly id: string) {
    super()
  }

  eq(other: ReplacementWidget) {
    return this.text === other.text && this.id === other.id
  }

  toDOM(view: EditorView) {
    const span = document.createElement('span')
    span.className = 'cm-correction-replacement'
    span.textContent = ` ${this.text} `
    span.style.color = '#10b981' // emerald-500
    span.style.fontWeight = '500'
    span.style.cursor = 'pointer'
    span.style.backgroundColor = 'rgba(16, 185, 129, 0.1)'
    span.style.borderRadius = '4px'
    span.style.padding = '0 4px'
    span.style.marginLeft = '4px'
    span.style.marginRight = '4px'
    span.title = 'Click to accept correction'

    // Click handler to accept the correction
    span.onclick = (e) => {
      e.preventDefault()
      // We need to find the range of the original text to replace it.
      // Since we don't have direct access to the full entry here, 
      // we emit an event that the Editor component will listen to.
      const event = new CustomEvent('accept-correction', {
        detail: { id: this.id, replacement: this.text },
        bubbles: true,
      })
      view.dom.dispatchEvent(event)
    }

    return span
  }
}
