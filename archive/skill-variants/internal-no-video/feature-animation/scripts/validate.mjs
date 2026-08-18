/* 校验 feature-animation 生成的动画 HTML：
   用法: node validate.mjs <file.html>
   通用检查: 无 JS 报错 / 按时间轴百分位逐相位截图 / 双主题 / 播放推进
   截图输出到 <file>.frames/ 目录。功能专项断言（终点/角度/碰撞）请另行用 __seek 采样编写。 */
import { pathToFileURL } from "url";
import { resolve, dirname, basename, join } from "path";
import { mkdirSync } from "fs";

const file = process.argv[2];
if (!file) { console.error("用法: node validate.mjs <file.html>"); process.exit(2); }

let chromium;
try { ({ chromium } = await import("playwright")); }
catch { ({ chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs")); }

const abs = resolve(file);
const outDir = join(dirname(abs), basename(abs).replace(/\.html?$/i, "") + ".frames");
mkdirSync(outDir, { recursive: true });

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewportSize: { width: 1100, height: 900 } });
page.on("pageerror", e => errors.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });

await page.goto(pathToFileURL(abs).href, { waitUntil: "networkidle" });
await page.emulateMedia({ colorScheme: "dark" });
await page.waitForTimeout(400);

const hooks = await page.evaluate(() => ({
  seek: typeof window.__seek === "function",
  play: typeof window.__play === "function",
  info: typeof window.__info === "function" ? window.__info() : null
}));
if (!hooks.seek) errors.push("缺少测试钩子 window.__seek");

const T = hooks.info && hooks.info.T ? hooks.info.T : 10;
const stage = page.locator("#stage").first();
const target = (await stage.count()) ? stage : page;

// 逐相位截图（暗色）
for (const f of [0.05, 0.2, 0.4, 0.6, 0.8, 0.95]) {
  if (hooks.seek) await page.evaluate(t => window.__seek(t), T * f);
  await page.waitForTimeout(250);
  await target.screenshot({ path: join(outDir, `dark-${Math.round(f * 100)}.png`) });
}

// 亮色主题抽查
await page.emulateMedia({ colorScheme: "light" });
if (hooks.seek) await page.evaluate(t => window.__seek(t), T * 0.5);
await page.waitForTimeout(300);
await target.screenshot({ path: join(outDir, "light-50.png") });

// 播放推进检查
if (hooks.play) {
  await page.evaluate(() => window.__play());
  const s1 = await target.screenshot();
  await page.waitForTimeout(1600);
  const s2 = await target.screenshot();
  if (Buffer.compare(s1, s2) === 0) errors.push("恢复播放后画面未推进");
}

await browser.close();

if (errors.length) {
  console.error("❌ 校验失败:\n" + errors.join("\n"));
  process.exit(1);
}
console.log(`✅ 通用校验通过（时长 T=${T.toFixed(1)}s）。逐相位截图在: ${outDir}\n提醒：请补功能专项断言（终点/角度上限/障碍物重叠），并亲眼查看关键教育帧截图。`);
