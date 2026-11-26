# Patch Note Automation

This folder contains a tiny utility to append new entries to the project's changelog.

## How to use
```bash
# From the project root
node scripts/add_patch_note.js "Fix rendering; Add dark theme support; Update AI Report depth options"
```

- Separate individual notes with a semicolon (`;`).
- The script will:
  1. Read the existing `patch_notes.json` (which can hold either a single object or an array of entries).
  2. Determine the next version number (increments the patch part).
  3. Append a new entry with the current date and the provided notes.
  4. Append a markdown section to `패치내역.md` for human‑readable changelog.

## Files
- `add_patch_note.js` – the executable script.
- `patch_notes.json` – JSON formatted changelog (array of entries).
- `패치내역.md` – Korean markdown changelog displayed in the app.
