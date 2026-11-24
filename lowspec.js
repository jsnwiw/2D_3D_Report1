// lowspec.js – 자동으로 저사양 기기 감지하고 저해상도/2D 버전을 로드합니다.
// https://developer.mozilla.org/en-US/docs/Web/API/Navigator/deviceMemory
// https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia

(() => {
  // 전역 플래그 (다른 스크립트가 확인할 수 있게 window에 정의)
  window.isLowSpec = false;

  // 1️⃣ 메모리 기반 감지 (deviceMemory가 4GB 이하이면 저사양으로 간주)
  const mem = navigator.deviceMemory || 8; // 지원 안 될 경우 기본 8GB
  if (mem <= 4) {
    window.isLowSpec = true;
  }

  // 2️⃣ GPU 성능 힌트 – WebGL 파라미터를 통해 판단 (간단히 MAX_RENDERBUFFER_SIZE 확인)
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (gl) {
    const maxSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
    // 대부분 저사양 기기에서는 4096 이하인 경우가 많음
    if (maxSize && maxSize <= 4096) {
      window.isLowSpec = true;
    }
  }

  // 3️⃣ 화면 해상도(픽셀 밀도) 기반 감지 – 고해상도 화면이면 성능 부하 높음
  if (window.devicePixelRatio && window.devicePixelRatio > 2) {
    // 고해상도 디스플레이는 저사양 GPU에서 부하가 크므로 플래그 설정
    window.isLowSpec = true;
  }

  console.log('[LowSpec] deviceMemory=', mem, 'maxRenderbufferSize=', gl?.getParameter(gl.MAX_RENDERBUFFER_SIZE), 'isLowSpec=', window.isLowSpec);

  // 외부에서 호출 가능한 초기화 함수
  window.loadAppropriateResources = function () {
    if (window.isLowSpec) {
      // 저사양인 경우 3D 캔버스를 숨기고 2D 차트만 보여줍니다.
      const canvasContainer = document.getElementById('canvas-container');
      if (canvasContainer) canvasContainer.style.display = 'none';

      // 기존에 2D 차트가 들어갈 div가 있다면 보이게 합니다. (예시: #chart-2d)
      const chart2d = document.getElementById('chart-2d');
      if (chart2d) chart2d.style.display = 'block';

      // 저해상도 3D 모델/텍스처 경로를 전역 변수에 저장 (사용자는 해당 파일을 제공해야 함)
      // 예: models/lowres/model_low.glb
      window.lowResModelPath = 'models/lowres/model_low.glb';

      // 이미 로드된 Three.js 장면이 있다면 교체 로직을 추가해야 합니다.
      if (window.threeScene && window.threeRenderer) {
        // 여기서는 간단히 기존 씬을 클리어하고 저해상도 모델을 로드하도록 합니다.
        while (window.threeScene.children.length) {
          window.threeScene.remove(window.threeScene.children[0]);
        }
        const loader = new THREE.GLTFLoader();
        loader.load(window.lowResModelPath, gltf => {
          window.threeScene.add(gltf.scene);
        }, undefined, err => {
          console.error('Low‑res model load error', err);
        });
      }
    } else {
      // 고사양인 경우 기존 3D 씬을 활성화하고 2D 차트를 숨깁니다.
      const canvasContainer = document.getElementById('canvas-container');
      if (canvasContainer) canvasContainer.style.display = 'block';
      const chart2d = document.getElementById('chart-2d');
      if (chart2d) chart2d.style.display = 'none';
    }
  };

  // DOMContentLoaded 시 자동 실행
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.loadAppropriateResources());
  } else {
    window.loadAppropriateResources();
  }
})();
