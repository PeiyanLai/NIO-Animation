#!/usr/bin/env python3
"""从参考宣传片里提取**可复用的动效风格规格**（style-spec.json）。

    python3 analyze-reference-video.py <video.mp4> [--out DIR] [--fps 4] [--cut 26]

产出：
    <out>/style-spec.json   剪辑节奏、镜头时长分布、色板、明暗分布、镜头表
    <out>/shot-NN.jpg       每个镜头的代表帧（定景别、构图、字幕位置用）

为什么要做这一步：「像蔚来宣传片」不是形容词，它是一组**可量化的参数**——平均镜头时长、
切点密度、色板、明暗比例。量出来之后，我们的动画就能按同一组参数编排，
而不是凭感觉「做得高级一点」。

环境说明：本仓库只有 Remotion 自带的精简版 ffmpeg（无 scdet/metadata 滤镜、无 rawvideo
输出、连 fps 滤镜都没有），所以切点检测不走 ffmpeg 滤镜，而是**逐点抽帧 + PIL 比对**。

⚠️ 参考片只用于提取风格参数与选帧参考；其素材本身能否进交付物要单独走合规。
"""
import argparse, json, os, shutil, subprocess, glob
from PIL import Image, ImageStat


def find_ffmpeg():
    here = os.path.dirname(os.path.abspath(__file__))
    roots = [os.path.join(here, '../../../../remotion-terrain/node_modules'),
             os.path.join(os.getcwd(), 'node_modules'),
             os.path.join(os.getcwd(), 'remotion-terrain/node_modules')]
    for r in roots:
        for p in ('@remotion/compositor-linux-x64-gnu', '@remotion/compositor-linux-x64-musl'):
            f = os.path.join(r, p, 'ffmpeg')
            if os.path.exists(f):
                return os.path.abspath(f)
    return shutil.which('ffmpeg') or 'ffmpeg'


def probe(ff, src):
    out = subprocess.run([ff, '-i', src], capture_output=True, text=True).stderr
    dur, res, fps = None, '?', 0.0
    for line in out.splitlines():
        if 'Duration:' in line:
            h, m, s = line.split('Duration:')[1].split(',')[0].strip().split(':')
            dur = int(h) * 3600 + int(m) * 60 + float(s)
        if 'Video:' in line:
            for tok in line.split(','):
                tok = tok.strip()
                head = tok.split(' ')[0]
                if 'x' in head and head.split('x')[0].isdigit():
                    res = head
                if tok.endswith('fps'):
                    try:
                        fps = float(tok.split()[0])
                    except ValueError:
                        pass
    if dur is None:
        raise SystemExit('读不出时长：' + src)
    return dur, res, fps


ap = argparse.ArgumentParser()
ap.add_argument('src')
ap.add_argument('--out', default='./style-ref')
ap.add_argument('--fps', type=float, default=4.0, help='抽帧密度，越高切点越准也越慢')
ap.add_argument('--cut', type=float, default=17.0, help='切点阈值：相邻帧平均通道差，越小越敏感')
a = ap.parse_args()

FF = find_ffmpeg()
os.makedirs(a.out, exist_ok=True)
tmp = os.path.join(a.out, '_frames')
os.makedirs(tmp, exist_ok=True)
for f in glob.glob(os.path.join(tmp, '*.jpg')):
    os.remove(f)

dur, res, fps = probe(FF, a.src)

# ── 1. 抽帧（精简版 ffmpeg 没有 fps 滤镜，只能逐点 -ss 抽）─────────────
step = 1.0 / a.fps
times = [i * step for i in range(int(dur / step))]
for i, t in enumerate(times):
    subprocess.run([FF, '-y', '-v', 'error', '-ss', f'{t:.3f}', '-i', a.src,
                    '-frames:v', '1', '-vf', 'scale=96:-1',
                    os.path.join(tmp, f'{i:05d}.jpg')], check=False)
files = sorted(glob.glob(os.path.join(tmp, '*.jpg')))
if len(files) < 2:
    raise SystemExit('抽帧失败，检查 ffmpeg 与输入文件')

# ── 2. 自动裁到「真正在动」的画面区 ───────────────────────────────────
# 竖屏录屏 / 信箱式的参考片，大半个画面是永远不变的黑边；不裁掉的话
# 相邻帧差会被稀释到检不出切点（第一次跑这脚本就栽在这儿）。
imgs = [Image.open(f).convert('RGB') for f in files]
W, H = imgs[0].size
grays = [im.convert('L').tobytes() for im in imgs]
step_s = max(1, len(grays) // 24)
sample = grays[::step_s]
var = bytearray(W * H)
for i in range(W * H):
    col = [g[i] for g in sample]
    var[i] = 1 if (max(col) - min(col)) > 18 else 0
rows = [y for y in range(H) if sum(var[y * W:(y + 1) * W]) > W * 0.05]
cols = [x for x in range(W) if sum(var[y * W + x] for y in range(H)) > H * 0.05]
if rows and cols and (len(rows) < H * 0.95 or len(cols) < W * 0.95):
    box = (cols[0], rows[0], cols[-1] + 1, rows[-1] + 1)
    imgs = [im.crop(box) for im in imgs]
    ACTIVE = {'x': box[0], 'y': box[1], 'w': box[2] - box[0], 'h': box[3] - box[1],
              '说明': '自动检出的实际画面区（源片带黑边/录屏 UI 时会小于整帧）'}
else:
    ACTIVE = None

# ── 2b. 逐帧比对找切点 ────────────────────────────────────────────────
diffs = []
for i in range(1, len(imgs)):
    p, q = imgs[i - 1], imgs[i]
    if p.size != q.size:
        q = q.resize(p.size)
    pb, qb = p.tobytes(), q.tobytes()
    diffs.append(sum(abs(x - y) for x, y in zip(pb, qb)) / len(pb))
cut_idx = [i + 1 for i, d in enumerate(diffs) if d > a.cut]

bounds = [0.0] + [times[i] for i in cut_idx if i < len(times)] + [dur]
shots = []
for i in range(len(bounds) - 1):
    ln = bounds[i + 1] - bounds[i]
    if ln > 0.25:
        shots.append({'start': round(bounds[i], 2), 'len': round(ln, 2)})

# ── 3. 每镜代表帧 ─────────────────────────────────────────────────────
for f in glob.glob(os.path.join(a.out, 'shot-*.jpg')):
    os.remove(f)
MAX = 40
picked = shots if len(shots) <= MAX else shots[:: max(1, len(shots) // MAX)]
for i, s in enumerate(picked):
    t = s['start'] + s['len'] * 0.45
    subprocess.run([FF, '-y', '-v', 'error', '-ss', f'{t:.3f}', '-i', a.src,
                    '-frames:v', '1', '-vf', 'scale=480:-1',
                    os.path.join(a.out, f'shot-{i:02d}.jpg')], check=False)

# ── 4. 色板 + 明暗 ────────────────────────────────────────────────────
n = min(len(imgs), 60)
sheet = Image.new('RGB', (96 * n, 54))
for i, im in enumerate(imgs[:n]):
    sheet.paste(im.resize((96, 54)), (96 * i, 0))
pal_img = sheet.quantize(colors=10, method=Image.MEDIANCUT).convert('RGB')
pal = sorted({pal_img.getpixel((x, 27)) for x in range(0, pal_img.width, 7)})
palette = ['#%02x%02x%02x' % c for c in pal][:10]

ys = [ImageStat.Stat(im.convert('L')).mean[0] for im in imgs]
yavg = sum(ys) / len(ys)

lens = sorted(s['len'] for s in shots)


def pct(p):
    return round(lens[min(len(lens) - 1, int(len(lens) * p))], 2) if lens else 0


spec = {
    'source': os.path.basename(a.src),
    'duration': round(dur, 2), 'fps': fps, 'resolution': res,
    '实际画面区': ACTIVE,
    '剪辑节奏': {
        '镜头数': len(shots),
        '平均镜头时长': round(sum(lens) / len(lens), 2) if lens else 0,
        '中位数': pct(0.5), 'p10': pct(0.1), 'p90': pct(0.9),
        '最短': lens[0] if lens else 0, '最长': lens[-1] if lens else 0,
        '每分钟切点数': round(len(shots) / (dur / 60), 1),
    },
    '色板': palette,
    '明暗': {'YAVG': round(yavg, 1), '偏暗帧占比': round(sum(1 for y in ys if y < 90) / len(ys), 3)},
    '镜头表': shots,
    '用法提示': [
        '「平均镜头时长」与「每分钟切点数」直接用作动画分镜的节奏基准',
        '色板用于校对我们的 NIO token 与参考片是否同调；差异大说明参考片做了调色，不要直接照搬',
        'shot-*.jpg 是每镜代表帧，用来定景别、构图与字幕位置',
        '⚠️ 参考片素材本身能否进交付物要单独走合规，本脚本只提取风格参数',
    ],
}
with open(os.path.join(a.out, 'style-spec.json'), 'w') as f:
    json.dump(spec, f, ensure_ascii=False, indent=2)
shutil.rmtree(tmp, ignore_errors=True)

r = spec['剪辑节奏']
print(f"✅ {spec['source']}  {res} · {spec['duration']}s · {fps}fps")
print(f"   镜头 {r['镜头数']} 个，平均 {r['平均镜头时长']}s"
      f"（中位 {r['中位数']}s，p10 {r['p10']} / p90 {r['p90']}），每分钟 {r['每分钟切点数']} 切")
print(f"   色板 {' '.join(palette)}")
print(f"   YAVG {spec['明暗']['YAVG']}，偏暗帧占比 {spec['明暗']['偏暗帧占比']}")
print(f"   → {os.path.join(a.out, 'style-spec.json')}，代表帧 {len(picked)} 张")
