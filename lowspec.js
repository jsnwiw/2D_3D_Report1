// lowspec.js – 저사양 기기 자동 감지, 렉 방지 최적화 모드 및 2D/3D 전환
(() => {
  // 기본 상태 플래그
  window.isLowSpec = false;
  window.lowspecChart = null;
  window.cachedLowSpecData = null;

  // 1️⃣ 메모리 기반 감지 (4 GB 이하이면 저사양으로 간주)
  const mem = navigator.deviceMemory || 8;
  if (mem <= 4) window.isLowSpec = true;

  // 2️⃣ CPU 코어 기반 감지 (4코어 이하)
  const cores = navigator.hardwareConcurrency || 8;
  if (cores <= 4) window.isLowSpec = true;

  // 3️⃣ WebGL 파라미터 기반 감지 (MAX_RENDERBUFFER_SIZE ≤ 4096)
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (gl) {
    const maxSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
    if (maxSize && maxSize <= 4096) window.isLowSpec = true;
  }

  // 4️⃣ 고해상도 모바일 픽셀 밀도 (DPR > 2 && 모바일 화면)
  const isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile && window.devicePixelRatio && window.devicePixelRatio > 2) {
    window.isLowSpec = true;
  }

  console.log('[LowSpec] deviceMemory=', mem, 'cores=', cores, 'isLowSpec=', window.isLowSpec);

  // 테마별 색상 팔레트
  const getThemePalette = (theme) => {
    const isDark = theme === 'dark';
    return {
      textColor: isDark ? '#f1f5f9' : '#0f172a',
      textMuted: isDark ? '#94a3b8' : '#475569',
      gridColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)',
      barBg: isDark ? 'rgba(168, 85, 247, 0.55)' : 'rgba(99, 102, 241, 0.65)',
      barBorder: isDark ? 'rgba(192, 132, 252, 1)' : 'rgba(79, 70, 229, 1)',
      tooltipBg: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.96)',
      tooltipTitle: isDark ? '#c084fc' : '#4338ca',
      tooltipBody: isDark ? '#f1f5f9' : '#0f172a',
      tooltipBorder: isDark ? 'rgba(168, 85, 247, 0.4)' : 'rgba(99, 102, 241, 0.3)'
    };
  };

  // 저사양 2D 차트 생성 또는 갱신 (실제 업로드 데이터 연동)
  const renderLowSpecChart = (labels, values, title = '주요 실적 지표') => {
    const ctx = document.getElementById('chart-2d-canvas')?.getContext('2d');
    if (!ctx || typeof Chart === 'undefined') return;

    if (labels && values) {
      window.cachedLowSpecData = { labels, values, title };
    } else if (window.cachedLowSpecData) {
      labels = window.cachedLowSpecData.labels;
      values = window.cachedLowSpecData.values;
      title = window.cachedLowSpecData.title;
    } else {
      labels = ['항목 A', '항목 B', '항목 C', '항목 D', '항목 E'];
      values = [28, 45, 19, 36, 52];
    }

    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const palette = getThemePalette(currentTheme);

    if (window.lowspecChart) {
      window.lowspecChart.destroy();
      window.lowspecChart = null;
    }

    window.lowspecChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.slice(0, 30),
        datasets: [{
          label: title,
          data: values.slice(0, 30),
          backgroundColor: palette.barBg,
          borderColor: palette.barBorder,
          borderWidth: 2,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: {
          legend: {
            display: true,
            labels: {
              color: palette.textColor,
              font: { weight: '700', size: 12 }
            }
          },
          tooltip: {
            backgroundColor: palette.tooltipBg,
            titleColor: palette.tooltipTitle,
            bodyColor: palette.tooltipBody,
            borderColor: palette.tooltipBorder,
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8
          }
        },
        scales: {
          x: {
            ticks: {
              color: palette.textColor,
              font: { weight: '600' },
              maxRotation: 45
            },
            grid: { color: palette.gridColor }
          },
          y: {
            beginAtZero: true,
            ticks: { color: palette.textColor, font: { weight: '600' } },
            grid: { color: palette.gridColor }
          }
        }
      }
    });
  };

  window.__renderLowSpecChartWithData = (labels, values, title) => {
    renderLowSpecChart(labels, values, title);
  };

  // UI 이벤트 리스너 및 초기화
  const initLowSpecControls = () => {
    const btnToggle = document.getElementById('btn-lowspec-toggle');
    const menuCheckbox = document.getElementById('menu-lowspec-toggle');
    const menuType = document.getElementById('menu-lowspec-type');
    const to3dBtn = document.getElementById('lowspec-to-3d-btn');

    // 상단 툴바 토글 버튼 클릭
    btnToggle?.addEventListener('click', () => {
      const isCurrentlyOn = document.getElementById('canvas-container')?.style.display === 'none' ||
                            window.appState?.lowSpecMode;
      const nextState = !isCurrentlyOn;
      const type = menuType ? menuType.value : '3d-lite';
      if (window.__setLowSpecMode) {
        window.__setLowSpecMode(nextState, type);
      }
    });

    // 메뉴 드로어 체크박스 변경
    menuCheckbox?.addEventListener('change', (e) => {
      const type = menuType ? menuType.value : '3d-lite';
      if (window.__setLowSpecMode) {
        window.__setLowSpecMode(e.target.checked, type);
      }
    });

    // 메뉴 드로어 모드 변경 (3D 라이트 vs 2D 전용)
    menuType?.addEventListener('change', (e) => {
      if (window.__setLowSpecMode) {
        window.__setLowSpecMode(true, e.target.value);
      }
    });

    // 2D 카드에서 3D로 즉시 전환 버튼
    to3dBtn?.addEventListener('click', () => {
      if (window.__setLowSpecMode) {
        window.__setLowSpecMode(true, '3d-lite');
      }
    });

    // 테마 변경 시 저사양 차트 색상 실시간 동기화
    window.addEventListener('themechange', () => {
      renderLowSpecChart();
    });

    // 저장된 설정 복원 또는 저사양 자동 적용
    let savedMode = null;
    let savedType = '3d-lite';
    try {
      savedMode = localStorage.getItem('lowSpecMode');
      savedType = localStorage.getItem('lowSpecType') || '3d-lite';
    } catch (e) {}

    const shouldEnable = savedMode === 'true' || (savedMode === null && window.isLowSpec);
    if (shouldEnable && window.__setLowSpecMode) {
      window.__setLowSpecMode(true, savedType);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLowSpecControls);
  } else {
    initLowSpecControls();
  }
})();
