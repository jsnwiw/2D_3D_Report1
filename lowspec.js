// lowspec.js – 저사양 기기 자동 감지 및 2D 차트 전환 (라이트/다크 테마 동기화 지원)
// Detect low‑spec devices via deviceMemory, WebGL max renderbuffer size, and DPR.
// If low‑spec, hide the 3D canvas and show a lightweight Chart.js dashboard.
(() => {
  // 기본 플래그 (다른 스크립트가 확인하도록 전역에 정의)
  window.isLowSpec = false;
  window.lowspecChart = null;

  // 1️⃣ 메모리 기반 감지 (4 GB 이하이면 저사양으로 간주)
  const mem = navigator.deviceMemory || 8; // 지원 안 될 경우 기본 8 GB
  if (mem <= 4) window.isLowSpec = true;

  // 2️⃣ WebGL 파라미터 기반 감지 (MAX_RENDERBUFFER_SIZE ≤ 4096)
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (gl) {
    const maxSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
    if (maxSize && maxSize <= 4096) window.isLowSpec = true;
  }

  // 3️⃣ 화면 해상도(픽셀 밀도) 기반 감지 – DPR > 2이면 모바일/고밀도 렌더링 부하 발생 가능
  if (window.devicePixelRatio && window.devicePixelRatio > 2) window.isLowSpec = true;

  console.log('[LowSpec] deviceMemory=', mem, 'maxRenderbufferSize=', gl?.getParameter(gl.MAX_RENDERBUFFER_SIZE), 'isLowSpec=', window.isLowSpec);

  // 테마별 색상 설정 함수
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

  // 저사양 차트 생성 또는 갱신
  const renderLowSpecChart = () => {
    const ctx = document.getElementById('chart-2d-canvas')?.getContext('2d');
    if (!ctx || typeof Chart === 'undefined') return;

    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const palette = getThemePalette(currentTheme);

    if (window.lowspecChart) {
      window.lowspecChart.destroy();
      window.lowspecChart = null;
    }

    window.lowspecChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['항목 A', '항목 B', '항목 C', '항목 D', '항목 E'],
        datasets: [{
          label: '주요 실적 지표',
          data: [28, 45, 19, 36, 52],
          backgroundColor: palette.barBg,
          borderColor: palette.barBorder,
          borderWidth: 2,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: {
          legend: {
            display: true,
            labels: {
              color: palette.textColor,
              font: { weight: '600', size: 12 }
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
            ticks: { color: palette.textColor, font: { weight: '600' } },
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

  // 저사양이면 UI 전환 수행
  const applyLowSpec = () => {
    // 3D 캔버스 숨기기
    const canvasContainer = document.getElementById('canvas-container');
    if (canvasContainer) canvasContainer.style.display = 'none';

    // 2D 저사양 전용 대시보드 보이기
    const lowspecContainer = document.getElementById('lowspec-container') || document.getElementById('chart-2d');
    if (lowspecContainer) lowspecContainer.style.display = 'block';

    renderLowSpecChart();
  };

  // 테마 전환 시 저사양 차트 색상 실시간 동기화
  window.addEventListener('themechange', () => {
    if (window.isLowSpec) {
      renderLowSpecChart();
    }
  });

  // DOMContentLoaded 후 적용
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (window.isLowSpec) applyLowSpec();
    });
  } else {
    if (window.isLowSpec) applyLowSpec();
  }
})();
