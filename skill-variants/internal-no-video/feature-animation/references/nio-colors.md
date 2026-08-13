# NIOFlow Design System (Ace — 全局默认配色)

适用于所有产出的 PPT、前端、数据可视化，除非用户明确指定其他风格。

## 品牌主色（NIO Teal）
- **accent**: #00bebe（强调：关键数据、CTA、激活态）
- **accent-2**: #00D4D4（高亮/渐变顶部/hover）
- **accent-soft**: #D0F5F5（卡片背景/tag/引用块）
- **sage**: #004b64（深色背景/渐变底部）
- 默认渐变: linear-gradient(135deg, #00D4D4, #00bebe)
- **主色规则**: 仅用于强调，单块面积≤15%，每页≤3处主色实例；文本用 #00bebe；大面积浅色块用 #D0F5F5

## 中性灰（青色调，禁止纯灰 #888/#666）
- ink-1: #1A1F1F（标题）· ink-2: #2E3D3D（正文）· ink-3: #5C7070（辅助）· ink-4: #8AABAB（说明/footer）
- 最多 4 级文本层级；正文颜色不浅于 #5C7070

## 背景与分割线
- bg: #FFFFFF · bg-soft: #F0FAFA · line: #D8EEEE · line-2: #B8DEDE
- 大面积背景仅限白色、#F0FAFA、#E8FAFA

## 数据可视化色阶
- Good: linear-gradient(90deg, #00AAAA, #00bebe)
- Medium: linear-gradient(90deg, #5C9FAA, #3D8090)
- Risk: linear-gradient(90deg, #8AABAB, #5C7070)
- Negative: #D14545（极少使用，仅数据色阶，不出现在正文标题）

## 分类色板（饼图/柱状图/多类别区分）
- 类别一/主对象: linear-gradient(135deg, #00D4D4, #00AAAA)（青）
- 类别二: linear-gradient(135deg, #7B6CE8, #5D4DD4)（紫）
- 类别三: linear-gradient(135deg, #E8B947, #D49922)（琥珀）

## 阴影（青色冷调，禁止纯黑阴影）
- 标准卡片: 0 16px 34px -22px rgba(0,60,70,.15)
- 强调卡片: 0 24px 50px -32px rgba(0,60,70,.18)
- 主色辉光: 0 0 0 4px rgba(0,190,190,.15)

## 渐变与暗色
- 仅允许两类渐变：主色青绿渐变 + 冷调灰度渐变；禁止暖色和彩虹渐变
- 深色背景用 #0a0a0a 搭配 #00D4D4 高亮
