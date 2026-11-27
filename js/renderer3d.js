/**
 * ==============================================================================
 * [renderer3d.js] Three.js WebGPU / Vulkan 차세대 3D 시각화 엔진 & 10종 지오메트리
 * ==============================================================================
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import WebGPURenderer from 'three/addons/renderers/webgpu/WebGPURenderer.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { $, appState, showToast } from './state.js';
import { inferBest3DStyle, inferBestColorTheme } from './analytics.js';
import { showDetailCard } from './chart2d.js';

let extraVisuals = [];
let selectedObject = null;
let hoveredObject = null;
let originalColor = null;
let cameraAnim = null;
let pointLight = null;

// 저사양 경량 GLB 모델 캐시 및 실시간 부하 감지 상태
let lowResBarGeometry = null;
let lowResNodeGeometry = null;
let lowResLoadPromise = null;
let sceneInitTime = performance.now();
let lowFpsStreak = 0;
let severeLowFpsStreak = 0;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const tempVec = new THREE.Vector3();
const clock = new THREE.Clock();

let lastFpsUpdateTime = performance.now();
let frameCount = 0;

/**
 * 저사양 경량 GLB 모델(models/lowres/*.glb) 비동기 사전 로드 및 폴백 지오메트리 생성
 */
function getFallbackLowResBarGeometry() {
    const geo = new THREE.CylinderGeometry(0.42, 0.42, 1, 6);
    geo.translate(0, 0.5, 0);
    geo.userData.isSharedLowRes = true;
    return geo;
}

function getFallbackLowResNodeGeometry() {
    const geo = new THREE.OctahedronGeometry(0.4, 0);
    geo.userData.isSharedLowRes = true;
    return geo;
}

function extractFirstMeshGeometry(gltfScene) {
    let found = null;
    gltfScene.traverse((child) => {
        if (!found && child.isMesh && child.geometry) {
            found = child.geometry.clone();
            found.userData.isSharedLowRes = true;
        }
    });
    return found;
}

export function preloadLowResModels() {
    if (lowResLoadPromise) return lowResLoadPromise;
    const loader = new GLTFLoader();
    const barUrl = new URL('../models/lowres/model_low.glb', import.meta.url).href;
    const nodeUrl = new URL('../models/lowres/node_low.glb', import.meta.url).href;

    const loadOne = (url) => new Promise((resolve) => {
        loader.load(
            url,
            (gltf) => resolve(extractFirstMeshGeometry(gltf.scene)),
            undefined,
            () => resolve(null)
        );
    });

    lowResLoadPromise = Promise.all([loadOne(barUrl), loadOne(nodeUrl)]).then(([barGeo, nodeGeo]) => {
        lowResBarGeometry = barGeo || getFallbackLowResBarGeometry();
        lowResNodeGeometry = nodeGeo || getFallbackLowResNodeGeometry();
        appState.lowResModelsLoaded = true;
        console.log('[LowRes] GLB 모델 로드 완료:', {
            barFromGlb: Boolean(barGeo),
            nodeFromGlb: Boolean(nodeGeo)
        });
        if (appState.parsedData && (appState.lowSpecMode || appState.current3DStyle === 'lowres-model') && window.__applyVisualization) {
            window.__applyVisualization();
        }
    });
    return lowResLoadPromise;
}

function getLowResBarGeometry() {
    if (!lowResBarGeometry) {
        lowResBarGeometry = getFallbackLowResBarGeometry();
        preloadLowResModels();
    }
    return lowResBarGeometry;
}

function getLowResNodeGeometry() {
    if (!lowResNodeGeometry) {
        lowResNodeGeometry = getFallbackLowResNodeGeometry();
        preloadLowResModels();
    }
    return lowResNodeGeometry;
}

function createDataMaterial(color, extraOpts = {}) {
    if (appState.lowSpecMode) {
        return new THREE.MeshLambertMaterial({ color, ...extraOpts });
    }
    return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.35,
        metalness: 0.15,
        ...extraOpts
    });
}

/**
 * 3D 씬 및 WebGPURenderer 초기화
 */
export async function initThreeScene() {
    // If ultra‑light 2D‑only mode is active, skip 3D initialization
    if (appState.lowSpecMode && appState.lowSpecType === '2d-only') {
        console.log('[LowSpec] 2D‑only mode active – skipping 3D renderer initialization');
        setLowSpecMode(true, '2d-only', { initial: true });
        return;
    }
    // Detect low‑spec device early and enable lightweight mode
    // Simple heuristic: few logical processors or low GPU tier
    // Low‑spec auto‑detect disabled for debugging – always use full 3D mode
    const isLowSpecDevice = () => false;
    // Previously automatic low‑spec activation removed
    // if (isLowSpecDevice()) {
    //     setLowSpecMode(true, '3d-lite', { manual: true, initial: true });
    //     console.log('[LowSpec] Device detected as low‑spec – activating 3d‑lite mode');
    // }
    const container = $('canvas-container');
    if (!container) return;

    appState.scene = new THREE.Scene();
    const isDarkInit = document.documentElement.getAttribute('data-theme') === 'dark';
    const initBgHex = isDarkInit ? 0x0f172a : 0xf1f5f9;
    appState.scene.background = new THREE.Color(initBgHex);
    appState.scene.fog = new THREE.FogExp2(initBgHex, 0.015);
    const bgColorInput = $('bg-color');
    if (bgColorInput) bgColorInput.value = isDarkInit ? '#0f172a' : '#f1f5f9';

    // 다크 / 라이트 모드 전환 시 3D 씬 배경색 및 안개 동기화
    window.addEventListener('themechange', (e) => {
        const theme = e.detail?.theme || document.documentElement.getAttribute('data-theme') || 'light';
        const isDark = theme === 'dark';
        const newBgHex = isDark ? 0x0f172a : 0xf1f5f9;
        // Animate background and fog color transition
        const oldBgHex = appState.scene?.background?.getHex ? appState.scene.background.getHex() : newBgHex;
        const duration = 600; // ms
        const startColor = new THREE.Color(oldBgHex);
        const endColor = new THREE.Color(newBgHex);
        const startTime = performance.now();
        const step = () => {
            const now = performance.now();
            const t = Math.min(1, (now - startTime) / duration);
            const lerped = startColor.clone().lerp(endColor, t);
            if (appState.scene) {
                appState.scene.background.copy(lerped);
                if (appState.scene.fog) appState.scene.fog.color.copy(lerped);
            }
            if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        const bgInput = $('bg-color');
        if (bgInput) bgInput.value = isDark ? '#0f172a' : '#f1f5f9';
    });


    appState.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);
    appState.camera.position.set(0, 10, 20);

    try {
        appState.renderer = new WebGPURenderer({ antialias: true, alpha: false, forceWebGL: false });
        await appState.renderer.init();
    } catch (webgpuErr) {
        console.warn('WebGPURenderer 초기화 실패, WebGLRenderer로 폴백:', webgpuErr);
        appState.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        appState.gpuEngineState.isWebGPU = false;
        appState.gpuEngineState.backendName = 'WebGL 2.0 (Fallback)';
        const badge = $('gpu-engine-text');
        if (badge) badge.textContent = '⚡ WebGL 2.0';
    }

    // 실제 어댑터 정보 조회
    if ('gpu' in navigator) {
        try {
            const adapter = await navigator.gpu.requestAdapter();
            if (adapter) {
                const info = await adapter.requestAdapterInfo?.();
                if (info) {
                    if (info.device) appState.gpuEngineState.gpuName = info.device;
                    if (info.description) appState.gpuEngineState.gpuName = info.description;
                    if (info.vendor) appState.gpuEngineState.vendor = info.vendor;
                    if (info.architecture) appState.gpuEngineState.architecture = info.architecture;
                }
                appState.gpuEngineState.featuresCount = adapter.features?.size || 0;
                appState.gpuEngineState.isWebGPU = true;
                appState.gpuEngineState.backendName = 'WebGPU (Vulkan / Direct3D 12 Low-level)';
                const badge = $('gpu-engine-text');
                if (badge) badge.textContent = '⚡ Vulkan / WebGPU';
            }
        } catch (e) {
            console.warn('WebGPU 어댑터 정보 조회 실패:', e);
        }
    }

    // WebGL fallback으로 실제 GPU 렌더러/벤더 보강 (WebGPU adapter info가 빈 문자열일 때)
    try {
        const glCanvas = document.createElement('canvas');
        const gl = glCanvas.getContext('webgl') || glCanvas.getContext('experimental-webgl');
        if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                if (renderer && (!appState.gpuEngineState.gpuName || appState.gpuEngineState.gpuName === '하드웨어 감지 중...')) {
                    appState.gpuEngineState.gpuName = renderer;
                }
                if (vendor && (!appState.gpuEngineState.vendor || appState.gpuEngineState.vendor === '감지 중...')) {
                    appState.gpuEngineState.vendor = vendor;
                }
            }
        }
    } catch (e) { /* ignore */ }

    // 아키텍처 자동 판별
    if (!appState.gpuEngineState.architecture || appState.gpuEngineState.architecture === '감지 중...') {
        appState.gpuEngineState.architecture = appState.gpuEngineState.isWebGPU ? 'WGSL Low-level Pipeline' : 'GLSL Standard Pipeline';
    }

    // 감지 완료 후 GPU 모달 요소 즉시 갱신
    const _mp = $('modal-system-platform');
    const _mc = $('modal-system-cpu');
    const _ma = $('modal-gpu-api');
    const _md = $('modal-gpu-device');
    const _mv = $('modal-gpu-vendor');
    const _mar = $('modal-gpu-architecture');
    const _mf = $('modal-gpu-features');
    if (_mp) _mp.textContent = navigator.platform || 'Unknown';
    if (_mc) _mc.textContent = `${navigator.hardwareConcurrency || '?'}코어`;
    if (_ma) _ma.textContent = appState.gpuEngineState.backendName;
    if (_md) _md.textContent = appState.gpuEngineState.gpuName;
    if (_mv) _mv.textContent = appState.gpuEngineState.vendor;
    if (_mar) _mar.textContent = appState.gpuEngineState.architecture;
    if (_mf) _mf.textContent = appState.gpuEngineState.featuresCount > 0
        ? `${appState.gpuEngineState.featuresCount}개 하드웨어 기능 활성화됨`
        : '감지 불가';

    appState.renderer.setSize(window.innerWidth, window.innerHeight);
    appState.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    appState.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    appState.renderer.toneMappingExposure = 1.1;
    container.appendChild(appState.renderer.domElement);

    // OrbitControls
    appState.controls = new OrbitControls(appState.camera, appState.renderer.domElement);
    appState.controls.enableDamping = true;
    appState.controls.dampingFactor = 0.08;
    appState.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    appState.controls.minDistance = 3;
    appState.controls.maxDistance = 120;
    appState.controls.target.set(0, 2, 0);

    // 조명
    appState.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    appState.scene.add(appState.ambientLight);

    appState.dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    appState.dirLight.position.set(15, 25, 15);
    appState.scene.add(appState.dirLight);

    pointLight = new THREE.PointLight(0x818cf8, 0.5, 50);
    pointLight.position.set(0, 10, 0);
    appState.scene.add(pointLight);

    // 그리드
    appState.gridHelper = new THREE.GridHelper(30, 30, 0x94a3b8, 0xe2e8f0);
    appState.gridHelper.position.y = 0;
    appState.scene.add(appState.gridHelper);

    // 태블릿/모니터 화면 크기 자동 맞춤 엔진 리스너 등록
    window.addEventListener('resize', handleAdaptiveResize);
    window.addEventListener('orientationchange', () => {
        setTimeout(handleAdaptiveResize, 200);
    });

    // 레이캐스팅 이벤트
    setupRaycasting();

    // 초기 화면 크기 자동 최적화
    handleAdaptiveResize();
    sceneInitTime = performance.now();

    // 기기 사양 기반 초기 저사양/일반 모드 자동 적용 (고사양: 일반, 저사양: 3d-lite)
    if (window.__getInitialLowSpecState) {
        const initLowSpec = window.__getInitialLowSpecState();
        appState.autoAdaptLowSpec = initLowSpec.autoAdapt;
        if (initLowSpec.enabled) {
            setLowSpecMode(true, initLowSpec.type, { initial: true });
        }
    }

    // 렌더 루프 가동
    animateLoop();

    // 전역 바인딩(상세 선택 시 호출용)
    window.__selectObject = selectObject;
}

/**
 * 태블릿 / 모니터 화면 크기 지능형 자동 적응 엔진 (Auto-Adaptive Engine)
 */
export function handleAdaptiveResize() {
    if (!appState.camera || !appState.renderer) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / Math.max(height, 1);

    // 1. 카메라 종횡비 및 기기별 최적 FOV(화각) 동적 보정
    appState.camera.aspect = aspect;
    if (aspect < 1.0) {
        // 태블릿/모바일 세로 모드 (화면 폭이 좁으므로 시야각을 넓혀 잘림 방지)
        appState.camera.fov = 58;
    } else if (aspect < 1.4) {
        // 태블릿 가로 / 컴팩트 모니터
        appState.camera.fov = 52;
    } else {
        // 와이드 모니터 / 대형 디스플레이 (왜곡 없는 표준 원근감)
        appState.camera.fov = 48;
    }
    appState.camera.updateProjectionMatrix();

    // 2. 모니터 해상도 및 고주사율/고밀도 DPR 자동 최적화 (저사양 모드 시 1.0으로 제한하여 GPU 부하 70% 감소)
    const baseDpr = width > 2000 ? 1.5 : (width > 1200 ? 2 : Math.min(window.devicePixelRatio || 1, 2));
    const maxDpr = appState.lowSpecMode ? Math.min(baseDpr, 1.0) : baseDpr;
    appState.renderer.setPixelRatio(maxDpr);
    appState.renderer.setSize(width, height);

    // 3. 2D Chart.js 및 미니 차트 캔버스 즉각 동기화 리사이즈
    if (appState.chart2d) {
        appState.chart2d.resize();
    }
    if (appState.miniChart) {
        appState.miniChart.resize();
    }

    // 4. 3D 월드 라벨 좌표 업데이트
    updateLabels();

    // 5. 기기 및 방향 감지 CSS 클래스 자동 부여
    updateDeviceLayoutClass(width, height, aspect);
}

function updateDeviceLayoutClass(w, h, aspect) {
    const b = document.body;
    b.classList.remove('device-mobile', 'device-tablet', 'device-desktop', 'device-ultrawide', 'screen-portrait', 'screen-landscape');

    if (aspect < 1.1) {
        b.classList.add('screen-portrait');
    } else {
        b.classList.add('screen-landscape');
    }

    if (w < 600) {
        b.classList.add('device-mobile');
    } else if (w <= 1024) {
        b.classList.add('device-tablet');
    } else if (w <= 1920) {
        b.classList.add('device-desktop');
    } else {
        b.classList.add('device-ultrawide');
    }
}

/**
 * 씬 클리어 (메모리 해제)
 */
export function clearScene() {
    appState.dataObjects.forEach(obj => {
        appState.scene.remove(obj);
        if (obj.geometry && !obj.geometry.userData?.isSharedLowRes) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
            else obj.material.dispose();
        }
    });
    appState.dataObjects = [];

    extraVisuals.forEach(obj => {
        appState.scene.remove(obj);
        if (obj.geometry && !obj.geometry.userData?.isSharedLowRes) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
    });
    extraVisuals = [];

    appState.domLabels.forEach(l => l.el.remove());
    appState.domLabels = [];
    selectedObject = null;
    hoveredObject = null;
}

/**
 * 테마 컬러 산출 (데이터 분석 자동 추천 및 10종 프리셋 대응)
 */
export function getThemeColor(idx, total, overrideTheme = null) {
    let theme = overrideTheme || ($('color-theme-select') ? $('color-theme-select').value : 'auto');

    // 자동 추천 모드일 경우 데이터 분석 결과로부터 실시간 추천 테마 산출
    if (!theme || theme === 'auto') {
        const rec = inferBestColorTheme(appState.currentLabels, appState.currentValues, appState.analysisResult);
        theme = rec ? rec.theme : 'ocean';
    }

    const t = total > 1 ? idx / (total - 1) : 0.5;

    // 1. 직접 색상 코드 지정 (HEX)
    if (theme === 'custom') {
        const hex = $('custom-theme-color-picker') ? $('custom-theme-color-picker').value : '#6366f1';
        const base = new THREE.Color(hex);
        const hsl = {};
        base.getHSL(hsl);
        const lAdj = (t - 0.5) * 0.35;
        const sAdj = (1 - t) * 0.2;
        return new THREE.Color().setHSL(hsl.h, Math.min(1, Math.max(0.2, hsl.s + sAdj)), Math.min(0.85, Math.max(0.25, hsl.l + lAdj)));
    }

    // 2. 비비드 레인보우 (황금비 분할로 인접 항목 간 극대화된 색상 대비)
    if (theme === 'vibrant' || theme === 'rainbow') {
        const hue = (idx * 0.618033988749895) % 1;
        return new THREE.Color().setHSL(hue, 0.88, 0.56);
    }

    // 3. 에메랄드 그린 (순이익, 자산, ESG, 헬스케어)
    if (theme === 'emerald') {
        return new THREE.Color().lerpColors(new THREE.Color(0x34d399), new THREE.Color(0x047857), t);
    }

    // 4. 선셋 오렌지/핑크 (마케팅, 트래픽, 클릭, 전환율)
    if (theme === 'sunset') {
        return new THREE.Color().lerpColors(new THREE.Color(0xf59e0b), new THREE.Color(0xec4899), t);
    }

    // 5. 파이어 & 플레임 (비용, 손실, 리스크, 결함, 이상치 경고)
    if (theme === 'fire') {
        if (t < 0.5) {
            return new THREE.Color().lerpColors(new THREE.Color(0xfef08a), new THREE.Color(0xf97316), t * 2);
        } else {
            return new THREE.Color().lerpColors(new THREE.Color(0xf97316), new THREE.Color(0xdc2626), (t - 0.5) * 2);
        }
    }

    // 6. 골드 & 럭셔리 (성과 랭킹 1위, VIP, 금융 자산, 목표 달성)
    if (theme === 'gold') {
        return new THREE.Color().lerpColors(new THREE.Color(0xfef08a), new THREE.Color(0xb45309), t);
    }

    // 7. 네온 사이버펑크 (AI, 센서, IT, 반도체, 사이버, 하이테크)
    if (theme === 'neon') {
        if (t < 0.5) {
            return new THREE.Color().lerpColors(new THREE.Color(0x06b6d4), new THREE.Color(0x8b5cf6), t * 2);
        } else {
            return new THREE.Color().lerpColors(new THREE.Color(0x8b5cf6), new THREE.Color(0xf43f5e), (t - 0.5) * 2);
        }
    }

    // 8. 오로라 판타지 (시계열 추세, 연속적 흐름, 연구개발 R&D)
    if (theme === 'aurora') {
        if (t < 0.5) {
            return new THREE.Color().lerpColors(new THREE.Color(0x2dd4bf), new THREE.Color(0x38bdf8), t * 2);
        } else {
            return new THREE.Color().lerpColors(new THREE.Color(0x38bdf8), new THREE.Color(0x6366f1), (t - 0.5) * 2);
        }
    }

    // 9. 파스텔 마카롱 (고객 만족도, 설문조사, 교육, 감성)
    if (theme === 'pastel') {
        const hue = (0.55 + t * 0.45) % 1;
        return new THREE.Color().setHSL(hue, 0.65, 0.72);
    }

    // 10. 모노크롬 슬레이트 (정통 감사, 엄격한 규정 준수, 공공)
    if (theme === 'monochrome') {
        const v = 0.25 + t * 0.55;
        return new THREE.Color(v, v, v + 0.05);
    }

    // 11. 기본 오션 블루/시안 (매출, 수량, 표준 비즈니스 분석)
    return new THREE.Color().lerpColors(new THREE.Color(0x38bdf8), new THREE.Color(0x1d4ed8), t);
}

/**
 * 10종 3D 지오메트리 메인 렌더러
 */
export function render3DVisualization(labels, values) {
    if (!appState.scene || (appState.lowSpecMode && appState.lowSpecType === '2d-only')) {
        return;
    }
    clearScene();
    if (!labels || !labels.length) return;

    appState.currentLabels = labels;
    appState.currentValues = values;

    const count = labels.length;
    let maxVal = 0.001;
    let minVal = Infinity;
    for (const value of values) {
        if (value > maxVal) maxVal = value;
        if (value < minVal) minVal = value;
    }
    const maxH = 8;
    const barStyleSelect = $('bar-style');
    const quickBarStyle = $('quick-bar-style');

    let style = appState.current3DStyle;
    if (!style || style === 'auto') {
        style = (quickBarStyle && quickBarStyle.value !== 'auto')
            ? quickBarStyle.value
            : (barStyleSelect ? barStyleSelect.value : 'auto');
    }

    if (style === 'auto' || !style) {
        style = inferBest3DStyle(labels, values, appState.analysisResult);
    }
    appState.current3DStyle = style;

    const isDonut = style === 'donut';
    const isPie = style === 'pie' || isDonut;

    if (isPie) {
        renderPieOrDonut(labels, values, maxVal, isDonut);
    } else if (style === 'lowres-model') {
        renderLowResModelColumns(labels, values, maxVal, maxH);
    } else if (style === 'scatter') {
        renderScatter(labels, values, maxVal, maxH);
    } else if (style === 'line') {
        renderTubeLine(labels, values, maxVal, maxH);
    } else if (style === 'area') {
        renderAreaSurface(labels, values, maxVal, maxH);
    } else if (style === 'surface') {
        renderSurfaceGrid(labels, values, maxVal, maxH);
    } else {
        renderColumns(labels, values, maxVal, minVal, maxH, style);
    }

    fitCameraToObjectBounds(count, style);
}

function renderLowResModelColumns(labels, values, maxVal, maxH) {
    const count = labels.length;
    const cols = Math.min(count, Math.ceil(Math.sqrt(count * 1.6)));
    const rows = Math.ceil(count / cols);
    const spacing = Math.max(1.5, Math.min(3.0, 20 / Math.max(cols, rows)));
    const sharedGeo = getLowResBarGeometry();

    labels.forEach((label, idx) => {
        const val = values[idx];
        const h = Math.max(0.15, (val / maxVal) * maxH);
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x = (col - (cols - 1) / 2) * spacing;
        const z = (row - (rows - 1) / 2) * spacing;
        const color = getThemeColor(idx, count);

        const mat = new THREE.MeshLambertMaterial({ color });
        const mesh = new THREE.Mesh(sharedGeo, mat);
        mesh.scale.set(1, h, 1);
        mesh.position.set(x, 0, z);
        mesh.userData = { name: label, value: val, idx, color: color.clone() };

        appState.scene.add(mesh);
        appState.dataObjects.push(mesh);
        createDomLabel(label, val, mesh, h);
    });
}

function renderColumns(labels, values, maxVal, minVal, maxH, style) {
    const count = labels.length;
    const cols = Math.min(count, Math.ceil(Math.sqrt(count * 1.6)));
    const rows = Math.ceil(count / cols);
    const spacing = Math.max(1.5, Math.min(3.0, 20 / Math.max(cols, rows)));

    if (appState.lowSpecMode && style === 'cylinder') {
        renderLowResModelColumns(labels, values, maxVal, maxH);
        return;
    }

    labels.forEach((label, idx) => {
        const val = values[idx];
        const h = Math.max(0.15, (val / maxVal) * maxH);
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x = (col - (cols - 1) / 2) * spacing;
        const z = (row - (rows - 1) / 2) * spacing;
        const color = getThemeColor(idx, count);

        let geo;
        if (style === 'cylinder') geo = new THREE.CylinderGeometry(0.45, 0.45, h, 24);
        else if (style === 'pyramid') geo = new THREE.ConeGeometry(0.65, h, 4);
        else geo = new THREE.BoxGeometry(0.75, h, 0.75);

        const mat = createDataMaterial(color);

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, h / 2, z);
        mesh.userData = { name: label, value: val, idx, color: color.clone() };

        appState.scene.add(mesh);
        appState.dataObjects.push(mesh);
        createDomLabel(label, val, mesh, h);
    });
}

function renderPieOrDonut(labels, values, maxVal, isDonut) {
    const count = labels.length;
    const sum = values.reduce((a, b) => a + Math.max(0, b), 0) || 1;
    let currentAngle = 0;
    const outerR = 6;
    const innerR = isDonut ? 2.5 : 0;

    labels.forEach((label, idx) => {
        const val = Math.max(0, values[idx]);
        const angle = (val / sum) * Math.PI * 2;
        if (angle <= 0.005) return;

        const h = 0.8 + (val / maxVal) * 1.5;
        const shape = new THREE.Shape();

        if (isDonut) {
            shape.absarc(0, 0, outerR, currentAngle, currentAngle + angle, false);
            shape.absarc(0, 0, innerR, currentAngle + angle, currentAngle, true);
        } else {
            shape.moveTo(0, 0);
            shape.arc(0, 0, outerR, currentAngle, currentAngle + angle, false);
            shape.lineTo(0, 0);
        }

        const extrudeSettings = {
            depth: h,
            bevelEnabled: !appState.lowSpecMode,
            bevelSegments: appState.lowSpecMode ? 1 : 3,
            steps: 1,
            bevelSize: 0.08,
            bevelThickness: 0.08
        };
        const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geo.rotateX(Math.PI / 2);

        const color = getThemeColor(idx, count);
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.2 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(0, h, 0);
        mesh.userData = { name: label, value: val, idx, color: color.clone() };

        appState.scene.add(mesh);
        appState.dataObjects.push(mesh);

        const midAngle = currentAngle + angle / 2;
        const labelR = (outerR + innerR) / 2;
        const lx = Math.cos(midAngle) * labelR;
        const lz = -Math.sin(midAngle) * labelR;
        createDomLabel(label, val, mesh, h + 0.5, lx, lz);

        currentAngle += angle;
    });
}

function renderScatter(labels, values, maxVal, maxH) {
    const count = labels.length;
    labels.forEach((label, idx) => {
        const val = values[idx];
        const h = Math.max(0.5, (val / maxVal) * maxH);
        const angle = (idx / count) * Math.PI * 2;
        const r = 2 + (idx % 4) * 2;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        const color = getThemeColor(idx, count);

        const geo = appState.lowSpecMode
            ? getLowResNodeGeometry()
            : new THREE.SphereGeometry(0.4, 20, 20);
        const mat = createDataMaterial(color);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, h, z);
        mesh.userData = { name: label, value: val, idx, color: color.clone() };

        appState.scene.add(mesh);
        appState.dataObjects.push(mesh);

        // 바닥 연결 가이드 라인
        const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0, z), new THREE.Vector3(x, h, z)]);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.5 });
        const line = new THREE.Line(lineGeo, lineMat);
        appState.scene.add(line);
        extraVisuals.push(line);

        createDomLabel(label, val, mesh, 0.6);
    });
}

function renderTubeLine(labels, values, maxVal, maxH) {
    const count = labels.length;
    const points = [];
    const spacing = 1.2;

    labels.forEach((label, idx) => {
        const val = values[idx];
        const h = Math.max(0.2, (val / maxVal) * maxH);
        const x = (idx - (count - 1) / 2) * spacing;
        points.push(new THREE.Vector3(x, h, 0));

        // 데이터 노드 스피어 (저사양 모드에서는 초경량 node_low.glb 사용)
        const color = getThemeColor(idx, count);
        const nodeGeo = appState.lowSpecMode
            ? getLowResNodeGeometry()
            : new THREE.SphereGeometry(0.35, 16, 16);
        const nodeMat = createDataMaterial(color);
        const node = new THREE.Mesh(nodeGeo, nodeMat);
        node.position.set(x, h, 0);
        node.userData = { name: label, value: val, idx, color: color.clone() };

        appState.scene.add(node);
        appState.dataObjects.push(node);
        createDomLabel(label, val, node, 0.5);
    });

    if (points.length >= 2) {
        const curve = new THREE.CatmullRomCurve3(points);
        const tubeSegments = points.length * (appState.lowSpecMode ? 4 : 8);
        const radialSegments = appState.lowSpecMode ? 6 : 12;
        const tubeGeo = new THREE.TubeGeometry(curve, tubeSegments, 0.15, radialSegments, false);
        const tubeMat = new THREE.MeshStandardMaterial({ color: 0x6366f1, roughness: 0.3, metalness: 0.3 });
        const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
        appState.scene.add(tubeMesh);
        extraVisuals.push(tubeMesh);
    }
}

function renderAreaSurface(labels, values, maxVal, maxH) {
    const count = labels.length;
    const spacing = 1.3;
    const shape = new THREE.Shape();
    const halfW = ((count - 1) * spacing) / 2;

    shape.moveTo(-halfW, 0);
    labels.forEach((label, idx) => {
        const val = values[idx];
        const h = Math.max(0.2, (val / maxVal) * maxH);
        const x = idx * spacing - halfW;
        shape.lineTo(x, h);
    });
    shape.lineTo(halfW, 0);
    shape.closePath();

    const extrudeSettings = {
        depth: 1.0,
        bevelEnabled: !appState.lowSpecMode,
        bevelSegments: 1,
        steps: 1,
        bevelSize: 0.05,
        bevelThickness: 0.05
    };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    const mat = new THREE.MeshStandardMaterial({
        color: 0x6366f1,
        roughness: 0.35,
        metalness: 0.25,
        side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 0, -0.5);
    appState.scene.add(mesh);
    extraVisuals.push(mesh);

    labels.forEach((label, idx) => {
        const val = values[idx];
        const h = Math.max(0.2, (val / maxVal) * maxH);
        const x = idx * spacing - halfW;
        const color = getThemeColor(idx, count);
        const nodeGeo = new THREE.SphereGeometry(0.3, 16, 16);
        const nodeMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.2 });
        const node = new THREE.Mesh(nodeGeo, nodeMat);
        node.position.set(x, h, 0);
        node.userData = { name: label, value: val, idx, color: color.clone() };
        appState.scene.add(node);
        appState.dataObjects.push(node);
        createDomLabel(label, val, node, 0.4);
    });
}

function renderSurfaceGrid(labels, values, maxVal, maxH) {
    const count = labels.length;
    const cols = Math.min(count, Math.ceil(Math.sqrt(count * 1.5)));
    const rows = Math.ceil(count / cols);
    const spacing = 1.8;

    const planeW = Math.max(2, (cols - 1) * spacing);
    const planeH = Math.max(2, (rows - 1) * spacing);
    const geo = new THREE.PlaneGeometry(planeW, planeH, Math.max(1, cols - 1), Math.max(1, rows - 1));
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const val = values[i % count] || 0;
        const h = Math.max(0.1, (val / maxVal) * maxH);
        pos.setY(i, h);
    }
    geo.computeVertexNormals();

    const mat = createDataMaterial(0x4f46e5, { side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    appState.scene.add(mesh);
    extraVisuals.push(mesh);

    if (!appState.lowSpecMode) {
        const wireMat = new THREE.MeshBasicMaterial({ color: 0x818cf8, wireframe: true, transparent: true, opacity: 0.4 });
        const wireMesh = new THREE.Mesh(geo, wireMat);
        appState.scene.add(wireMesh);
        extraVisuals.push(wireMesh);
    }

    labels.forEach((label, idx) => {
        const val = values[idx];
        const h = Math.max(0.1, (val / maxVal) * maxH);
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x = (col - (cols - 1) / 2) * spacing;
        const z = (row - (rows - 1) / 2) * spacing;
        const color = getThemeColor(idx, count);

        const nodeGeo = appState.lowSpecMode
            ? getLowResNodeGeometry()
            : new THREE.SphereGeometry(0.3, 16, 16);
        const nodeMat = createDataMaterial(color);
        const node = new THREE.Mesh(nodeGeo, nodeMat);
        node.position.set(x, h, z);
        node.userData = { name: label, value: val, idx, color: color.clone() };

        appState.scene.add(node);
        appState.dataObjects.push(node);
        createDomLabel(label, val, node, 0.4);
    });
}

function fitCameraToObjectBounds(count, style) {
    const aspect = window.innerWidth / Math.max(window.innerHeight, 1);
    const aspectMultiplier = aspect < 1.0 ? 1.55 : (aspect < 1.3 ? 1.25 : 1.0);
    const spread = Math.max(count * 1.3, 10) * aspectMultiplier;
    if (cameraAnim) return;
    animateCamera([0, spread * 0.5 + 5, spread * 0.7 + 8], [0, 2, 0], 800);
}

/**
 * 2D 텍스트 라벨 DOM 생성
 */
function createDomLabel(name, val, mesh, hOffset = 0, customX = null, customZ = null) {
    const layer = $('label-layer');
    if (!layer) return;

    // 저사양 기기 최적화: DOM 레이어 병목 방지를 위해 상위 15개까지만 라벨 생성
    if (appState.lowSpecMode && appState.domLabels.length >= 15) return;

    const div = document.createElement('div');
    div.className = 'label-3d';
    div.textContent = `${name}: ${typeof val === 'number' ? Math.round(val).toLocaleString() : val}`;
    if (!appState.showLabels) div.style.display = 'none';

    layer.appendChild(div);
    appState.domLabels.push({
        el: div,
        mesh,
        hOffset,
        customX,
        customZ
    });
}

export function updateLabels() {
    // Throttle label updates to ~30 fps to reduce DOM work
    const now = performance.now();
    if (now - (appState.lastLabelUpdateTime || 0) < 33) return;
    appState.lastLabelUpdateTime = now;
    if (!appState.camera || !appState.renderer || !appState.domLabels.length) return;
    const w = window.innerWidth;
    const h = window.innerHeight;

    appState.domLabels.forEach(l => {
        if (!l.mesh) return;
        tempVec.copy(l.mesh.position);
        tempVec.y += l.hOffset || 0;
        if (l.customX !== null) tempVec.x = l.customX;
        if (l.customZ !== null) tempVec.z = l.customZ;

        tempVec.project(appState.camera);
        if (tempVec.z > 1) {
            l.el.style.opacity = '0';
            return;
        }
        const x = (tempVec.x * 0.5 + 0.5) * w;
        const y = (-tempVec.y * 0.5 + 0.5) * h;
        l.el.style.left = `${x}px`;
        l.el.style.top = `${y}px`;
        l.el.style.opacity = '1';
    });
}

export function toggleLabels() {
    appState.showLabels = !appState.showLabels;
    appState.domLabels.forEach(l => {
        l.el.style.display = appState.showLabels ? '' : 'none';
    });
}

export function toggleGrid() {
    if (appState.gridHelper) {
        appState.gridHelper.visible = !appState.gridHelper.visible;
    }
}

/**
 * 레이캐스팅 광선 추적 (Hover 발광 & 터치/클릭 카메라 포커싱 - 모바일 터치 최적화)
 */
function setupRaycasting() {
    const container = $('canvas-container');
    const tooltip = $('hover-tooltip');
    const tooltipName = $('tooltip-name');
    const tooltipValue = $('tooltip-value');

    if (!container) return;

    let pointerStartX = 0;
    let pointerStartY = 0;
    let pointerStartTime = 0;

    // 터치/마우스 시작 위치 기록 (드래그 회전과 탭/클릭 구분)
    container.addEventListener('pointerdown', (e) => {
        pointerStartX = e.clientX;
        pointerStartY = e.clientY;
        pointerStartTime = performance.now();
    });

    // 마우스 호버 (모바일 터치 드래그 중에는 호버 툴팁 비활성화)
    // Throttle pointermove to reduce raycasting overhead (max once per 50 ms)
        let lastPointerMove = 0;
        container.addEventListener('pointermove', (e) => {
            const now = performance.now();
            if (now - lastPointerMove < 50) return; // skip if called too quickly
            lastPointerMove = now;
            if (e.pointerType === 'touch') return;
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            if (tooltip && tooltip.style.display !== 'none') {
                const tipX = Math.min(e.clientX + 14, window.innerWidth - 140);
                const tipY = Math.max(10, Math.min(e.clientY + 14, window.innerHeight - 80));
                tooltip.style.left = `${tipX}px`;
                tooltip.style.top = `${tipY}px`;
            }
            if (!appState.dataObjects.length || !appState.camera) return;
            raycaster.setFromCamera(mouse, appState.camera);
            const hits = raycaster.intersectObjects(appState.dataObjects, false);
            if (hits.length > 0) {
                const hit = hits[0].object;
                if (hoveredObject && hoveredObject !== selectedObject) {
                    hoveredObject.material.emissive?.setHex(0x000000);
                }
                hoveredObject = hit;
                if (hoveredObject !== selectedObject) {
                    hoveredObject.material.emissive?.setHex(0x312e81);
                }
                if (tooltip && tooltipName && tooltipValue) {
                    tooltip.style.display = 'block';
                    tooltipName.textContent = hit.userData.name || '데이터';
                    tooltipValue.textContent = typeof hit.userData.value === 'number'
                        ? hit.userData.value.toLocaleString()
                        : hit.userData.value;
                }
                container.style.cursor = 'pointer';
            } else {
                if (hoveredObject && hoveredObject !== selectedObject) {
                    hoveredObject.material.emissive?.setHex(0x000000);
                }
                hoveredObject = null;
                if (tooltip) tooltip.style.display = 'none';
                container.style.cursor = 'grab';
            }
        });

    // 터치/클릭 시 3D 메쉬 판별 및 선택 처리 함수
    const handleTapOrClick = (clientX, clientY) => {
        if (!appState.dataObjects.length || !appState.camera) return;

        mouse.x = (clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, appState.camera);
        const hits = raycaster.intersectObjects(appState.dataObjects, false);

        if (hits.length > 0) {
            const hit = hits[0].object;
            selectObject(hit, hit.userData.idx);

            // 터치 환경에서도 툴팁을 손가락 위치에 맞게 안전하게 표시
            if (tooltip && tooltipName && tooltipValue) {
                tooltip.style.display = 'block';
                tooltipName.textContent = hit.userData.name || '데이터';
                tooltipValue.textContent = typeof hit.userData.value === 'number'
                    ? hit.userData.value.toLocaleString()
                    : hit.userData.value;
                const tipX = Math.min(Math.max(10, clientX - 60), window.innerWidth - 140);
                const tipY = Math.max(10, clientY - 64);
                tooltip.style.left = `${tipX}px`;
                tooltip.style.top = `${tipY}px`;
            }
        } else {
            // 빈 공간 탭 시 선택 해제
            if (selectedObject && selectedObject.material) {
                selectedObject.material.emissive?.setHex(0x000000);
            }
            selectedObject = null;
            if (tooltip) tooltip.style.display = 'none';
        }
    };

    // 포인터가 떨어질 때 드래그가 아니었던 경우(탭 또는 클릭)만 오브젝트 선택
    container.addEventListener('pointerup', (e) => {
        const dx = Math.abs(e.clientX - pointerStartX);
        const dy = Math.abs(e.clientY - pointerStartY);
        const dt = performance.now() - pointerStartTime;

        // 드래그(시점 회전/줌/패닝)가 아닌 가벼운 터치 탭 (< 10px 이동, < 400ms 지속)
        if (dx < 10 && dy < 10 && dt < 400) {
            handleTapOrClick(e.clientX, e.clientY);
        }
    });
}

export function selectObject(mesh, idx) {
    if (selectedObject && selectedObject.material) {
        selectedObject.material.emissive?.setHex(0x000000);
    }
    selectedObject = mesh;
    if (selectedObject && selectedObject.material) {
        selectedObject.material.emissive?.setHex(0x4338ca);
    }
    showDetailCard(mesh.userData, idx);

    // 카메라 포커싱
    const targetPos = mesh.position.clone();
    animateCamera(
        [targetPos.x, targetPos.y + 4, targetPos.z + 8],
        [targetPos.x, targetPos.y, targetPos.z],
        600
    );
}

/**
 * 카메라 부드러운 전환 보간 애니메이션
 */
export function animateCamera(targetPos, targetLookAt, duration = 800) {
    if (!appState.camera || !appState.controls) return;
    const startPos = appState.camera.position.clone();
    const startTarget = appState.controls.target.clone();
    const endPos = new THREE.Vector3(...targetPos);
    const endTarget = new THREE.Vector3(...targetLookAt);
    const startTime = performance.now();
    cameraAnim = { startPos, startTarget, endPos, endTarget, startTime, duration };
}

function updateCameraAnim() {
    if (!cameraAnim || !appState.camera || !appState.controls) return;
    const now = performance.now();
    const elapsed = now - cameraAnim.startTime;
    const t = Math.min(1, elapsed / cameraAnim.duration);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    appState.camera.position.lerpVectors(cameraAnim.startPos, cameraAnim.endPos, ease);
    appState.controls.target.lerpVectors(cameraAnim.startTarget, cameraAnim.endTarget, ease);
    if (t >= 1) cameraAnim = null;
}

/**
 * 렌더 루프 및 실시간 FPS 성능 측정 엔진
 */
function animateLoop() {
    requestAnimationFrame(animateLoop);
    // Skip rendering when tab is hidden to save CPU
    if (document.hidden) return;

    const delta = clock.getDelta();
    frameCount++;

    // 실시간 FPS 측정 (250ms 주기)
    const now = performance.now();
    if (now - lastFpsUpdateTime >= 250) {
        const measuredFps = Math.round((frameCount * 1000) / (now - lastFpsUpdateTime));
        frameCount = 0;
        lastFpsUpdateTime = now;

        appState.gpuEngineState.fps = measuredFps;
        appState.gpuEngineState.frameTimeMs = (1000 / Math.max(measuredFps, 1)).toFixed(1);

        if (measuredFps > 0 && measuredFps < appState.gpuEngineState.minFps) appState.gpuEngineState.minFps = measuredFps;
        if (measuredFps > appState.gpuEngineState.maxFps) appState.gpuEngineState.maxFps = measuredFps;

        appState.gpuEngineState.fpsHistory.push(measuredFps);
        if (appState.gpuEngineState.fpsHistory.length > 40) appState.gpuEngineState.fpsHistory.shift();

        const sum = appState.gpuEngineState.fpsHistory.reduce((a, b) => a + b, 0);
        appState.gpuEngineState.avgFps = Math.round(sum / appState.gpuEngineState.fpsHistory.length);

        const badgeFps = $('gpu-badge-fps');
        if (badgeFps) badgeFps.textContent = `${measuredFps} FPS`;

        if (window.__updateGpuModalLive) window.__updateGpuModalLive();

        // 실시간 부하 감지 및 자동 저사양 모델 전환 (초기 3초 워밍업 이후, 백그라운드 탭 제외)
        if (!document.hidden && now - sceneInitTime > 3000 && appState.autoAdaptLowSpec && !appState.lowSpecManualOverride) {
            if (!appState.lowSpecMode) {
                const isLagging = measuredFps > 0 && (measuredFps < 24 || (appState.dataObjects.length > 100 && measuredFps < 30));
                lowFpsStreak = isLagging ? lowFpsStreak + 1 : Math.max(0, lowFpsStreak - 1);
                if (lowFpsStreak >= 12) {
                    lowFpsStreak = 0;
                    setLowSpecMode(true, '3d-lite', { autoTriggered: true });
                }
            } else if (appState.lowSpecType === '3d-lite') {
                const isSevereLag = measuredFps > 0 && measuredFps < 14;
                severeLowFpsStreak = isSevereLag ? severeLowFpsStreak + 1 : Math.max(0, severeLowFpsStreak - 1);
                if (severeLowFpsStreak >= 20) {
                    severeLowFpsStreak = 0;
                    setLowSpecMode(true, '2d-only', { autoTriggered: true });
                }
            }
        }
    }

    // 저사양 2D 전용 모드일 경우 3D 렌더링을 일시 정지하여 GPU 부하 0% 유지
    if (appState.lowSpecMode && appState.lowSpecType === '2d-only') {
        return;
    }

    updateCameraAnim();

    if (appState.controls) appState.controls.update();
    if (appState.renderer && appState.scene && appState.camera) {
        appState.renderer.render(appState.scene, appState.camera);
    }
    updateLabels();
}

/**
 * 저사양 최적화 모드 제어 (3D 경량 모델 / 2D 전용 전환)
 */
export function setLowSpecMode(enabled, type = '3d-lite', options = {}) {
    appState.lowSpecMode = enabled;
    appState.lowSpecType = type;

    if (options.manual) {
        appState.lowSpecManualOverride = !enabled;
    }

    if (!options.autoTriggered) {
        try {
            localStorage.setItem('lowSpecMode', enabled ? 'true' : 'false');
            localStorage.setItem('lowSpecType', type);
        } catch (e) {}
    }

    if (enabled) {
        preloadLowResModels();
    }

    // 씬 환경 부하 제어 (저사양 모드 시 안개 및 포인트 라이트 비활성화)
    if (appState.scene) {
        if (enabled) {
            appState.scene.fog = null;
        } else {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const fogHex = isDark ? 0x0f172a : 0xf1f5f9;
            appState.scene.fog = new THREE.FogExp2(fogHex, 0.015);
        }
    }
    if (pointLight) {
        pointLight.intensity = enabled ? 0 : 0.5;
    }

    const btn = $('btn-lowspec-toggle');
    const label = $('lowspec-btn-label');
    if (btn) {
        btn.classList.toggle('active', enabled);
        if (label) label.textContent = enabled ? '⚡ 저사양 ON' : '⚡ 저사양 모드';
        btn.setAttribute('title', enabled ? '저사양 모델 활성화됨 (클릭하여 일반 모드 복원)' : '저사양 기기 렉 방지 및 경량 모델 모드');
    }

    const menuCheckbox = $('menu-lowspec-toggle');
    if (menuCheckbox) menuCheckbox.checked = enabled;

    const modeSelect = $('menu-lowspec-type');
    if (modeSelect) modeSelect.value = type;

    const canvasContainer = $('canvas-container');
    const lowspecCard = $('lowspec-container');

    if (enabled && type === '2d-only') {
        if (canvasContainer) canvasContainer.style.display = 'none';
        if (lowspecCard) lowspecCard.style.display = 'flex';
        if (window.__renderLowSpecChartWithData) {
            window.__renderLowSpecChartWithData();
        }
        if (options.autoTriggered) {
            showToast('⚡ <strong>극심한 부하 감지 — 초경량 2D 모드 전환</strong>: 렉 없이 사용하실 수 있도록 2D 차트 모드로 전환했습니다.');
        } else if (!options.initial) {
            showToast('⚡ <strong>초경량 2D 모드 적용</strong>: 3D 가속을 중단하고 100% 렉 없는 2D 대시보드로 작동합니다.');
        }
    } else {
        if (lowspecCard) lowspecCard.style.display = 'none';
        if (canvasContainer) canvasContainer.style.display = 'block';
        if (!appState.renderer || !appState.scene) {
            initThreeScene().then(() => {
                handleAdaptiveResize();
                if (appState.parsedData && window.__applyVisualization) {
                    window.__applyVisualization();
                }
            });
        } else {
            handleAdaptiveResize();
            if (appState.parsedData && window.__applyVisualization) {
                window.__applyVisualization();
            }
        }
        if (enabled) {
            if (options.autoTriggered) {
                showToast('⚡ <strong>과부하 감지 — 저사양 3D 모델 자동 적용</strong>: 프레임 저하(렉)가 감지되어 경량 GLB 모델 및 3D 최적화 모드로 전환했습니다.');
            } else if (!options.initial) {
                showToast('⚡ <strong>3D 저사양 모델 모드 적용</strong>: 경량 GLB 모델, 해상도 1.0x 제한 및 셰이더 최적화로 렉을 방지합니다.');
            }
        } else if (!options.initial) {
            showToast('🧊 <strong>표준 고화질 3D 모드 복원</strong>: 고해상도 안티앨리어싱 및 표준 모델이 복원되었습니다.');
        }
    }

    window.dispatchEvent(new CustomEvent('lowspecchange', { detail: { enabled, type, autoTriggered: Boolean(options.autoTriggered) } }));
}
window.__setLowSpecMode = setLowSpecMode;
window.__rendererSetLowSpecMode = setLowSpecMode;

/**
 * 카메라 프리셋 버튼 바인딩
 */
export function bindCameraControls() {
    $('btn-reset-camera')?.addEventListener('click', () => {
        handleAdaptiveResize();
        const aspect = window.innerWidth / Math.max(window.innerHeight, 1);
        const aspectMultiplier = aspect < 1.0 ? 1.55 : (aspect < 1.3 ? 1.25 : 1.0);
        const spread = Math.max(appState.dataObjects.length * 1.3, 10) * aspectMultiplier;
        animateCamera([0, spread * 0.5 + 5, spread * 0.7 + 8], [0, 2, 0]);
        showToast('📐 <strong>화면 자동 맞춤 완료!</strong> 현재 화면 크기 및 해상도에 최적화되었습니다.');
    });
    $('btn-iso-view')?.addEventListener('click', () => {
        const spread = Math.max(appState.dataObjects.length * 1.3, 10);
        animateCamera([spread * 0.7, spread * 0.6 + 6, spread * 0.7], [0, 1.5, 0]);
    });
    $('btn-top-view')?.addEventListener('click', () => {
        const spread = Math.max(appState.dataObjects.length * 1.3, 10);
        animateCamera([0, spread + 10, 0.1], [0, 0, 0]);
    });
    $('btn-front-view')?.addEventListener('click', () => {
        const spread = Math.max(appState.dataObjects.length * 1.3, 10);
        animateCamera([0, 4, spread * 0.8 + 10], [0, 3, 0]);
    });
    $('btn-auto-rotate')?.addEventListener('click', () => {
        if (!appState.controls) return;
        appState.controls.autoRotate = !appState.controls.autoRotate;
        appState.controls.autoRotateSpeed = 2.0;
        const btn = $('btn-auto-rotate');
        if (btn) {
            btn.style.background = appState.controls.autoRotate ? '#e0e7ff' : '';
            btn.style.color = appState.controls.autoRotate ? '#4338ca' : '';
        }
    });
    $('btn-toggle-grid')?.addEventListener('click', toggleGrid);
    $('btn-toggle-labels')?.addEventListener('click', toggleLabels);
}
