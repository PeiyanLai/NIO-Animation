# 宠物素材库（真实照片剪纸）

**调用规则（强制）：需求涉及宠物，一律用这里的真实宠物画像，不要画矢量宠物。**
矢量宠物（`animations/src/Cat.tsx` / `Dog.tsx`）只做兜底：拿不到可用照片、
或要画俯视小图标（`CatTop`）时才用。这条规则的来历：机械感矢量宠物连续返工
多轮后，用户终审是「换成真实的」——从源头用照片，省掉整条返工路。

## 现有素材

| 宠物 | 姿态 | 朝向 | 文件 |
|---|---|---|---|
| 橘猫 | 坐姿(剪纸整体位姿:sit/lookout/turn/curl) | 头朝左 | `pets-photo.ts` CAT_URI + CAT_PHOTO |
| 边牧 | 站姿 + **关节腿 walk**(真实迈腿)/sit/lie/crouch/lookup | 头朝右 | `pets-photo.ts` DOG_* + DOG_PARTS |

源照片与授权登记：`photos/pets/approved-asset-manifest.json`（用户上传 PDF 提取，
内部演示可用，对外发布前需重新确认版权）。

## 组件入口

```tsx
import {PhotoCat, PhotoDog} from './PetsPhoto';   // 复制进工程后
<PhotoCat x0={x} gy={groundY} sit={坐高px} xf={位姿} op={1} />
<PhotoDog t={t} pose="walk" h={肩高px} senior={false} op={1} />
```

契约要点（改前必读 `pets-photo.ts` 文件头的标定注释）：
- **猫**：原点 = 坐骨着地点，前掌对齐 −0.4·sit；位姿差异用 dy/rot/scale 剪纸表达，
  切换要 0.5s 平滑（bag-data `catPhotoXf` 是范本）；
- **狗**：原点 = 掌距中点 × 地线，`h` = 鬐甲(肩)高；walk 姿态是**关节腿合成**
  （四条腿绕腿根枢轴对角摆动，近腿原色远腿压暗，身体毛缘盖接缝），其余姿态整图剪纸；
- **朝向是产品语义**：需要反向就 `scale(-1 1)` 镜像并注释理由，照片无文字可安全镜像；
- 老年个体用 `feColorMatrix saturate≈0.45` 压饱和表现，不要另换图。

## 复制不要引用

交付过的动画把 `pets-photo.ts` + `PetsPhoto.tsx` 复制进自己工程。
改了任何一边要同步回另一边，然后跑：

```bash
python3 scripts/assert-assets-in-sync.py --project animations
```

## 抠图与扩库

新增宠物照片照 `pets-photo.ts` 文件头的流程：软羽化抠图保毛边 →
**清除影棚地面灰雾与投影核**（低饱和中灰 + 限定区域；颜色距离软抠会把它们当前景）→
清完重量地线/掌位/肩高 → 登记 manifest → 加同步校验项。
