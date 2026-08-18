#!/usr/bin/env python3
"""校验**资产库**与**已交付动画工程**里的同一份素材没有走样。

    python3 assert-assets-in-sync.py --project remotion-terrain

## 为什么需要

资产库是「复制不要引用」的——动画工程各自持有一份拷贝。好处是 skill 更新不会
改坏旧动画，代价是**两边会各自往前走**：在工程里改了轮廓/贴图/灯带，忘了同步回
资产库，下一个功能从资产库起手就拿到了旧版，于是同一台车在不同动画里又长得不一样了。

这种漂移**肉眼发现不了**（base64 有几万字符，轮廓是几百个数字），只能靠比对。

## 判定

逐项比 md5。不一致时**不自动覆盖**——两边都可能是新的，得人来判断哪边对，
脚本只负责把不一致点指出来。
"""
import argparse, hashlib, os, re, sys

ap = argparse.ArgumentParser()
ap.add_argument('--project', default='remotion-terrain')
ap.add_argument('--assets', default=os.path.join(os.path.dirname(__file__), '..', 'assets', 'vehicles'))
a = ap.parse_args()

PROJ = os.path.abspath(a.project)
AST = os.path.abspath(a.assets)


def read(p):
    try:
        return open(p, encoding='utf-8').read()
    except OSError:
        return None


def grab(path, pattern, label):
    """按正则抓一段内容；抓不到就报错退出——静默跳过等于校验形同虚设"""
    s = read(path)
    if s is None:
        return None, f'文件不存在：{path}'
    m = re.search(pattern, s, re.S)
    if not m:
        return None, f'在 {os.path.basename(path)} 里匹配不到 /{pattern[:40]}…/'
    return m.group(1), None


# (说明, 工程文件, 工程正则, 资产库文件, 资产库正则)
CHECKS = [
    ('ES9 正侧视 · 照片', 'src/photo.ts', r"base64,([A-Za-z0-9+/=]+)",
     'es9/side.ts', r"base64,([A-Za-z0-9+/=]+)"),
    ('ES9 正侧视 · 车身轮廓', 'src/data.ts', r"CAR_BODY =\s*\n?\s*'([^']+)'",
     'es9/side.ts', r"ES9_SIDE_BODY =\s*\n?\s*'([^']+)'"),
    ('ES9 正侧视 · 前轮辋', 'src/wheel-photo.ts', r"RIM_F_URI = 'data:image/png;base64,([A-Za-z0-9+/=]+)'",
     'es9/side-rim.ts', r"ES9_RIM_FRONT = 'data:image/png;base64,([A-Za-z0-9+/=]+)'"),
    ('ES9 正俯视 · 照片', 'src/es9-top-photo.ts', r"base64,([A-Za-z0-9+/=]+)",
     'es9/top.ts', r"base64,([A-Za-z0-9+/=]+)"),
    ('ES9 正俯视 · 车身轮廓', 'src/parking-data.ts', r"CAR_TOP_BODY =\s*\n?\s*'([^']+)'",
     'es9/top.ts', r"ES9_TOP_BODY =\s*\n?\s*'([^']+)'"),
    ('ES9 正俯视 · 大灯', 'src/parking-data.ts', r"left: \{\s*case: '([^']+)'",
     'es9/top.ts', r"left: \{\s*case: '([^']+)'"),
]

bad = 0
for label, pf, pr, af, ar in CHECKS:
    pv, pe = grab(os.path.join(PROJ, pf), pr, label)
    av, ae = grab(os.path.join(AST, af), ar, label)
    if pe or ae:
        print(f'❌ {label}：{pe or ae}')
        bad += 1
        continue
    h = lambda v: hashlib.md5(v.encode()).hexdigest()[:10]
    if pv == av:
        print(f'✅ {label}  {h(pv)}  ({len(pv)} 字符)')
    else:
        print(f'❌ {label}  工程={h(pv)}({len(pv)})  资产库={h(av)}({len(av)})')
        bad += 1

print()
if bad:
    print(f'{bad} 项不一致。**不要直接覆盖**——两边都可能是新的，先确认哪一版是对的，')
    print('再把对的那份同步过去，并说明改了什么。')
    sys.exit(1)
print('资产库与工程一致。')
