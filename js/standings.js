/* =========================================================================
 *  standings.js  —  순위 계산 (앱의 "요리법")
 * =========================================================================
 *  [아들에게 주는 설명]
 *  이 파일은 화면을 직접 건드리지 않는다.  오직 "계산"만 한다.
 *  입력: 경기 목록 + 내가 적어 넣은 점수들
 *  출력: 각 조의 순위표 (몇 승 몇 무 몇 패, 승점 몇 점, 골득실 얼마)
 *
 *  이렇게 "계산"과 "화면"을 따로 떼어 놓으면:
 *    - 순위 규칙이 틀렸을 때 여기만 고치면 된다 (화면 코드는 안 건드림)
 *    - 나중에 테스트("이 점수면 한국이 1위가 맞나?")를 짜기도 쉽다
 *  → 이게 "관심사 분리(separation of concerns)" 라는 개발의 기본기다.
 * ========================================================================= */

/* 경기마다 고유한 이름표(ID)를 만든다.
 * 예) A조 대한민국 vs 체코  →  "A|대한민국|체코"
 * 이 ID로 "이 경기의 점수"를 저장하고 찾는다. (절대 형식 바꾸지 말 것!
 * 바꾸면 예전에 저장해 둔 점수와 연결이 끊긴다.) */
function matchId(d) {
  return d.g + "|" + d.home + "|" + d.away;
}

/* 점수가 "진짜로 입력됐는지" 확인하는 도우미.
 * 빈칸("")이나 없음(null)이면 아직 안 한 경기로 친다. */
function hasScore(r) {
  return r && r.h !== "" && r.a !== "" && r.h != null && r.a != null;
}

/* 한 조(group)의 순위표를 계산해서 돌려준다.
 *   matches : 그 조의 경기 배열 (data.js의 WC_DATA.GS에서 골라 넣음)
 *   results : { "A|대한민국|체코": {h:2, a:1}, ... } 형태의 점수 모음
 * 돌려주는 값: 팀별 기록 객체 배열 (이미 순위순으로 정렬됨) */
function calcStandings(matches, results) {
  const teams = {}; // 팀이름 → 기록

  // 1) 이 조에 나오는 모든 팀을 0으로 초기화
  matches.forEach(function (d) {
    [d.home, d.away].forEach(function (t) {
      if (!teams[t]) {
        teams[t] = {
          t: t,            // 팀 이름
          P: 0,            // 경기 수 (Played)
          W: 0, D: 0, L: 0,// 승 / 무 / 패
          GF: 0, GA: 0,    // 득점(For) / 실점(Against)
          Pts: 0,          // 승점 (Points) — 승 3점, 무 1점, 패 0점
          kr: t === "대한민국"
        };
      }
    });
  });

  // 2) 입력된 점수를 하나씩 보며 기록을 쌓는다
  matches.forEach(function (d) {
    const r = results[matchId(d)];
    if (!hasScore(r)) return; // 아직 안 한 경기는 건너뜀

    const h = teams[d.home], a = teams[d.away];
    const hs = +r.h, as = +r.a; // 앞의 +는 "글자를 숫자로" 바꾸는 표시

    h.P++; a.P++;
    h.GF += hs; h.GA += as;
    a.GF += as; a.GA += hs;

    if (hs > as) {        // 홈팀 승
      h.W++; a.L++; h.Pts += 3;
    } else if (as > hs) { // 원정팀 승
      a.W++; h.L++; a.Pts += 3;
    } else {              // 무승부
      h.D++; a.D++; h.Pts += 1; a.Pts += 1;
    }
  });

  // 3) 골득실(GD = 득점 - 실점)을 붙이고 순위대로 정렬한다
  const arr = Object.values(teams).map(function (x) {
    return Object.assign({}, x, { GD: x.GF - x.GA });
  });

  // 정렬 규칙: 승점 높은 순 → 골득실 높은 순 → 다득점 순 → 이름순
  arr.sort(function (x, y) {
    return (y.Pts - x.Pts)
        || (y.GD - x.GD)
        || (y.GF - x.GF)
        || x.t.localeCompare(y.t, "ko");
  });

  return arr;
}
