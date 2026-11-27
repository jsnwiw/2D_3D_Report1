# Project Automation Scripts

This folder contains utilities for automated project management and changelog maintenance.

---

## 1. 🚀 GitHub 프로젝트 자동 수집 및 동기화 (`sync_github_projects.js`)

GitHub 계정(`github.com/jsnwiw`)의 모든 퍼블릭 저장소를 REST API로 실시간 조회하여, 임시/테스트성 저장소를 자동으로 필터링하고 주요 프로젝트 정보를 `projects_registry.json`으로 동기화합니다.

### 실행 방법
```bash
npm run sync-projects
# 또는
node scripts/sync_github_projects.js
```

### 기능 및 동작 원리
1. GitHub API (`/users/jsnwiw/repos`) 비동기 호출
2. 포크(Fork) 저장소 및 임시 숫자/특수기호 저장소 자동 제외
3. 저장소별 GitHub URL, GitHub Pages 데모 주소(`https://jsnwiw.github.io/<repo>/`), 언어, 기술 스택 자동 매핑
4. 프로젝트 루트에 `projects_registry.json` 파일 생성 및 갱신

---

## 2. 📝 패치 노트 자동화 (`add_patch_note.js`)

새로운 기능 개발이나 수정 사항을 체계적으로 기록합니다.

### 실행 방법
```bash
node scripts/add_patch_note.js "Fix rendering; Add dark theme support; Update AI Report depth options"
```

- 구분자: 세미콜론 (`;`)
- `patch_notes.json`과 `패치내역.md`에 버전 번호 및 날짜와 함께 자동 반영됩니다.
