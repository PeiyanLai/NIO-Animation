# 飞书文档交付：把动画直接展现在飞书文档里

前提：**执行环境已打通飞书**（有飞书文档的 MCP 工具，或有 tenant token 可调 OpenAPI）。本文只定义"文档怎么组织、动画用哪种块、素材怎么产"，具体调用以环境里实际可用的飞书工具为准——先列出可用工具再套本流程，不要凭空假设工具名。

## 动画进文档的三种方式（按直观程度排序）

| 方式 | 打开文档时的效果 | 适用 | 素材来源 |
|---|---|---|---|
| **GIF 图片块** | 自动循环播放，零点击 | ≤30s 循环演示，用户教育首选 | `render-video.mjs --gif` |
| **MP4 文件块** | 卡片内点击播放，高清可全屏 | 长动画、高清晰度要求、有声版本 | `render-video.mjs` |
| **iframe 内嵌网页块** | 完整交互（场景切换/双主题） | 有内网可访问的 HTML 托管地址时 | 交互 HTML 自行托管 |

注意：claude.ai Artifact 链接**通常不能**被 iframe 内嵌（需登录 + frame 限制），iframe 方式只在公司内网有托管位置时可用。

**推荐组合**：GIF 图片块（第一屏直接看懂）+ MP4 文件块（高清收藏/转发）+ 交互版链接文本（备用入口）。

## 文档结构模板

按此顺序生成块，分步说明与关键参数**从动画的场景配置和字幕文案里取**，保证文档与动画数字一致，不要另写一遍：

1. 文档标题：`<功能名> · 用户教育演示`
2. **callout 块**：一句话核心教育点（即第 0 步对齐的"讲什么"，如"全程无需操作，车辆自动完成"）
3. heading「动画演示」→ **GIF 图片块**（自动播放）
4. heading「分步说明」→ 有序列表：每步 = 动画分步字幕原文 + 该阶段秒数区间
5. heading「关键参数」→ 表格：HUD/字幕里出现过的数字（转角上限、温度、时长、循环总时长等）
6. heading「高清视频」→ **MP4 文件块**
7. 交互版链接 + 一行使用说明（日/夜切换、场景 chips 怎么用）

多场景动画（场景 a/b…）：每个场景一组「GIF + 分步说明」，用 heading2 分节，别把多场景拼成一个超长 GIF。

## 素材导出

```bash
node scripts/render-video.mjs <file.html> --out demo.mp4 --scenes a --gif
```

- GIF 默认 720px / 12fps，飞书内嵌**控制在 10MB 内最稳**；超了就调小 `--gif-width`（如 560）、`--gif-fps`（如 10），或按场景拆成多个 GIF
- 交付前抽帧亲眼检查 GIF：字幕、HUD 读数在 720px 下必须仍可读

## OpenAPI 直连备查（环境只有裸 HTTP 时）

以下凭经验整理，**执行前以 open.feishu.cn 官方文档为准**；需要 `docx` 与 `drive` 的写权限 scope：

- 建文档：`POST /open-apis/docx/v1/documents`
- 加块：`POST /open-apis/docx/v1/documents/{document_id}/blocks/{block_id}/children`（根节点的 block_id 即 document_id）
- 常用 block_type：text=2 · heading1=3 · ordered=13 · callout=19 · divider=22 · file=23 · iframe=26 · image=27 · table=31
- 图片/视频三步走：① 先建**空的** image/file 块拿到 block_id → ② `POST /open-apis/drive/v1/medias/upload_all`（multipart：`parent_type=docx_image` 或 `docx_file`，`parent_node=` 该块 block_id）拿到 file_token → ③ PATCH 该块把 token 写回（replace_image / replace_file）
- **GIF 必须走 image 块**才会自动播放；走 file 块只是一个附件卡片
- `upload_all` 单次上限 20MB，超出需分片接口（尽量别走到这步——素材阶段就控制体积）

## 交付闭环

- 文档生成后把**文档链接**发回给用户，并列出文档里的块清单（哪些是 GIF、哪些是视频）
- 有截图能力时截文档首屏亲眼确认 GIF 在播放位置正确；没有则明确告知"未能预览，请打开确认"
- 用户后续改动画 → 重新导出素材 → **更新原文档**（替换图片/文件块），不要另建新文档
