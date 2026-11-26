// auto_patch_note.js
// Automatically generate a patch note entry from the latest git commit message.
// Usage: npm run auto-patch
// It reads the most recent commit message, extracts lines, and appends
// a new entry to patch_notes.json and 패치내역.md.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getLatestCommitMessage() {
  try {
    const raw = execSync('git log -1 --pretty=%B', { encoding: 'utf8' });
    return raw.trim();
  } catch (e) {
    console.error('Failed to get git commit message:', e);
    return '';
  }
}

function today() {
  const d = new Date();
  const pad = n => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nextVersion(patchNotes) {
  if (!Array.isArray(patchNotes) || patchNotes.length === 0) return 'v1.0.0';
  const last = patchNotes[patchNotes.length - 1];
  const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(last.version);
  if (!match) return 'v1.0.0';
  let [_, major, minor, patch] = match.map(Number);
  patch += 1;
  return `v${major}.${minor}.${patch}`;
}

function main() {
  const commitMsg = getLatestCommitMessage();
  if (!commitMsg) {
    console.error('No commit message found.');
    process.exit(1);
  }
  const notes = commitMsg.split('\n').map(l => l.trim()).filter(Boolean);

  const jsonPath = path.resolve(__dirname, '..', 'patch_notes.json');
  const mdPath = path.resolve(__dirname, '..', '패치내역.md');

  let entries = [];
  if (fs.existsSync(jsonPath)) {
    const content = fs.readFileSync(jsonPath, 'utf8');
    const data = JSON.parse(content);
    entries = Array.isArray(data) ? data : [data];
  }

  const newVer = nextVersion(entries);
  const newEntry = { version: newVer, date: today(), notes };
  entries.push(newEntry);

  fs.writeFileSync(jsonPath, JSON.stringify(entries, null, 2), 'utf8');

  const mdBlock = `\n## ${newVer} (${newEntry.date})\n${notes.map(n => `- ${n}`).join('\n')}\n`;
  fs.appendFileSync(mdPath, mdBlock, 'utf8');
  console.log(`Auto patch note added: ${newVer}`);
}

main();
