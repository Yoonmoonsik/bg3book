// UI strings. Data values (type, acquisition, tags) are stored in Korean and translated here.
const I18N = {
  ko: {
    site_quest: "BG3 퀘스트 일지", site_dnd: "5.5e 모드 데이터 검색",
    title: "BG3 책 열람실", sub: "발더스 게이트 3에 등장하는 읽을 수 있는 책·쪽지·석판", unit: "종",
    q: "제목·내용·장소 검색 (한/영)", "f-ty": "유형", "f-a": "획득 유형", "f-bg": "열람 배경", "f-r": "지역", "f-tg": "태그",
    all: "전체", reset: "필터 초기화", shown: (n) => `${n}권 표시`,
    pick: "왼쪽 목록에서 책을 선택하세요.", none: "(내용 없음)", unknown: "미확인 제목", noSource: "획득처 확인 안 됨",
    places: "발견 장소", region: "지역", how: "방식", level: "레벨 (좌표)", method: "지역 판정", noPlace: "맵 배치 없음",
    shops: "판매 상인", osiris: "스토리 스크립트(Osiris) 지급", tables: "트레저 테이블", data: "데이터",
    contentHandle: "내용 핸들", titleHandle: "제목 핸들", templates: "템플릿", icon: "아이콘", bg: "배경",
    prev: "◀ 이전", next: "다음 ▶", carried: "소지", "f-ac": "막", "f-rd": "읽음", read: "읽은 책", unread: "안 읽은 책",
    markRead: "읽음 표시", isRead: "✓ 읽음", series: "시리즈", moved: "스토리 진행 중 획득", cutscene: "엔딩·에필로그 장면",
    hits: (n) => `검색어 ${n}곳`, help: "도움말",
    footer: "데이터: 바닐라 게임 파일에서 추출(제목·내용 핸들, 배치, 트레저 테이블, 상점, Osiris 스크립트). 태그는 키워드로 추론한 값입니다.",
  },
  en: {
    site_quest: "BG3 Quest Journal", site_dnd: "5.5e mod data browser",
    title: "BG3 Book Library", sub: "Readable books, notes and tablets in Baldur's Gate 3", unit: "entries",
    q: "Search title, text or place", "f-ty": "Type", "f-a": "Source", "f-bg": "Background", "f-r": "Region", "f-tg": "Tag",
    all: "All", reset: "Reset filters", shown: (n) => `${n} shown`,
    pick: "Pick a book from the list.", none: "(no text)", unknown: "Unidentified title", noSource: "Source not found",
    places: "Found at", region: "Region", how: "How", level: "Level (coords)", method: "Region match", noPlace: "Not placed on a map",
    shops: "Sold by", osiris: "Given by story script (Osiris)", tables: "Treasure tables", data: "Data",
    contentHandle: "Content handle", titleHandle: "Title handle", templates: "Templates", icon: "Icon", bg: "Background",
    prev: "◀ Prev", next: "Next ▶", carried: "carried", "f-ac": "Act", "f-rd": "Read", read: "Read", unread: "Unread",
    markRead: "Mark as read", isRead: "✓ Read", series: "Series", moved: "Picked up during the story", cutscene: "Ending/epilogue scene",
    hits: (n) => `${n} match${n === 1 ? "" : "es"}`, help: "Help",
    footer: "Data extracted from the vanilla game files (title/content handles, placements, treasure tables, traders, Osiris scripts). Tags are inferred from keywords.",
  },
};
const VALUE_EN = {
  "유일(1개)": "Unique (1)", "복수 획득 가능": "Obtainable multiple times", "획득처 확인 안 됨": "Source not found",
  "맵에 배치": "Placed on map", "캐릭터·컨테이너 소지품(ItemList)": "Character/container inventory (ItemList)",
  "treasure table에서 획득": "Treasure table", "상점에서 구매": "Bought from trader", "스토리 스크립트(Osiris) 지급": "Given by story script (Osiris)",
  "엔딩·에필로그 전용": "Ending/epilogue only", "엔딩·에필로그 장면 전용 배치": "Placed only in ending/epilogue scenes",
  "스토리 진행 중 획득(ToInventory)": "Picked up during the story (ToInventory)",
  "프롤로그": "Prologue", "1막": "Act 1", "2막": "Act 2", "3막": "Act 3", "엔딩": "Ending", "에필로그": "Epilogue", "기타": "Other",
};
const ACT_ORDER = ["프롤로그", "1막", "2막", "3막", "엔딩", "에필로그", "기타"];
const BG = {
  None: ["기본 책", "Book", "Book_BG_B1"], PaperSheet: ["종이 한 장", "Paper sheet", "paper_Sheet"],
  PaperStack: ["종이 묶음", "Paper stack", "paper_Stack"], ScrollA: ["두루마리 A", "Scroll A", "scroll_A_bg"],
  ScrollB: ["두루마리 B", "Scroll B", "scroll_B_bg"], TabletA: ["석판 A", "Tablet A", "tablet_A_bg"],
  TabletB: ["석판 B", "Tablet B", "tablet_B_bg"], TabletC: ["석판 C", "Tablet C", "tablet_C_bg"],
  GithDisc: ["기스양키 원판", "Githyanki disc", "gith_disc_bg"],
};
const HOW = {
  level: ["맵에 배치", "On map"], in_container: ["상자 안", "In container"],
  carried: ["캐릭터 소지", "Carried by character"], container_itemlist: ["컨테이너 소지품", "Container inventory"],
};
const FILTERS = ["f-ac", "f-ty", "f-a", "f-bg", "f-r", "f-tg"];
const $ = (id) => document.getElementById(id);
let books = [], shown = [], current = null, byId = {};
// read marks live only in this browser
let READ = new Set();
try { READ = new Set(JSON.parse(localStorage.getItem("read") || "[]")); } catch (e) { /* storage blocked */ }
const saveRead = () => { try { localStorage.setItem("read", JSON.stringify([...READ])); } catch (e) { /* storage blocked */ } };
let ui = pickUi(), lang = ui; // ui = interface language, lang = book text language

function pickUi() {
  const q = new URLSearchParams(location.search).get("lang");
  if (q === "ko" || q === "en") return q;
  try { const s = localStorage.getItem("ui"); if (s === "ko" || s === "en") return s; } catch (e) { /* storage blocked */ }
  return (navigator.language || "").toLowerCase().startsWith("ko") ? "ko" : "en";
}
const T = (k, ...a) => (typeof I18N[ui][k] === "function" ? I18N[ui][k](...a) : I18N[ui][k]);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// game text only uses <br>, <b>, <i>
const rich = (s) => esc(s).replace(/&lt;br&gt;/g, "\n").replace(/&lt;(\/?)(b|i)&gt;/g, "<$1$2>");
const val = (v) => (ui === "en" ? VALUE_EN[v] || v : v);
// tags are "한국어 (English)"
const tag = (t) => { const m = t.match(/^(.*) \((.*)\)$/); return m ? (ui === "en" ? m[2] : m[1]) : t; };
const bgName = (k) => BG[k]?.[ui === "en" ? 1 : 0] || k;
// English UI shows no Korean; Korean UI may show English beside it
const title = (b) => (ui === "en" ? b.te[0] : b.t[0] || b.te[0]) || b.id;
const subtitle = (b) => (ui === "en" ? [] : b.te).join(" / ");
const region = (p) => (ui === "en" ? p.re : p.r || p.re) || p.l;
const regions = (b) => [...new Set(b.pl.map(region).filter(Boolean))];

function label(sel, v) {
  return sel === "f-bg" ? bgName(v) : sel === "f-tg" ? tag(v) : sel === "f-r" ? v : val(v);
}

function fillFilters() {
  const src = { "f-ac": (b) => b.ac, "f-ty": (b) => [b.ty], "f-a": (b) => b.a, "f-bg": (b) => b.bg, "f-r": regions, "f-tg": (b) => b.tg };
  FILTERS.forEach((id) => {
    const keep = $(id).value, counts = {};
    books.forEach((b) => src[id](b).forEach((v) => (counts[v] = (counts[v] || 0) + 1)));
    $(id).innerHTML = `<option value="">${T("all")}</option>` + Object.keys(counts)
      .sort((a, b) => id === "f-ac" ? ACT_ORDER.indexOf(a) - ACT_ORDER.indexOf(b) : label(id, a).localeCompare(label(id, b), ui))
      .map((v) => `<option value="${esc(v)}">${esc(label(id, v))} (${counts[v]})</option>`).join("");
    $(id).value = keep;
  });
  const rd = $("f-rd").value;
  $("f-rd").innerHTML = `<option value="">${T("all")}</option><option value="1">${T("read")}</option><option value="0">${T("unread")}</option>`;
  $("f-rd").value = rd;
}

function applyUi() {
  document.documentElement.lang = ui;
  document.title = T("title");
  document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = T(el.dataset.i18n)));
  document.querySelectorAll("[data-ui]").forEach((b) => b.classList.toggle("on", b.dataset.ui === ui));
  $("help").href = "help.html?lang=" + ui;
  $("q").placeholder = T("q");
  if (books.length) {
    $("total").textContent = `· ${books.length.toLocaleString()} ${T("unit")}`;
    // the region filter's values are region names in the UI language, so it resets on switch
    $("f-r").value = "";
    fillFilters();
    books.sort((a, b) => title(a).localeCompare(title(b), ui));
    apply();
    current ? show(current) : ($("detail").innerHTML = `<p class="empty">${T("pick")}</p>`);
  }
}

function apply() {
  const q = $("q").value.trim().toLowerCase();
  const f = { ac: $("f-ac").value, ty: $("f-ty").value, a: $("f-a").value, bg: $("f-bg").value, r: $("f-r").value,
    tg: $("f-tg").value, rd: $("f-rd").value };
  shown = books.filter((b) => (!f.ac || b.ac.includes(f.ac)) && (!f.rd || READ.has(b.id) === (f.rd === "1")) &&
    (!q || b._h.includes(q)) && (!f.ty || b.ty === f.ty) && (!f.a || b.a.includes(f.a)) &&
    (!f.bg || b.bg.includes(f.bg)) && (!f.r || regions(b).includes(f.r)) && (!f.tg || b.tg.includes(f.tg)));
  $("count").textContent = T("shown", shown.length.toLocaleString());
  const list = $("list");
  list.innerHTML = shown.map((b) =>
    `<li data-id="${esc(b.id)}"${current && current.id === b.id ? ' class="on"' : ""}><span class="t">${READ.has(b.id) ? "✓ " : ""}${esc(title(b))}</span>` +
    `<span class="m">${esc(val(b.ty))} · ${esc(regions(b).slice(0, 3).join(", ") || b.a.map(val).join(", ") || T("noSource"))}</span></li>`).join("");
  const s = new URLSearchParams(f);
  if (q) s.set("q", q);
  if (current) s.set("id", current.id);
  s.set("lang", ui);
  [...s.keys()].forEach((k) => !s.get(k) && s.delete(k));
  history.replaceState(null, "", "?" + s.toString());
}

function show(b) {
  current = b;
  document.querySelectorAll("#list li").forEach((li) => li.classList.toggle("on", li.dataset.id === b.id));
  const bg = b.bg[0] || "None";
  if (ui === "en") lang = "en";
  const text = lang === "ko" ? b.c || b.ce : b.ce;
  const rows = b.pl.map((p) => {
    const who = ui === "en" ? p.ke : p.k || p.ke;
    return `<tr${p.cs ? ' class="cs"' : ""}><td>${esc(region(p))} <small>(${esc(val(p.a))})</small>${p.cs ? ` <small>(${T("cutscene")})</small>` : ""}</td><td>${esc(HOW[p.h]?.[ui === "en" ? 1 : 0] || p.h)}${who ? " · " + esc(who) : ""}</td>
    <td><code>${esc(p.l)}${p.xyz ? " (" + p.xyz.map((v) => v.toFixed(0)).join(", ") + ")" : ""}</code></td><td><code>${esc(p.m)}</code></td></tr>`;
  }).join("");
  const shops = b.s.map((s) => (ui === "en" ? s.e : s.k));
  $("detail").innerHTML = `
    <div class="head-row"><h2 class="title">${esc(title(b))}</h2>
      <button class="readbtn${READ.has(b.id) ? " on" : ""}" data-read>${READ.has(b.id) ? T("isRead") : T("markRead")}</button></div>
    <p class="title-en">${esc(subtitle(b))}</p>
    <div class="chips">
      <span class="chip type" data-f="f-ty" data-v="${esc(b.ty)}">${esc(val(b.ty))}</span>
      ${b.a.map((a) => `<span class="chip" data-f="f-a" data-v="${esc(a)}">${esc(val(a))}</span>`).join("")}
      ${b.bg.map((g) => `<span class="chip" data-f="f-bg" data-v="${esc(g)}">${T("bg")}: ${esc(bgName(g))}</span>`).join("")}
    </div>
    <div class="chips">${b.tg.map((t) => `<span class="chip" data-f="f-tg" data-v="${esc(t)}">#${esc(tag(t))}</span>`).join("")}</div>
    ${ui === "en" ? "" : `<div class="toggle"><button data-lang="ko" class="${lang === "ko" ? "on" : ""}">한국어</button> <button data-lang="en" class="${lang === "en" ? "on" : ""}">English</button></div>`}
    <div class="page ${esc(bg)}" style="background-image:url('assets/${BG[bg]?.[2] || "Book_BG_B1"}.webp')"><div class="txt">${rich(text).replace(/\n{3,}/g, "\n\n") || `<i>${T("none")}</i>`}<span class="end"></span><span class="pad"></span></div></div>
    ${seriesNav(b)}
    <div class="pager" hidden><button data-turn="-1">${T("prev")}</button><span id="pg"></span><span id="hits"></span><button data-turn="1">${T("next")}</button></div>
    ${b.u.length && ui === "ko" ? `<p>${T("unknown")}: ${esc(b.u.join(" / "))}</p>` : ""}
    <section><h3>${T("places")} (${b.pl.length})</h3>${rows ? `<table><tr><th>${T("region")}</th><th>${T("how")}</th><th>${T("level")}</th><th>${T("method")}</th></tr>${rows}</table>` : `<p class='empty'>${T("noPlace")}</p>`}</section>
    ${shops.length ? `<section><h3>${T("shops")}</h3><p>${shops.map(esc).join("<br>")}</p></section>` : ""}
    ${b.os.length ? `<section><h3>${T("osiris")}</h3><p>${(ui === "en" ? b.oe : b.os).map(esc).join("<br>")}</p></section>` : ""}
    ${b.mv.length ? `<section><h3>${T("moved")}</h3><p>${(ui === "en" ? b.mve : b.mv).map(esc).join("<br>")}</p></section>` : ""}
    ${b.tt.length ? `<section><h3>${T("tables")}</h3><p><code>${b.tt.map(esc).join(", ")}</code></p></section>` : ""}
    <section><h3>${T("data")}</h3><dl>
      <dt>BookId</dt><dd><code>${esc(b.id)}</code></dd>
      <dt>${T("contentHandle")}</dt><dd><code>${esc(b.ch)}</code></dd>
      <dt>${T("titleHandle")}</dt><dd><code>${esc(b.th.join(", "))}</code></dd>
      <dt>${T("templates")}</dt><dd><code>${esc(b.tp.join(", "))}</code></dd>
      <dt>${T("icon")}</dt><dd><code>${esc(b.ic.join(", "))}</code></dd>
    </dl></section>`;
  spread = 0;
  turn(0);
  highlight();
  apply();
}

function seriesNav(b) {
  if (!b.sr) return "";
  const i = b.sr.indexOf(b.id);
  return `<div class="series"><b>${T("series")} ${i + 1} / ${b.sr.length}</b>
    <button data-go="${esc(b.sr[i - 1] || "")}" ${i ? "" : "disabled"}>${T("prev")}</button>
    <button data-go="${esc(b.sr[i + 1] || "")}" ${i < b.sr.length - 1 ? "" : "disabled"}>${T("next")}</button>
    <ol>${b.sr.map((id) => `<li${id === b.id ? ' class="on"' : ""}><a href="#" data-go="${esc(id)}">${esc(title(byId[id]))}</a></li>`).join("")}</ol></div>`;
}

// Mark the search words in the book text and open the page that holds the first one.
function highlight() {
  const q = $("q").value.trim();
  const t = document.querySelector(".page .txt");
  if (!q || !t) return;
  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  const walker = document.createTreeWalker(t, NodeFilter.SHOW_TEXT), nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  let n = 0;
  nodes.forEach((node) => {
    rx.lastIndex = 0;
    if (!rx.test(node.data)) return;
    const span = document.createElement("span");
    span.innerHTML = esc(node.data).replace(new RegExp(esc(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), (m) => (n++, `<mark>${m}</mark>`));
    node.replaceWith(...span.childNodes);
  });
  if (!n) return;
  $("hits").textContent = " · " + T("hits", n);
  const first = t.querySelector("mark");
  if (t.closest(".page.None")) {
    const g = getComputedStyle(t).columnGap;
    const step = t.clientWidth + (g.endsWith("%") ? t.clientWidth * parseFloat(g) / 100 : parseFloat(g));
    const x = first.getBoundingClientRect().left - t.getBoundingClientRect().left + t.scrollLeft;
    spread = Math.floor(x / step);
    turn(0);
  } else {
    t.scrollTop = first.offsetTop - 20;
  }
}

// Default book: the text is laid out in fixed-height columns; one step shows the next two pages.
let spread = 0;
function turn(d) {
  const t = document.querySelector(".page.None .txt"), pager = document.querySelector(".pager");
  if (!t || !pager) return;
  const g = getComputedStyle(t).columnGap; // "16%" of the box width, or a px value
  const step = t.clientWidth + (g.endsWith("%") ? t.clientWidth * parseFloat(g) / 100 : parseFloat(g));
  // the column holding the end marker decides the page count; the trailing .pad column lets the
  // last spread scroll fully even when it has a single column of text
  const end = t.querySelector(".end").getBoundingClientRect().left - t.getBoundingClientRect().left + t.scrollLeft;
  const pages = Math.max(1, Math.floor(end / step) + 1);
  const before = spread;
  spread = Math.min(Math.max(spread + d, 0), pages - 1);
  t.scrollLeft = spread * step;
  pager.hidden = pages < 2;
  pager.querySelector('[data-turn="-1"]').disabled = spread === 0;
  pager.querySelector('[data-turn="1"]').disabled = spread === pages - 1;
  $("pg").textContent = `${spread + 1} / ${pages}`;
  return spread !== before;
}
addEventListener("resize", () => turn(0));

// Mouse wheel over a two-page book turns the page; at the first or last spread the page scrolls as usual.
let wheelAt = 0;
$("detail").addEventListener("wheel", (e) => {
  if (!e.target.closest(".page.None") || !e.deltaY) return;
  const d = e.deltaY > 0 ? 1 : -1, now = Date.now();
  if (now - wheelAt < 250) { e.preventDefault(); return; } // one turn per wheel gesture
  if (turn(d)) { wheelAt = now; e.preventDefault(); }
}, { passive: false });

function toggleRead() {
  READ.has(current.id) ? READ.delete(current.id) : READ.add(current.id);
  saveRead();
  show(current);
}

// Left/right arrow keys turn the page, up/down open the next/previous book in the list (after scrolling a scrolling page to its end), R toggles
// the read mark and E/K switch the book text to English/Korean, unless a text box or select has focus. The keys are listed on help.html.
addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || (e.target instanceof Element && e.target.closest("input, select, textarea"))) return;
  if (e.code === "KeyR") { // physical key, so r, R, ㄱ and ㄲ all count
    if (current) { e.preventDefault(); toggleRead(); }
    return;
  }
  if (e.code === "KeyE" || e.code === "KeyK") { // book text only; the English UI always shows English text
    if (current && ui === "ko") { e.preventDefault(); lang = e.code === "KeyE" ? "en" : "ko"; show(current); }
    return;
  }
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    // A scrolling page (scroll, tablet, disc) scrolls first; at its top or bottom the keys change the book.
    const t = document.querySelector(".page .txt"), down = e.key === "ArrowDown";
    if (t && t.scrollHeight > t.clientHeight + 1 && (down ? t.scrollTop + t.clientHeight < t.scrollHeight - 1 : t.scrollTop > 0)) {
      e.preventDefault();
      t.scrollBy({ top: (down ? 1 : -1) * t.clientHeight * 0.2, behavior: "smooth" });
      return;
    }
    const list = shown, i = list.indexOf(current);
    const b = list[i < 0 ? 0 : i + (e.key === "ArrowDown" ? 1 : -1)];
    if (!b) return;
    e.preventDefault();
    show(b);
    document.querySelector(`#list li[data-id="${CSS.escape(b.id)}"]`)?.scrollIntoView({ block: "nearest" });
    return;
  }
  if (document.querySelector(".page.None") && turn(e.key === "ArrowRight" ? 1 : -1)) e.preventDefault();
});

document.querySelectorAll("[data-ui]").forEach((b) => b.addEventListener("click", () => {
  ui = lang = b.dataset.ui;
  try { localStorage.setItem("ui", ui); } catch (e) { /* storage blocked */ }
  applyUi();
}));
$("detail").addEventListener("click", (e) => {
  const c = e.target.closest(".chip");
  if (c) { $(c.dataset.f).value = c.dataset.v; apply(); return; }
  const go = e.target.closest("[data-go]");
  if (go) { e.preventDefault(); if (go.dataset.go) show(byId[go.dataset.go]); return; }
  if (e.target.closest("[data-read]")) { toggleRead(); return; }
  const tb = e.target.closest("[data-turn]");
  if (tb) { turn(+tb.dataset.turn); return; }
  const l = e.target.closest("[data-lang]");
  if (l) { lang = l.dataset.lang; show(current); }
});
$("list").addEventListener("click", (e) => {
  const li = e.target.closest("li[data-id]");
  if (li) {
    show(books.find((b) => b.id === li.dataset.id));
    if (innerWidth <= 820) $("detail").scrollIntoView({ behavior: "smooth" });
  }
});
[...FILTERS, "f-rd"].forEach((id) => $(id).addEventListener("change", apply));
let timer;
$("q").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(apply, 150); });
$("reset").addEventListener("click", () => { $("q").value = ""; [...FILTERS, "f-rd"].forEach((id) => ($(id).value = "")); apply(); });

applyUi();
fetch("data/books.json").then((r) => r.json()).then((data) => {
  books = data;
  books.forEach((b) => {
    byId[b.id] = b;
    b._h = [b.t, b.te, b.id, b.c, b.ce, b.pl.map((p) => [p.r, p.re, p.k, p.ke])].flat(3).join(" ").toLowerCase();
  });
  const s = new URLSearchParams(location.search);
  $("q").value = s.get("q") || "";
  fillFilters();
  ["ac", "ty", "a", "bg", "r", "tg", "rd"].forEach((k) => s.get(k) && ($("f-" + k).value = s.get(k)));
  current = books.find((x) => x.id === s.get("id")) || null;
  applyUi();
});
