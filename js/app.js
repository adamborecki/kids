/* The Fun Drawer — tiny hash-routed app.
   #/                      → pick a thing + find activities (filters)
   #/<category>            → that category's activities (filters)
   #/<category>/<activity> → activity folder (markdown split into tabs at each ## heading)
*/
(() => {
  "use strict";

  const app = document.getElementById("app");
  const pageSize = document.getElementById("page-size");
  const ageSelect = document.getElementById("age");
  const KEYS = { paper: "funDrawer.paper", filters: "funDrawer.filters", panel: "funDrawer.panelOpen" };
  let catalog = null;
  let S = null;            // catalog.scales
  let FACETS = [];
  let onAge = null;        // current view's handler for an age change

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

  /* ---------- Activity facts → labels ---------- */
  const timeBucket = (a) => (a.minutes <= S.time.short ? "short" : a.minutes <= S.time.medium ? "medium" : "long");
  const ageText = (n) => (n >= 11 ? "11+" : String(n));
  const ageRange = (a) => (a.ages[0] === a.ages[1] ? ageText(a.ages[0]) : `${a.ages[0]}–${ageText(a.ages[1])}`);
  const both = (list, map, bothLabel) => (list.length > 1 ? bothLabel : map[list[0]]);
  const cash = (n) => `<span class="cash"><b>${"$".repeat(n)}</b><i>${"$".repeat(3 - n)}</i></span>`;

  const labels = (a) => ({
    time: `${S.timeLabels[timeBucket(a)]} · ${esc(a.time || a.minutes + " min")}`,
    cleanup: a.cleanup ? `${S.cleanup[a.cleanup]} ${cash(a.cleanup)}` : S.cleanup[0],
    noise: S.noise[a.noise],
    where: both(a.where, S.where, "🏠🌳 In or out"),
    players: both(a.players, S.players, "👤👥 Solo or group"),
    ages: `🎂 Ages ${ageRange(a)}`,
  });

  const badges = (a) => Object.entries(labels(a)).map(([k, v]) => {
    const level = k === "noise" ? ` n${a.noise}` : k === "cleanup" ? ` c${a.cleanup}` : "";
    return `<span class="badge b-${k}${level}">${v}</span>`;
  }).join("");

  /* ---------- Filters ---------- */
  function buildFacets() {
    FACETS = [
      { key: "age", label: "🎂 Age", single: true,
        options: S.ages.map((n) => ({ id: String(n), label: ageText(n) })),
        test: (a, v) => a.ages[0] <= +v && +v <= a.ages[1] },
      { key: "where", label: "📍 Where",
        options: Object.entries(S.where).map(([id, label]) => ({ id, label })),
        test: (a, v) => a.where.includes(v) },
      { key: "time", label: "⏱️ Time",
        options: [
          { id: "short", label: `${S.timeLabels.short} <small>≤${S.time.short}m</small>` },
          { id: "medium", label: `${S.timeLabels.medium} <small>≤${S.time.medium}m</small>` },
          { id: "long", label: `${S.timeLabels.long} <small>${S.time.medium + 1}m+</small>` },
        ],
        test: (a, v) => timeBucket(a) === v },
      { key: "cleanup", label: "🧽 Cleanup",
        options: S.cleanup.map((l, i) => ({ id: String(i), label: l.replace(" cleanup", "") })),
        test: (a, v) => a.cleanup === +v },
      { key: "noise", label: "🔊 Noise",
        options: S.noise.map((label, i) => ({ id: String(i), label })),
        test: (a, v) => a.noise === +v },
      { key: "players", label: "👥 Players",
        options: Object.entries(S.players).map(([id, label]) => ({ id, label })),
        test: (a, v) => a.players.includes(v) },
    ];
  }

  const filters = {};
  function loadFilters() {
    let saved = {};
    try { saved = JSON.parse(store.get(KEYS.filters) || "{}"); } catch { /* ignore */ }
    FACETS.forEach((f) => { filters[f.key] = new Set((saved[f.key] || []).filter((v) => f.options.some((o) => o.id === v))); });
  }
  function saveFilters() {
    const out = {};
    FACETS.forEach((f) => { out[f.key] = [...filters[f.key]]; });
    store.set(KEYS.filters, JSON.stringify(out));
  }
  const age = () => [...filters.age][0] || "";
  const activeCount = () => FACETS.reduce((n, f) => n + filters[f.key].size, 0);

  // AND across groups, OR inside a group. `skip` ignores one group (for live counts).
  const matches = (a, skip) => FACETS.every((f) =>
    f.key === skip || !filters[f.key].size || [...filters[f.key]].some((v) => f.test(a, v)));

  function setAge(v) {
    filters.age = new Set(v ? [v] : []);
    saveFilters();
    ageSelect.value = v;
    if (onAge) onAge();
  }
  ageSelect.addEventListener("change", () => setAge(ageSelect.value));

  // pool: [{cat, a}] · draw(hits) paints the results. Returns a repaint function.
  function filterPanel(root, pool, draw) {
    const panel = document.createElement("details");
    panel.className = "filter-panel";
    panel.open = store.get(KEYS.panel) !== "0";
    panel.addEventListener("toggle", () => store.set(KEYS.panel, panel.open ? "1" : "0"));
    root.appendChild(panel);

    const paint = () => {
      const hits = pool.filter((p) => matches(p.a));
      const n = activeCount();
      panel.innerHTML = `
        <summary>
          <span class="fp-title">🔎 Filters</span>
          ${n ? `<span class="fp-on">${n} on</span>` : ""}
          <span class="fp-count">${hits.length} of ${pool.length}</span>
          ${n ? `<button type="button" class="fp-clear" data-clear>✖ Clear</button>` : ""}
        </summary>
        <div class="fp-groups">
          ${FACETS.map((f) => `
            <div class="fp-group">
              <div class="fp-label">${f.label}</div>
              <div class="fp-chips">
                ${f.options.map((o) => {
                  const on = filters[f.key].has(o.id);
                  const count = pool.filter((p) => matches(p.a, f.key) && f.test(p.a, o.id)).length;
                  return `<button type="button" class="chip${count || on ? "" : " zero"}" data-k="${f.key}" data-v="${o.id}" aria-pressed="${on}">${o.label} <span class="ct">${count}</span></button>`;
                }).join("")}
              </div>
            </div>`).join("")}
        </div>`;
      draw(hits);
    };

    panel.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      const clear = e.target.closest("[data-clear]");
      if (clear) {
        e.preventDefault();
        FACETS.forEach((f) => filters[f.key].clear());
        saveFilters(); ageSelect.value = ""; paint();
      } else if (chip) {
        const { k, v } = chip.dataset;
        const f = FACETS.find((x) => x.key === k);
        const set = filters[k];
        if (set.has(v)) set.delete(v);
        else { if (f.single) set.clear(); set.add(v); }
        saveFilters();
        if (k === "age") ageSelect.value = age();
        paint();
      }
    });
    paint();
    return paint;
  }

  const card = ({ cat, a }, showCat) => `
    <a class="act-card" href="#/${cat.id}/${a.id}" style="--c:${cat.color}">
      <span class="act-emoji" aria-hidden="true">${a.emoji}</span>
      <div>
        ${showCat ? `<div class="act-cat">${cat.emoji} ${esc(cat.name)}</div>` : ""}
        <h3>${esc(a.name)}</h3>
        <div class="badges">${badges(a)}</div>
      </div>
    </a>`;

  const emptyMsg = `<p class="empty">No matches 🤷 Try turning off a filter.</p>`;

  /* ---------- Paper size (Letter / A4) ---------- */
  const docx = (paper, name) => `print/${paper}/${name}.docx`;
  const paper = () => (document.documentElement.dataset.paper === "a4" ? "a4" : "letter");
  function setPaper(p) {
    p = p === "a4" ? "a4" : "letter";
    document.documentElement.dataset.paper = p;
    pageSize.textContent = p === "a4"
      ? "@page { size: A4; margin: 14mm; }"
      : "@page { size: letter; margin: 0.6in; }";
    document.querySelectorAll("button[data-paper]").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.paper === p)));
    document.querySelectorAll("a[data-docx]").forEach((a) => {
      a.href = docx(p, a.dataset.docx);
      a.querySelector(".paper-name").textContent = p === "a4" ? "A4" : "Letter";
    });
    store.set(KEYS.paper, p);
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-paper]");
    if (b) setPaper(b.dataset.paper);
  });
  const paperToggle = () => `
    <span class="paper" role="group" aria-label="Paper size">
      <button type="button" data-paper="letter">Letter</button><button type="button" data-paper="a4">A4</button>
    </span>`;
  const wordLink = (name, label = "Word") =>
    `<a class="btn" data-docx="${esc(name)}" href="${docx(paper(), name)}" download>📄 <span>${label} (<span class="paper-name">${paper() === "a4" ? "A4" : "Letter"}</span>)</span></a>`;

  /* ---------- Views ---------- */
  const allPool = () => catalog.categories.flatMap((cat) => cat.activities.map((a) => ({ cat, a })));

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
      <h2 class="find-head">🔎 Or find the perfect activity</h2>
      <div class="filters-slot"></div>
      <div class="act-list"></div>
      <div class="bundle">
        <p>🖨️ Want it all on paper?</p>
        ${paperToggle()}
        ${wordLink("fun-drawer-everything", "Everything booklet")}
      </div>`;
    const list = app.querySelector(".act-list");
    onAge = filterPanel(app.querySelector(".filters-slot"), allPool(),
      (hits) => { list.innerHTML = hits.length ? hits.map((p) => card(p, true)).join("") : emptyMsg; });
    setPaper(paper());
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
      <div class="filters-slot"></div>
      <div class="act-list"></div>
      <p class="actions" style="margin-top:18px">${paperToggle()} ${wordLink(cat.id + "--all", "Print all " + cat.name)}</p>`;
    const list = app.querySelector(".act-list");
    onAge = filterPanel(app.querySelector(".filters-slot"), cat.activities.map((a) => ({ cat, a })),
      (hits) => { list.innerHTML = hits.length ? hits.map((p) => card(p, false)).join("") : emptyMsg; });
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
      <div class="badges big">${badges(act)}</div>
      <div class="actions">
        <button class="btn primary" type="button" data-print>🖨️ Print</button>
        ${paperToggle()}
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
      t.innerHTML = `<span class="ico" aria-hidden="true">${ico}</span><span class="tl">${esc(label)}</span>`;
      t.addEventListener("click", () => show(i));
      tabs.appendChild(t);
      box.appendChild(s.el);
      s.tab = t;
    });
    const allTab = document.createElement("button");
    allTab.className = "tab"; allTab.type = "button"; allTab.setAttribute("role", "tab");
    allTab.innerHTML = `<span class="ico" aria-hidden="true">📖</span><span>See all</span>`;
    allTab.addEventListener("click", () => show(-1));
    tabs.appendChild(allTab);

    // "By Age": wrap each "### … Age N" heading + what follows it into one block.
    const ageSec = sections.find((s) => /by age/i.test(s.title));
    let applyAge = () => {};
    if (ageSec) {
      const blocks = [];
      let cur = null;
      for (const node of [...ageSec.el.childNodes]) {
        const m = node.nodeName === "H3" && node.textContent.match(/Age (\d+)/);
        if (m) {
          cur = document.createElement("div");
          cur.className = "age-block";
          cur.dataset.age = m[1];
          node.before(cur);
          blocks.push(cur);
        }
        if (cur) cur.appendChild(node);
      }
      const picker = document.createElement("div");
      picker.className = "age-picker";
      picker.innerHTML = `<span>🎂 Age:</span>` +
        S.ages.map((n) => `<button type="button" class="chip" data-age="${n}">${ageText(n)}</button>`).join("") +
        `<button type="button" class="chip" data-age="">All</button>`;
      ageSec.el.querySelector("h2").after(picker);
      picker.addEventListener("click", (e) => {
        const b = e.target.closest("[data-age]");
        if (b) setAge(b.dataset.age);
      });

      applyAge = () => {
        const a = age();
        ageSec.el.classList.toggle("ages-filtered", !!a);
        blocks.forEach((b) => b.classList.toggle("mine", b.dataset.age === a));
        picker.querySelectorAll("[data-age]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.age === a)));
        ageSec.tab.querySelector(".tl").textContent = a ? `Age ${ageText(+a)}` : ageSec.label;
      };
      applyAge();
    }
    onAge = applyAge;

    // Pager at the bottom of each part
    sections.forEach((s, i) => {
      const prev = sections[i - 1], next = sections[i + 1];
      const nav = document.createElement("div");
      nav.className = "pager";
      nav.innerHTML =
        (prev ? `<button class="btn" type="button" data-go="${i - 1}">◀ ${prev.ico} <span class="pl">${esc(prev.label)}</span></button>` : "") +
        (next ? `<button class="btn primary next" type="button" data-go="${i + 1}">${next.ico} <span class="pl">${esc(next.label)}</span> ▶</button>`
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

    // Make checklists tappable, mark fill-in tables, let wide tables scroll on phones.
    app.querySelectorAll('input[type="checkbox"]').forEach((c) => { c.disabled = false; });
    app.querySelectorAll(".section table").forEach((t) => {
      // A wide table that's (almost) all blank = drawing grid (pixel art, mazes, floor plans).
      const cells = [...t.querySelectorAll("tbody td")];
      const cols = t.querySelectorAll("thead th").length;
      const blank = (td) => !td.textContent.trim();
      if (cols >= 6 && cells.filter(blank).length >= cells.length * 0.8) t.classList.add("grid-table");
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
    onAge = null;
    const cat = catalog.categories.find((c) => c.id === cId);
    const act = cat && cat.activities.find((a) => a.id === aId);
    if (act) renderActivity(cat, act);
    else if (cat) renderCategory(cat);
    else renderHome();
    window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
  }

  async function init() {
    setPaper(store.get(KEYS.paper) || "letter");
    try {
      catalog = await fetch("catalog.json").then((r) => r.json());
    } catch {
      app.innerHTML = `<p class="error">😬 The drawer is stuck. Open this site through a web server (GitHub Pages, or <code>python3 -m http.server</code>).</p>`;
      return;
    }
    S = catalog.scales;
    buildFacets();
    loadFilters();
    ageSelect.innerHTML = `<option value="">Any</option>` +
      S.ages.map((n) => `<option value="${n}">${ageText(n)}</option>`).join("");
    ageSelect.value = age();
    window.addEventListener("hashchange", route);
    route();
  }

  init();
})();
