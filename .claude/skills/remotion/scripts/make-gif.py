#!/usr/bin/env python3
"""把 Remotion 合成渲成**飞书文档里能自动循环播放的 GIF**。

    python3 make-gif.py <CompId> --out out/xxx.gif [--project remotion-terrain]
                        [--scale 0.34] [--every 3] [--max-mb 8]

为什么需要它：**飞书文档不能内嵌运行 HTML**，文档里唯一能「动起来」的是 GIF——
图片块会自动循环播放，团队成员打开文档就直接看到动画，不用点、不用跳转。
HTML 只能作为附件/链接，让需要逐帧细看的人下载后在浏览器里打开。

两步：
    1) `remotion render --codec=gif` 渲出 GIF（本仓库自带精简版 ffmpeg，但 gif 编码可用）
       用 --scale 降分辨率、--every-nth-frame 降帧率。1080p30 直接渲会 OOM（实测 exit 137）
    2) 超过 --max-mb 时用 PIL 降色深/降尺寸重压——GIF 不压缩时间维度，长片必然超标

飞书文档里图片过大加载慢，**建议单条 GIF 控制在 8MB 以内、时长 ≤15s**。
一个功能有四章的话，做四条 GIF 分别插在四个小节下面，比做一条长的好。
"""
import argparse, os, shutil, subprocess, sys
from PIL import Image, ImageSequence

ap = argparse.ArgumentParser()
ap.add_argument('comp', help='Remotion 合成 id，如 SceneA / RampC3 / BagA')
ap.add_argument('--project', default='remotion-terrain')
ap.add_argument('--out', required=True)
ap.add_argument('--scale', type=float, default=0.34, help='0.34 → 1920×1080 变 653×367')
ap.add_argument('--every', type=int, default=3, help='每 N 帧取一帧，3 → 30fps 变 10fps')
ap.add_argument('--max-mb', type=float, default=8.0)
ap.add_argument('--concurrency', type=int, default=2, help='调高容易 OOM')
a = ap.parse_args()

proj = os.path.abspath(a.project)
out = os.path.abspath(a.out)
os.makedirs(os.path.dirname(out) or '.', exist_ok=True)

print(f'渲 GIF：{a.comp}  scale={a.scale}  every={a.every}')
r = subprocess.run(
    ['npx', 'remotion', 'render', a.comp, out, '--codec=gif',
     f'--scale={a.scale}', f'--every-nth-frame={a.every}', f'--concurrency={a.concurrency}',
     '--browser-executable=/opt/pw-browsers/chromium', '--chrome-mode=chrome-for-testing',
     '--log=error'],
    cwd=proj)
if r.returncode != 0:
    sys.exit(f'渲染失败（returncode={r.returncode}）。'
             'exit 137 = 被系统 OOM 杀掉，把 --scale / --concurrency 调小再试。')

mb = os.path.getsize(out) / 1024 / 1024
im = Image.open(out)
w, h = im.size
n = getattr(im, 'n_frames', 1)
dur = im.info.get('duration', round(1000 * a.every / 30))

# 超标就重压：先降色深（对扁平矢量画面几乎无损），再降尺寸
colors, scale = 128, 1.0
while mb > a.max_mb and (colors > 40 or scale > 0.5):
    if colors > 40:
        colors = max(40, colors // 2)
    else:
        scale *= 0.85
    src = Image.open(out)
    frames = []
    for f in ImageSequence.Iterator(src):
        g = f.convert('RGB')
        if scale < 1.0:
            g = g.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
        frames.append(g.quantize(colors=colors, method=Image.MEDIANCUT))
    tmp = out + '.tmp.gif'
    frames[0].save(tmp, save_all=True, append_images=frames[1:], loop=0,
                   duration=dur, optimize=True, disposal=2)
    shutil.move(tmp, out)
    mb = os.path.getsize(out) / 1024 / 1024
    print(f'  重压：colors={colors} scale={scale:.2f} → {mb:.1f}MB')

im = Image.open(out)
print(f'✅ {out}  {im.size[0]}×{im.size[1]} · {n} 帧 · {round(1000/dur)}fps · {mb:.1f}MB')
if mb > a.max_mb:
    print(f'⚠️ 仍超 {a.max_mb}MB —— 缩短这一段时长，或只把最关键的一章做成 GIF')
