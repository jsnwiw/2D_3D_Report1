# Low-Resolution 3D Models (`models/lowres/`)

저사양 기기 및 실시간 과부하(FPS 저하) 감지 시 렉 없이 60fps로 렌더링하기 위한 초경량 Low-Poly GLB(glTF 2.0) 모델이 포함되어 있습니다.

- `model_low.glb`: 막대/타워 시각화용 초경량 6각 기둥 GLB 모델 (36 triangles, 바닥 원점 `y = 0`)
- `node_low.glb`: 산점도/라인/서피스 노드용 초경량 8면체 GLB 마커 모델 (8 triangles)

## 동작 방식
1. **고사양 기기**: 기본으로 원래의 표준 고화질 3D 모델/지오메트리(`MeshStandardMaterial`, 고해상도 세그먼트, 베벨, 안개, 조명)를 사용합니다.
2. **저사양 기기 감지 시 (`lowspec.js`)**: 자동으로 저사양 3D 라이트 모드(`3d-lite`)가 적용되어 `model_low.glb` / `node_low.glb` 및 경량 `MeshLambertMaterial`로 전환됩니다.
3. **실시간 부하 감지 시 (`js/renderer3d.js`)**: 고사양 기기에서도 대용량 데이터 등으로 프레임이 지속적으로 저하(24 FPS 미만)되면 자동으로 저사양 3D 모델 모드로 전환하여 렉을 방지합니다.
