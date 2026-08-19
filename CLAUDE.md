# NIO-Animation · 冷启动指南

蔚来功能演示动画仓库：用 `.claude/skills/remotion/` 这套 skill 把车辆功能
做成用户教育动画，交付可发链接的单文件交互 HTML 与飞书用 GIF。

## 新会话先做三件事

1. 读 `.claude/skills/remotion/references/hard-rules.md`——全部强制规则的
   一页清单。方法论细节在 `.claude/skills/remotion/SKILL.md`。
2. 认路（四块边界不要混）：

   | 路径 | 角色 |
   |---|---|
   | `photos/` | 素材原片 + `approved-asset-manifest.json` 授权登记（新素材必登记） |
   | `.claude/skills/remotion/` | 方法与产线：SKILL.md、脚本、车辆/宠物资产库 |
   | `animations/` | Remotion 工程源码（`src/*-entry.tsx` 各是一个交付页入口） |
   | `dist/` | 成品：自包含 HTML + 分镜表（MP4 不入库，按需现导） |

3. 跑 `bash .claude/skills/remotion/scripts/preflight.sh` 自检环境。
4. **跑 `python3 .claude/skills/remotion/scripts/update.py` 检查仓库更新。**

## 分支与发版

- **`main`**：稳定版。里程碑达成后从工作分支合并进来并打 tag（`v1.x.x`）。
  公司/外部 agent 消费这个分支，建议 `git clone --depth 1`。
- **工作分支**（当前 `claude/repository-identification-u5jo5v`）：日常开发、
  提交、推送都在这里；不经用户同意不动别的分支。

## 交付闭环（改完必须走完，不许停在中间）

```
改组件 → 断言/目检 → build-player.py 重打包 → assert-self-contained-html.mjs
→ 无头浏览器零报错 → Artifact 同址发布（带 url 参数）→ make-gif.py → 提交推送
```

HTML 里内联的是打包快照——源码改对了但没重跑 build-player，发出去的还是旧版，
这是本仓库返工率最高的一步。

## 素材纪律

- 资产**复制不引用**，canonical 在 `.claude/skills/remotion/assets/`，
  改素材必跑 `assert-assets-in-sync.py`。
- 大体积产物（MP4、源 PDF）不入库；新增大文件前先想想 clone 的人。

> 内部资料，请勿外传。含未发布功能的演示设计与 ES8/ES9 实拍素材。
