#!/usr/bin/env python3
"""把 Remotion Player 入口打成**单文件交互 HTML**（Artifact 片段形态）。

    python3 build-player.py src/radio-entry.tsx radio-player.html [--project animations]

改了组件或素材之后**必须重跑一遍**——HTML 里内联的是打包快照，不会自己跟着源码更新。
这是最容易忘的一步：源码改对了、还渲了 still 验证过，但发出去的链接还是旧的。

两步：
  1. esbuild 打成单个 iife bundle（React、Player、base64 素材全部进去）
  2. 把 bundle 原样塞进 <script>，配上头部样式

## 为什么要转义 `</script`

bundle 里只要出现字面量 `</script`（正则、字符串、注释里都可能），浏览器就会在那里
提前结束脚本块，页面直接白屏，而且**控制台不一定报错**——极难排查。
统一替换成 `<\\/script`：在 JS 字符串和正则里这两者等价，但 HTML 解析器不再断开。

产物是 `<head>` 之外的**片段**（没有 <html>/<body>），可直接交给 Artifact 发布。
"""
import argparse, os, subprocess, sys

ap = argparse.ArgumentParser()
ap.add_argument('entry', help='入口 tsx，如 src/radio-entry.tsx')
ap.add_argument('out', help='输出 HTML')
ap.add_argument('--project', default='animations')
ap.add_argument('--title', default='')
a = ap.parse_args()

proj = os.path.abspath(a.project)
out = os.path.abspath(a.out)
bundle = os.path.join(proj, '.build-bundle.js')

print(f'打包 {a.entry} …')
r = subprocess.run(
    ['npx', 'esbuild', a.entry, '--bundle', '--minify', '--format=iife', '--target=es2020',
     '--define:process.env.NODE_ENV="production"', f'--outfile={bundle}'],
    cwd=proj)
if r.returncode != 0:
    sys.exit('esbuild 失败')

js = open(bundle, encoding='utf-8').read()
os.remove(bundle)
# 关键一步：见模块注释
js = js.replace('</script', r'<\/script')

HEAD = '''<style>
  :root { color-scheme: light; }
  body { margin:0; background:#F0FAFA; color:#1A1F1F; -webkit-font-smoothing:antialiased;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",sans-serif; }
  * { box-sizing: border-box; }
  button:focus-visible { outline:2px solid #00bebe; outline-offset:2px; }
</style>
<div id="root"></div>
'''
title = f'<title>{a.title}</title>\n' if a.title else ''
open(out, 'w', encoding='utf-8').write(title + HEAD + '<script>' + js + '</script>\n')
print(f'✅ {out}  {os.path.getsize(out)/1024:.0f} KB')
print('   记得跑：node scripts/assert-self-contained-html.mjs %s --fragment' % a.out)
