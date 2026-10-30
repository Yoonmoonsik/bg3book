const BG = {
  None: ["기본 책", "Book_BG_B1"], PaperSheet: ["종이 한 장", "paper_Sheet"], PaperStack: ["종이 묶음", "paper_Stack"],
  ScrollA: ["두루마리 A", "scroll_A_bg"], ScrollB: ["두루마리 B", "scroll_B_bg"], TabletA: ["석판 A", "tablet_A_bg"],
  TabletB: ["석판 B", "tablet_B_bg"], TabletC: ["석판 C", "tablet_C_bg"], GithDisc: ["기스양키 원판", "gith_disc_bg"],
};
const HOW = { level: "맵에 배치", in_container: "상자 안", carried: "캐릭터 소지", container_itemlist: "컨테이너 소지품" };
const $ = (id) => document.getElementById(id);
let books = [], shown = [], current = null, lang = "ko";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// game text only uses <br>, <b>, <i>
const rich = (s) => esc(s).replace(/&lt;br&gt;/g, "\n").replace(/&lt;(\/?)(b|i)&gt;/g, "<$1$2>");
const title = (b) => b.t[0] || b.te[0] || b.id;
const region = (p) => p.r || p.l;

function fill(sel, values) {
  const counts = {};
  values.flat().forEach((v) => (counts[v] = (counts[v] || 0) + 1));
  Object.keys(counts).sort((a, b) => a.localeCompare(b, "ko")).forEach((v) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = `${sel === "f-bg" ? BG[v]?.[0] || v : v} (${counts[v]})`;
    $(sel).appendChild(o);
  });
}

function haystack(b) {
  return (b.t.join(" ") + " " + b.te.join(" ") + " " + b.id + " " + b.p.join(" ") + " " + b.c + " " + b.ce).toLowerCase();
}

function apply() {
  const q = $("q").value.trim().toLowerCase();
  const f = { ty: $("f-ty").value, a: $("f-a").value, bg: $("f-bg").value, r: $("f-r").value, tg: $("f-tg").value };
  shown = books.filter((b) =>
    (!q || b._h.includes(q)) && (!f.ty || b.ty === f.ty) && (!f.a || b.a.includes(f.a)) &&
    (!f.bg || b.bg.includes(f.bg)) && (!f.r || b._r.includes(f.r)) && (!f.tg || b.tg.includes(f.tg)));
  $("count").textContent = `${shown.length.toLocaleString()}권 표시`;
  const list = $("list");
  list.innerHTML = "";
  const frag = document.createDocumentFragment();
  shown.slice(0, 600).forEach((b) => {
    const li = document.createElement("li");
    li.dataset.id = b.id;
    if (current && current.id === b.id) li.className = "on";
    li.innerHTML = `<span class="t">${esc(title(b))}</span><span class="m">${esc(b.ty)} · ${esc(b._r.slice(0, 3).join(", ") || b.a.join(", ") || "획득처 확인 안 됨")}</span>`;
    frag.appendChild(li);
  });
  list.appendChild(frag);
  if (shown.length > 600) {
    const li = document.createElement("li");
    li.className = "m";
    li.textContent = `… 외 ${shown.length - 600}권 (검색어나 필터로 좁혀 주세요)`;
    frag.appendChild(li);
    list.appendChild(li);
  }
  const s = new URLSearchParams(f);
  if (q) s.set("q", q);
  if (current) s.set("id", current.id);
  [...s.keys()].forEach((k) => !s.get(k) && s.delete(k));
  history.replaceState(null, "", "?" + s.toString());
}

function show(b) {
  current = b;
  document.querySelectorAll("#list li").forEach((li) => li.classList.toggle("on", li.dataset.id === b.id));
  const bg = b.bg[0] || "None";
  const text = lang === "ko" ? b.c || b.ce : b.ce || b.c;
  const rows = b.pl.map((p) => `<tr><td>${esc(region(p))}</td><td>${esc(HOW[p.h] || p.h)}${p.k ? " · " + esc(p.k) : ""}</td>
    <td><code>${esc(p.l)}${p.xyz ? " (" + p.xyz.map((v) => v.toFixed(0)).join(", ") + ")" : ""}</code></td><td><code>${esc(p.m)}</code></td></tr>`).join("");
  $("detail").innerHTML = `
    <h2 class="title">${esc(title(b))}</h2>
    <p class="title-en">${esc(b.te.join(" / "))}</p>
    <div class="chips">
      <span class="chip type" data-f="f-ty" data-v="${esc(b.ty)}">${esc(b.ty)}</span>
      ${b.a.map((a) => `<span class="chip" data-f="f-a" data-v="${esc(a)}">${esc(a)}</span>`).join("")}
      ${b.bg.map((g) => `<span class="chip" data-f="f-bg" data-v="${esc(g)}">배경: ${esc(BG[g]?.[0] || g)}</span>`).join("")}
    </div>
    <div class="chips">${b.tg.map((t) => `<span class="chip" data-f="f-tg" data-v="${esc(t)}">#${esc(t)}</span>`).join("")}</div>
    <div class="toggle"><button data-lang="ko" class="${lang === "ko" ? "on" : ""}">한국어</button> <button data-lang="en" class="${lang === "en" ? "on" : ""}">English</button></div>
    <div class="page ${esc(bg)}" style="background-image:url('assets/${BG[bg]?.[1] || "Book_BG_B1"}.webp')">${rich(text) || "<i>(내용 없음)</i>"}</div>
    ${b.u.length ? `<p>미확인 제목: ${esc(b.u.join(" / "))}</p>` : ""}
    <section><h3>발견 장소 (${b.pl.length})</h3>${rows ? `<table><tr><th>지역</th><th>방식</th><th>레벨 (좌표)</th><th>지역 판정</th></tr>${rows}</table>` : "<p class='empty'>맵 배치 없음</p>"}</section>
    ${b.s.length ? `<section><h3>판매 상인</h3><p>${b.s.map(esc).join("<br>")}</p></section>` : ""}
    ${b.os.length ? `<section><h3>스토리 스크립트(Osiris) 지급</h3><p>${b.os.map(esc).join("<br>")}</p></section>` : ""}
    ${b.tt.length ? `<section><h3>트레저 테이블</h3><p><code>${b.tt.map(esc).join(", ")}</code></p></section>` : ""}
    <section><h3>데이터</h3><dl>
      <dt>BookId</dt><dd><code>${esc(b.id)}</code></dd>
      <dt>내용 핸들</dt><dd><code>${esc(b.ch)}</code></dd>
      <dt>제목 핸들</dt><dd><code>${esc(b.th.join(", "))}</code></dd>
      <dt>템플릿</dt><dd><code>${esc(b.tp.join(", "))}</code></dd>
      <dt>아이콘</dt><dd><code>${esc(b.ic.join(", "))}</code></dd>
    </dl></section>`;
  if (innerWidth <= 820) $("detail").scrollIntoView({ behavior: "smooth" });
  apply();
}

$("detail").addEventListener("click", (e) => {
  const c = e.target.closest(".chip");
  if (c) { $(c.dataset.f).value = c.dataset.v; apply(); return; }
  const l = e.target.closest("[data-lang]");
  if (l) { lang = l.dataset.lang; show(current); }
});
$("list").addEventListener("click", (e) => {
  const li = e.target.closest("li[data-id]");
  if (li) show(books.find((b) => b.id === li.dataset.id));
});
["f-ty", "f-a", "f-bg", "f-r", "f-tg"].forEach((id) => $(id).addEventListener("change", apply));
let timer;
$("q").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(apply, 150); });
$("reset").addEventListener("click", () => {
  $("q").value = "";
  ["f-ty", "f-a", "f-bg", "f-r", "f-tg"].forEach((id) => ($(id).value = ""));
  apply();
});

fetch("data/books.json").then((r) => r.json()).then((data) => {
  books = data;
  books.forEach((b) => { b._r = [...new Set(b.pl.map(region).filter(Boolean))]; b._h = haystack(b); });
  books.sort((a, b) => title(a).localeCompare(title(b), "ko"));
  $("total").textContent = `· ${books.length.toLocaleString()}종`;
  fill("f-ty", books.map((b) => b.ty));
  fill("f-a", books.map((b) => b.a));
  fill("f-bg", books.map((b) => b.bg));
  fill("f-r", books.map((b) => b._r));
  fill("f-tg", books.map((b) => b.tg));
  const s = new URLSearchParams(location.search);
  $("q").value = s.get("q") || "";
  ["ty", "a", "bg", "r", "tg"].forEach((k) => s.get(k) && ($("f-" + k).value = s.get(k)));
  apply();
  const b = books.find((x) => x.id === s.get("id"));
  if (b) show(b);
});
