#!/usr/bin/env python3
"""照片抠形工具链 —— 把「描轮廓 → 内缩 → 体检」这套反复手写的流程固化成 CLI。

背景：用真实照片当动画主体时，要用 SVG <mask> 手描轮廓抠形。纯靠肉眼描会踩四个坑：
轮廓跳变台阶、裹进背景、切掉细长部件（灯条/行李架/下唇）、整圈背景渗出。
颜色启发式在明暗混合区（车头亮灯 + 暗格栅、尾灯光晕、地面反光）一定会骗你，
只靠 `lum < 固定阈值` 会把亮车灯判成背景、把地面光晕判成车身，然后「修好一处、改坏三处」。

推荐流程（每步对应一个子命令）：
  1. scan    逐行/逐列**自适应阈值**扫边界（该行两侧背景中位亮度 × 0.42），先看数列是否平滑单调
  2. bright  高亮特征扫描（lum > 150）定位灯带/棱线这类「设计线」——它们**就是**轮廓本身
  3. grid    数据可疑的区段（前脸、尾灯、后视镜）放大 N 倍 + 网格叠图，一格一格目视读数
  4. erode   多边形沿**内法线**整体内缩（不是按质心缩放，形状不规则会歪），
             支持**逐点不同的内缩距离**——车头段要设 0.5，否则把灯条整个切掉
  5. bleed   无图渗出体检：统计 mask 内「高亮度 + 低饱和」像素占比，> 1.5% 报警
  6. encode  裁切 / 纵向归正 / 提亮 → JPEG base64 data URI（单文件 HTML 必须内联）
  7. preview mask 合成到纯色底 + 轮廓叠线，裁切成**一张**对比图查看（省 token）

依赖：Pillow、numpy。
"""

import argparse
import base64
import io
import json
import math
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance

# ---------------------------------------------------------------------------
# 公共工具
# ---------------------------------------------------------------------------

BG_RATIO = 0.42     # 自适应阈值系数：该行两侧背景中位亮度 × 系数 = 前景/背景分界
BRIGHT_LUM = 150.0  # 「设计线」高亮阈值（灯带/镀铬条/棱线）
BLEED_LUM = 150.0   # 渗出体检：多亮算「背景灰」
BLEED_SAT = 26.0    # 渗出体检：多低饱和算「背景灰」
BLEED_LIMIT = 1.5   # 渗出占比警戒线（%）


def load_rgb(path):
    return Image.open(path).convert('RGB')


def luminance(im):
    a = np.asarray(im).astype(np.float32)
    return 0.299 * a[:, :, 0] + 0.587 * a[:, :, 1] + 0.114 * a[:, :, 2]


def saturation(im):
    a = np.asarray(im).astype(np.float32)
    return a.max(2) - a.min(2)


def load_points(path):
    """点集文件：JSON [[x,y],...] 或 {"points":[[x,y],...],"erode":2 或 [每点距离]}"""
    with open(path, 'r', encoding='utf-8') as fh:
        data = json.load(fh)
    if isinstance(data, dict):
        pts = [(float(p[0]), float(p[1])) for p in data['points']]
        return pts, data.get('erode', 2.0)
    return [(float(p[0]), float(p[1])) for p in data], 2.0


def to_path(points, decimals=1):
    body = 'L'.join('%s,%s' % (round(x, decimals), round(y, decimals)) for x, y in points)
    return 'M' + body + 'Z'


def signed_area(poly):
    n = len(poly)
    return sum(poly[i][0] * poly[(i + 1) % n][1] - poly[(i + 1) % n][0] * poly[i][1]
               for i in range(n)) / 2.0


def erode_polygon(poly, dists):
    """沿内法线整体偏移。dists 可以是标量或逐点列表（长度必须等于点数）。

    为什么不按质心缩放：形状不规则时质心缩放会把轮廓「拧歪」，
    车头往里塌、车尾往外鼓。逐点取相邻两条边法线的平均方向才是真正的等距内缩。
    """
    n = len(poly)
    if isinstance(dists, (int, float)):
        dists = [float(dists)] * n
    if len(dists) != n:
        raise ValueError('erode 距离数量 %d 与点数 %d 不一致' % (len(dists), n))
    sgn = -1.0 if signed_area(poly) > 0 else 1.0

    def normal(ax, ay, bx, by):
        dx, dy = bx - ax, by - ay
        L = math.hypot(dx, dy) or 1.0
        return (dy / L, -dx / L)

    out = []
    for i in range(n):
        px, py = poly[i - 1]
        cx, cy = poly[i]
        nx, ny = poly[(i + 1) % n]
        n1 = normal(px, py, cx, cy)
        n2 = normal(cx, cy, nx, ny)
        vx, vy = n1[0] + n2[0], n1[1] + n2[1]
        L = math.hypot(vx, vy) or 1.0
        d = sgn * dists[i]
        out.append((cx + vx / L * d, cy + vy / L * d))
    return out


def polygon_mask(size, poly):
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).polygon([(float(x), float(y)) for x, y in poly], fill=255)
    return m


# ---------------------------------------------------------------------------
# scan：逐行/逐列自适应阈值扫边界
# ---------------------------------------------------------------------------

def cmd_scan(a):
    im = load_rgb(a.image)
    lum = luminance(im)
    if a.axis == 'col':
        lum = lum.T
    n_lines, n_span = lum.shape
    lo = a.start if a.start is not None else 0
    hi = a.end if a.end is not None else n_lines
    pad = a.bg_pad

    print('# %s 自适应阈值扫描  系数=%.2f  背景采样带=%dpx' % (a.axis, a.ratio, pad))
    print('# %-6s %8s %8s %9s %7s' % ('idx', 'first', 'last', 'thresh', 'width'))
    prev = None
    for i in range(lo, hi, a.step):
        row = lum[i]
        left_bg = np.median(row[:pad])
        right_bg = np.median(row[-pad:])
        thr = max(left_bg, right_bg) * a.ratio
        fg = np.where(row < thr)[0] if not a.bright_subject else np.where(row > thr)[0]
        if len(fg) == 0:
            print('  %-6d %8s %8s %9.1f %7s' % (i, '-', '-', thr, '-'))
            prev = None
            continue
        first, last = int(fg[0]), int(fg[-1])
        jump = ''
        if prev is not None and (abs(first - prev[0]) > a.jump or abs(last - prev[1]) > a.jump):
            jump = '  <-- 跳变，此段改用 grid 目视读数'
        print('  %-6d %8d %8d %9.1f %7d%s' % (i, first, last, thr, last - first, jump))
        prev = (first, last)
    print('# 提示：数列应平滑单调。渐进误差（车头 0px、车尾 16px）要按位置分段修，')
    print('#       整体平移会把好的地方改坏。')


# ---------------------------------------------------------------------------
# bright：高亮特征扫描（找灯带 / 镀铬棱线这类「设计线」）
# ---------------------------------------------------------------------------

def cmd_bright(a):
    im = load_rgb(a.image)
    lum = luminance(im)
    if a.axis == 'col':
        lum = lum.T
    lo = a.start if a.start is not None else 0
    hi = a.end if a.end is not None else lum.shape[0]

    print('# 高亮特征扫描  lum > %.0f  axis=%s' % (a.threshold, a.axis))
    print('# 主体自身的硬特征优先于亮度边界：灯带/棱线/切边就是轮廓本身。')
    print('# 沿它的**外缘**走直线或缓弧，不要绕到光晕外面——否则会把没有圆角的车头描成圆角。')
    print('# %-6s %8s %8s %8s %8s' % ('idx', 'L_out', 'L_in', 'R_in', 'R_out'))
    mid = lum.shape[1] // 2
    for i in range(lo, hi, a.step):
        row = lum[i]
        li = np.where(row[:mid] > a.threshold)[0]
        ri = np.where(row[mid:] > a.threshold)[0]
        lo_out = int(li[0]) if len(li) else None
        lo_in = int(li[-1]) if len(li) else None
        ri_in = int(ri[0] + mid) if len(ri) else None
        ri_out = int(ri[-1] + mid) if len(ri) else None
        fmt = lambda v: '-' if v is None else str(v)
        print('  %-6d %8s %8s %8s %8s' % (i, fmt(lo_out), fmt(lo_in), fmt(ri_in), fmt(ri_out)))


# ---------------------------------------------------------------------------
# erode：多边形内缩（支持逐点距离）
# ---------------------------------------------------------------------------

def cmd_erode(a):
    poly, default_d = load_points(a.points)
    dists = default_d
    if a.dist is not None:
        dists = a.dist
    if a.segment:
        # --segment i0:i1:d 形式，可重复；用于「车头段只缩 0.5」这类逐点差异
        base = dists if isinstance(dists, list) else [float(dists)] * len(poly)
        base = list(base)
        for spec in a.segment:
            i0, i1, d = spec.split(':')
            for i in range(int(i0), int(i1)):
                base[i % len(poly)] = float(d)
        dists = base
    out = erode_polygon(poly, dists)
    path = to_path(out, a.decimals)
    xs = [p[0] for p in out]
    ys = [p[1] for p in out]
    if a.out:
        with open(a.out, 'w', encoding='utf-8') as fh:
            fh.write(path)
        print('已写出 %s' % a.out)
    else:
        print(path)
    per_pt = '逐点' if isinstance(dists, list) and len(set(dists)) > 1 else str(dists)
    print('# 点数 %d  内缩 %s  bbox (%.1f,%.1f)-(%.1f,%.1f)'
          % (len(out), per_pt, min(xs), min(ys), max(xs), max(ys)), file=sys.stderr)
    print('# ⚠️ 细长部件（灯条/行李架/下唇）所在段的内缩距离要单独调小到 0.5，'
          '统一 2px 会把它整条切掉。', file=sys.stderr)


# ---------------------------------------------------------------------------
# bleed：无图渗出体检
# ---------------------------------------------------------------------------

def cmd_bleed(a):
    im = load_rgb(a.image)
    poly, _ = load_points(a.points)
    m = np.asarray(polygon_mask(im.size, poly)) > 128
    lum = luminance(im)
    sat = saturation(im)
    inside = m.sum()
    if inside == 0:
        print('❌ mask 内没有像素，检查点集坐标系是否与图片一致')
        return 1
    bg_like = ((lum > a.lum) & (sat < a.sat) & m).sum()
    pct = bg_like / inside * 100.0
    print('mask 内像素 %d   「高亮+低饱和」占比 %.3f%%   警戒线 %.2f%%' % (inside, pct, a.limit))
    if pct > a.limit:
        print('❌ 还在裹背景：把轮廓再内缩 1–2px，或检查主体与地面接触处（最常见）')
        return 1
    print('✅ 无明显背景渗出')
    return 0


# ---------------------------------------------------------------------------
# grid：放大 N 倍 + 网格叠图（供目视读数）
# ---------------------------------------------------------------------------

def cmd_grid(a):
    im = load_rgb(a.image)
    box = (a.x0, a.y0,
           a.x1 if a.x1 is not None else im.width,
           a.y1 if a.y1 is not None else im.height)
    crop = im.crop(box)
    W, H = crop.size
    big = crop.resize((W * a.zoom, H * a.zoom), Image.LANCZOS)
    d = ImageDraw.Draw(big)
    step = a.grid * a.zoom
    for gx in range(0, W * a.zoom + 1, step):
        d.line([(gx, 0), (gx, H * a.zoom)], fill=(0, 255, 255), width=1)
        d.text((gx + 2, 2), str(box[0] + gx // a.zoom), fill=(255, 0, 255))
    for gy in range(0, H * a.zoom + 1, step):
        d.line([(0, gy), (W * a.zoom, gy)], fill=(0, 255, 255), width=1)
        d.text((2, gy + 2), str(box[1] + gy // a.zoom), fill=(255, 0, 255))
    if a.points:
        poly, _ = load_points(a.points)
        pts = [((x - box[0]) * a.zoom, (y - box[1]) * a.zoom) for x, y in poly]
        d.line(pts + [pts[0]], fill=(255, 96, 0), width=2)
    big.save(a.out)
    print('已写出 %s（%dx%d，放大 %d 倍，网格 %dpx / 原图坐标已标注）'
          % (a.out, big.width, big.height, a.zoom, a.grid))


# ---------------------------------------------------------------------------
# encode：裁切 / 纵向归正 / 提亮 → base64 data URI
# ---------------------------------------------------------------------------

def cmd_encode(a):
    im = load_rgb(a.image)
    box = (a.x0, a.y0,
           a.x1 if a.x1 is not None else im.width,
           a.y1 if a.y1 is not None else im.height)
    W = box[2] - box[0]
    H = round((box[3] - box[1]) * a.ky)
    crop = im.crop(box).resize((W, H), Image.LANCZOS)
    arr = np.power(np.asarray(crop).astype(np.float32) / 255.0, a.gamma)
    out = Image.fromarray((np.clip(arr, 0, 1) * 255).astype('uint8'))
    out = ImageEnhance.Contrast(out).enhance(a.contrast)
    out = ImageEnhance.Color(out).enhance(a.saturation)
    if a.png:
        out.save(a.png)
    buf = io.BytesIO()
    out.save(buf, 'JPEG', quality=a.quality, optimize=True)
    uri = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()
    with open(a.out, 'w', encoding='utf-8') as fh:
        fh.write(uri)
    print('资产 %dx%d  data URI %.1f KB → %s' % (W, H, len(uri) / 1024, a.out))
    if a.ky != 1.0:
        print('# 纵向归正系数 %.4f 已烘进重采样；渲染端只留一个 SCALE，'
              '不要在组件里再写第二个缩放' % a.ky)


# ---------------------------------------------------------------------------
# preview：mask 合成到纯色底 + 轮廓叠线（一张图看完，别反复整帧渲染）
# ---------------------------------------------------------------------------

def cmd_preview(a):
    im = load_rgb(a.image)
    poly, _ = load_points(a.points)
    m = polygon_mask(im.size, poly)
    bg = tuple(int(a.bg[i:i + 2], 16) for i in (1, 3, 5)) if a.bg.startswith('#') else (240, 250, 250)
    comp = Image.new('RGB', im.size, bg)
    comp.paste(im, (0, 0), m)
    if a.outline:
        d = ImageDraw.Draw(comp)
        d.line([(x, y) for x, y in poly] + [poly[0]], fill=(0, 255, 255), width=1)
    box = (a.x0, a.y0,
           a.x1 if a.x1 is not None else im.width,
           a.y1 if a.y1 is not None else im.height)
    comp = comp.crop(box)
    if a.zoom > 1:
        comp = comp.resize((comp.width * a.zoom, comp.height * a.zoom), Image.LANCZOS)
    comp.save(a.out)
    print('已写出 %s（%dx%d）' % (a.out, comp.width, comp.height))
    print('# 只看这一张：整帧 1080p 连看多张是主要的 token 成本来源')


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def build_parser():
    p = argparse.ArgumentParser(
        prog='cutout-trace.py',
        description='照片抠形工具链：扫边界 / 找设计线 / 内缩 / 渗出体检 / 网格读数 / 编码 / 预览',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    sub = p.add_subparsers(dest='cmd', required=True)

    s = sub.add_parser('scan', help='逐行/逐列自适应阈值扫边界（先看数列平不平滑）')
    s.add_argument('image')
    s.add_argument('--axis', choices=['row', 'col'], default='row')
    s.add_argument('--start', type=int, default=None, help='起始行/列')
    s.add_argument('--end', type=int, default=None)
    s.add_argument('--step', type=int, default=10, help='采样间隔（默认 10）')
    s.add_argument('--ratio', type=float, default=BG_RATIO,
                   help='阈值系数：两侧背景中位亮度 × ratio（默认 %.2f）' % BG_RATIO)
    s.add_argument('--bg-pad', type=int, default=12, help='两侧背景采样带宽度（px）')
    s.add_argument('--jump', type=float, default=12, help='相邻行跳变多少 px 就报警')
    s.add_argument('--bright-subject', action='store_true',
                   help='主体比背景亮时用（默认按「主体较暗」判定）')
    s.set_defaults(func=cmd_scan)

    b = sub.add_parser('bright', help='高亮特征扫描：定位灯带 / 棱线这类设计线')
    b.add_argument('image')
    b.add_argument('--axis', choices=['row', 'col'], default='row')
    b.add_argument('--start', type=int, default=None)
    b.add_argument('--end', type=int, default=None)
    b.add_argument('--step', type=int, default=4)
    b.add_argument('--threshold', type=float, default=BRIGHT_LUM,
                   help='亮度阈值（默认 %.0f）' % BRIGHT_LUM)
    b.set_defaults(func=cmd_bright)

    e = sub.add_parser('erode', help='多边形沿内法线整体内缩（支持逐点不同距离）')
    e.add_argument('points', help='JSON：[[x,y],...] 或 {"points":[...],"erode":2}')
    e.add_argument('--dist', type=float, default=None, help='统一内缩距离（覆盖文件里的 erode）')
    e.add_argument('--segment', action='append', metavar='i0:i1:d',
                   help='区段内缩距离，可重复。例：--segment 0:17:0.5（车头段只缩 0.5）')
    e.add_argument('--decimals', type=int, default=1)
    e.add_argument('--out', help='写出 SVG path 的文件；不给就打到 stdout')
    e.set_defaults(func=cmd_erode)

    bl = sub.add_parser('bleed', help='无图渗出体检：mask 内「高亮+低饱和」占比')
    bl.add_argument('image')
    bl.add_argument('points')
    bl.add_argument('--lum', type=float, default=BLEED_LUM)
    bl.add_argument('--sat', type=float, default=BLEED_SAT)
    bl.add_argument('--limit', type=float, default=BLEED_LIMIT, help='警戒线 %%（默认 1.5）')
    bl.set_defaults(func=cmd_bleed)

    g = sub.add_parser('grid', help='放大 N 倍 + 网格叠图，供目视读坐标')
    g.add_argument('image')
    g.add_argument('out')
    g.add_argument('--x0', type=int, default=0)
    g.add_argument('--y0', type=int, default=0)
    g.add_argument('--x1', type=int, default=None)
    g.add_argument('--y1', type=int, default=None)
    g.add_argument('--zoom', type=int, default=4, help='放大倍数（默认 4–5 倍）')
    g.add_argument('--grid', type=int, default=20, help='网格间距（原图 px，默认 20）')
    g.add_argument('--points', help='同时把当前轮廓叠上去')
    g.set_defaults(func=cmd_grid)

    en = sub.add_parser('encode', help='裁切 / 纵向归正 / 提亮 → base64 data URI')
    en.add_argument('image')
    en.add_argument('out', help='写出 data URI 的 txt')
    en.add_argument('--x0', type=int, default=0)
    en.add_argument('--y0', type=int, default=0)
    en.add_argument('--x1', type=int, default=None)
    en.add_argument('--y1', type=int, default=None)
    en.add_argument('--ky', type=float, default=1.0,
                    help='纵向归正系数：实测长宽比 ÷ 实车长宽比 的倒数（视频截帧常需要）')
    en.add_argument('--gamma', type=float, default=1.0, help='<1 提亮（暗底照片常用 0.46–0.62）')
    en.add_argument('--contrast', type=float, default=1.0)
    en.add_argument('--saturation', type=float, default=1.0)
    en.add_argument('--quality', type=int, default=84)
    en.add_argument('--png', help='同时存一张 PNG 供查看')
    en.set_defaults(func=cmd_encode)

    pv = sub.add_parser('preview', help='mask 合成到纯色底 + 轮廓叠线，裁一张对比图')
    pv.add_argument('image')
    pv.add_argument('points')
    pv.add_argument('out')
    pv.add_argument('--bg', default='#F0FAFA', help='合成底色（默认 NIO 浅底）')
    pv.add_argument('--outline', action='store_true', help='叠一圈轮廓线')
    pv.add_argument('--x0', type=int, default=0)
    pv.add_argument('--y0', type=int, default=0)
    pv.add_argument('--x1', type=int, default=None)
    pv.add_argument('--y1', type=int, default=None)
    pv.add_argument('--zoom', type=int, default=1)
    pv.set_defaults(func=cmd_preview)

    return p


def main():
    args = build_parser().parse_args()
    rc = args.func(args)
    sys.exit(rc or 0)


if __name__ == '__main__':
    main()
