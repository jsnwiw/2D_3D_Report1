/* ==============================================================================
 * [theme-toggle.js] 다크 / 라이트 테마 전환 및 환경 설정 동기화
 * ============================================================================== */
(() => {
  function applyTheme(theme) {
    const htmlEl = document.documentElement;
    htmlEl.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {
      console.warn('localStorage access failed:', e);
    }

    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#0f172a' : '#f8fafc');
    }

    const buttons = document.querySelectorAll('#theme-toggle, #btn-toggle-theme, .theme-toggle-btn');
    buttons.forEach((btn) => {
      btn.innerHTML = theme === 'dark'
        ? '<span class="toolbar-icon" aria-hidden="true">🌙</span> 다크 모드'
        : '<span class="toolbar-icon" aria-hidden="true">☀️</span> 라이트 모드';
      btn.setAttribute('aria-label', theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환');
    });

    // 테마 변경 커스텀 이벤트 디스패치 (차트 및 3D 씬 반응용)
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
  }

  function initTheme() {
    let saved = 'light';
    try {
      saved = localStorage.getItem('theme');
    } catch (e) {}

    if (!saved) {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      saved = prefersDark ? 'dark' : 'light';
    }

    applyTheme(saved);

    // 이벤트 위임 또는 개별 버튼 바인딩
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('#theme-toggle, #btn-toggle-theme, .theme-toggle-btn');
      if (btn) {
        e.preventDefault();
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
  } else {
    initTheme();
  }
})();
