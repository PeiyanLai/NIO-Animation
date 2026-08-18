#!/usr/bin/env python3
"""判定一张「俯视图 / 侧视图」是不是**正投影**，够不够格当动画贴图。

    python3 assert-orthographic.py <图> --len-mm 5280 --wid-mm 2010 --wb-mm 3130
    # 自动量不出来时（深色背景 + 深色车），改用放大读数手工给：
    python3 assert-orthographic.py --len-mm 5365 --wid-mm 2029 --wb-mm 3250 \
        --len-px 676 --wid-px 256 --wb-px 409.7

## 为什么需要

拿到一张自称「正俯视图」的照片，很可能其实是**从车斜上方拍的**。
肉眼容易漏判，但代价很大：**透视图不能在平面内旋转**——泊车这类动画里车要转角，
一转，画面上那些本不该看见的垂直面（尾门、前脸）就会跟着甩，物理上不可能。
而且透视**不能靠拉伸校正**，拉了只是把透视图拉变形。

## 两个判据，必须都过

1. **长宽比**：`量得的 L/W` 对 `实车 L/W`。偏差 > 3% 就说明尺度不对。
2. **轴距/车长比**：`量得的 WB/L` 对 `实车 WB/L`。
   **这一条才是关键**——如果只是均匀缩放（视频截帧常见），长度和轴距同比缩，
   这个比值**不变**；它一旦也偏了，就是真透视，拉伸救不回来。

实测：ES8 那张「正俯视图」L/W 偏 −11.5%、WB/L 偏 −16.3% → 两条都偏，透视，判废。
对照：ES9 现用的那张归正后 L/W 偏 −0.4%、WB/L 偏 +0.0% → 两条都过。

⚠️ **自动量只在干净背景上可信**。ES9 那张是深色沥青上的深色车，四角离散度 93、
主体占比 0% —— 脚本会直接拒绝，而不是给出一组看着像模像样的假数。
这种时候用 `cutout-trace.py grid` 放大读出像素值，再手工传进来。

## 还要看一眼

数值之外，**放大看车头车尾**：正投影看不到任何垂直面。
能看见完整的尾门立面 / 前脸格栅，就已经判定了，不用算。
"""
import argparse, sys

import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('image', nargs='?')
ap.add_argument('--len-mm', type=float, required=True, help='实车车长 mm')
ap.add_argument('--wid-mm', type=float, required=True, help='实车车宽 mm')
ap.add_argument('--wb-mm', type=float, help='实车轴距 mm；给了才做第二条判据')
ap.add_argument('--axis', default='v', choices=['v', 'h'], help='车身长度方向：v=纵向，h=横向')
ap.add_argument('--tol', type=float, default=3.0, help='允许偏差 %%')
# 自动量不准时手工给（从 grid 放大读数得到）。给了就不看图。
ap.add_argument('--len-px', type=float)
ap.add_argument('--wid-px', type=float)
ap.add_argument('--wb-px', type=float)
a = ap.parse_args()

if a.len_px and a.wid_px:
    L, W, wb = a.len_px, a.wid_px, a.wb_px
    print(f'手工给定：车长 {L:g}px  车宽 {W:g}px' + (f'  轴距 {wb:g}px' if wb else ''))
else:
    if not a.image:
        sys.exit('要么给图，要么给 --len-px/--wid-px（可选 --wb-px）')
    lum = np.asarray(Image.open(a.image).convert('RGB')).astype(float).mean(2)
    if a.axis == 'h':
        lum = lum.T
    H, Wq = lum.shape
    # 背景从四角估（亮底暗底通吃），主体 = 偏离背景超过 delta
    corner = np.concatenate([lum[:8, :8].ravel(), lum[:8, -8:].ravel(),
                             lum[-8:, :8].ravel(), lum[-8:, -8:].ravel()])
    bg = float(np.median(corner))
    spread = float(np.percentile(corner, 90) - np.percentile(corner, 10))
    delta = max(30.0, spread * 2)
    body = np.abs(lum - bg) > delta
    frac = body.mean()
    print(f'背景估计 {bg:.0f}（四角离散度 {spread:.0f}）  主体占比 {frac:.1%}')
    if spread > 45 or not (0.05 < frac < 0.75):
        sys.exit('❌ 背景不干净或主体分不出来（深色背景 + 深色车最常见）。\n'
                 '   别信自动量的数——改用 cutout-trace.py grid 放大读出车长/车宽/轴距，\n'
                 '   再用 --len-px --wid-px --wb-px 传进来。')
    rows = [(y, np.nonzero(body[y])[0]) for y in range(H)]
    rows = [(y, r) for y, r in rows if len(r)]
    L = rows[-1][0] - rows[0][0] + 1
    W = max(r.max() - r.min() + 1 for _, r in rows)
    print(f'量得：车长 {L}px  车宽 {W}px（含后视镜）')
    wb = None
    if a.wb_mm:
        tire = np.abs(lum - bg) > delta * 2.2      # 轮胎比车身更暗
        y0 = rows[0][0]
        seg = lambda lo, hi: np.nonzero(tire[int(lo):int(hi)])[0]
        fy, ry = seg(y0 + L * 0.13, y0 + L * 0.40), seg(y0 + L * 0.62, y0 + L * 0.90)
        if len(fy) and len(ry):
            wb = (ry.mean() + y0 + L * 0.62) - (fy.mean() + y0 + L * 0.13)

fails = []
ratio, want = L / W, a.len_mm / a.wid_mm
d1 = ratio / want - 1
print(f'① 长宽比 {ratio:.3f}  实车 {want:.3f}  偏差 {d1:+.1%}  '
      + ('✅' if abs(d1) * 100 <= a.tol else '❌'))
if abs(d1) * 100 > a.tol:
    fails.append('长宽比')

d2 = None
if a.wb_mm and wb:
    r2, w2 = wb / L, a.wb_mm / a.len_mm
    d2 = r2 / w2 - 1
    print(f'② 轴距/车长 {r2:.3f}  实车 {w2:.3f}  偏差 {d2:+.1%}  '
          + ('✅' if abs(d2) * 100 <= a.tol else '❌')
          + '   ← 均匀缩放时这条不该偏')
    if abs(d2) * 100 > a.tol:
        fails.append('轴距/车长比')
elif a.wb_mm:
    print('② 轴距量不出来，跳过——**只过第一条判据不足以判定是正投影**')

print()
if not fails:
    print('✅ 可当正投影贴图用。')
elif fails == ['长宽比'] and d2 is not None:
    print(f'⚠️ 只有长宽比偏（{d1:+.1%}）→ **非均匀缩放**，不是透视。')
    print(f'   可以救：把长度方向按 ×{1 / (1 + d1):.4f} 归正后再抠形。')
else:
    print(f'❌ {" 和 ".join(fails)}都偏 → **真透视，判废**。')
    print('   拉伸校正救不回来（拉了只是把透视图拉变形），也不能在平面内旋转。')
    print('   只能登记为 reference-only：读造型、读灯语，不直接贴图。')
    sys.exit(1)
