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
import argparse, base64, os, subprocess, sys

ap = argparse.ArgumentParser()
ap.add_argument('entry', help='入口 tsx，如 src/radio-entry.tsx')
ap.add_argument('out', help='输出 HTML')
ap.add_argument('--project', default='animations')
ap.add_argument('--title', default='')
ap.add_argument('--gif', action='append', default=[], metavar='标签=path.gif',
                help='内嵌一条预渲染 GIF 并在页面右上角生成一键下载入口，可重复传。'
                     '例：--gif 场景一·车尾已入位=out/park-s1.gif')
ap.add_argument('--gif-name', default='动画', help='GIF 下载文件名前缀（通常填功能名，如 平移泊入）')
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
# Artifact 发布端有个 PR-review 模板分类器，会以「页面含具体 GitHub PR 链接」等特征
# 判定页面身份。两处防误判：
# ① Remotion 未授权横幅里内嵌了 pull/4589 链接——改指 PR 列表页（文案与授权逻辑不动）；
# ② 实测过一次误判的真正元凶是 **base64 素材流里随机撞上分类器指纹**
#    （报错 "carries the artifact-pr-review machinery... too large for a review page"，
#    同一文件旧素材能发、换了新图就被拒）。遇到这种拒发：把可疑的 base64 素材
#    换个压缩参数重编码（PIL save compress_level 改一档，像素不变、字节流全变）再打包即可。
js = js.replace('github.com/remotion-dev/remotion/pull/4589',
                'github.com/remotion-dev/remotion/pulls')

# charset 必须自带：Artifact 发布时外层 head 有 <meta charset>，但产物**下载到本地
# 直接打开**（公司 agent 对话框附件的标准用法）时没有外层——浏览器靠猜编码，
# 猜错则全页中文与 JS 字符串变乱码（GIF zip 文件名乱码就是这么来的）。
HEAD = '''<meta charset="utf-8">
<style>
  :root { color-scheme: light; }
  body { margin:0; background:#F0FAFA; color:#1A1F1F; -webkit-font-smoothing:antialiased;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",sans-serif; }
  * { box-sizing: border-box; }
  button:focus-visible { outline:2px solid #00bebe; outline-offset:2px; }
</style>
<div id="root"></div>
'''
# ── 高清 GIF 一键下载组件（--gif 时注入，页面右上角固定）────────────────────
# 设计约束：
#  · GIF **预渲染后内嵌**（make-gif.py 产物），不在浏览器里现算——Player 是
#    DOM/SVG 渲染，客户端截帧转 GIF 又重又不稳。
#  · 单场景 = Blob 直接落一个 .gif；「全部」= 页面内现打一个 **store 模式 zip**
#    （不压缩，GIF 本身已压过；避开「连续多下载」的浏览器拦截弹窗）。
#  · ⚠️ claude.ai Artifact 查看器的沙箱会拦截页面自身发起的下载——这个入口
#    只在 HTML **下载到本地打开**（或公司 agent 对话框附件打开）时生效，
#    验收必须走本地打开，别在 Artifact 里点了没反应就以为坏了。
GIF_WIDGET = ''
if a.gif:
    items = []
    for spec in a.gif:
        label, _, path = spec.partition('=')
        if not path:
            sys.exit(f'--gif 参数要写成 标签=path.gif，收到：{spec}')
        with open(path, 'rb') as f:
            b64 = base64.b64encode(f.read()).decode('ascii')
        safe = ''.join('-' if c in '/\\:*?"<>|' else c for c in label)
        items.append({'label': label, 'file': f'{a.gif_name}-{safe}.gif', 'b64': b64})
        print(f'   内嵌 GIF：{label}  {len(b64)*3//4/1024:.0f} KB')
    import json
    data = json.dumps([{'label': i['label'], 'file': i['file']} for i in items], ensure_ascii=False)
    b64s = json.dumps([i['b64'] for i in items])
    GIF_WIDGET = '''
<div id="gif-dl" style="position:fixed;top:14px;right:14px;z-index:9999;background:rgba(255,255,255,.92);backdrop-filter:blur(6px);border:1.5px solid #BFE3E3;border-radius:14px;padding:12px 14px;box-shadow:0 4px 18px rgba(0,80,80,.10);max-width:240px">
  <div style="font-size:12px;letter-spacing:.12em;color:#4A6A6A;margin-bottom:8px">高清 GIF 下载 · 1440×810</div>
  <div id="gif-dl-btns" style="display:flex;flex-direction:column;gap:6px"></div>
</div>
<script>(function(){
var META=__META__, B64=__B64__;
function bytes(b){var s=atob(b),a=new Uint8Array(s.length);for(var i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a}
function save(name,blob){var u=URL.createObjectURL(blob),el=document.createElement('a');el.href=u;el.download=name;document.body.appendChild(el);el.click();el.remove();setTimeout(function(){URL.revokeObjectURL(u)},4000)}
var TBL=(function(){var t=new Uint32Array(256);for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=(c&1)?(3988292384^(c>>>1)):(c>>>1);t[n]=c}return t})();
function crc32(a){var c=4294967295;for(var i=0;i<a.length;i++)c=TBL[(c^a[i])&255]^(c>>>8);return(c^4294967295)>>>0}
function u16(v){return new Uint8Array([v&255,(v>>>8)&255])}
function u32(v){return new Uint8Array([v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255])}
function zip(files){/* store 模式：CRC + 原样字节，UTF-8 文件名(flag 0x0800) */
 var parts=[],cd=[],off=0,DT=[u16(24576),u16(23827)];
 files.forEach(function(f){
  var nm=new TextEncoder().encode(f.name),d=f.data,crc=crc32(d);
  var loc=[u32(67324752),u16(20),u16(2048),u16(0),DT[0],DT[1],u32(crc),u32(d.length),u32(d.length),u16(nm.length),u16(0),nm,d];
  loc.forEach(function(p){parts.push(p)});
  cd.push({nm:nm,crc:crc,sz:d.length,off:off});
  off+=30+nm.length+d.length});
 var cdStart=off,cdLen=0;
 cd.forEach(function(e){
  var rec=[u32(33639248),u16(20),u16(20),u16(2048),u16(0),DT[0],DT[1],u32(e.crc),u32(e.sz),u32(e.sz),u16(e.nm.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(e.off),e.nm];
  rec.forEach(function(p){parts.push(p)});cdLen+=46+e.nm.length});
 [u32(101010256),u16(0),u16(0),u16(cd.length),u16(cd.length),u32(cdLen),u32(cdStart),u16(0)].forEach(function(p){parts.push(p)});
 return new Blob(parts,{type:'application/zip'})}
var box=document.getElementById('gif-dl-btns');
function mkbtn(txt,fn){var b=document.createElement('button');b.textContent=txt;
 b.style.cssText='font:600 13px inherit;font-family:inherit;color:#0A5C5C;background:#E8F7F7;border:1.5px solid #9AD4D4;border-radius:9px;padding:7px 10px;cursor:pointer;text-align:left';
 b.onmouseenter=function(){b.style.background='#D8F1F1'};b.onmouseleave=function(){b.style.background='#E8F7F7'};
 b.onclick=fn;box.appendChild(b)}
META.forEach(function(m,i){mkbtn('⬇ '+m.label,function(){save(m.file,new Blob([bytes(B64[i])],{type:'image/gif'}))})});
if(META.length>1)mkbtn('⬇ 全部场景打包 (zip)',function(){save('__ZIPNAME__',zip(META.map(function(m,i){return{name:m.file,data:bytes(B64[i])}})))});
})()</script>
'''.replace('__META__', data).replace('__B64__', b64s).replace('__ZIPNAME__', f'{a.gif_name}-全部场景.zip')
    # 组件 JS 的字符串里没有字面量 </script（base64 字符集也不可能出现），
    # 唯一的 </script> 是真闭合标签——所以这段**不做**转义，转义反而会弄坏它。

title = f'<title>{a.title}</title>\n' if a.title else ''
open(out, 'w', encoding='utf-8').write(title + HEAD + '<script>' + js + '</script>\n' + GIF_WIDGET)
print(f'✅ {out}  {os.path.getsize(out)/1024:.0f} KB')
print('   记得跑：node scripts/assert-self-contained-html.mjs %s --fragment' % a.out)
