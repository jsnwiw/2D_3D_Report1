// js/lowSpecControl.js – 저사양 모드 토글 및 타입 전환 로직
(() => {
  /**
   * lowSpecMode 와 lowSpecType을 전역 상태에 저장하고,
   * 3D 캔버스와 저사양 2D 차트 컨테이너의 가시성을 전환합니다.
   *
   * @param {boolean} enabled   true → 저사양 모드 활성화, false → 일반 모드
   * @param {'lowres-model'|'3d-lite'|'2d-only'} type  저사양 동작 종류
   * @param {object} options    추가 옵션
   */
  const handleLowSpecChange = (enabled, type = '3d-lite', options = {}) => {
    // renderer3d.js 의 정교한 엔진 제어 함수가 등록되어 있다면 우선 위임
    if (typeof window.__rendererSetLowSpecMode === 'function') {
      window.__rendererSetLowSpecMode(enabled, type, options);
      return;
    }

    const previous = window.appState?.lowSpecMode;
    const app = window.appState;
    const canvasContainer = document.getElementById('canvas-container');
    const lowSpecContainer = document.getElementById('lowspec-container');

    // 상태 업데이트
    if (app) {
      app.lowSpecMode = enabled;
      app.lowSpecType = type;
      app.lowSpecManualOverride = true; // 사용자가 직접 전환했음을 기록
    }

    // 로컬스토리지에 영구 저장
    try {
      localStorage.setItem('lowSpecMode', enabled ? 'true' : 'false');
      localStorage.setItem('lowSpecType', type);
    } catch (_) {}

    // UI 전환 (2D 전용일 때만 3D 캔버스를 숨기고 2D 차트 표시)
    if (type === '2d-only') {
      if (canvasContainer) canvasContainer.style.display = enabled ? 'none' : 'block';
      if (lowSpecContainer) lowSpecContainer.style.display = enabled ? 'block' : 'none';
    } else {
      if (lowSpecContainer) lowSpecContainer.style.display = 'none';
      if (canvasContainer) canvasContainer.style.display = 'block';
    }

    // 차트 렌더링 (2D 전용)
    if (enabled && type === '2d-only') {
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

    // 알림
    if (enabled && !previous && typeof window.showToast === 'function') {
      window.showToast('✅ 저사양 모드가 적용되었습니다.', 4000);
    }
  };

  // 기존 등록 함수가 없으면 등록, 있으면 위임 가능하도록 보존
  if (!window.__setLowSpecMode) {
    window.__setLowSpecMode = handleLowSpecChange;
  }
  // 디버깅: 페이지 로드 시 무조건 일반 3D 모드로 전환
  if (window.__setLowSpecMode) {
    // Apply initial low‑spec state from appState if set, otherwise default to normal mode
    const initEnabled = window.appState?.lowSpecMode ?? false;
    const initType = window.appState?.lowSpecType ?? '3d-lite';
    window.__setLowSpecMode(initEnabled, initType);
  }
})();
