# 归档

这里是**早期版本**，已被 `dist/` 里的 Remotion 版取代。留着是为了追溯，不再维护。

## 早期单文件 SVG 动画（feature-animation skill 时代）

| 文件 | 被谁取代 |
|---|---|
| `index.html` | 平移泊入 **V1 示意版**：车轮画成 90° 横移，强调「整车平移」的概念 |
| `v2.html` | 平移泊入 V2 真实转角版 → `dist/parking-player.html` |
| `terrain-mode.html` | 全地形 → `dist/terrain-player.html` |
| `pet-mode.html` | 宠物模式 → `dist/pet-mode-player.html` |
| `team-radio.html` | 对讲机组队 → `dist/radio-player.html` |

⚠️ **`index.html`（泊车 V1）不要改动。** 它是当初对齐概念用的版本，
和后来按真实转角重做的 V2 是两种表达，保留原样。

## 流程图产物（flow-diagram skill）

| 文件 | 说明 |
|---|---|
| `team-flow.html` | 对讲机组队 · 交互用户流程图 |
| `team-flow-explorer.html` | 同上，可拖拽/可编辑的画布版 |
| `team-flow-mermaid.md` | Mermaid 源 |

## `skill-variants/`

`internal-no-video/feature-animation/` —— feature-animation skill 的一个变体
（去掉视频导出、只出 HTML）。现在这条产线已经并入 remotion skill，留作参考。
