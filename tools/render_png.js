// Render img/*.svg → img/png/*.png (used by the Word booklets).
// Run: node tools/render_png.js   (needs Playwright + Chromium)
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

(async () => {
  const root = path.resolve(__dirname, "..");
  const out = path.join(root, "img", "png");
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 240, height: 240 }, deviceScaleFactor: 3 });
  for (const file of fs.readdirSync(path.join(root, "img")).filter((f) => f.endsWith(".svg"))) {
    await page.goto("file://" + path.join(root, "img", file));
    await page.screenshot({ path: path.join(out, file.replace(/\.svg$/, ".png")), omitBackground: true });
    console.log("🖼️ ", file);
  }
  await browser.close();
})();
