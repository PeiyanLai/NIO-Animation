# Mermaid 实战避坑指南

流程图（flowchart）与时序图（sequenceDiagram）的稳定输出规则。违反其中任何一条都可能导致整图渲染为空白或布局混乱——**交付前必须本地渲染验证**。

## 选型

- `flowchart TD/TB` —— 用户/业务流程（节点 + 决策 + 分支）
- `sequenceDiagram` —— 系统间交互（API 调用、多方协议、数据交换）

## flowchart 稳定布局规则

- 用 `subgraph` 表示大阶段；子图内写 `direction LR` 或 `direction TB`
- **绝不写反向边**（后面的节点指回前面的），会打乱 dagre 布局——改为在节点文案里注明「↩ 回到 X」
- 主流程用 `-->`；条件/可选路径用 `-.->`（虚线）
- 节点 ID 短小、大写；跨子图的边写在**所有子图之后**；子图内部边写在子图**内部**
- 自环尽量避免，必须有时用虚线

## 禁用语法清单（逐条踩过坑）

| 禁用 | 原因 | 替代 |
|---|---|---|
| `A & B --> C` 合并边 | 部分版本不支持 | 拆成多行 |
| `==>` 粗箭头 | 与边标签组合时解析错误 | 一律 `-->` |
| 节点文本里的 `\n` | 语法错误 | 用 `<br/>` |
| 节点文本里的 `#` | 被当作 HEX 色前缀 | 写「No.」 |
| 节点标签里的 emoji | 部分渲染器崩坏 | 纯文本 |
| 文本中的裸 `&` | 实体解析 | 写 `&amp;` |

其他：中文引号安全，ASCII 双引号在带引号标签内要转义；JS 内嵌 mermaid 源码时先 `node --check` 校验脚本语法。

## sequenceDiagram 规则

- **每张图只放真正参与交互的 participant**——不活跃的系统不要出现（其生命线是纯噪音）
- **分支路径拆成多张图**，不要用带很多 participant 的 `alt/else`——Mermaid 会把所有生命线画穿所有分支
- `rect` 不要嵌进 `alt/else`（渲染 bug）；相位底色用 `rect rgba(...)` 写在 alt 之外
- `Note over X,Y:` 做阶段标注；`autonumber` 编号

**多图分支模式（推荐）**：共享前置段一张图，结尾 `Note` 指明「以下分支」；每条分支各一张图、只含该分支涉及的系统；每张图上方加一个着色小标题条区分路径。

## 渲染验证方法

```bash
npm i mermaid   # 二进制在包内，无需外网下载
# 把各 mermaid 代码块塞进 <pre class="mermaid">，用无头浏览器 mermaid.run() 渲染，
# 断言生成了 <svg> 且页面无 "Syntax error" 字样，截图人工过目
```

Artifact 环境原生渲染 ```mermaid 代码围栏（Markdown）与 `<pre class="mermaid">`（HTML），无需也不能外链 CDN。
