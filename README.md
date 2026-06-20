# ⚽ 2026 월드컵 즐기기 도우미

2026 FIFA 월드컵(미국·캐나다·멕시코)을 가족이 함께 즐기기 위한 **일정 · 결과 · 순위** 앱.
그리고 동시에 **고등학생 아들의 바이브 코딩 입문 교재**다.

> 앱 안의 **[만든 과정 배우기](learn/index.html)** 페이지에서 이 앱이 어떻게 만들어졌는지
> 단계별로 배우고, 직접 바꿔보는 미션까지 해볼 수 있다.

---

## 기능
- 조별리그 **72경기** + 32강 **16경기** 일정 (한국시간 KST)
- 날짜·조·팀·장소 **필터**, 헤더 클릭 **정렬**, 🇰🇷 한국 경기 강조
- 결과 **수동 입력** → 12개 조 **순위 자동 계산** (승점→골득실→다득점)
- 브라우저 **자동 저장**(localStorage) — 새로고침해도 유지
- 결과 **JSON 내보내기/불러오기** (기기 간 이동·백업)

## 실행 (설치 필요 없음)
1. `index.html`을 **더블클릭** → 브라우저에서 바로 열림. 끝.
2. (선택) 서버처럼 띄우려면 폴더에서:
   ```bash
   python -m http.server 8000   # http://localhost:8000
   ```

## 폴더 구조
```
2026_WorldCup/
├─ index.html          메인 앱
├─ css/style.css       꾸미기
├─ js/data.js          경기 데이터
├─ js/standings.js     순위 계산
├─ js/app.js           화면 + 동작
├─ learn/              ★ 만든 과정 학습 페이지 (아들용)
├─ CLAUDE.md           Claude용 프로젝트 규칙
├─ WORKLOG.md          작업 기록
├─ WORKFLOW.md         기술·API 상세
└─ CLAUDE_CODE_MIGRATION.md  React 정식화 계획(미래용)
```
파일별 역할 설명은 `learn/index.html` 또는 각 파일 맨 위 주석 참고.

## GitHub Pages 배포 (인터넷에 올려 폰에서 보기)
정적 앱이라 무료로 배포된다.
```bash
# 이 폴더에서
git init
git add .
git commit -m "2026 월드컵 앱 첫 배포"
# GitHub에 새 저장소(wc2026) 만든 뒤:
git branch -M main
git remote add origin https://github.com/<아이디>/wc2026.git
git push -u origin main
```
그 다음 GitHub 저장소 → **Settings → Pages → Branch: main / root** 선택 →
잠시 후 `https://<아이디>.github.io/wc2026/` 로 접속.

> 아들 본인 GitHub 계정으로 올리면 "내가 만든 걸 인터넷에 올렸다"는 경험이 된다 (learn-in-public).

## 다음 단계
- `learn/` 미션 1(색 바꾸기)부터 직접 해보기
- 실시간 결과 자동수집 등 큰 확장 → `WORKFLOW.md`의 API 가이드
- 앱이 커지면 React+Vite로 정식화 → `CLAUDE_CODE_MIGRATION.md`

## 데이터 주의
- 경기 일정/장소는 작성 시점 기준. 32강 **대진 팀**은 6/27 조별리그 종료 후 FIFA 규정으로 확정.
- 경기 결과는 직접 입력하는 방식(외부 자동수집은 아직 미연동).
