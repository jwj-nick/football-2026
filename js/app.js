/* =========================================================================
 *  app.js  —  화면 그리기 + 사용자 동작 처리 (앱의 "접시 위 요리")
 * =========================================================================
 *  [아들에게 주는 설명]
 *  이 파일은 두 친구를 가져다 쓴다.
 *    - data.js     의 WC_DATA      (경기 재료)
 *    - standings.js 의 calcStandings/matchId (계산 요리법)
 *  그리고 그 결과를 HTML 표로 그려서 화면에 뿌린다.
 *
 *  큰 흐름:
 *    1) 필터 메뉴(날짜·조·팀·장소)를 데이터에서 자동으로 채운다
 *    2) 표를 그린다 (renderGS / renderStandings / renderR32)
 *    3) 사용자가 클릭/입력하면 다시 그린다
 *    4) 점수는 브라우저에 저장(localStorage)해서 새로고침해도 남는다
 * ========================================================================= */

const GS = WC_DATA.GS;   // 조별리그 72경기
const R32 = WC_DATA.R32; // 32강 16경기
const KEY = "wc2026_results"; // 브라우저 저장소에서 쓸 이름표

/* ---- 결과 저장소 ----------------------------------------------------------
 * results 는 { "A|대한민국|체코": {h:2, a:1}, ... } 모양.
 * localStorage = 브라우저가 가진 작은 메모장. 새로고침/껐다켜도 안 지워진다. */
let results = {};
try {
  const raw = localStorage.getItem(KEY);
  if (raw) results = JSON.parse(raw); // 글자 → 객체로 되돌리기
} catch (e) { /* 저장된 게 없거나 깨졌으면 그냥 빈 값으로 시작 */ }

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(results)); // 객체 → 글자로
    note("저장됨 ✓");
  } catch (e) {
    note("저장불가(미리보기 환경): 내보내기 버튼을 쓰세요", true);
  }
}

// 화면 한쪽에 잠깐 메시지를 띄우는 도우미 (2.5초 뒤 사라짐)
function note(t, warn) {
  const n = document.getElementById("savedNote");
  n.textContent = t;
  n.style.color = warn ? "#c8102e" : "#1a7c3d";
  setTimeout(function () { n.textContent = ""; }, 2500);
}

let editMode = false; // "결과입력" 버튼을 켰는지 여부

/* ---- 필터 메뉴 채우기 -----------------------------------------------------
 * 데이터를 훑어서 "있는 날짜/조/팀/장소"만 자동으로 메뉴에 넣는다.
 * → 경기를 추가하면 메뉴도 알아서 늘어난다 (직접 손댈 필요 없음). */
const fD = document.getElementById("fD"), fG = document.getElementById("fG");
const fT = document.getElementById("fT"), fV = document.getElementById("fV");
const fD2 = document.getElementById("fD2"), fV2 = document.getElementById("fV2");

// [...new Set(...)] = 중복 제거 묶음. 같은 날짜가 여러 번 나와도 메뉴엔 한 번만.
[...new Set(GS.map(d => d.iso.slice(0, 10)))].sort().forEach(function (iso) {
  const r = GS.find(x => x.iso.slice(0, 10) === iso);
  fD.add(new Option(r.date + "(" + r.dow + ")", iso));
});
[...new Set(GS.map(d => d.g))].sort().forEach(g => fG.add(new Option(g + "조", g)));
[...new Set(GS.flatMap(d => [d.home, d.away]))]
  .sort((a, b) => a.localeCompare(b, "ko"))
  .forEach(t => fT.add(new Option(t, t)));
[...new Set(GS.map(d => d.venue))]
  .sort((a, b) => a.localeCompare(b, "ko"))
  .forEach(v => fV.add(new Option(v, v)));
[...new Set(R32.map(d => d.iso.slice(0, 10)))].sort().forEach(function (iso) {
  const r = R32.find(x => x.iso.slice(0, 10) === iso);
  fD2.add(new Option(r.date + "(" + r.dow + ")", iso));
});
[...new Set(R32.map(d => d.venue))]
  .sort((a, b) => a.localeCompare(b, "ko"))
  .forEach(v => fV2.add(new Option(v, v)));

/* ====================== 1. 조별리그 표 ===================================== */
let sk = "iso", sa = true; // 정렬 기준(key)과 방향(asc), 헤더 클릭으로 바뀜

// "결과" 칸: 입력모드면 숫자칸 2개, 아니면 점수 또는 '예정'
function scoreCell(d) {
  const id = matchId(d), r = results[id];
  if (editMode) {
    return '<input class="sin" type="number" min="0" data-id="' + id + '" data-s="h" value="' + (r ? r.h : "") + '"> : ' +
           '<input class="sin" type="number" min="0" data-id="' + id + '" data-s="a" value="' + (r ? r.a : "") + '">';
  }
  if (r && r.h !== "" && r.a !== "" && r.h != null && r.a != null) {
    return '<span class="score">' + r.h + " : " + r.a + "</span>";
  }
  return '<span class="tbd">예정</span>';
}

// "매치업" 칸: 이긴 팀을 초록색으로 강조
function muCell(d) {
  const r = results[matchId(d)];
  const noteHtml = d.note ? '<span class="note">(' + d.note + ")</span>" : "";
  let h = d.home, a = d.away;
  if (r && r.h != null && r.a != null && r.h !== "" && r.a !== "") {
    if (+r.h > +r.a) h = '<span class="win">' + h + "</span>";
    else if (+r.a > +r.h) a = '<span class="win">' + a + "</span>";
  }
  return h + '<span class="vs">vs</span>' + a + noteHtml;
}

function renderGS() {
  // 1) 필터 통과한 경기만 고른다
  let rows = GS.filter(d =>
    (!fD.value || d.iso.slice(0, 10) === fD.value) &&
    (!fG.value || d.g === fG.value) &&
    (!fT.value || d.home === fT.value || d.away === fT.value) &&
    (!fV.value || d.venue === fV.value)
  );
  // 2) 정렬한다 (점수 같으면 시간순으로)
  rows.sort(function (a, b) {
    let x = a[sk], y = b[sk];
    let c = (sk === "iso") ? (x < y ? -1 : x > y ? 1 : 0) : String(x).localeCompare(String(y), "ko");
    if (c === 0) c = a.iso < b.iso ? -1 : 1;
    return sa ? c : -c;
  });
  // 3) 표(HTML 글자)를 만들어서 화면에 꽂는다
  document.getElementById("tbGS").innerHTML = rows.map(d =>
    '<tr class="' + (d.kr ? "krrow" : "") + '">' +
    "<td>" + d.date + "(" + d.dow + ") " + d.time + "</td>" +
    '<td><span class="grp">' + d.g + "</span></td>" +
    '<td class="mu">' + muCell(d) + "</td>" +
    "<td>" + scoreCell(d) + "</td>" +
    "<td>" + d.venue + "</td></tr>"
  ).join("");
  document.getElementById("cntGS").textContent = rows.length + "경기";
  // 정렬 화살표 표시
  document.querySelectorAll("#gs th[data-k] .arr").forEach(s => s.textContent = "");
  const th = document.querySelector('#gs th[data-k="' + sk + '"] .arr');
  if (th) th.textContent = sa ? "▲" : "▼";
  // 입력모드면 숫자칸이 바뀔 때 onScore가 돌도록 연결
  if (editMode) document.querySelectorAll(".sin").forEach(inp => inp.onchange = onScore);
}

// 숫자칸을 고치면 results를 갱신하고 저장 + 순위 다시 계산
function onScore(e) {
  const id = e.target.dataset.id, s = e.target.dataset.s, v = e.target.value;
  if (!results[id]) results[id] = { h: "", a: "" };
  results[id][s] = v === "" ? "" : Math.max(0, parseInt(v));
  // 두 칸 다 비면 그 경기 기록을 통째로 지운다 (깔끔하게)
  if ((results[id].h === "" || results[id].h == null) &&
      (results[id].a === "" || results[id].a == null)) {
    delete results[id];
  }
  save();
  renderStandings();
}

// 헤더 클릭 → 정렬 / 필터 바뀜 → 다시 그림
document.querySelectorAll("#gs th[data-k]").forEach(th =>
  th.onclick = () => { const k = th.dataset.k; if (sk === k) sa = !sa; else { sk = k; sa = true; } renderGS(); }
);
[fD, fG, fT, fV].forEach(s => s.onchange = renderGS);
document.getElementById("krBtn").onclick = () => { fT.value = "대한민국"; fD.value = ""; fG.value = ""; fV.value = ""; renderGS(); };
document.getElementById("reset").onclick = () => { fD.value = ""; fG.value = ""; fT.value = ""; fV.value = ""; sk = "iso"; sa = true; renderGS(); };
document.getElementById("editBtn").onclick = function () {
  editMode = !editMode;
  this.classList.toggle("on", editMode);
  this.textContent = editMode ? "✅ 입력완료" : "✏️ 결과입력";
  renderGS();
};

/* ---- 내보내기 / 불러오기 / 전체삭제 --------------------------------------
 * 내 점수를 파일(JSON)로 백업하거나, 다른 기기에서 가져오는 기능. */
document.getElementById("expBtn").onclick = function () {
  const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "wc2026_results.json";
  a.click();
};
document.getElementById("impBtn").onclick = () => document.getElementById("impFile").click();
document.getElementById("impFile").onchange = function (e) {
  const f = e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = function () {
    try { results = JSON.parse(rd.result); save(); renderGS(); renderStandings(); note("불러오기 완료 ✓"); }
    catch (x) { note("파일 오류", true); }
  };
  rd.readAsText(f);
};
document.getElementById("clrBtn").onclick = function () {
  if (confirm("입력한 모든 결과를 삭제할까요?")) { results = {}; save(); renderGS(); renderStandings(); }
};

/* ====================== 2. 순위표 ========================================= */
function renderStandings() {
  const grid = document.getElementById("stGrid");
  const groups = [...new Set(GS.map(d => d.g))].sort();
  grid.innerHTML = groups.map(function (g) {
    // 이 조의 경기만 골라서 standings.js의 계산 함수에 넘긴다
    const matches = GS.filter(d => d.g === g);
    const arr = calcStandings(matches, results); // ← 계산은 전부 저쪽에서!

    const rows = arr.map(function (x, i) {
      // 승점 막대: 한 조 3경기라 최대 9점 → 9점 대비 몇 %인지로 막대 길이
      const pct = Math.min(100, Math.round((x.Pts / 9) * 100));
      return '<tr class="' + (x.kr ? "krrow " : "") + (i < 2 ? "qual" : "") + '">' +
        "<td>" + (i + 1) + ". " + x.t + "</td>" +
        "<td>" + x.P + "</td><td>" + x.W + "</td><td>" + x.D + "</td><td>" + x.L + "</td>" +
        "<td>" + (x.GD > 0 ? "+" : "") + x.GD + "</td>" +
        "<td><b>" + x.Pts + "</b>" +
          '<div class="ptsbar"><i style="width:' + pct + '%"></i></div></td></tr>';
    }).join("");

    return '<div class="scard"><h3>' + g + "조</h3><table><thead><tr>" +
      "<th>팀</th><th>경기</th><th>승</th><th>무</th><th>패</th><th>득실</th><th>승점</th>" +
      "</tr></thead><tbody>" + rows + "</tbody></table></div>";
  }).join("");
}

/* ====================== 3. 32강 ========================================== */
let sk2 = "iso", sa2 = true;
function renderR32() {
  let rows = R32.filter(d =>
    (!fD2.value || d.iso.slice(0, 10) === fD2.value) &&
    (!fV2.value || d.venue === fV2.value)
  );
  rows.sort(function (a, b) {
    let x = a[sk2], y = b[sk2];
    let c = (sk2 === "iso" || sk2 === "idx") ? (x < y ? -1 : x > y ? 1 : 0) : String(x).localeCompare(String(y), "ko");
    if (c === 0) c = a.iso < b.iso ? -1 : 1;
    return sa2 ? c : -c;
  });
  document.getElementById("tbR32").innerHTML = rows.map(d =>
    "<tr><td>32강 " + d.idx + "경기</td><td>" + d.date + "(" + d.dow + ") " + d.time + "</td>" +
    "<td>" + d.venue + '</td><td class="tbd">조별리그 결과 후 확정</td></tr>'
  ).join("");
  document.getElementById("cntR32").textContent = rows.length + "경기";
  document.querySelectorAll("#r32 th[data-k] .arr").forEach(s => s.textContent = "");
  const th = document.querySelector('#r32 th[data-k="' + sk2 + '"] .arr');
  if (th) th.textContent = sa2 ? "▲" : "▼";
}
document.querySelectorAll("#r32 th[data-k]").forEach(th =>
  th.onclick = () => { const k = th.dataset.k; if (sk2 === k) sa2 = !sa2; else { sk2 = k; sa2 = true; } renderR32(); }
);
[fD2, fV2].forEach(s => s.onchange = renderR32);
document.getElementById("reset2").onclick = () => { fD2.value = ""; fV2.value = ""; sk2 = "iso"; sa2 = true; renderR32(); };

/* ====================== 탭 전환 ========================================== */
document.querySelectorAll(".tab").forEach(t =>
  t.onclick = function () {
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    ["gs", "st", "r32"].forEach(id =>
      document.getElementById(id).classList.toggle("hidden", id !== t.dataset.tab)
    );
  }
);

/* ====================== 시작! ============================================= */
// 페이지가 열리면 세 화면을 한 번씩 그려 둔다.
renderGS();
renderStandings();
renderR32();
