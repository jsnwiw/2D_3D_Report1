// lowspec.js – 저사양 기기 자동 감지 및 2D 차트 전환
// Detect low‑spec devices via deviceMemory, WebGL max renderbuffer size, and DPR.
// If low‑spec, hide the 3D canvas and show a simple Chart.js chart.
(() => {
  // 기본 플래그 (다른 스크립트가 확인하도록 전역에 정의)
  window.isLowSpec = false;

  // 1️⃣ 메모리 기반 감지 (4 GB 이하이면 저사양으로 간주)
  const mem = navigator.deviceMemory || 8; // 지원 안 될 경우 기본 8 GB
  if (mem <= 4) window.isLowSpec = true;

  // 2️⃣ WebGL 파라미터 기반 감지 (MAX_RENDERBUFFER_SIZE ≤ 4096)
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (gl) {
    const maxSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
    if (maxSize && maxSize <= 4096) window.isLowSpec = true;
  }

  // 3️⃣ 화면 해상도(픽셀 밀도) 기반 감지 – DPR > 2이면 부하가 커질 수 있음
  if (window.devicePixelRatio && window.devicePixelRatio > 2) window.isLowSpec = true;

  console.log('[LowSpec] deviceMemory=', mem, 'maxRenderbufferSize=', gl?.getParameter(gl.MAX_RENDERBUFFER_SIZE), 'isLowSpec=', window.isLowSpec);

  // 저사양이면 UI 전환 수행
  const applyLowSpec = () => {
    // 3D 캔버스 숨기기
    const canvasContainer = document.getElementById('canvas-container');
    if (canvasContainer) canvasContainer.style.display = 'none';
    // 2D 차트 보이기
    const chartDiv = document.getElementById('chart-2d');
    if (chartDiv) chartDiv.style.display = 'block';
    // Chart.js 차트 생성 (이미 로드된 Chart.js 사용)
    const ctx = document.getElementById('chart-2d-canvas')?.getContext('2d');
    if (ctx) {
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['A', 'B', 'C', 'D', 'E'],
          datasets: [{
            label: 'Sample Data',
            data: [12, 19, 3, 5, 2],
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { beginAtZero: true } }
        }
      });
    }
  };

  // DOMContentLoaded 후 적용
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (window.isLowSpec) applyLowSpec();
    });
  } else {
    if (window.isLowSpec) applyLowSpec();
  }
})();
