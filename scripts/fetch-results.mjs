/* =========================================================================
 *  fetch-results.mjs  —  외부 API에서 경기 결과를 긁어 data/results.json 생성
 * =========================================================================
 *  [아들에게 주는 설명]
 *  이 스크립트는 "브라우저"가 아니라 "GitHub Actions 서버"에서 돈다.
 *  그래서 비밀 키(FOOTBALL_API_KEY)를 안전하게 쓸 수 있다(브라우저에 노출 X).
 *
 *  흐름:
 *    1) js/data.js의 경기 일정(WC_DATA)을 읽는다
 *    2) football-data.org API에서 월드컵 경기 결과를 받아온다
 *    3) 영문 팀명을 우리 한글 팀명으로 바꾼다 (TEAM 매핑)
 *    4) 우리 일정의 matchId("조|home|away")에 점수를 맞춰 채운다
 *    5) data/results.json으로 저장 -> 앱이 그 파일을 읽어 화면에 반영
 *
 *  실행: Node 18+ (전역 fetch). 환경변수 FOOTBALL_API_KEY 필요.
 *      FOOTBALL_API_KEY=xxxx node scripts/fetch-results.mjs
 * ========================================================================= */

import { readFileSync, writeFileSync } from "node:fs";

const API_KEY = process.env.FOOTBALL_API_KEY;
if (!API_KEY) {
  console.error("FOOTBALL_API_KEY 환경변수가 없습니다. (football-data.org 무료 키)");
  process.exit(1);
}

// football-data.org의 월드컵 대회 코드는 'WC'
const API_URL = "https://api.football-data.org/v4/competitions/WC/matches";

// ---- 1) 일정 읽기: js/data.js에서 WC_DATA(JSON 리터럴) 추출 ----------------
const dataJs = readFileSync(new URL("../js/data.js", import.meta.url), "utf8");
const found = dataJs.match(/const\s+WC_DATA\s*=\s*(\{[\s\S]*\});/);
if (!found) { console.error("js/data.js에서 WC_DATA를 찾지 못했습니다."); process.exit(1); }
const WC_DATA = JSON.parse(found[1]);
const FIX = WC_DATA.GS;

// ---- 2) 영문 -> 한글 팀명 매핑 (가장 흔한 버그 지점!) ----------------------
//  API 영문 표기가 조금씩 다를 수 있어 여러 별칭을 소문자 키로 등록.
//  매칭 실패 팀은 아래에서 경고로 찍히니, 그때 별칭을 추가하면 된다.
const TEAM = {
  "mexico": "멕시코",
  "south africa": "남아프리카공화국",
  "korea republic": "대한민국", "south korea": "대한민국", "korea, republic of": "대한민국",
  "czechia": "체코", "czech republic": "체코",
  "canada": "캐나다",
  "bosnia and herzegovina": "보스니아 헤르체고비나", "bosnia & herzegovina": "보스니아 헤르체고비나",
  "qatar": "카타르",
  "switzerland": "스위스",
  "brazil": "브라질",
  "morocco": "모로코",
  "haiti": "아이티",
  "scotland": "스코틀랜드",
  "united states": "미국", "usa": "미국", "united states of america": "미국",
  "paraguay": "파라과이",
  "australia": "호주",
  "turkey": "튀르키예", "türkiye": "튀르키예", "turkiye": "튀르키예",
  "germany": "독일",
  "curacao": "쿠라소", "curaçao": "쿠라소",
  "ivory coast": "코트디부아르", "côte d'ivoire": "코트디부아르", "cote d'ivoire": "코트디부아르",
  "ecuador": "에콰도르",
  "netherlands": "네덜란드",
  "japan": "일본",
  "sweden": "스웨덴",
  "tunisia": "튀니지",
  "belgium": "벨기에",
  "egypt": "이집트",
  "iran": "이란", "ir iran": "이란",
  "new zealand": "뉴질랜드",
  "spain": "스페인",
  "cape verde": "카보베르데", "cabo verde": "카보베르데",
  "saudi arabia": "사우디아라비아",
  "uruguay": "우루과이",
  "france": "프랑스",
  "senegal": "세네갈",
  "iraq": "이라크",
  "norway": "노르웨이",
  "argentina": "아르헨티나",
  "algeria": "알제리",
  "austria": "오스트리아",
  "jordan": "요르단",
  "portugal": "포르투갈",
  "dr congo": "콩고민주공화국", "congo dr": "콩고민주공화국",
  "democratic republic of congo": "콩고민주공화국", "congo, the democratic republic of the": "콩고민주공화국",
  "uzbekistan": "우즈베키스탄",
  "colombia": "콜롬비아",
  "england": "잉글랜드",
  "croatia": "크로아티아",
  "ghana": "가나",
  "panama": "파나마",
};
const toKo = (name) => TEAM[String(name || "").trim().toLowerCase()] || null;

// 일정으로부터 (home + 구분자 + away) -> matchId 사전. 구분자로 이름 충돌 방지.
const SEP = "@@";
const fixIndex = {};
for (const d of FIX) fixIndex[d.home + SEP + d.away] = d.g + "|" + d.home + "|" + d.away;

// ---- 3) API 호출 ----------------------------------------------------------
const resp = await fetch(API_URL, { headers: { "X-Auth-Token": API_KEY } });
if (!resp.ok) {
  console.error("API 오류:", resp.status, await resp.text());
  process.exit(1);
}
const data = await resp.json();
const matches = data.matches || [];

// ---- 4) 결과 정규화 -------------------------------------------------------
const results = {};
const warnUnknownTeam = new Set();
let matched = 0, skipped = 0;

for (const mt of matches) {
  const st = mt.status;
  if (st !== "FINISHED" && st !== "IN_PLAY" && st !== "PAUSED") { skipped++; continue; }

  const homeKo = toKo(mt.homeTeam && mt.homeTeam.name);
  const awayKo = toKo(mt.awayTeam && mt.awayTeam.name);
  if (!homeKo) warnUnknownTeam.add(mt.homeTeam && mt.homeTeam.name);
  if (!awayKo) warnUnknownTeam.add(mt.awayTeam && mt.awayTeam.name);
  if (!homeKo || !awayKo) continue;

  const hs = mt.score && mt.score.fullTime ? mt.score.fullTime.home : null;
  const as = mt.score && mt.score.fullTime ? mt.score.fullTime.away : null;
  if (hs == null || as == null) continue;

  // 우리 일정과 같은 방향이면 그대로, 반대 방향이면 점수를 바꿔 맞춘다
  let id = fixIndex[homeKo + SEP + awayKo];
  let H = hs, A = as;
  if (!id) { id = fixIndex[awayKo + SEP + homeKo]; H = as; A = hs; }
  if (!id) continue; // 조별리그에 없는 경기(토너먼트 등)는 건너뜀

  results[id] = { h: H, a: A, status: st };
  matched++;
}

// ---- 5) 저장 -------------------------------------------------------------
const out = {
  updatedAt: new Date().toISOString(),
  source: "football-data.org",
  results,
};
writeFileSync(new URL("../data/results.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");

console.log(`저장 완료: ${matched}경기 반영 (건너뜀 ${skipped})`);
if (warnUnknownTeam.size) {
  console.warn("매핑 안 된 팀명(TEAM에 추가하세요):", [...warnUnknownTeam].filter(Boolean).join(", "));
}
