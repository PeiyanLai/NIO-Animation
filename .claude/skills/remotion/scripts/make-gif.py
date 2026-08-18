#!/usr/bin/env python3
"""把 Remotion 合成渲成**飞书文档里能自动循环播放的高清 GIF**。

    python3 make-gif.py <CompId> --out out/xxx.gif [--project animations]
                        [--scale 0.75] [--every 5] [--max-mb 12]

为什么需要它：**飞书文档不能内嵌运行 HTML**，文档里唯一能「自己动起来」的是 GIF——
图片块会自动循环播放，团队成员打开文档就直接看到动画，不用点、不用跳转。

## 清晰度是第一约束，不是体积

飞书文档正文宽度约 700–900px，**Retina 屏按 2 倍渲染**，所以 730px 宽的 GIF 贴进去
等于被拉伸一倍——实测就是「糊」。**GIF 横向像素要给到显示宽度的 1.5–2 倍**，
`--scale 0.75`（1920×1080 → 1440×810）是及格线，不要为了省体积往下调。
省体积应该靠**降帧率**（`--every 5` → 6fps）和**缩短单条时长**，不是靠降分辨率。

## 三步

1) `remotion render --codec=gif` 渲出 GIF，`--scale` 控分辨率、`--every-nth-frame` 控帧率。
   1080p30 直接渲会 OOM（实测 exit 137），`--concurrency` 压到 2
2) ffmpeg `palettegen(stats_mode=diff)` + `paletteuse(dither=bayer)` 重做调色板。
   **这一步是白拿的**：实测 1440×810 从 11.8MB → 9.7MB，车身金属渐变肉眼看不出差别。
   用 bayer 而不是误差扩散抖动——后者制造的噪点会毁掉 GIF 的帧间压缩
3) 还超 `--max-mb` 就继续降色深；**降到 64 色还超，就该缩短这一段时长了，不要再降分辨率**

飞书 `upload_all` 单次上限 20MB。单条建议 **12MB 以内、时长 ≤15s**。
一个功能有四章就做四条，分别插在四个小节下面，比做一条长的好。
"""
import argparse, glob, os, shutil, subprocess, sys
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('comp', help='Remotion 合成 id，如 SceneA / RampC3 / BagA')
ap.add_argument('--project', default='animations')
ap.add_argument('--out', required=True)
ap.add_argument('--scale', type=float, default=0.75, help='0.75 → 1920×1080 变 1440×810，飞书里的及格线')
ap.add_argument('--every', type=int, default=5, help='每 N 帧取一帧，5 → 30fps 变 6fps')
ap.add_argument('--max-mb', type=float, default=12.0, help='飞书单次上传上限 20MB')
ap.add_argument('--colors', type=int, default=128, help='调色板色数；扁平矢量画面 128 足够')
ap.add_argument('--concurrency', type=int, default=2, help='调高容易 OOM')
a = ap.parse_args()

proj = os.path.abspath(a.project)
out = os.path.abspath(a.out)
os.makedirs(os.path.dirname(out) or '.', exist_ok=True)

# compositor 包名带平台后缀（linux-x64-gnu / darwin-arm64 / …），必须 glob 而不能写死。
# 坑：npm 会把**多个**平台的目录都装下来，musl 和 gnu 两个 ffmpeg 都存在、都是 +x，
# 但非本机那个跑起来是 rc=127（缺动态加载器），而 Python 把它报成
# 「FileNotFoundError: 找不到 ffmpeg」—— 完全误导。
# 所以判据只能是**真的执行一次 -version**，不能看 os.access(X_OK)。
def _probe(p: str) -> bool:
    try:
        return subprocess.run([p, '-version'], capture_output=True, timeout=20).returncode == 0
    except Exception:
        return False


FFMPEG = next((p for p in sorted(glob.glob(
    os.path.join(proj, 'node_modules/@remotion/compositor-*/ffmpeg'))) if _probe(p)), '')
if not FFMPEG:
    _sys = shutil.which('ffmpeg')
    FFMPEG = _sys if _sys and _probe(_sys) else ''

mb_of = lambda p: os.path.getsize(p) / 1024 / 1024

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

print(f'  原始：{mb_of(out):.1f}MB')


def repalette(colors: int) -> bool:
    """重做调色板。帧延迟与 loop 标记由 ffmpeg 原样带过，不会变速也不会只播一遍。"""
    if not FFMPEG:
        return False
    tmp = out + '.tmp.gif'
    p = subprocess.run(
        [FFMPEG, '-y', '-v', 'error', '-i', out, '-filter_complex',
         f'[0:v]split[a][b];[a]palettegen=max_colors={colors}:stats_mode=diff[p];'
         f'[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle', tmp],
        capture_output=True, text=True)
    if p.returncode != 0 or not os.path.exists(tmp):
        print(f'  ⚠️ 调色板重编码失败，保留原文件：{p.stderr.strip()[:200]}')
        return False
    # 只在真的更小时才替换——极扁平的画面偶尔会反向变大
    if mb_of(tmp) < mb_of(out):
        shutil.move(tmp, out)
    else:
        os.remove(tmp)
    return True


colors = a.colors
if not FFMPEG:
    print('  ⚠️ 没有可用的 ffmpeg，跳过调色板重编码（体积会大 15%~20%）')
elif repalette(colors):
    print(f'  调色板 {colors} 色 → {mb_of(out):.1f}MB')
    while mb_of(out) > a.max_mb and colors > 64:
        colors = max(64, colors // 2)
        repalette(colors)
        print(f'  降到 {colors} 色 → {mb_of(out):.1f}MB')

im = Image.open(out)
dur = im.info.get('duration') or round(1000 * a.every / 30)
mb = mb_of(out)
print(f'✅ {out}  {im.size[0]}×{im.size[1]} · {im.n_frames} 帧 · {round(1000 / dur)}fps · {mb:.1f}MB')
if im.size[0] < 1200:
    print(f'⚠️ 只有 {im.size[0]}px 宽——飞书文档里会糊，把 --scale 调到 0.75 以上')
if mb > a.max_mb:
    print(f'⚠️ 仍超 {a.max_mb}MB —— **缩短这一段时长**或再降 --every，不要降 --scale')
