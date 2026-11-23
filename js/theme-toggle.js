/* theme-toggle.js – 다크/라이트 테마 전환 */
(() => {
  const btn = document.getElementById('btn-toggle-theme');
  if (!btn) return;
  // 초기 테마 설정: 저장된 테마가 있으면 사용, 없으면 OS 선호도
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initTheme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', initTheme);

  // 버튼 클릭 시 토글
  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });
})();