#!/usr/bin/env python3
"""NIO-Animation skill 自动更新脚本。
用法：python3 update.py
每次使用 skill 前运行一次；没更新时秒回，有更新时自动替换并提示重读规则文件。
"""
import urllib.request, tarfile, io, os, json, shutil, sys, pathlib

# 仓库信息
REPO = 'PeiyanLai/NIO-Animation'
BRANCH = 'main'                      # 远端默认分支
API = f'https://api.github.com/repos/{REPO}'
UA = {'User-Agent': 'Mozilla/5.0'}

# 本 skill 目录（update.py 所在目录的上一级，即 remotion/）
SKILL_DIR = pathlib.Path(__file__).resolve().parent.parent
# 仓库根目录 = skill 目录向上三级（remotion -> skills -> .claude -> 仓库根）
REPO_ROOT = SKILL_DIR.parent.parent.parent
SHAF = REPO_ROOT / '.skill.sha'      # 记录上次同步的 SHA


def fetch(url, timeout=120, retries=5):
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA)
            r = urllib.request.urlopen(req, timeout=timeout)
            chunks = []
            while True:
                c = r.read(65536)
                if not c:
                    break
                chunks.append(c)
            return b''.join(chunks)
        except Exception as e:
            last = e
            print(f'  尝试 {i+1}/{retries} 失败: {e}')
            import time; time.sleep(3)
    raise last


def main():
    # 0. git 工作区保护：开发克隆用 git pull 更新,本脚本只服务 tarball 解压副本。
    #    没有这层保护的话,下面的替换会把 .git(全部历史)一起删掉。
    if (REPO_ROOT / '.git').exists():
        print(f'{REPO_ROOT} 是 git 工作区：请用 git pull 更新，本脚本不做替换')
        return

    # 1. 查远端 SHA
    sha = json.load(urllib.request.urlopen(
        urllib.request.Request(API + f'/branches/{BRANCH}', headers=UA),
        timeout=60))['commit']['sha']

    if SHAF.exists() and SHAF.read_text().strip() == sha:
        print(f'已是最新 ({sha[:9]})，无需更新')
        return

    # 2. 下载 tarball
    print('检测到更新，下载中...')
    data = fetch(API + f'/tarball/{BRANCH}')
    print(f'下载完成: {len(data)} bytes')

    # 3. 解压到临时目录
    tmp = str(REPO_ROOT) + '.new'
    shutil.rmtree(tmp, ignore_errors=True)
    os.makedirs(tmp)
    with tarfile.open(fileobj=io.BytesIO(data)) as tar:
        root = tar.getmembers()[0].name.split('/')[0]
        for m in tar.getmembers():
            rel = m.name[len(root)+1:]
            if not rel:
                continue
            m.name = rel
            tar.extract(m, tmp)

    # 4. 原子替换：先把旧副本挪到一边、新副本就位后才删——
    #    任何一步失败旧副本都还在,不会出现「删了旧的、新的没就位」的两头空。
    old = str(REPO_ROOT) + '.old'
    shutil.rmtree(old, ignore_errors=True)
    os.rename(str(REPO_ROOT), old)
    os.rename(tmp, str(REPO_ROOT))
    shutil.rmtree(old, ignore_errors=True)
    SHAF.write_text(sha)
    print(f'已更新到 {sha[:9]}')
    print('⚠️ 请重读 CLAUDE.md、hard-rules.md、SKILL.md 的交付形态章节')


if __name__ == '__main__':
    main()
