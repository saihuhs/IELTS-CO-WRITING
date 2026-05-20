# Tasks
- [x] Task 1: Fix inline AI polish display issue
  - [x] SubTask 1.1: Identify why `inlinePolishField` is being cleared or not rendered (e.g., selection change logic, React state synchronization, or CodeMirror plugin update).
  - [x] SubTask 1.2: Modify `ghostText.ts` or `IeltsEditor.tsx` to ensure the inline polish ghost text remains visible until the user explicitly dismisses it (by typing or clicking away).
- [x] Task 2: Adjust autocomplete sensitivity and length limits
  - [x] SubTask 2.1: In `IeltsEditor.tsx` and `editor-api.ts`, adjust the word fragment detection logic so it's less sensitive (e.g., ensure it only triggers when clearly inside a word, not at word boundaries).
  - [x] SubTask 2.2: Increase the maximum allowed words for autocomplete from 6 to a larger number (e.g., 12) in both the prompt instructions and the frontend trimming logic.

# Task Dependencies
- None
