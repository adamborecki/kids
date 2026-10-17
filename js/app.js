/* The Fun Drawer — tiny hash-routed app.
   #/                      → pick a thing (categories)
   #/<category>            → activity list
   #/<category>/<activity> → activity folder (markdown split into tabs at each ## heading)
*/
(() => {
  "use strict";

  const app = document.getElementById("app");
  const pageSize = document.getElementById("page-size");
  const PAPER_KEY = "funDrawer.paper";
  let catalog = null;

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));

  const md = (text) => (window.marked
    ? window.marked.parse(text, { gfm: true, breaks: true })
    : `<pre>${esc(text)}</pre>`);

  const cash = (n) =>
    `<span class="cash" title="Cleanup: ${esc(catalog.cleanup[n] || "")}"><b>${"$".repeat(n)}</b><i>${"$".repeat(3 - n)}</i></span>`;

  const timeOf = (a) => a.time || `${a.minutes} min`;
  const docx = (paper, name) => `print/${paper}/${name}.docx`;
  const paper = () => (document.documentElement.dataset.paper === "a4" ? "a4" : "letter");

  /* ---------- Paper size (Letter / A4) ---------- */
  function setPaper(p) {
    p = p === "a4" ? "a4" : "letter";
    document.documentElement.dataset.paper = p;
    pageSize.textContent = p === "a4"
      ? "@page { size: A4; margin: 14mm; }"
      : "@page { size: letter; margin: 0.6in; }";
    document.querySelectorAll("[data-paper]").forEach((b) => {
      if (b.tagName === "BUTTON") b.setAttribute("aria-pressed", String(b.dataset.paper === p));
    });
    document.querySelectorAll("a[data-docx]").forEach((a) => {
      a.href = docx(p, a.dataset.docx);
      a.querySelector(".paper-name").textContent = p === "a4" ? "A4" : "Letter";
    });
    store.set(PAPER_KEY, p);
  }
  document.querySelectorAll(".paper button").forEach((b) =>
    b.addEventListener("click", () => setPaper(b.dataset.paper)));

  const wordLink = (name, label = "Word") =>
    `<a class="btn" data-docx="${esc(name)}" href="${docx(paper(), name)}" download>📄 <span>${label} (<span class="paper-name">${paper() === "a4" ? "A4" : "Letter"}</span>)</span></a>`;

  /* ---------- Views ---------- */
  function renderHome() {
    document.title = "The Fun Drawer";
    app.innerHTML = `
      <section class="hello">
        <h1>Pick a thing! 👇</h1>
        <p>Grab it from the drawer. Find a fun thing to do. 🎉</p>
      </section>
      <div class="cat-grid">
        ${catalog.categories.map((c) => `
          <a class="cat-card" href="#/${c.id}" style="--c:${c.color}">
            <img src="${c.image}" alt="" width="220" height="220">
            <h2>${c.emoji} ${esc(c.name)}</h2>
            <p>${esc(c.tagline)}</p>
            <span class="pill">${c.activities.length} activities ▶</span>
          </a>`).join("")}
      </div>
      <div class="bundle">
        <p>🖨️ Want it all on paper?</p>
        ${wordLink("fun-drawer-everything", "Everything booklet")}
      </div>`;
  }

  function renderCategory(cat) {
    document.title = `${cat.name} · The Fun Drawer`;
    app.style.setProperty("--c", cat.color);
    app.innerHTML = `
      <nav class="crumbs"><a href="#/">🏠 Home</a> › ${cat.emoji} ${esc(cat.name)}</nav>
      <header class="cat-head">
        <img src="${cat.image}" alt="${esc(cat.name)}" width="130" height="130">
        <div>
          <h1>${cat.emoji} ${esc(cat.name)}</h1>
          <div class="intro">${md(cat.intro)}</div>
        </div>
      </header>
      <div class="filters" role="group" aria-label="Filter activities">
        <button class="chip" data-f="all" aria-pressed="true">🌟 All</button>
        <button class="chip" data-f="quick" aria-pressed="false">⚡ Quick (15 min or less)</button>
        <button class="chip" data-f="clean" aria-pressed="false">✨ Easy cleanup ($)</button>
      </div>
      <div class="act-list"></div>
      <p class="actions" style="margin-top:18px">${wordLink(cat.id + "--all", "Print all " + cat.name)}</p>`;

    const list = app.querySelector(".act-list");
    const draw = (f) => {
      const items = cat.activities.filter((a) =>
        f === "quick" ? a.minutes <= 15 : f === "clean" ? a.cleanup === 1 : true);
      list.innerHTML = items.length ? items.map((a) => `
        <a class="act-card" href="#/${cat.id}/${a.id}">
          <span class="act-emoji" aria-hidden="true">${a.emoji}</span>
          <div>
            <h2>${esc(a.name)}</h2>
            <div class="meta">
              <span>⏱️ ${esc(timeOf(a))}</span>
              <span>🧽 ${cash(a.cleanup)}</span>
              <span>👧 ${esc(a.ages)}</span>
            </div>
          </div>
        </a>`).join("") : `<p class="empty">Nothing here yet 🤷</p>`;
    };
    app.querySelectorAll(".chip").forEach((chip) => chip.addEventListener("click", () => {
      app.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
      draw(chip.dataset.f);
    }));
    draw("all");
    setPaper(paper());
  }

  async function renderActivity(cat, act) {
    document.title = `${act.name} · The Fun Drawer`;
    app.style.setProperty("--c", cat.color);
    app.innerHTML = `<p class="loading">Opening the folder… 📂</p>`;

    let text;
    try {
      const res = await fetch(`activities/${cat.id}/${act.id}.md`);
      if (!res.ok) throw new Error(res.status);
      text = await res.text();
    } catch {
      app.innerHTML = `<p class="error">😬 Couldn't open this folder. <a href="#/${cat.id}">Go back</a></p>`;
      return;
    }

    // Split the markdown: before first ## = intro, each ## = one "file" in the folder.
    const tmp = document.createElement("div");
    tmp.innerHTML = md(text);
    const intro = document.createElement("div");
    const sections = [];
    for (const node of [...tmp.childNodes]) {
      if (node.nodeName === "H1") continue;
      if (node.nodeName === "H2") {
        const el = document.createElement("section");
        el.className = "section";
        el.appendChild(node);
        sections.push({ title: node.textContent.trim(), el });
      } else {
        (sections.length ? sections[sections.length - 1].el : intro).appendChild(node);
      }
    }

    app.innerHTML = `
      <nav class="crumbs"><a href="#/">🏠 Home</a> › <a href="#/${cat.id}">${cat.emoji} ${esc(cat.name)}</a> › ${esc(act.name)}</nav>
      <div class="act-top">
        <span class="act-emoji" aria-hidden="true">${act.emoji}</span>
        <h1>${esc(act.name)}</h1>
      </div>
      <ul class="facts">
        <li>⏱️ <b>${esc(timeOf(act))}</b></li>
        <li>🧽 Cleanup ${cash(act.cleanup)}</li>
        <li>👧 Ages <b>${esc(act.ages)}</b></li>
        <li>${esc(act.where)}</li>
      </ul>
      <div class="actions">
        <button class="btn primary" type="button" data-print>🖨️ Print</button>
        ${wordLink(`${cat.id}--${act.id}`)}
      </div>
      <div class="intro-box"></div>
      <div class="folder">
        <div class="folder-label">📂 ${esc(act.name)} folder · ${sections.length} things inside</div>
        <div class="tabs" role="tablist"></div>
        <div class="sections"></div>
      </div>`;

    app.querySelector(".intro-box").append(...intro.childNodes);
    const tabs = app.querySelector(".tabs");
    const box = app.querySelector(".sections");

    const split = (title) => {
      const m = title.match(/^(\p{Extended_Pictographic}[️⃣‍\p{Extended_Pictographic}]*)\s*(.*)$/u);
      return m ? { ico: m[1], label: m[2] } : { ico: "📄", label: title };
    };

    sections.forEach((s, i) => {
      s.el.id = `part-${i}`;
      if (/printable/i.test(s.title)) s.el.classList.add("printable");
      const { ico, label } = split(s.title);
      s.ico = ico; s.label = label;
      const t = document.createElement("button");
      t.className = "tab"; t.type = "button";
      t.setAttribute("role", "tab");
      t.setAttribute("aria-controls", s.el.id);
      t.innerHTML = `<span class="ico" aria-hidden="true">${ico}</span><span>${esc(label)}</span>`;
      t.addEventListener("click", () => show(i));
      tabs.appendChild(t);
      box.appendChild(s.el);
    });
    const allTab = document.createElement("button");
    allTab.className = "tab"; allTab.type = "button"; allTab.setAttribute("role", "tab");
    allTab.innerHTML = `<span class="ico" aria-hidden="true">📖</span><span>See all</span>`;
    allTab.addEventListener("click", () => show(-1));
    tabs.appendChild(allTab);

    // Pager at the bottom of each part
    sections.forEach((s, i) => {
      const prev = sections[i - 1], next = sections[i + 1];
      const nav = document.createElement("div");
      nav.className = "pager";
      nav.innerHTML =
        (prev ? `<button class="btn" type="button" data-go="${i - 1}">◀ ${prev.ico} ${esc(prev.label)}</button>` : "") +
        (next ? `<button class="btn primary next" type="button" data-go="${i + 1}">${next.ico} ${esc(next.label)} ▶</button>`
              : `<a class="btn primary next" href="#/${cat.id}">🎉 Done! More ${esc(cat.name)} ▶</a>`);
      s.el.appendChild(nav);
    });
    box.addEventListener("click", (e) => {
      const b = e.target.closest("[data-go]");
      if (b) { show(Number(b.dataset.go)); tabs.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
    });

    function show(i) {
      box.classList.toggle("show-all", i < 0);
      sections.forEach((s, j) => s.el.classList.toggle("active", j === i));
      [...tabs.children].forEach((t, j) => {
        const on = i < 0 ? j === sections.length : j === i;
        t.setAttribute("aria-selected", String(on));
        if (on) t.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      });
    }

    // Make checklists tappable, mark empty fill-in tables, let wide tables scroll on phones.
    app.querySelectorAll('input[type="checkbox"]').forEach((c) => { c.disabled = false; });
    app.querySelectorAll(".section table").forEach((t) => {
      // A wide table that's empty except for row labels = drawing grid (pixel art).
      const cells = [...t.querySelectorAll("tbody td")];
      const cols = t.querySelectorAll("thead th").length;
      const blank = (td) => !td.textContent.trim();
      if (cols >= 6 && cells.every((td) => td.cellIndex === 0 || blank(td))) t.classList.add("grid-table");
      else if (cells.some(blank)) t.classList.add("fill");
      const wrap = document.createElement("div");
      wrap.className = "table-wrap";
      t.replaceWith(wrap); wrap.appendChild(t);
    });

    app.querySelector("[data-print]").addEventListener("click", () => window.print());
    show(0);
    setPaper(paper());
  }

  /* ---------- Router ---------- */
  function route() {
    const [cId, aId] = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    app.style.removeProperty("--c");
    const cat = catalog.categories.find((c) => c.id === cId);
    const act = cat && cat.activities.find((a) => a.id === aId);
    if (act) renderActivity(cat, act);
    else if (cat) renderCategory(cat);
    else renderHome();
    window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
  }

  async function init() {
    setPaper(store.get(PAPER_KEY) || "letter");
    try {
      catalog = await fetch("catalog.json").then((r) => r.json());
    } catch {
      app.innerHTML = `<p class="error">😬 The drawer is stuck. Open this site through a web server (GitHub Pages, or <code>python3 -m http.server</code>).</p>`;
      return;
    }
    window.addEventListener("hashchange", route);
    route();
  }

  init();
})();
