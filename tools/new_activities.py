#!/usr/bin/env python3
"""Turn compact activity drafts into activities/<cat>/<id>.md files + catalog.json entries.

Usage: python3 tools/new_activities.py drafts.txt [more.txt ...]

Draft format (one block per activity):
  === <category> | <id> | <Name> | <emoji> | <minutes> | <cleanup 0-3> | <noise 0-3> | indoor,outdoor | solo,group | <age>-<age> [| grownup] [| time=10 min / day]
  Intro text (markdown)
  --- Gather      one item per line (becomes a checklist)
  --- Steps       "# Step title" then body lines (numbered automatically)
  --- Ages        "@6 text", "@7 text" ... one block for every age in the range (11 = 11+)
  --- Why         markdown
  --- Notes       markdown (Grown-Up Notes)
  --- Cleanup     one line = plain text, several lines = checklist
  --- Printable   markdown
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KC = {n: f"{n}️⃣" for n in range(1, 10)} | {10: "🔟"}
SECTIONS = ["Gather", "Steps", "Ages", "Why", "Notes", "Cleanup", "Printable"]


def age_head(n):
    return "### 🚀 Age 11+" if n >= 11 else f"### {KC[n]} Age {n}"


def convert(block):
    head, *rest = block.split("\n")
    f = [x.strip() for x in head.split("|")]
    cat, id_, name, emoji, minutes, cleanup, noise, where, players, ages = f[:10]
    lo, hi = map(int, ages.split("-"))
    meta = {"id": id_, "name": name, "emoji": emoji, "minutes": int(minutes)}
    extras = f[10:]
    for x in extras:
        if x.startswith("time="):
            meta["time"] = x[5:]
    meta |= {"cleanup": int(cleanup), "noise": int(noise), "where": where.split(","),
             "players": players.split(","), "ages": [lo, hi]}
    if "grownup" in extras:
        meta["grownup"] = True

    parts = re.split(r"^--- (\w+)\s*$", "\n".join(rest), flags=re.M)
    intro, secs = parts[0].strip(), dict(zip(parts[1::2], (p.strip("\n") for p in parts[2::2])))
    assert list(secs) == SECTIONS, (id_, list(secs))

    out = [f"# {emoji} {name}", "", intro, "", "## 🧰 Gather"]
    out += [f"- [ ] {l.strip()}" for l in secs["Gather"].splitlines() if l.strip()]
    out += ["", "## 👣 Steps"]
    n = 0
    for l in secs["Steps"].splitlines():
        if l.startswith("# "):
            n += 1
            out += ["", f"### {KC[n]} {l[2:].strip()}"]
        elif l.strip():
            out.append(l)
    out += ["", "## 🎚️ By Age", "🎂 Pick the age. Every age can do the main steps — this is the **extra challenge**."]
    seen = []
    for l in secs["Ages"].splitlines():
        m = re.match(r"@(\d+)\s+(.*)", l)
        if m:
            seen.append(int(m.group(1)))
            out += ["", age_head(int(m.group(1))), m.group(2)]
        elif l.strip():
            out.append(l)
    assert seen == list(range(lo, hi + 1)), (id_, seen, lo, hi)
    clean = [l.strip() for l in secs["Cleanup"].splitlines() if l.strip()]
    out += ["", "## 🧠 Why It Works", secs["Why"], "", "## 🛟 Grown-Up Notes", secs["Notes"], "", "## 🧽 Cleanup"]
    out += [f"- [ ] {l}" for l in clean] if len(clean) > 1 else clean
    out += ["", "## 🖨️ Printable", secs["Printable"].strip(), ""]
    return cat, meta, "\n".join(out)


def write_catalog(catalog):
    """One activity per line, so the file stays easy to scan and edit."""
    d = lambda o: json.dumps(o, ensure_ascii=False)
    sc = catalog["scales"]
    lines = ["{", f'  "title": {d(catalog["title"])},', '  "scales": {']
    lines += [f"    {d(k)}: {d(v)}" + ("," if i < len(sc) - 1 else "") for i, (k, v) in enumerate(sc.items())]
    lines += ["  },", '  "categories": [']
    cats = catalog["categories"]
    for ci, cat in enumerate(cats):
        lines.append("    {")
        lines += [f"      {d(k)}: {d(cat[k])}," for k in ["id", "name", "emoji", "image", "color", "tagline", "intro"]]
        lines.append('      "activities": [')
        acts = cat["activities"]
        lines += ["        { " + d(a)[1:-1] + " }" + ("," if i < len(acts) - 1 else "") for i, a in enumerate(acts)]
        lines += ["      ]", "    }" + ("," if ci < len(cats) - 1 else "")]
    lines += ["  ]", "}"]
    (ROOT / "catalog.json").write_text("\n".join(lines) + "\n")


def main(paths):
    catalog = json.loads((ROOT / "catalog.json").read_text())
    cats = {c["id"]: c for c in catalog["categories"]}
    taken = {a["id"] for c in cats.values() for a in c["activities"]}
    made = 0
    for path in paths:
        for block in Path(path).read_text().split("=== ")[1:]:
            cat, meta, md = convert(block.strip())
            if meta["id"] in taken:
                sys.exit(f"duplicate id: {meta['id']}")
            taken.add(meta["id"])
            (ROOT / "activities" / cat).mkdir(parents=True, exist_ok=True)
            (ROOT / "activities" / cat / f'{meta["id"]}.md').write_text(md)
            cats[cat]["activities"].append(meta)
            made += 1
    write_catalog(catalog)
    print(f"✅ {made} activities added:", {c: len(v["activities"]) for c, v in cats.items()})


if __name__ == "__main__":
    main(sys.argv[1:])
