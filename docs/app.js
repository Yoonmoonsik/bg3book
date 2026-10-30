// UI strings. Data values (type, acquisition, tags) are stored in Korean and translated here.
const I18N = {
  ko: {
    title: "BG3 책 열람실", sub: "발더스 게이트 3에 등장하는 읽을 수 있는 책·쪽지·석판", unit: "종",
    q: "제목·내용·장소 검색 (한/영)", "f-ty": "유형", "f-a": "획득 유형", "f-bg": "열람 배경", "f-r": "지역", "f-tg": "태그",
    all: "전체", reset: "필터 초기화", shown: (n) => `${n}권 표시`, more: (n) => `… 외 ${n}권 (검색어나 필터로 좁혀 주세요)`,
    pick: "왼쪽 목록에서 책을 선택하세요.", none: "(내용 없음)", unknown: "미확인 제목", noSource: "획득처 확인 안 됨",
    places: "발견 장소", region: "지역", how: "방식", level: "레벨 (좌표)", method: "지역 판정", noPlace: "맵 배치 없음",
    shops: "판매 상인", osiris: "스토리 스크립트(Osiris) 지급", tables: "트레저 테이블", data: "데이터",
    contentHandle: "내용 핸들", titleHandle: "제목 핸들", templates: "템플릿", icon: "아이콘", bg: "배경",
    prev: "◀ 이전", next: "다음 ▶", carried: "소지",
    footer: "데이터: 바닐라 게임 파일에서 추출(제목·내용 핸들, 배치, 트레저 테이블, 상점, Osiris 스크립트). 태그는 키워드로 추론한 값입니다.",
  },
  en: {
    title: "BG3 Book Library", sub: "Readable books, notes and tablets in Baldur's Gate 3", unit: "entries",
    q: "Search title, text or place (EN/KO)", "f-ty": "Type", "f-a": "Source", "f-bg": "Background", "f-r": "Region", "f-tg": "Tag",
    all: "All", reset: "Reset filters", shown: (n) => `${n} shown`, more: (n) => `… ${n} more (narrow with search or filters)`,
    pick: "Pick a book from the list.", none: "(no text)", unknown: "Unidentified title", noSource: "Source not found",
    places: "Found at", region: "Region", how: "How", level: "Level (coords)", method: "Region match", noPlace: "Not placed on a map",
    shops: "Sold by", osiris: "Given by story script (Osiris)", tables: "Treasure tables", data: "Data",
    contentHandle: "Content handle", titleHandle: "Title handle", templates: "Templates", icon: "Icon", bg: "Background",
    prev: "◀ Prev", next: "Next ▶", carried: "carried",
    footer: "Data extracted from the vanilla game files (title/content handles, placements, treasure tables, traders, Osiris scripts). Tags are inferred from keywords.",
  },
};
const VALUE_EN = {
  "유일(1개)": "Unique (1)", "복수 획득 가능": "Obtainable multiple times", "획득처 확인 안 됨": "Source not found",
  "맵에 배치": "Placed on map", "캐릭터·컨테이너 소지품(ItemList)": "Character/container inventory (ItemList)",
  "treasure table에서 획득": "Treasure table", "상점에서 구매": "Bought from trader", "스토리 스크립트(Osiris) 지급": "Given by story script (Osiris)",
};
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
const FILTERS = ["f-ty", "f-a", "f-bg", "f-r", "f-tg"];
const $ = (id) => document.getElementById(id);
let books = [], shown = [], current = null;
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
const title = (b) => (ui === "en" ? b.te[0] || b.t[0] : b.t[0] || b.te[0]) || b.id;
const subtitle = (b) => (ui === "en" ? b.t : b.te).join(" / ");
const region = (p) => (ui === "en" ? p.re || p.r : p.r || p.re) || p.l;
const regions = (b) => [...new Set(b.pl.map(region).filter(Boolean))];

function label(sel, v) {
  return sel === "f-bg" ? bgName(v) : sel === "f-tg" ? tag(v) : sel === "f-r" ? v : val(v);
}

function fillFilters() {
  const src = { "f-ty": (b) => [b.ty], "f-a": (b) => b.a, "f-bg": (b) => b.bg, "f-r": regions, "f-tg": (b) => b.tg };
  FILTERS.forEach((id) => {
    const keep = $(id).value, counts = {};
    books.forEach((b) => src[id](b).forEach((v) => (counts[v] = (counts[v] || 0) + 1)));
    $(id).innerHTML = `<option value="">${T("all")}</option>` + Object.keys(counts)
      .sort((a, b) => label(id, a).localeCompare(label(id, b), ui))
      .map((v) => `<option value="${esc(v)}">${esc(label(id, v))} (${counts[v]})</option>`).join("");
    $(id).value = keep;
  });
}

function applyUi() {
  document.documentElement.lang = ui;
  document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = T(el.dataset.i18n)));
  document.querySelectorAll("[data-ui]").forEach((b) => b.classList.toggle("on", b.dataset.ui === ui));
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
  const f = { ty: $("f-ty").value, a: $("f-a").value, bg: $("f-bg").value, r: $("f-r").value, tg: $("f-tg").value };
  shown = books.filter((b) =>
    (!q || b._h.includes(q)) && (!f.ty || b.ty === f.ty) && (!f.a || b.a.includes(f.a)) &&
    (!f.bg || b.bg.includes(f.bg)) && (!f.r || regions(b).includes(f.r)) && (!f.tg || b.tg.includes(f.tg)));
  $("count").textContent = T("shown", shown.length.toLocaleString());
  const list = $("list");
  list.innerHTML = shown.slice(0, 600).map((b) =>
    `<li data-id="${esc(b.id)}"${current && current.id === b.id ? ' class="on"' : ""}><span class="t">${esc(title(b))}</span>` +
    `<span class="m">${esc(val(b.ty))} · ${esc(regions(b).slice(0, 3).join(", ") || b.a.map(val).join(", ") || T("noSource"))}</span></li>`).join("") +
    (shown.length > 600 ? `<li class="m">${esc(T("more", shown.length - 600))}</li>` : "");
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
  const text = lang === "ko" ? b.c || b.ce : b.ce || b.c;
  const rows = b.pl.map((p) => {
    const who = ui === "en" ? p.ke || p.k : p.k || p.ke;
    return `<tr><td>${esc(region(p))}</td><td>${esc(HOW[p.h]?.[ui === "en" ? 1 : 0] || p.h)}${who ? " · " + esc(who) : ""}</td>
    <td><code>${esc(p.l)}${p.xyz ? " (" + p.xyz.map((v) => v.toFixed(0)).join(", ") + ")" : ""}</code></td><td><code>${esc(p.m)}</code></td></tr>`;
  }).join("");
  const shops = b.s.map((s) => (ui === "en" ? s.e : s.k));
  $("detail").innerHTML = `
    <h2 class="title">${esc(title(b))}</h2>
    <p class="title-en">${esc(subtitle(b))}</p>
    <div class="chips">
      <span class="chip type" data-f="f-ty" data-v="${esc(b.ty)}">${esc(val(b.ty))}</span>
      ${b.a.map((a) => `<span class="chip" data-f="f-a" data-v="${esc(a)}">${esc(val(a))}</span>`).join("")}
      ${b.bg.map((g) => `<span class="chip" data-f="f-bg" data-v="${esc(g)}">${T("bg")}: ${esc(bgName(g))}</span>`).join("")}
    </div>
    <div class="chips">${b.tg.map((t) => `<span class="chip" data-f="f-tg" data-v="${esc(t)}">#${esc(tag(t))}</span>`).join("")}</div>
    <div class="toggle"><button data-lang="ko" class="${lang === "ko" ? "on" : ""}">한국어</button> <button data-lang="en" class="${lang === "en" ? "on" : ""}">English</button></div>
    <div class="page ${esc(bg)}" style="background-image:url('assets/${BG[bg]?.[2] || "Book_BG_B1"}.webp')"><div class="txt">${rich(text).replace(/\n{3,}/g, "\n\n") || `<i>${T("none")}</i>`}<span class="end"></span><span class="pad"></span></div></div>
    <div class="pager" hidden><button data-turn="-1">${T("prev")}</button><span id="pg"></span><button data-turn="1">${T("next")}</button></div>
    ${b.u.length ? `<p>${T("unknown")}: ${esc(b.u.join(" / "))}</p>` : ""}
    <section><h3>${T("places")} (${b.pl.length})</h3>${rows ? `<table><tr><th>${T("region")}</th><th>${T("how")}</th><th>${T("level")}</th><th>${T("method")}</th></tr>${rows}</table>` : `<p class='empty'>${T("noPlace")}</p>`}</section>
    ${shops.length ? `<section><h3>${T("shops")}</h3><p>${shops.map(esc).join("<br>")}</p></section>` : ""}
    ${b.os.length ? `<section><h3>${T("osiris")}</h3><p>${b.os.map(esc).join("<br>")}</p></section>` : ""}
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
  apply();
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
  spread = Math.min(Math.max(spread + d, 0), pages - 1);
  t.scrollLeft = spread * step;
  pager.hidden = pages < 2;
  pager.querySelector('[data-turn="-1"]').disabled = spread === 0;
  pager.querySelector('[data-turn="1"]').disabled = spread === pages - 1;
  $("pg").textContent = `${spread + 1} / ${pages}`;
}
addEventListener("resize", () => turn(0));

document.querySelectorAll("[data-ui]").forEach((b) => b.addEventListener("click", () => {
  ui = lang = b.dataset.ui;
  try { localStorage.setItem("ui", ui); } catch (e) { /* storage blocked */ }
  applyUi();
}));
$("detail").addEventListener("click", (e) => {
  const c = e.target.closest(".chip");
  if (c) { $(c.dataset.f).value = c.dataset.v; apply(); return; }
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
FILTERS.forEach((id) => $(id).addEventListener("change", apply));
let timer;
$("q").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(apply, 150); });
$("reset").addEventListener("click", () => { $("q").value = ""; FILTERS.forEach((id) => ($(id).value = "")); apply(); });

applyUi();
fetch("data/books.json").then((r) => r.json()).then((data) => {
  books = data;
  books.forEach((b) => {
    b._h = [b.t, b.te, b.id, b.c, b.ce, b.pl.map((p) => [p.r, p.re, p.k, p.ke])].flat(3).join(" ").toLowerCase();
  });
  const s = new URLSearchParams(location.search);
  $("q").value = s.get("q") || "";
  fillFilters();
  ["ty", "a", "bg", "r", "tg"].forEach((k) => s.get(k) && ($("f-" + k).value = s.get(k)));
  current = books.find((x) => x.id === s.get("id")) || null;
  applyUi();
});
