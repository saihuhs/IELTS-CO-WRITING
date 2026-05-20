# Fix AI Polish and Relax Autocomplete Spec

## Why
1. The AI polish feature for sentence selection (inline display) is currently not showing up after selection.
2. The autocomplete feature is too sensitive to word fragments, often outputting single meaningless words, and the length restriction is too strict.

## What Changes
- Investigate and fix the issue where inline AI polish suggestions do not appear after selecting a sentence.
- Reduce the sensitivity of word fragment completion in autocomplete.
- Relax the word count limit for autocomplete to allow longer phrase/sentence completion.

## Impact
- Affected specs: AI Polish, Autocomplete
- Affected code: `src/components/editor/IeltsEditor.tsx`, `src/components/editor/ghostText.ts`, `src/lib/editor-api.ts`

## MODIFIED Requirements
### Requirement: AI Polish for Sentences
- **WHEN** user selects a sentence (> 3 words) and waits
- **THEN** the AI polish suggestion should be reliably displayed inline at the end of the selection without disappearing immediately.

### Requirement: Autocomplete
- **WHEN** user pauses typing
- **THEN** the autocomplete should provide meaningful continuations (up to ~10-12 words) and only restrict to single-word completion when strictly inside an unfinished word.
