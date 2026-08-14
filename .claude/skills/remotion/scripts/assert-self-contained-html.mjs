#!/usr/bin/env node
/* 单文件 HTML 自包含校验（改编自 vehicle-feature-animation skill 的同名脚本）
   用法: node assert-self-contained-html.mjs page.html [--fragment]
   --fragment: Artifact 片段模式（页面由平台包 <html>/<body>，不要求完整文档）

   与原版的差异（原版会误报）：
   - 先剥离 <script>…</script> 内容再做「标签级外链」检查。打包后的 JS 里常含
     `<IFrame>`、`href="https://github.com/..."` 这类**错误提示字符串**，并非真实依赖。
   - 改为在脚本内容中检查**真正的运行时外链**：fetch / XHR / WebSocket / 动态 import / importScripts。 */
import fs from 'node:fs';

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--'));
const fragment = args.includes('--fragment');
if (!input) {
  console.error('Usage: node assert-self-contained-html.mjs page.html [--fragment]');
  process.exit(2);
}

const html = fs.readFileSync(input, 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join('\n');
const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

const violations = [];

// 标签级外链（在剥离脚本后的标记上检查）
const markupChecks = [
  [/<script\b[^>]*\bsrc\s*=/i, '发现外链 <script src>'],
  [/<link\b[^>]*\bhref\s*=\s*["'](?!data:)/i, '发现外链 <link href>'],
  [/\b(?:src|href)\s*=\s*["']https?:\/\//i, '发现远程 http(s) 资源'],
  [/url\(\s*["']?https?:\/\//i, '发现远程 CSS 资源'],
  [/<iframe\b/i, '发现 iframe'],
];
for (const [re, msg] of markupChecks) if (re.test(markup)) violations.push(msg);

// 脚本内的运行时外链（CSP 也会拦，但要在交付前就发现）
const scriptChecks = [
  [/\bfetch\s*\(\s*["'`]https?:\/\//i, '脚本内 fetch 远程地址'],
  [/new\s+XMLHttpRequest\b/i, '脚本内使用 XMLHttpRequest'],
  [/new\s+WebSocket\s*\(/i, '脚本内使用 WebSocket'],
  [/\bimportScripts\s*\(/i, '脚本内 importScripts'],
  [/\bimport\s*\(\s*["'`]https?:\/\//i, '脚本内动态 import 远程模块'],
];
for (const [re, msg] of scriptChecks) if (re.test(scripts)) violations.push(msg);

if (!/<script\b/i.test(html)) violations.push('没有内联脚本，确认 player 是否已打包进来');
if (!fragment && !/<(?:html|body)\b/i.test(html)) violations.push('不是完整 HTML 文档（Artifact 片段请加 --fragment）');
// </script 会提前闭合内联脚本，发布前必须为 0
if (/<\/script/i.test(scripts)) violations.push('内联脚本里含 </script，会提前闭合');

if (violations.length) {
  console.error(`自包含校验未通过: ${input}`);
  for (const v of violations) console.error(`- ${v}`);
  process.exit(1);
}
console.log(`✅ 自包含校验通过: ${input}`);
