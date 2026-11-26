// add_patch_note.js
// Usage: node add_patch_note.js "Your note 1; Your note 2; ..."
// This script automatically appends a new patch entry to patch_notes.json
// and updates the Korean markdown changelog (패치내역.md).

const fs = require('fs');
const path = require('path');

// Helper to get YYYY-MM-DD formatted date
function today() {
  const d = new Date();
  const pad = n => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Determine next version based on existing entries (semantic vMAJOR.MINOR.PATCH)
function nextVersion(patchNotes) {
  if (!Array.isArray(patchNotes) || patchNotes.length === 0) return 'v1.0.0';
  const last = patchNotes[patchNotes.length - 1];
  const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(last.version);
  if (!match) return 'v1.0.0';
  let [_, major, minor, patch] = match.map(Number);
  patch += 1; // simple patch increment
  return `v${major}.${minor}.${patch}`;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Error: No notes provided.');
    process.exit(1);
  }
  const rawNotes = args.join(' ');
  const notes = rawNotes.split(';').map(n => n.trim()).filter(Boolean);
  const patchJsonPath = path.resolve(__dirname, '..', 'patch_notes.json');
  const mdPath = path.resolve(__dirname, '..', '패치내역.md');

  // Load existing JSON
  let data = { version: '', date: '', notes: [] };
  if (fs.existsSync(patchJsonPath)) {
    const content = fs.readFileSync(patchJsonPath, 'utf8');
    data = JSON.parse(content);
  }

  // Ensure we have an array of entries (if the file originally held a single object, wrap it)
  let entries = [];
  if (Array.isArray(data)) {
    entries = data;
  } else if (data.version) {
    entries = [data];
  }

  const newVersion = nextVersion(entries);
  const newEntry = {
    version: newVersion,
    date: today(),
    notes,
  };
  entries.push(newEntry);

  // Write pretty JSON (2‑space indent)
  fs.writeFileSync(patchJsonPath, JSON.stringify(entries, null, 2), 'utf8');

  // Append markdown entry
  const mdHeader = `## ${newVersion} (${newEntry.date})\n`;
  const mdNotes = notes.map(n => `- ${n}`).join('\n');
  const mdBlock = `\n${mdHeader}${mdNotes}\n`;
  fs.appendFileSync(mdPath, mdBlock, 'utf8');

  console.log(`Added patch note ${newVersion}`);
}

main();
