/* 把 feature-animation 动画 HTML 导出为 MP4 视频（可选同时导出 GIF）。
   用法: node render-video.mjs <file.html> [--out demo.mp4] [--scenes a,b] [--theme dark|light] [--zoom 2]
                                [--gif] [--gif-width 720] [--gif-fps 12]
   依赖: playwright(全局或本地) + @ffmpeg-installer/ffmpeg(脚本自动 npm 安装，二进制在包内)
   原理: 无头浏览器实时录屏（CSS 动画与 JS 时间轴保持同步），按 __info().T 逐场景播完，
         再用 ffmpeg 裁切 .stage-shell 区域并转 H.264（yuv420p + faststart，通用播放）。
   --gif 用调色板两遍法(palettegen/paletteuse)从 MP4 再转一份循环 GIF——
         GIF 作为图片插入飞书文档/IM 时会自动循环播放，是"动画直接展现在文档里"的载体。 */
import { pathToFileURL } from "url";
import { resolve, dirname } from "path";
import { execSync, spawnSync } from "child_process";
import { readdirSync, existsSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { createRequire } from "module";

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
if (!file) { console.error("用法: node render-video.mjs <file.html> [--out x.mp4] [--scenes a,b]"); process.exit(2); }
const opt = (name, dft) => {
  const i = args.indexOf("--" + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dft;
};
const out = resolve(opt("out", file.replace(/\.html?$/i, "") + ".mp4"));
const scenes = opt("scenes", "").split(",").map(s => s.trim()).filter(Boolean);
const theme = opt("theme", "dark");
const zoom = parseFloat(opt("zoom", "2"));
const wantGif = args.includes("--gif");
const gifWidth = parseInt(opt("gif-width", "720"), 10);
const gifFps = parseInt(opt("gif-fps", "12"), 10);

let chromium;
try { ({ chromium } = await import("playwright")); }
catch { ({ chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs")); }

// ffmpeg：优先 @ffmpeg-installer（含 x264），自动安装到临时目录
function getFfmpeg() {
  const req = createRequire(import.meta.url);
  try { return req("@ffmpeg-installer/ffmpeg").path; } catch {}
  const dir = mkdtempSync(resolve(tmpdir(), "ffi-"));
  console.log("安装 @ffmpeg-installer/ffmpeg …");
  execSync("npm install @ffmpeg-installer/ffmpeg --prefix " + JSON.stringify(dir) +
           " --no-fund --no-audit --loglevel=error", { stdio: "inherit" });
  const req2 = createRequire(resolve(dir, "node_modules", "x.js"));
  return req2("@ffmpeg-installer/ffmpeg").path;
}

const VW = 1760, VH = 1330;
const rawDir = mkdtempSync(resolve(tmpdir(), "anim-video-"));
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: VW, height: VH },
  colorScheme: theme,
  recordVideo: { dir: rawDir, size: { width: VW, height: VH } }
});
const page = await ctx.newPage();
await page.goto(pathToFileURL(resolve(file)).href, { waitUntil: "networkidle" });
await page.evaluate(z => { document.body.style.zoom = String(z); }, zoom);
await page.waitForTimeout(300);
await page.evaluate(() => {
  const el = document.querySelector(".stage-shell") || document.querySelector("#stage") || document.body;
  el.scrollIntoView({ block: "start" });
});
await page.waitForTimeout(400);

const rect = await page.evaluate(() => {
  const el = document.querySelector(".stage-shell") || document.querySelector("#stage") || document.body;
  const r = el.getBoundingClientRect();
  return { x: Math.max(0, Math.round(r.x)), y: Math.max(0, Math.round(r.y)),
           w: Math.round(r.width) & ~1, h: Math.round(r.height) & ~1 };
});

const hasScn = await page.evaluate(() => typeof window.__scn === "function" && typeof window.__info === "function");
const sceneList = scenes.length ? scenes : [null];
let playTotal = 0;
for (const sc of sceneList) {
  if (hasScn && sc) await page.evaluate(s => window.__scn(s), sc);
  const T = hasScn ? (await page.evaluate(() => window.__info().T)) : 12;
  const ms = Math.ceil(T * 1000) + 250;
  playTotal += ms / 1000;
  await page.waitForTimeout(ms);
}

const video = page.video();
await ctx.close();
const rawPath = await video.path();
await browser.close();

// 裁头：只保留最后 playTotal 秒（去掉加载/滚动设置段）
const ffmpeg = getFfmpeg();
const probe = spawnSync(ffmpeg, ["-i", rawPath], { encoding: "utf-8" });
const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(probe.stderr || "");
const total = m ? (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]) : playTotal;
const start = Math.max(0, total - playTotal - 0.1).toFixed(2);

const ff = spawnSync(ffmpeg, [
  "-y", "-hide_banner", "-loglevel", "error",
  "-ss", start, "-i", rawPath, "-t", playTotal.toFixed(2),
  "-vf", `crop=${rect.w}:${rect.h}:${rect.x}:${rect.y}`,
  "-c:v", "libx264", "-preset", "medium", "-crf", "21",
  "-pix_fmt", "yuv420p", "-movflags", "+faststart", out
], { stdio: "inherit" });
if (ff.status !== 0) { console.error("ffmpeg 转码失败"); process.exit(1); }

console.log(`✅ 已导出: ${out}（${playTotal.toFixed(1)}s, ${rect.w}x${rect.h}, H.264）`);

if (wantGif) {
  // 注意：包内 ffmpeg 版本较老，palettegen 不支持 stat_mode 等新选项，保持基础参数
  const gifOut = out.replace(/\.mp4$/i, "") + ".gif";
  const fg = spawnSync(ffmpeg, [
    "-y", "-hide_banner", "-loglevel", "error", "-i", out,
    "-filter_complex",
    `fps=${gifFps},scale=${gifWidth}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4`,
    "-loop", "0", gifOut
  ], { stdio: "inherit" });
  if (fg.status !== 0) { console.error("GIF 转换失败"); process.exit(1); }
  const { statSync } = await import("fs");
  const mb = statSync(gifOut).size / 1048576;
  console.log(`✅ 已导出: ${gifOut}（${gifWidth}px, ${gifFps}fps, ${mb.toFixed(1)}MB${mb > 10 ? " ⚠️ 超 10MB，飞书内嵌可能失败，建议调小 --gif-width/--gif-fps 或按场景拆分" : ""}）`);
}

console.log("提醒：抽几帧亲眼检查关键教育画面后再交付。");
