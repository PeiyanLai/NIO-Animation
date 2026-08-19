# 交付产物

都是**单文件自包含** HTML（贴图 base64 内联、无外链），可直接发链接、下载后离线打开。
点画面暂停/继续，顶部 chips 切章节。

| 文件 | 功能 | 章节 |
|---|---|---|
| `terrain-player.html` | 全地形模式 | 自动识别一键开启 · 行驶中切换 · 五种地形 |
| `parking-player.html` | 平移泊入（四轮转向） | 车尾已入位摆正车头 · 车身平行半入位平移 |
| `radio-player.html` | 对讲机组队 | 组队对讲 · 无网硬件接力 · 朋友的车 App 入队 · 混合车队队形 |
| `ramp-player.html` | 宠物上下车斜坡架 | 打开后备箱 · 装架 · 展开 · 狗上车 |
| `bag-player.html` | 灵动宠物包 | 放置 · 锁定 · 栓扣活动范围 · 解锁取出 |
| `pet-mode-player.html` | 宠物模式 | 座舱俯视示意 |

## 分镜

| 文件 | 说明 |
|---|---|
| `ramp-shotlist.md` / `bag-shotlist.md` | 实拍分镜表（`make-shotlist.mjs` 生成） |

MP4 成片**不入库**（体积原因，2026-08-19 起）——需要时用
`npx remotion render` 现导，产线见 SKILL.md「MP4 导出」节。

**分镜表里的 `conceptualItems` 是开拍前必须归零的清单**——概念件可以画，但拍不出来。

## 重新生成

```bash
python3 .claude/skills/remotion/scripts/build-player.py src/<功能>-entry.tsx dist/<功能>-player.html
```

改了组件或素材**必须重跑**：HTML 里内联的是打包快照，不会跟着源码自己更新。
这是最容易忘的一步——源码改对了、还渲了 still 验证过，但发出去的链接还是旧的。
