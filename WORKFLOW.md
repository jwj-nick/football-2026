# WORKFLOW — 기술 상세 · 도구/스킬 · API 연동 가이드

이 문서는 **개발 워크플로우(어떤 도구로 어떻게 작업하나)** 와 **확장(특히 실시간 API)** 의 기술 상세를 담는다.
사람용 개요는 `README.md`, Claude용 규칙은 `CLAUDE.md`.

---

## 1. 개발 워크플로우 (도구 · 흐름)

### 1.1 작업 사이클
```
바꾸고 싶은 것 한 가지 정함
  → 파일 수정 (한 곳만)
  → index.html 새로고침으로 눈으로 확인
  → 잘 되면 WORKLOG.md에 한 줄 + git 커밋
  → 안 되면 콘솔(F12) 에러 보고 고침
```
**원칙: 작게 자주.** 한 번에 여러 곳을 바꾸면 어디서 깨졌는지 못 찾는다.

### 1.2 쓰는 도구
| 도구 | 용도 |
|---|---|
| 브라우저(Chrome) | 실행·확인. `F12` 개발자도구 → Console 탭에서 에러 확인 |
| 텍스트 에디터 / Claude Code | 코드 수정 |
| `git` + GitHub | 버전 기록 + Pages 배포 |
| Claude (대화/Claude Code) | 바이브 코딩 파트너 |

### 1.3 Claude에게 일 시키는 법 (요청 템플릿)
> **[무엇]** ___ 을(를) **[어디]** (파일/함수) 에서 바꿔줘.
> **[어떻게 확인]** ___ 하면 성공.

예: "조별리그 표에서 한국 경기를 맨 위로 고정해줘. 정렬은 `js/app.js`의 `renderGS` 안에 있어. 조별리그 탭에서 한국 3경기가 위에 오면 성공."

### 1.4 로컬 실행 두 가지
- **가장 간단:** `index.html` 더블클릭. (이 앱은 ES모듈을 안 써서 `file://`로도 잘 돈다.)
- **권장(서버 흉내):** 폴더에서 아래 중 하나 — 일부 브라우저 보안정책이 더 엄격할 때 안전.
  ```bash
  python -m http.server 8000      # → http://localhost:8000
  # 또는
  npx serve .
  ```

---

## 2. 데이터 계약 (바꾸면 안 되는 약속)

- `matchId = "{조}|{home}|{away}"` — 결과 저장/조회의 열쇠. **형식 고정.**
- localStorage: 키 `wc2026_results`, 값 `{ "A|대한민국|체코": {h:2, a:1}, ... }`.
- 결과 우선순위(미래 API 붙일 때): **수동 입력 > 자동 수집.** 손으로 고친 값을 자동이 덮지 않는다.
- 시간 전부 KST. `.ics` 같은 캘린더 내보낼 때만 UTC(−9h)로 변환.

---

## 3. 확장 가이드 ① — 작은 기능들 (서버 불필요)

빌드/서버 없이 바로 가능한 것들. `learn/`의 미션과 연결됨.
- 응원팀 즐겨찾기(⭐) + localStorage 저장
- 다크 모드 토글 (`:root` 변수 교체)
- 경기 검색창 (팀명 입력 필터)
- 한국 경기 D-day 카운트다운
- `.ics` 캘린더 내보내기 (한국 경기를 폰 캘린더에 추가)

---

## 4. 결과 자동수집 — ✅ 구현됨 (GitHub Actions 방식)

> GitHub Pages는 정적 호스팅이라 **서버리스 함수가 없다.** 그래서 마이그레이션 가이드의
> Vercel 프록시 대신, **GitHub Actions(예약 실행)가 결과를 긁어 `data/results.json`으로
> 커밋 → 앱이 그 JSON을 읽는** 방식으로 구현했다. (키는 Actions Secret에 숨겨져 안전, CORS 무관)

```
[GitHub Actions cron] → scripts/fetch-results.mjs → [football-data.org]
        └ 키는 Secret · 팀명 한글 매핑 · data/results.json 커밋
[브라우저] → data/results.json (정적 파일) → 화면/순위에 병합
```

구성 파일:
- `scripts/fetch-results.mjs` — 일정(js/data.js) 읽기 → API 호출 → 영문→한글 팀명 매핑 → `data/results.json` 생성.
- `.github/workflows/update-results.yml` — 2시간마다(cron) + 수동 실행(Run workflow). 변경분만 커밋·푸시.
- `js/app.js` — 로드 시 `data/results.json`을 읽어 **수동 입력 > 자동** 규칙으로 병합(`eff()`), 순위 재계산.
- `data/results.json` — 현재 결과(초기엔 수동 스냅샷, 이후 Actions가 갱신).

### ⚙️ 켜는 법 (한 번만 — 본인/아들이 직접)
1. **무료 API 키 발급**: https://www.football-data.org/client/register → 이메일로 토큰 수령.
2. **GitHub Secret 등록**: 저장소 → Settings → Secrets and variables → Actions → New repository secret
   - 이름 `FOOTBALL_API_KEY`, 값 = 발급받은 토큰.
3. **워크플로우 권한**: Settings → Actions → General → Workflow permissions → **Read and write** 허용.
4. **첫 실행**: Actions 탭 → "경기 결과 자동 갱신" → **Run workflow**. 이후엔 2시간마다 자동.
   - 실행 로그에 `매핑 안 된 팀명: …` 경고가 보이면 `scripts/fetch-results.mjs`의 `TEAM`에 그 영문명을 추가.
> 키를 안 넣어도 앱은 **현재 스냅샷 + 수동 입력**으로 정상 동작한다. 키를 넣으면 그때부터 자동.

---

## 4-구. (참고) 원래 설계 — 서버리스 프록시 방식

> 아래는 Vercel 등으로 옮길 때의 참고 설계. 전체 React 정식화 맥락은 `CLAUDE_CODE_MIGRATION.md`.

### 4.1 왜 브라우저가 API를 직접 부르면 안 되나
1. **키 노출** — API 키를 브라우저 코드에 넣으면 누구나 소스 보고 훔친다.
2. **CORS** — 외부 API가 브라우저 직접 호출을 막는 경우가 많다.
3. **레이트리밋** — 무료 한도가 금방 소진된다.

→ 해결: **서버리스 프록시**. 브라우저는 *우리 서버*에만 요청하고, 우리 서버가 키를 숨긴 채 외부 API를 호출.
```
[브라우저] → /api/results (우리 서버리스 함수) → [외부 축구 API]
                  └ 키는 서버 환경변수 + 응답 캐시 + 한글 팀명으로 정규화
```

### 4.2 API 후보
| API | 무료 티어 | 라이브 | 비고 |
|---|---|---|---|
| **football-data.org** | 분당 10콜, 영구 무료 | ❌ 지연 | 키 발급 쉬움, 입문에 적합 |
| **API-Football** (api-sports.io) | 하루 100요청 | ✅ 라이브 | 경기 중 실시간 필요 시 |

입문 추천: **football-data.org** (다음날 결과 반영이면 충분). 실시간이 꼭 필요하면 API-Football.

### 4.3 최소 구현 스케치 (Vercel 서버리스 함수)
```js
// api/results.js  — 브라우저가 부르는 우리 서버 함수
export default async function handler(req, res) {
  const r = await fetch(
    'https://api.football-data.org/v4/competitions/WC/matches',
    { headers: { 'X-Auth-Token': process.env.FOOTBALL_API_KEY } } // 키는 환경변수!
  );
  const data = await r.json();

  // 외부 응답 → 우리 형식 { matchId: {h, a, status} } 로 정규화
  const out = {};
  for (const m of data.matches ?? []) {
    if (m.status !== 'FINISHED' && m.status !== 'IN_PLAY') continue;
    const id = toMatchId(m); // ⚠️ 영문 팀명 → 한글 팀명 매핑 필요 (가장 흔한 버그!)
    out[id] = { h: m.score.fullTime.home, a: m.score.fullTime.away, status: m.status };
  }
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300'); // 캐시로 한도 보호
  res.json(out);
}
```
프론트(app.js) 쪽: 앱 로드 시 1회 + (경기 시간대면) 60초마다 `/api/results`를 받아
**수동 입력이 없는 경기만** 자동 값으로 채운다.

### 4.4 실수 방지 체크리스트
- [ ] API 키는 **서버 환경변수**에만. `VITE_` 접두사 금지(브라우저 노출됨). `.env`는 `.gitignore`.
- [ ] **팀명 매핑** 테이블 필수 (영문 ↔ `data.js`의 한글). 누락 시 결과가 안 붙음 → 콘솔 경고 찍기.
- [ ] 라이브 폴링은 **경기 시간대에만**, 60초+ 주기. (무료 한도 보호)
- [ ] 자동 수집이 **수동 override를 덮지 않게** 병합 순서 엄수.
- [ ] 경기 개수 하드코딩 금지 (조별리그만 먼저 노출되는 피드 있음).

### 4.5 이 단계를 시작하는 신호
- football-data.org 무료 키 발급 완료
- GitHub 저장소 + Vercel 연결 (서버리스 함수 호스팅용)
- → 그 다음 `CLAUDE_CODE_MIGRATION.md`의 Phase 3을 따라가거나, "최소 버전부터 하나씩" Claude와 진행.

---

## 5. 배포 워크플로우 (요약)
정적 앱이라 **GitHub Pages면 충분**(서버리스 API를 붙이기 전까지). 절차는 `README.md` 참고.
실시간 API 단계로 가면 그때 **Vercel**로 옮긴다(서버리스 함수 필요).
