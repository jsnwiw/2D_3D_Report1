// patchNotes.js - Load and display patch notes modal
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-patch-notes');
  const modal = document.getElementById('patch-notes-modal');
  const close = document.getElementById('patch-notes-close');
  const body = document.getElementById('patch-notes-body');

  if (!btn || !modal || !close || !body) return;

  // Load notes JSON (supports root and /desktop/, /mobile/ subdirectories)
  const jsonPath = /\/(desktop|mobile)\//.test(window.location.pathname) ? '../patch_notes.json' : 'patch_notes.json';
  fetch(jsonPath)
    .then((resp) => resp.json())
    .then((data) => {
      const { version, date, notes } = data;
      const header = document.createElement('h3');
      header.textContent = `버전 ${version} (${date})`;
      body.appendChild(header);
      const ul = document.createElement('ul');
      notes.forEach((note) => {
        const li = document.createElement('li');
        li.textContent = note;
        ul.appendChild(li);
      });
      body.appendChild(ul);
    })
    .catch((e) => {
      body.textContent = '패치 노트를 불러오는 중 오류 발생.';
      console.error(e);
    });

  btn.addEventListener('click', () => {
    modal.style.display = 'block';
  });
  close.addEventListener('click', () => {
    modal.style.display = 'none';
  });
  // Close when clicking outside modal content
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
});
