/**
 * GitHub 프로젝트 자동 수집 및 동기화 스크립트 (sync_github_projects.js)
 * 
 * GitHub REST API를 통해 jsnwiw 계정의 모든 퍼블릭 저장소를 가져와
 * 의미 있는 프로젝트를 자동 선별하고 projects_registry.json으로 동기화합니다.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const GITHUB_USERNAME = 'jsnwiw';
const OUTPUT_FILE = path.join(__dirname, '..', 'projects_registry.json');

// 무의미하거나 임시 테스트용 저장소 필터링 정규식/목록
const IGNORED_NAMES = [
  /^1+$/, /^2+$/, /^\-+/, /^[0-9]+$/, /^test/i, /^nam$/i, /^13wj/i
];

// 알려진 주요 프로젝트 메타데이터 매핑
const PROJECT_METADATA_MAP = {
  '2D_3D_Report1': {
    title: '3D & 2D 인터랙티브 데이터 분석 시스템',
    tag: '개인',
    techStack: ['Three.js', 'WebGPU', 'WebGL', 'Chart.js', 'SheetJS', 'PWA', 'JavaScript'],
    description: 'Vulkan/WebGPU 차세대 가속 3D 다차원 시각화 및 AI 리포트 스튜디오'
  },
  'NDVM': {
    title: 'NDVM - 네트워크 & 인프라 데이터 시각화 시스템',
    tag: '팀',
    techStack: ['JavaScript', 'Chart.js', 'Network Visualization'],
    description: '네트워크 장비 상태 실시간 매핑 및 트래픽 플로우 토폴로지 시각화'
  },
  'korea_disaster_insight': {
    title: '한국 재난 인사이트 분석 대시보드',
    tag: '개인',
    techStack: ['JavaScript', 'Public Open Data API', 'Chart.js'],
    description: '전국 재난/재해 공공 오픈 API 실시간 수집 및 다차원 위험도 분석'
  },
  'korea_infrastructure_analysis': {
    title: '대한민국 스마트 인프라 안전성 및 시설 분석',
    tag: '팀',
    techStack: ['JavaScript', 'Chart.js', 'Public Data Analysis'],
    description: '전국 공공 인프라 시설물의 노후도 및 안전등급 통계 데이터 분석'
  },
  '3Dvisualization': {
    title: '3D Glass Shader & Material Studio',
    tag: '개인',
    techStack: ['Three.js', 'WebGL', 'Custom GLSL', 'PBR Material'],
    description: '물리 기반 렌더링(PBR) 글래스 셰이더 및 IOR 굴절/반사 실시간 스튜디오'
  },
  'project-presentation': {
    title: '인터랙티브 웹 쇼케이스 프레젠테이션',
    tag: '솔루션',
    techStack: ['HTML5', 'CSS3', 'JavaScript'],
    description: '프레임워크 없는 순수 웹 표준 기반 초경량 슬라이드 엔진'
  }
};

function fetchGitHubRepos(username) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/users/${username}/repos?sort=updated&per_page=100`,
      method: 'GET',
      headers: {
        'User-Agent': 'NodeJS-GitHub-Sync-Agent'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            reject(new Error(`GitHub API Error: HTTP ${res.statusCode} - ${data}`));
            return;
          }
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function syncProjects() {
  console.log(`\n======================================================`);
  console.log(`🚀 [GitHub Sync] github.com/${GITHUB_USERNAME} 저장소 수집 시작...`);
  console.log(`======================================================\n`);

  try {
    const rawRepos = await fetchGitHubRepos(GITHUB_USERNAME);
    console.log(`✅ GitHub에서 총 ${rawRepos.length}개의 저장소를 발견했습니다.\n`);

    const curatedProjects = [];
    const scratchRepos = [];

    for (const repo of rawRepos) {
      if (repo.fork) continue; // 포크된 저장소 스킵

      // 무의미한 테스트용 이름 검사
      const isIgnored = IGNORED_NAMES.some(pattern => pattern.test(repo.name));
      if (isIgnored) {
        scratchRepos.push(repo.name);
        continue;
      }

      const knownMeta = PROJECT_METADATA_MAP[repo.name] || {};
      const projectItem = {
        name: repo.name,
        title: knownMeta.title || repo.name,
        tag: knownMeta.tag || '개인',
        githubUrl: repo.html_url,
        demoUrl: repo.homepage || `https://${GITHUB_USERNAME}.github.io/${repo.name}/`,
        description: knownMeta.description || repo.description || 'GitHub 프로젝트',
        language: repo.language || 'JavaScript',
        techStack: knownMeta.techStack || [repo.language || 'JavaScript'],
        stars: repo.stargazers_count,
        updatedAt: repo.updated_at,
        createdAt: repo.created_at
      };

      curatedProjects.push(projectItem);
    }

    const payload = {
      username: GITHUB_USERNAME,
      syncedAt: new Date().toISOString(),
      totalReposFound: rawRepos.length,
      curatedCount: curatedProjects.length,
      projects: curatedProjects
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');

    console.log(`📁 [결과 저장] ${OUTPUT_FILE} 에 ${curatedProjects.length}개 프로젝트 동기화 완료!`);
    console.log(`\n--- 📌 선별된 주요 프로젝트 목록 ---`);
    curatedProjects.forEach((p, idx) => {
      console.log(`${idx + 1}. [${p.tag}] ${p.title} (${p.name})`);
      console.log(`   🔗 GitHub: ${p.githubUrl}`);
      console.log(`   🌐 Demo:   ${p.demoUrl}`);
      console.log(`   🛠️ Tech:   ${p.techStack.join(', ')}`);
      console.log();
    });

    if (scratchRepos.length > 0) {
      console.log(`ℹ️ 임시/테스트성으로 판별되어 필터링된 저장소 (${scratchRepos.length}개):`);
      console.log(`   ${scratchRepos.join(', ')}\n`);
    }

    console.log(`✨ 동기화 작업이 성공적으로 완료되었습니다.`);
  } catch (err) {
    console.error(`❌ 동기화 실패:`, err.message);
  }
}

syncProjects();
