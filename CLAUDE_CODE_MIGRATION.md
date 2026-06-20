# 2026 월드컵 앱 — Claude Code 마이그레이션 가이드

HTML 프로토타입(`worldcup_2026_app.html`)을 React + Vite + Vercel 정식 앱으로 옮기기 위한 작업 지침서. 기존 vibe-coding 워크플로우(React+Vite, Vercel 배포, localStorage V1) 기준으로 작성.

---

## 1. 목표와 범위

프로토타입에서 이미 동작하는 것(그대로 이식):
- 72경기 조별리그 일정 + 32강 16경기 (KST)
- 날짜/조/팀/장소 필터, 헤더 정렬, 탭 전환
- 결과 수동 입력 → 12개 조 순위 자동 계산
- localStorage 저장, JSON 내보내기/불러오기

정식 앱에서 새로 추가하는 것:
- **실시간 결과 자동 수집** (서버리스 프록시 경유)
- **수동 입력 ↔ 자동 수집 병합** (수동 입력 우선 override)
- **32강 대진 자동 채움** (조별리그 종료 후, 선택)
- **.ics 캘린더 내보내기**
- 여러 기기에서 접근(Vercel 배포 URL)

명시적 비목표(초기 버전): 사용자 계정, 서버 DB 동기화, 베팅/xG/라인업 등 심화 데이터. 필요해지면 그때 백엔드+DB 단계로.

---

## 2. 아키텍처 결정

### 2.1 데이터 소스 선택

| API | 무료 티어 | 월드컵 | 라이브 | 비고 |
|---|---|---|---|---|
| football-data.org | 분당 10콜, 무료 영구 | 포함 | ❌ 지연 제공 | REST/JSON 단순, 키 발급 쉬움 |
| API-Football (api-sports.io) | 하루 100요청 | 전 티어 포함 | ✅ 라이브 | 라이브 스코어 필요 시 |

권장: **프로토타이핑·하루 단위 업데이트면 football-data.org 무료**로 충분(경기 다음날 결과 반영). **경기 중 실시간 반영이 필요하면 API-Football 무료(100/일)**로 시작하고, 폴링 주기를 길게(라이브 중 60~90초) 잡아 한도 관리.

> 주의: football-data.org 무료 티어는 점수·일정이 지연되며 라이브 스코어는 유료 add-on. 라이브가 핵심 요구면 처음부터 API-Football로 설계.

### 2.2 왜 서버리스 프록시인가 (직접 호출 금지)

정적 SPA에서 API를 브라우저가 직접 호출하면 (1) API 키 노출, (2) CORS 차단, (3) 레이트리밋 폭주 문제가 생긴다. → **Vercel Serverless Function(`/api/*`)을 프록시로 둬서** 키를 서버 환경변수에 숨기고, 응답을 캐시(예: 60초 `s-maxage`)해 한도를 보호한다.

```
[브라우저] → /api/results (Vercel Function) → [외부 API]
                    └ 환경변수 키 + 캐시 + 정규화(JSON 변환)
```

### 2.3 데이터의 두 층

- **정적 골격**: `fixtures.json` (경기 ID·일시·조·팀·장소). 프로토타입 JSON을 그대로 사용. 빌드 타임 번들.
- **동적 결과**: `results` (스코어). 우선순위 = **수동 입력 > API 자동** (사용자가 손으로 고친 값은 자동 수집이 덮어쓰지 않음). localStorage + (선택) API 병합.

매치 식별자(`matchId`)는 프로토타입과 동일하게 `"{조}|{home}|{away}"` 유지 → 마이그레이션 시 기존 데이터 호환.

---

## 3. 프로젝트 구조

```
wc2026-app/
├─ api/
│  ├─ results.js          # 외부 API 프록시 + 정규화 + 캐시
│  └─ standings.js        # (선택) API 순위 직접 사용 시
├─ src/
│  ├─ data/fixtures.json  # 프로토타입에서 추출한 72+16 경기
│  ├─ lib/
│  │  ├─ standings.js     # 순위 계산 (프로토타입 로직 이식)
│  │  ├─ merge.js         # 수동 결과 ⊕ API 결과 병합
│  │  └─ ics.js           # 캘린더 내보내기
│  ├─ hooks/useLocalStorage.js
│  ├─ components/
│  │  ├─ Tabs.jsx
│  │  ├─ FixtureTable.jsx # 필터+정렬+결과입력
│  │  ├─ Standings.jsx
│  │  └─ Round32.jsx
│  └─ App.jsx
├─ .env.local             # FOOTBALL_API_KEY=...  (gitignore)
└─ vercel.json
```

---

## 4. 단계별 작업 (Claude Code 프롬프트 포함)

각 단계는 독립 커밋. Claude Code에 아래 프롬프트를 순서대로 던지되, 단계마다 동작 확인 후 다음으로.

### Phase 0 — 스캐폴드
```
npm create vite@latest wc2026-app -- --template react
cd wc2026-app && npm i
```
Claude Code 프롬프트:
> "Vite+React 프로젝트에 위 디렉토리 구조를 만들어줘. 라우팅은 단일 페이지 탭이라 react-router 없이 useState 탭으로. 스타일은 프로토타입 CSS를 src/index.css로 이식."

### Phase 1 — 정적 프로토타입 1:1 이식
> "첨부한 `worldcup_2026_app.html`의 fixtures 데이터를 `src/data/fixtures.json`으로 추출하고, 필터(날짜·조·팀·장소)·정렬·탭·순위 자동계산 로직을 React 컴포넌트로 분해해줘. 동작은 원본과 100% 동일하게. 순위 정렬 기준은 승점→골득실→다득점 유지."

체크: 결과 입력 → 순위 갱신이 프로토타입과 동일한지 비교.

### Phase 2 — 영속성 + 가져오기/내보내기
> "`useLocalStorage` 훅을 만들어 results 상태를 'wc2026_results' 키로 저장. 프로토타입과 동일한 JSON 스키마({matchId:{h,a}})로 import/export 버튼 구현. matchId는 '{조}|{home}|{away}' 유지해서 기존 데이터 호환되게."

### Phase 3 — 실시간 결과 자동 수집 (핵심)
환경변수 설정: `.env.local`에 `FOOTBALL_API_KEY`, Vercel 대시보드에도 동일 등록.

`api/results.js` 프록시 스켈레톤:
```js
// Vercel Serverless Function
export default async function handler(req, res) {
  const r = await fetch(
    'https://api.football-data.org/v4/competitions/WC/matches',
    { headers: { 'X-Auth-Token': process.env.FOOTBALL_API_KEY } }
  );
  const data = await r.json();
  // 외부 스키마 → 우리 {matchId:{h,a,status}} 로 정규화
  const out = {};
  for (const m of data.matches ?? []) {
    if (m.status !== 'FINISHED' && m.status !== 'IN_PLAY') continue;
    const id = normalizeId(m); // 팀명 → 한글 매핑 테이블 필요
    out[id] = { h: m.score.fullTime.home, a: m.score.fullTime.away, status: m.status };
  }
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  res.json(out);
}
```
> Claude Code 프롬프트: "api/results.js를 위 패턴으로 작성하되, 외부 API 영문 팀명을 fixtures.json의 한글 팀명에 매핑하는 teamMap을 만들어줘. 프론트는 앱 로드 시 1회 + (라이브 시간대면) 60초 폴링으로 /api/results를 가져와 results와 병합. 병합 규칙은 수동 입력이 있으면 그 값을 우선."

병합 로직(`merge.js`) 규칙: `manual[id]`가 존재하면 그대로, 없으면 `api[id]` 사용.

### Phase 4 — 32강 대진 자동 채움 (선택, 조별리그 종료 후)
FIFA Annex C 규칙(3위 8팀 조합에 따라 대진 결정, 495 시나리오)은 직접 구현이 복잡하니, **API가 knockout 대진을 노출하면 그걸 우선 사용**하고, 안 되면 수동 입력 UI만 둔다.
> "조별리그 전 경기 status가 FINISHED가 되면, API의 32강 fixture를 가져와 Round32 탭의 'TBD'를 실제 팀으로 채워줘. API에 없으면 수동 입력 셀 유지."

### Phase 5 — .ics 내보내기 + 배포
> "현재 필터된 경기(또는 한국 경기만)를 .ics로 내보내는 버튼 추가. VEVENT의 DTSTART는 fixtures의 KST를 UTC로 변환(-9h)해서 생성. 그다음 Vercel에 배포하고 환경변수 연결 확인."

배포: `vercel --prod` (또는 GitHub 연동 자동배포). 환경변수는 Vercel 프로젝트 설정에 등록.

---

## 5. `CLAUDE.md` 권장 내용 (프로젝트 루트)

```markdown
# WC2026 App
- Stack: React 18 + Vite, Vercel serverless (/api), localStorage V1.
- Data: src/data/fixtures.json (정적 골격, KST). results는 동적.
- matchId = "{조}|{home}|{away}". 절대 변경 금지(데이터 호환).
- 결과 우선순위: 수동 입력 > API 자동. 병합은 lib/merge.js.
- 순위 정렬: 승점 → 골득실 → 다득점.
- API 키는 서버 환경변수(FOOTBALL_API_KEY)만. 클라이언트 직접 호출 금지.
- 시간은 전부 KST 표기, .ics 생성 시에만 UTC 변환.
## 검증
- 결과 입력 시 순위가 프로토타입과 동일하게 갱신되는지.
- API 응답 팀명이 teamMap으로 100% 한글 매핑되는지(누락 시 콘솔 경고).
```

---

## 6. 핵심 주의점 (실수 방지)

1. **레이트리밋**: 무료 티어(10/분 또는 100/일)는 브라우저 직접 폴링이면 금방 소진. 반드시 서버 프록시 + 캐시. 라이브 폴링은 경기 시간대에만, 60초+ 주기.
2. **지연 데이터**: football-data 무료는 실시간 아님. "실시간"이 요구면 API-Football로 교체(프록시만 바꾸면 됨 — 그래서 정규화 계층이 중요).
3. **팀명 매핑**: 외부 API는 영문/표준 표기. fixtures.json의 한글명과 매핑 테이블 없으면 결과가 안 붙는다. 가장 흔한 버그.
4. **104 vs 72**: 일부 피드는 72개 조별리그만 먼저, 토너먼트는 확정 후 노출. fixture 개수를 하드코딩하지 말 것.
5. **키 보안**: `.env.local`은 gitignore. 절대 클라이언트 번들에 키 포함 금지(`VITE_` 접두사 쓰지 말 것 — 그건 브라우저에 노출됨).
6. **수동 override 보존**: 자동 수집이 손으로 고친 값을 덮어쓰지 않게 병합 순서 엄수.

---

## 7. 추천 진행 순서

Phase 1~2(정적 이식 + 저장)까지는 한 세션에 끝내고 바로 배포해 폰에서 확인. Phase 3(자동 수집)은 한국 조별리그 첫 경기(6/12) 전에 붙여 실제 데이터로 검증. Phase 4(32강 자동)는 6/27 이후. .ics는 아무 때나.

> 이 가이드의 정적 데이터·순위 로직은 이미 프로토타입에 검증돼 있으므로, Phase 1은 "재구현"이 아니라 "구조 분해 이식"으로 접근하면 빠르다.
