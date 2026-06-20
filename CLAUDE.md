# CLAUDE.md — 2026 월드컵 즐기기 도우미 앱

이 파일은 **Claude(나)에게 주는 프로젝트 사용설명서**다. 이 폴더에서 Claude Code를 실행하면 자동으로 읽힌다.
사람용 개요는 `README.md`, 작업 기록은 `WORKLOG.md`, 기술/API 상세는 `WORKFLOW.md` 참고.

---

## 0. 이 프로젝트의 목적 (가장 중요)

1. **2026 FIFA 월드컵을 가족이 즐기는 도우미 앱** — 일정/결과/순위.
2. **고등학생 아들의 바이브 코딩 입문 교재** — 앱 안에 `learn/` 학습 페이지를 포함.
   아들이 **스스로 읽고, 직접 바꿔보고, 나중에 혼자 확장**할 수 있게 하는 것이 1순위 목표.

> 그래서 이 프로젝트의 코드는 "영리함"보다 **"읽혀야 한다"**. 한글 주석을 풍부하게,
> 변수명은 쉽게, 파일은 역할별로 분리. 초보가 따라올 수 있는 것이 정확성·성능보다 우선이다.

---

## 1. 스택과 원칙

- **빌드 없음.** 순수 HTML/CSS/JS. npm·React·번들러 없음. `index.html` 더블클릭으로 실행.
  - 이유: 아들의 "바꾸면 바로 보인다" 피드백 루프를 최대한 빠르게.
- **ES 모듈(`import`/`export`) 쓰지 말 것.** `file://`로 열면 CORS로 막힌다.
  대신 `<script>` 태그를 **순서대로**(`data.js → standings.js → app.js`) 불러 전역 함수/객체로 공유.
- **관심사 분리** 엄수:
  - `js/data.js` — 데이터만 (`WC_DATA` 전역)
  - `js/standings.js` — 순수 계산만 (`matchId`, `calcStandings`). DOM 절대 안 건드림.
  - `js/app.js` — 화면 그리기 + 이벤트.
  - `css/style.css` — 꾸미기.
- 향후 정식화 경로(React+Vite+Vercel)는 `CLAUDE_CODE_MIGRATION.md`에 전체 계획 보존. **지금은 그 길로 가지 않는다.**

## 2. 데이터 규칙 (깨면 데이터 호환 깨짐)

- 경기 식별자 `matchId = "{조}|{home}|{away}"` (예: `"A|대한민국|체코"`). **형식 절대 변경 금지.**
- 결과 저장 키: `localStorage["wc2026_results"]`, 스키마 `{ matchId: {h, a} }`.
- 시간은 전부 **KST**. `iso` 필드가 정렬·필터·날짜그룹의 기준.
- 순위 정렬: **승점 → 골득실 → 다득점 → 이름순**. (`standings.js`에 구현)
- 조별리그 72경기 / 32강 16경기. 개수를 하드코딩하지 말고 데이터 길이로 다룰 것.

## 3. 작업할 때 지켜야 할 것

- **한 번에 하나씩** 바꾸고, 사람이 브라우저에서 확인할 수 있게 변경점을 명확히 설명.
- 새 기능/함수에는 **아들이 읽을 한글 주석**을 단다 (왜 이렇게 했는지 한 줄이라도).
- 기능을 추가하면 가능하면 `learn/index.html`에 **대응하는 미션/설명**도 같이 갱신.
- 의미 있는 작업을 끝내면 `WORKLOG.md`에 한 줄(날짜·한 일·다음 할 일) 남긴다.
- 외부 API·서버·키가 필요한 변경은 **반드시 먼저 사람에게 확인**. (지금은 결과 수동 입력이 정상 동작 범위)

## 4. 파일 지도

```
2026_WorldCup/
├─ index.html              메인 앱 (뼈대) — 공통 네비 + D-day
├─ css/style.css           메인 앱 꾸미기
├─ js/data.js              경기 데이터 (WC_DATA)
├─ js/standings.js         순위 계산 (순수 함수)
├─ js/app.js               화면 그리기 + 이벤트
├─ assets/site.css         ★ 전 페이지 공통(네비바·용어풀이💬·콜아웃)
├─ assets/explore.css      ★ 탐구/커리어 부품(히어로·카드·타임라인·차트박스)
├─ learn/index.html        ★ 아들 학습 페이지 (만든 과정 + 미션)
├─ learn/learn.css
├─ explore/index.html      탐구 허브
├─ explore/games.html      축구 게임의 세계
├─ explore/broadcast.html  월드컵 중계 만드는 사람들
├─ explore/jobs.html       축구 산업 직업 + 생태계 지도
├─ explore/careers/        커리어 로드맵(tech/media/business/support)
├─ CLAUDE.md               (이 파일)
├─ README.md               사람용 개요 + 실행/배포
├─ WORKLOG.md              작업 기록 (chatlog/worklog)
├─ WORKFLOW.md             기술·API 상세, 확장 가이드
├─ CLAUDE_CODE_MIGRATION.md  React 정식화 계획 (미래용, 참조)
└─ _prototype_original.html  최초 단일파일 프로토타입 (출처 보존)
```

### 탐구(Explore) 섹션 규약 (새 콘텐츠 페이지 추가 시)
- 모든 페이지는 `assets/site.css` + `assets/explore.css`를 링크하고 공통 `<nav class="sitenav">`(상대경로 주의: explore/=`../`, careers/=`../../`)를 둔다.
- 본문은 `<div class="wrap">`, 끝에 `<footer class="sitefoot">`. **기존 클래스만** 사용(새 CSS 최소).
- 어려운 용어는 `.term`(💬 한 줄) 또는 `<span class="t" title="…">단어<sup>?</sup></span>`. **'거버넌스' 등은 반드시 한 줄 풀이.**
- 시각화(mermaid/Chart.js)는 CDN 사용 가능하되 **반드시 오프라인 폴백(표/숫자/글)** 동반(더블클릭·오프라인 동작 유지).

## 5. 검증 체크리스트 (변경 후 사람이 확인)

- [ ] `index.html` 더블클릭 → 콘솔 에러 없이 세 탭(조별리그/순위/32강) 표시
- [ ] 결과입력 모드에서 점수 입력 → 순위 탭이 즉시 갱신 (승점·골득실 규칙대로)
- [ ] 새로고침 후에도 입력한 점수 유지 (localStorage)
- [ ] 내보내기(JSON) → 불러오기 왕복 정상
- [ ] 🇰🇷 한국 버튼 → 한국 경기만 필터, 빨강 강조
- [ ] 모바일 폭(≤560px)에서 표가 깨지지 않음
```
