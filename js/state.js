/**
 * ==============================================================================
 * [state.js] 3D 데이터 시각화 웹 플랫폼 - 전역 상태 및 공유 유틸리티
 * ==============================================================================
 */

// DOM 셀렉터 헬퍼
export const $ = id => document.getElementById(id);

// 시스템 정보 수집 (CPU 모델, GPU 렌더러, 벤더 등)
export function getSystemInfo() {
    const platform = navigator.platform || 'Win32';
    const cpuCores = navigator.hardwareConcurrency || 4;
    let gpuRenderer = '감지 중...';
    let gpuVendor = '감지 중...';
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                const rendererParam = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                const vendorParam = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                if (rendererParam) gpuRenderer = rendererParam;
                if (vendorParam) gpuVendor = vendorParam;
            }
        }
    } catch (e) {
        // ignore
    }
    return { platform, cpuCores, gpuRenderer, gpuVendor };
}

// 전역 공유 상태 컨테이너
// 전역 공유 상태 컨테이너
export const appState = {
    // 파싱된 데이터 및 분석 결과
    parsedData: null,
    analysisResult: null,
    currentUploadedFile: null,
    selectedFilter: 'all',
    filterKeyword: '',
    dataLimit: 30, // 기본 상위 30개 표시 (대용량 최적화)

    // 저사양 기기 최적화 및 렉 방지 모드
    lowSpecMode: false,
    lowSpecType: '3d-lite', // '3d-lite' (3D 저사양 모델 최적화) 또는 '2d-only' (초경량 2D 모드)
    autoAdaptLowSpec: true, // 고사양 기기에서도 실시간 부하(FPS 저하) 시 자동으로 저사양 모델 전환
    lowSpecManualOverride: false, // 사용자가 수동으로 일반 모드 복원 시 자동 전환 일시 억제

    // Three.js 씬 및 3D 렌더링 객체
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    gridHelper: null,
    dirLight: null,
    ambientLight: null,
    dataObjects: [],
    domLabels: [],
    dataBounds: { minX: -10, maxX: 10, maxH: 10 },
    activeMeshIndex: -1,
    showLabels: true,
    current3DStyle: 'box', // 현재 적용된 3D 시각화 지오메트리 스타일

    // 2D Chart.js 인스턴스
    chart2d: null,
    miniChart: null,

    // GPU 하드웨어 정보 및 실시간 실측 엔진 상태
    gpuEngineState: {
        isWebGPU: true,
        backendName: 'WebGPU (Vulkan / Direct3D 12 Low-level)',
        gpuName: '하드웨어 감지 중...',
        vendor: '감지 중...',
        architecture: '감지 중...',
        featuresCount: 0,
        fps: 0,
        frameTimeMs: '0.0',
        minFps: 999,
        maxFps: 0,
        avgFps: 0,
        fpsHistory: [] // 최근 실측 프레임레이트 기록 (스파크라인 그래프용)
    },

    // AI 보고서 상태
    isReportEditMode: false,
    currentReportDataCache: null,

    // 시계열 타임라인 플레이어 상태
    timePlayerState: {
        numericCols: [],
        currentIndex: 0,
        isPlaying: false,
        timerId: null,
        speed: 900
    }
};

// ---------------------------------------------------------------------------
// 저사양 상태 초기화 함수 – 페이지 로드 시 호출
// ---------------------------------------------------------------------------
window.__initLowSpecStateOnLoad = () => {
    // lowspec.js 에서 정의한 __getInitialLowSpecState 가 존재하면 사용, 없으면 기본값 적용
    const init = (typeof window.__getInitialLowSpecState === 'function')
        ? window.__getInitialLowSpecState()
        : { enabled: false, type: '3d-lite', autoAdapt: true };
    appState.lowSpecMode = init.enabled;
    appState.lowSpecType = init.type;
    appState.autoAdaptLowSpec = init.autoAdapt;
};
    // 파싱된 데이터 및 분석 결과
    parsedData: null,
    analysisResult: null,
    currentUploadedFile: null,
    selectedFilter: 'all',
    filterKeyword: '',
    dataLimit: 30, // 기본 상위 30개 표시 (대용량 최적화)

    // 저사양 기기 최적화 및 렉 방지 모드
    lowSpecMode: false,
    lowSpecType: '3d-lite', // '3d-lite' (3D 저사양 모델 최적화) 또는 '2d-only' (초경량 2D 모드)
    autoAdaptLowSpec: true, // 고사양 기기에서도 실시간 부하(FPS 저하) 시 자동으로 저사양 모델 전환
    lowSpecManualOverride: false, // 사용자가 수동으로 일반 모드 복원 시 자동 전환 일시 억제

    // Three.js 씬 및 3D 렌더링 객체
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    gridHelper: null,
    dirLight: null,
    ambientLight: null,
    dataObjects: [],
    domLabels: [],
    dataBounds: { minX: -10, maxX: 10, maxH: 10 },
    activeMeshIndex: -1,
    showLabels: true,
    current3DStyle: 'box', // 현재 적용된 3D 시각화 지오메트리 스타일

    // 2D Chart.js 인스턴스
    chart2d: null,
    miniChart: null,

    // GPU 하드웨어 정보 및 실시간 실측 엔진 상태
    gpuEngineState: {
        isWebGPU: true,
        backendName: 'WebGPU (Vulkan / Direct3D 12 Low-level)',
        gpuName: '하드웨어 감지 중...',
        vendor: '감지 중...',
        architecture: '감지 중...',
        featuresCount: 0,
        fps: 0,
        frameTimeMs: '0.0',
        minFps: 999,
        maxFps: 0,
        avgFps: 0,
        fpsHistory: [] // 최근 실측 프레임레이트 기록 (스파크라인 그래프용)
    },

    // AI 보고서 상태
    isReportEditMode: false,
    currentReportDataCache: null,

    // 시계열 타임라인 플레이어 상태
    timePlayerState: {
        numericCols: [],
        currentIndex: 0,
        isPlaying: false,
        timerId: null,
        speed: 900
    }
};

// 알림 토스트 팝업 헬퍼
let toastTimer = null;
export function showToast(msg, duration = 3000) {
    const toast = $('toast-notification');
    if (!toast) return;
    toast.innerHTML = msg;
    toast.style.display = 'block';
    toast.style.opacity = '1';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => { toast.style.display = 'none'; }, 300);
    }, duration);
}

// 비동기 지연 헬퍼
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
