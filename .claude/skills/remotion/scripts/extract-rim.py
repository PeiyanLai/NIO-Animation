#!/usr/bin/env python3
"""从正侧视车身照片里抠出**可旋转的轮辋圆盘**。

    python3 extract-rim.py side.png --centers 195,318 770,318 --radius 62 \
        --out src/wheel-photo.ts

## 解决什么问题

用真实照片当车身时，轮子是**贴死在图里的**——车一开就成了滑行，一眼假。
过去的做法是在车身遮罩上挖出轮拱洞，另画一套矢量轮。但手画的轮毂在孔形、
质感、中心盖 Logo 上永远比不过照片，观感明显降一档。

更好的做法：**车身遮罩不挖洞**（让照片自己的轮胎露出来），只把**轮辋圆盘**
单独抠成带 alpha 的图，叠在车身之上按滚动距离旋转。

为什么只转轮辋就够：轮胎是黑橡胶，转与不转肉眼分辨不出；而圆盘边界正好落在
轮辋与胎圈的交界处，**暗对暗，接缝看不见**。

## 用的时候还要做两件事

1. **圆盘要跟着车身一起浮动**。车身通常有个 bob 微浮动，轮辋叠在上层，
   y 必须带上同一个 bob，否则会看到轮子在车身里上下窜。
2. **叠一层不旋转的穹面高光**（`url(#rimDome)` 那类径向渐变，opacity 0.5）。
   照片轮辋自带的高光会跟着转，高速滚动时有频闪感；压一层固定光源的高光就稳了。

## 半径怎么量

用 `cutout-trace.py grid --zoom 5 --grid 10` 放大读**轮辋外缘**（亮轮辐外侧那圈暗
轮辋唇的外边界），不要读到轮胎上。前后轮通常同尺寸，但各抠各的能保留各自的光照。
"""
import argparse, base64, io, os

from PIL import Image, ImageDraw

ap = argparse.ArgumentParser()
ap.add_argument('image', help='正侧视车身照片（与 CAR_BODY 同一坐标系）')
ap.add_argument('--centers', nargs='+', required=True, metavar='X,Y',
                help='轮心，照片坐标，按前→后顺序，如 195,318 770,318')
ap.add_argument('--radius', type=float, required=True, help='轮辋半径（照片 px）')
ap.add_argument('--names', nargs='+', default=None, help='导出常量后缀，默认 F R')
ap.add_argument('--out', required=True, help='输出 .ts')
a = ap.parse_args()

names = a.names or ['F', 'R', 'C', 'D'][:len(a.centers)]
assert len(names) == len(a.centers), '--names 数量要和 --centers 一致'

im = Image.open(a.image).convert('RGB')
R = int(round(a.radius))
lines = []
for name, c in zip(names, a.centers):
    cx, cy = (float(v) for v in c.split(','))
    box = (int(cx) - R, int(cy) - R, int(cx) + R, int(cy) + R)
    if box[0] < 0 or box[1] < 0 or box[2] > im.width or box[3] > im.height:
        raise SystemExit(f'轮心 {c} 半径 {R} 超出图幅 {im.size}')
    disc = im.crop(box).convert('RGBA')
    # 圆形 alpha：4 倍超采样再缩回，边缘才不会有锯齿
    m = Image.new('L', (2 * R * 4, 2 * R * 4), 0)
    ImageDraw.Draw(m).ellipse([0, 0, 2 * R * 4 - 1, 2 * R * 4 - 1], fill=255)
    disc.putalpha(m.resize((2 * R, 2 * R), Image.LANCZOS))
    buf = io.BytesIO()
    disc.save(buf, 'PNG', optimize=True)
    uri = base64.b64encode(buf.getvalue()).decode()
    lines.append(f"export const RIM_{name}_URI = 'data:image/png;base64,{uri}';")
    print(f'  RIM_{name}  中心({cx:g},{cy:g})  {2*R}x{2*R}  {len(uri)/1024:.1f} KB')

hdr = f'''// 可旋转轮辋圆盘（从正侧视照片抠出，PNG 带 alpha）
//
// 车身遮罩**不要挖轮拱洞**——让照片自己的轮胎露出来，这两张只叠轮辋。
// 圆盘 y 必须带上车身的 bob；上面再叠一层不旋转的穹面高光压住转动的高光。
// 标定：轮心 {" ".join(a.centers)}，轮辋半径 {a.radius:g}（照片坐标）。

'''
with open(a.out, 'w', encoding='utf-8') as fh:
    fh.write(hdr + '\n'.join(lines) + f'\nexport const RIM_PHOTO_R = {a.radius:g};\n')
print(f'✅ {a.out}  {os.path.getsize(a.out)/1024:.0f} KB')
