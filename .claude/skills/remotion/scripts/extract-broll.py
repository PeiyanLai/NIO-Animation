#!/usr/bin/env python3
"""从参考片里切出**可用作 B-roll 的镜头**，并逐镜给出可用性判定。

    python3 extract-broll.py <video.mp4> [--out DIR] [--fps 4] [--cut 17] [--min 1.2]

产出：
    <out>/broll-NN.mp4       每个镜头切出来的片段（原码率，未转码）
    <out>/broll-NN.jpg       代表帧
    <out>/broll-manifest.json  逐镜可用性判定 + 整体结论

判定的是三件事（决定这条片子能不能当素材，而不是只当参考）：

1. **有效分辨率**：录屏/信箱式素材的真实画面区往往远小于整帧。
   540×1170 的竖屏录屏里画面只有 540×310 —— 这个尺寸放进 1080p 成片就是糊的。
2. **静态叠加物**：角落里全片不变的亮块，基本就是水印/台标/账号号码。
   按素材合规规则，**带第三方水印的素材只能作参考，不能进交付物，也不许裁掉水印后使用**。
3. **镜头时长与明暗**：太短的切不出可用片段；过暗的做底会压住叠加层。

⚠️ 本脚本只做技术判定。素材**授权**上能不能用（谁拍的、发布了没有、内部可用范围）
必须另外确认，并登记进 approved-asset-manifest.json。
"""
import argparse, json, os, shutil, subprocess, glob
from PIL import Image, ImageStat


def find_ffmpeg():
    here = os.path.dirname(os.path.abspath(__file__))
    roots = [os.path.join(here, '../../../../animations/node_modules'),
             os.path.join(os.getcwd(), 'node_modules'),
             os.path.join(os.getcwd(), 'animations/node_modules')]
    for r in roots:
        for p in ('@remotion/compositor-linux-x64-gnu', '@remotion/compositor-linux-x64-musl'):
            f = os.path.join(r, p, 'ffmpeg')
            if os.path.exists(f):
                return os.path.abspath(f)
    return shutil.which('ffmpeg') or 'ffmpeg'


def probe(ff, src):
    out = subprocess.run([ff, '-i', src], capture_output=True, text=True).stderr
    dur, res = None, '?'
    for line in out.splitlines():
        if 'Duration:' in line:
            h, m, s = line.split('Duration:')[1].split(',')[0].strip().split(':')
            dur = int(h) * 3600 + int(m) * 60 + float(s)
        if 'Video:' in line:
            for tok in line.split(','):
                head = tok.strip().split(' ')[0]
                if 'x' in head and head.split('x')[0].isdigit():
                    res = head
    if dur is None:
        raise SystemExit('读不出时长：' + src)
    return dur, res


ap = argparse.ArgumentParser()
ap.add_argument('src')
ap.add_argument('--out', default='./broll')
ap.add_argument('--fps', type=float, default=4.0)
ap.add_argument('--cut', type=float, default=17.0)
ap.add_argument('--min', type=float, default=1.2, help='短于这个秒数的镜头不切')
a = ap.parse_args()

FF = find_ffmpeg()
os.makedirs(a.out, exist_ok=True)
tmp = os.path.join(a.out, '_frames')
os.makedirs(tmp, exist_ok=True)
for f in glob.glob(os.path.join(tmp, '*.jpg')):
    os.remove(f)

dur, res = probe(FF, a.src)
FW, FH = (int(v) for v in res.split('x')) if 'x' in res else (0, 0)

# ── 抽帧 ──────────────────────────────────────────────────────────────
step = 1.0 / a.fps
times = [i * step for i in range(int(dur / step))]
for i, t in enumerate(times):
    subprocess.run([FF, '-y', '-v', 'error', '-ss', f'{t:.3f}', '-i', a.src,
                    '-frames:v', '1', '-vf', 'scale=160:-1',
                    os.path.join(tmp, f'{i:05d}.jpg')], check=False)
files = sorted(glob.glob(os.path.join(tmp, '*.jpg')))
if len(files) < 2:
    raise SystemExit('抽帧失败')
imgs = [Image.open(f).convert('RGB') for f in files]
W, H = imgs[0].size
grays = [im.convert('L').tobytes() for im in imgs]
sample = grays[:: max(1, len(grays) // 24)]

# ── 变化图：既用来定活动区，也用来找静态叠加物 ────────────────────────
moving = bytearray(W * H)
for i in range(W * H):
    col = [g[i] for g in sample]
    moving[i] = 1 if (max(col) - min(col)) > 18 else 0

rows = [y for y in range(H) if sum(moving[y * W:(y + 1) * W]) > W * 0.05]
cols = [x for x in range(W) if sum(moving[y * W + x] for y in range(H)) > H * 0.05]
if rows and cols:
    box = (cols[0], rows[0], cols[-1] + 1, rows[-1] + 1)
else:
    box = (0, 0, W, H)
sx, sy = FW / W if W else 1, FH / H if H else 1
active = {'x': round(box[0] * sx), 'y': round(box[1] * sy),
          'w': round((box[2] - box[0]) * sx), 'h': round((box[3] - box[1]) * sy)}

# 静态叠加物：活动区四角内，全片不变且明显亮于/暗于邻域的块
mean_img = imgs[len(imgs) // 2]
marks = []
qw, qh = max(8, (box[2] - box[0]) // 4), max(8, (box[3] - box[1]) // 4)
corners = {
    '左上': (box[0], box[1]), '右上': (box[2] - qw, box[1]),
    '左下': (box[0], box[3] - qh), '右下': (box[2] - qw, box[3] - qh),
}
for name, (cx, cy) in corners.items():
    still = tot = 0
    for y in range(cy, min(cy + qh, box[3])):
        for x in range(cx, min(cx + qw, box[2])):
            tot += 1
            if not moving[y * W + x]:
                still += 1
    if tot == 0:
        continue
    ratio = still / tot
    patch = mean_img.crop((cx, cy, min(cx + qw, box[2]), min(cy + qh, box[3])))
    around = ImageStat.Stat(mean_img.crop(box).convert('L')).mean[0]
    here = ImageStat.Stat(patch.convert('L')).mean[0]
    # 角落几乎全静止、且亮度明显不同于全片均值 → 疑似水印/台标
    if ratio > 0.93 and abs(here - around) > 12:
        marks.append({'位置': name, '静止占比': round(ratio, 3),
                      '亮度差': round(here - around, 1)})

# ── 切点 → 镜头 ───────────────────────────────────────────────────────
crop = [im.crop(box) for im in imgs]
diffs = []
for i in range(1, len(crop)):
    pb, qb = crop[i - 1].tobytes(), crop[i].tobytes()
    diffs.append(sum(abs(x - y) for x, y in zip(pb, qb)) / len(pb))
cuts = [i + 1 for i, d in enumerate(diffs) if d > a.cut]
bounds = [0.0] + [times[i] for i in cuts if i < len(times)] + [dur]

shots = []
for i in range(len(bounds) - 1):
    ln = bounds[i + 1] - bounds[i]
    if ln >= a.min:
        shots.append({'start': round(bounds[i], 2), 'len': round(ln, 2)})

# ── 切片 + 逐镜判定 ───────────────────────────────────────────────────
for f in glob.glob(os.path.join(a.out, 'broll-*')):
    os.remove(f)
usable_h = active['h']
clips = []
for i, s in enumerate(shots):
    base = os.path.join(a.out, f'broll-{i:02d}')
    subprocess.run([FF, '-y', '-v', 'error', '-ss', f"{s['start']:.3f}", '-i', a.src,
                    '-t', f"{s['len']:.3f}", '-c', 'copy', base + '.mp4'], check=False)
    subprocess.run([FF, '-y', '-v', 'error', '-ss', f"{s['start'] + s['len'] * 0.45:.3f}",
                    '-i', a.src, '-frames:v', '1', '-vf', 'scale=480:-1', base + '.jpg'],
                   check=False)
    k0 = int(s['start'] / step)
    k1 = min(len(crop) - 1, int((s['start'] + s['len']) / step))
    ys = [ImageStat.Stat(crop[k].convert('L')).mean[0] for k in range(k0, k1 + 1)] or [0]
    y = sum(ys) / len(ys)
    reasons = []
    if usable_h < 720:
        reasons.append(f"有效画面仅 {active['w']}×{active['h']}，放进 1080p 会糊")
    if marks:
        reasons.append('检出静态叠加物（疑似水印/台标）')
    if y < 25:
        reasons.append(f'过暗（Y={y:.0f}），做底会压住叠加层')
    clips.append({
        'file': os.path.basename(base) + '.mp4',
        'start': s['start'], 'len': s['len'], 'Y': round(y, 1),
        '可作 B-roll': not reasons,
        '不可用原因': reasons,
    })

manifest = {
    'source': os.path.basename(a.src),
    'duration': round(dur, 2), 'resolution': res,
    '有效画面区': active,
    '静态叠加物': marks,
    '镜头数': len(shots),
    '可用镜头数': sum(1 for c in clips if c['可作 B-roll']),
    'clips': clips,
    '结论': (
        '❌ 只能作风格参考，不能进交付物' if (marks or usable_h < 720)
        else '✅ 技术上可作 B-roll —— 授权仍需另行确认并登记 approved-asset-manifest.json'
    ),
    '提醒': [
        '带第三方水印的素材不得进交付物，也不许裁掉水印后使用',
        '技术可用 ≠ 授权可用：谁拍的、发布了没有、内部可用范围，必须另外确认',
        '若只能作参考，仍可用 analyze-reference-video.py 提取风格参数对齐节奏与配色',
    ],
}
with open(os.path.join(a.out, 'broll-manifest.json'), 'w') as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)
shutil.rmtree(tmp, ignore_errors=True)

print(f"{manifest['source']}  整帧 {res} · 有效画面区 {active['w']}×{active['h']}")
print(f"  镜头 {len(shots)} 个，技术上可用 {manifest['可用镜头数']} 个")
if marks:
    print('  ⚠️ 静态叠加物：' + '、'.join(f"{m['位置']}(静止 {m['静止占比']})" for m in marks))
print('  ' + manifest['结论'])
print(f"  → {os.path.join(a.out, 'broll-manifest.json')}")
