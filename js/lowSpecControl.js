// js/lowSpecControl.js – 저사양 모드 토글 및 타입 전환 로직
(() => {
  /**
   * lowSpecMode 와 lowSpecType을 전역 상태에 저장하고,
   * 3D 캔버스와 저사양 2D 차트 컨테이너의 가시성을 전환합니다.
   *
   * @param {boolean} enabled   true → 저사양 모드 활성화, false → 일반 모드
   * @param {'lowres-model'|'3d-lite'|'2d-only'} type  저사양 동작 종류
   */
  window.__setLowSpecMode = (enabled, type = '3d-lite') => {
    const previous = window.appState?.lowSpecMode;
    const app = window.appState;
    const canvasContainer = document.getElementById('canvas-container');
    const lowSpecContainer = document.getElementById('lowspec-container');

    // 상태 업데이트
    app.lowSpecMode = enabled;
    app.lowSpecType = type;
    app.lowSpecManualOverride = true; // 사용자가 직접 전환했음을 기록

    // 로컬스토리지에 영구 저장
    try {
      localStorage.setItem('lowSpecMode', enabled);
      localStorage.setItem('lowSpecType', type);
    } catch (_) {}

    // UI 전환
    if (canvasContainer) canvasContainer.style.display = enabled ? 'none' : 'block';
    if (lowSpecContainer) lowSpecContainer.style.display = enabled ? 'block' : 'none';

    // 차트 렌더링 (2D 전용 또는 3D‑lite)
    if (enabled && (type === '2d-only' || type === '3d-lite')) {
      if (window.__renderLowSpecChartWithData) {
        const cached = window.cachedLowSpecData;
        if (cached) {
          window.__renderLowSpecChartWithData(cached.labels, cached.values, cached.title);
        } else {
          window.__renderLowSpecChartWithData();
        }
      }
    }

    // 저사양 GLB 모델 사전 로드 (3D‑lite 모드일 때)
    if (enabled && type !== '2d-only' && window.preloadLowResModels) {
      window.preloadLowResModels();
    }

    // UI 토글/체크박스 동기화
    const btn = document.getElementById('btn-lowspec-toggle');
    const menuChk = document.getElementById('menu-lowspec-toggle');
    const menuSel = document.getElementById('menu-lowspec-type');
    if (btn) btn.setAttribute('aria-pressed', enabled);
    if (menuChk) menuChk.checked = enabled;
    if (menuSel) menuSel.value = type;

    console.log('[LowSpec] mode:', enabled, 'type:', type);

    // 자동 적용 시 알림 (이전 상태가 false → true)
    if (enabled && !previous && typeof window.showToast === 'function') {
      window.showToast('✅ 저사양 모드가 자동으로 적용되었습니다.', 4000);
    }
  };
})();
