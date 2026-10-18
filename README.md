# 🗄️ The Fun Drawer

Picture-first activities for kids, built from stuff in the kitchen drawer:

| | Thing | Activities |
|---|---|---|
| 💦 | **Spray bottle** (the cheap $1 kind) | Rainbow Maker · Target Range · Chalk Paint · Coffee Filter Butterflies · Boat Race · Plant Mist Patrol |
| 🏷️ | **Label maker** + one ✨ Magic Silver Tape | Toy Museum · Treasure Hunt · Silver Tape Award · Label the House · Secret Codes · Pantry Patrol |
| 🖊️ | **4-color pen** | Make-a-Map · Color Story · Dots & Boxes · Ripple Doodles · Pixel Art · Four-Panel Comic |

## 🏷️ Badges + 🔎 filters
Every activity card shows badges. The home page and each category page have a filter panel (live counts on every chip; filters are remembered).

| Filter | Options |
|---|---|
| 🎂 Age | 6 · 7 · 8 · 9 · 10 · 11+ (also in the top bar — it picks the 🎚️ By Age challenge) |
| 📍 Where | 🏠 Indoor · 🌳 Outdoor |
| ⏱️ Time | ⚡ Short ≤15 min · ⏳ Medium ≤30 min · 🕰️ Long 31+ min |
| 🧽 Cleanup | ✨ None · 🧻 Light `$` · 🧽 Medium `$$` · 🛁 Big `$$$` |
| 🔊 Noise | 🤫 Silent · 🔉 Quiet · 🔊 Not as quiet · 📢 Unusually loud |
| 👥 Players | 👤 Solo · 👥 Group |

Groups combine with AND; options inside a group combine with OR (Indoor + Outdoor = either).

Tap an activity → it opens as a **folder**: 🧰 Gather · 👣 Steps · 🎚️ By Age · 🧠 Why It Works · 🛟 Grown-Up Notes · 🧽 Cleanup · 🖨️ Printable.
**🎚️ By Age** has a challenge for each age 6 → 11+. Pick an age and only that one shows (and prints).

## 🚀 Turn on GitHub Pages
1. Repo **Settings → Pages**
2. **Source:** Deploy from a branch → pick the branch → folder **`/ (root)`** → Save
3. Wait ~1 minute → open `https://<you>.github.io/kids/`

No build step. `.nojekyll` is included so the `.md` files are served as-is.

## 🖨️ Printing
- **In the browser:** 🖨️ Print button on any activity. Top-right toggle picks **Letter** (8.5×11) or **A4**. All folder tabs print; the Printable worksheet starts on its own page.
- **Word files:** `print/letter/` and `print/a4/` — one per activity, one per category, plus `fun-drawer-everything.docx`.

## ✏️ Add or edit an activity
1. Write `activities/<category>/<id>.md`
   - `# Title` → intro text → one `## 🧰 Section` per folder tab (the emoji becomes the tab icon)
   - Blank drawing space: `<div class="draw-box" data-label="✏️ Draw here"></div>` (add `small` or `big` to the class)
   - Add a `## 🎚️ By Age` section with `### 6️⃣ Age 6` … `### 🚀 Age 11+` blocks
2. Add one line to `catalog.json`:
   ```json
   { "id": "my-thing", "name": "My Thing", "emoji": "🎈", "minutes": 20,
     "cleanup": 0, "noise": 1, "where": ["indoor"], "players": ["solo", "group"], "ages": [6, 11] }
   ```
   `cleanup` and `noise` are 0–3 (see `scales` at the top of the file). `ages: [6, 11]` means 6 to 11+.
3. Rebuild Word files: `python3 tools/build_docx.py` (needs `pandoc` + `python-docx`)

Preview locally: `python3 -m http.server` → http://localhost:8000

## 📁 Layout
```
index.html  css/  js/app.js  js/vendor/marked.min.js
catalog.json              ← categories + activity list (time, cleanup, ages)
activities/<cat>/*.md     ← the content
img/*.svg  img/png/*.png  ← drawings (PNGs are for the Word files)
print/{letter,a4}/*.docx  ← generated
tools/                    ← build_docx.py, render_png.js
```
