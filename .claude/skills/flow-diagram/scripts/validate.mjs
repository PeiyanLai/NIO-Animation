/* 校验 flow-diagram 生成的 HTML：
   用法: node validate.mjs <file.html>
   断言: 无 JS 报错 / 节点边数量 / 单击弹编辑表单 / 拖拽后连线跟随
   并在同目录输出 <file>.preview.png 截图 */
import { pathToFileURL } from "url";
import { resolve, dirname, basename } from "path";

const file = process.argv[2];
if (!file) { console.error("用法: node validate.mjs <file.html>"); process.exit(2); }

let chromium;
try { ({ chromium } = await import("playwright")); }
catch { ({ chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs")); }

const abs = resolve(file);
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewportSize: { width: 1500, height: 950 } });
page.on("pageerror", e => errors.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
page.on("dialog", d => d.accept());

await page.goto(pathToFileURL(abs).href, { waitUntil: "networkidle" });
await page.waitForTimeout(500);

const counts = await page.evaluate(() => ({
  n: window.__flow ? window.__flow.nodes.length : -1,
  e: window.__flow ? window.__flow.edges.length : -1
}));
if (counts.n < 3) errors.push("节点数量异常: " + counts.n);
if (counts.e < 2) errors.push("边数量异常: " + counts.e);

// 单击节点 → 编辑表单
await page.locator(".node").first().click();
await page.waitForTimeout(300);
const editOpen = await page.evaluate(() =>
  document.getElementById("panel").classList.contains("open") &&
  !!document.querySelector('#panelBody input[type="text"]'));
if (!editOpen) errors.push("单击节点未打开编辑表单");
await page.click("#panelClose");

// 拖拽 → 连线跟随
await page.click("#zoom100");
await page.waitForTimeout(200);
const before = await page.evaluate(() => ({
  x: window.__flow.nodes[0].x,
  d: window.__flow.edges[0].p.getAttribute("d")
}));
const box = await page.locator(".node").first().boundingBox();
await page.mouse.move(box.x + 50, box.y + 20);
await page.mouse.down();
await page.mouse.move(box.x + 130, box.y + 70, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(250);
const after = await page.evaluate(() => ({
  x: window.__flow.nodes[0].x,
  d: window.__flow.edges[0].p.getAttribute("d")
}));
if (Math.abs(after.x - before.x - 80) > 4) errors.push(`拖拽位移异常: ${before.x} → ${after.x}`);
if (after.d === before.d) errors.push("拖拽后连线未跟随");

await page.click("#zoomFit");
await page.waitForTimeout(300);
const shot = resolve(dirname(abs), basename(abs).replace(/\.html?$/i, "") + ".preview.png");
await page.screenshot({ path: shot, fullPage: true });
await browser.close();

if (errors.length) {
  console.error("❌ 校验失败:\n" + errors.join("\n"));
  process.exit(1);
}
console.log(`✅ 校验通过：${counts.n} 节点 / ${counts.e} 边，编辑与拖拽正常。截图: ${shot}`);
