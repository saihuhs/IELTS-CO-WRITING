# Tasks
- [x] Task 1: Enable native spellcheck in CodeMirror
  - [x] SubTask 1.1: In `IeltsEditor.tsx`, update the CodeMirror component props to enable `spellCheck={true}` and ensure `contenteditable` attributes allow spellchecking.
- [x] Task 2: Enhance AI Correction Visuals
  - [x] SubTask 2.1: In `corrections.ts`, update the styling for `cm-correction-strikethrough` or create a new style for errors to use a red squiggly underline (`text-decoration: underline wavy red`) instead of a simple strikethrough.
  - [x] SubTask 2.2: Ensure the green replacement text is displayed immediately following the error.
  - [x] SubTask 2.3: Verify that the `acceptCorrectionKeymap` (Tab key) correctly replaces the text when the cursor is on or immediately after the correction widget.

# Task Dependencies
- None
