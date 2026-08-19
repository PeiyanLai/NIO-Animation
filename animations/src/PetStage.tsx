import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {ES8_FRONT2ROWS_URI} from './es8-front2rows-photo';
import {CAT_FRONT, CAT_FRONT_URI} from './pets-photo';
import {
  F_DATA, F_UI, PET_FRAME, PET_GEO as G, PET_SCENES, type PetKey,
  T_COLORS as C, easeOutBack, frac, petState, win,
} from './pet-data';

/* ─── 实拍舞台 ────────────────────────────────────────────────────────────
   背景：ES8 前两排俯视实拍（宠物在二排——只有这张拍得到二排；等高 fit 居中，
   标定见 pet-data.PET_FRAME 注释）。左右竖带（x 0…243 / 757…1000）放步骤块、
   状态卡、HUD、硬件特写，不压照片。
   猫：正面坐姿橘猫照片剪纸（俯前视机位下二排椅面朝镜头，正面朝向贴合视角），
   底边中心为锚坐在二排长椅右侧座位坐垫上，呼吸 = 以底边为轴 scaleY 1±0.006。
   配色纪律：车内矢量物件（项圈/吊牌）取内饰同族色（皮革 #54463A / 米白 #F5F2EA），
   teal 只做 UI 标注（信号、守护环、状态卡描边）。照片上的小字一律白描边。 */

/** 照片上小字的白描边（stroke #FFF + paintOrder stroke） */
const OUT = {
  stroke: '#FFFFFF', strokeWidth: 3.5,
  paintOrder: 'stroke' as const, strokeLinejoin: 'round' as const,
};

/* ─── 定位硬件特写（第 1 章）：项圈实物取内饰皮革色，脉冲环为 UI 层 ───── */
const CollarShowcase: React.FC<{x: number; y: number; pulse: number; op: number}> = ({x, y, pulse, op}) => (
  <g transform={`translate(${x} ${y})`} opacity={op}>
    {pulse > 0 && [0, 0.33, 0.66].map((d, i) => {
      const k = frac(pulse - d);
      return <circle key={i} r={24 + 30 * k} fill="none" stroke={C.accent} strokeWidth={2.4} opacity={0.85 * (1 - k)} />;
    })}
    {/* 白色柔光底盘：让深皮革项圈在浅青带上也有实物感 */}
    <circle r={32} fill="#FFFFFF" opacity={0.9} />
    {/* 项圈：深皮革圈 + 米白吊牌 */}
    <circle r={20} fill="none" stroke="#54463A" strokeWidth={7} />
    <circle cy={20} r={9} fill="#F5F2EA" stroke="#54463A" strokeWidth={2} />
    <circle cy={20} r={2.6} fill={C.accent} />
  </g>
);

/* ─── 定位硬件徽标（挂在猫胸口，位置随呼吸微动，锚点换算见组件内注释） ── */
const ChestTag: React.FC<{x: number; y: number; pulse: number; op: number}> = ({x, y, pulse, op}) => (
  <g transform={`translate(${x} ${y})`} opacity={op}>
    {pulse > 0 && [0, 0.5].map((d, i) => {
      const k = frac(pulse - d);
      return <circle key={i} r={10 + 18 * k} fill="none" stroke={C.accent} strokeWidth={2.2} opacity={0.9 * (1 - k)} />;
    })}
    <circle r={7.5} fill="#F5F2EA" stroke="#54463A" strokeWidth={2.2} />
    <circle r={2.4} fill={C.accent} />
  </g>
);

export const PetStage: React.FC<{scene: PetKey}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = PET_SCENES[scene];
  const t = Math.min(frame / fps, s.T - 0.001);
  const st = petState(scene, t);
  const {ph, paired, detected, locked, petMode, purify, temp} = st;

  const capK = win(t, ph === 0 ? 0 : s.ph[ph - 1], (ph === 0 ? 0 : s.ph[ph - 1]) + 0.45);
  const doneCk = t >= s.ph[3] + 0.3 ? win(t, s.ph[3] + 0.3, s.ph[3] + 0.75) : 0;

  // 猫：第 4 章随车主离车淡出——在 ph0 结束前(1.4s)走完，字幕「宠物已离车」出现时猫已不在
  const catOp = scene === 'd' ? 1 - win(t, s.ph[0] - 0.8, s.ph[0]) : 1;

  // 猫剪纸：底边中心为锚等比缩放（CAT_FRONT 契约，地线=图底），呼吸以底边为轴
  const k = G.cat.h / CAT_FRONT.h;                 // 160/712 = 0.2247
  const sy = 1 + 0.006 * Math.sin(t * 2.2);        // 呼吸：纯 t 函数，周期≈2.9s
  // 胸口徽标锚点：猫照片内 (165,290) 过同一套「底边中心锚 + 呼吸 scaleY」变换
  const chest = {
    x: G.cat.x + (G.chestImg.x - CAT_FRONT.w / 2) * k,
    y: G.cat.y + (G.chestImg.y - CAT_FRONT.h) * k * sy,
  };
  // 检测/守护环圆心 = 猫可见体量中心（底边上方 0.47×h ≈ 75）
  const catC = {x: G.cat.x, y: G.cat.y + G.bodyDy};

  // 徽标出现时机：第 1 章佩戴后；其余章节从头佩戴
  const tagOp = (scene === 'a' ? win(t, s.ph[0], s.ph[0] + 0.5) : 1) * catOp;
  const tagPulse = scene === 'a' ? (ph >= 2 ? t * 0.7 : 0) : (scene === 'b' && ph >= 1 && !detected ? t * 0.7 : 0);

  // 车主离车（第 3/4 章）：左门区箭头 + 文案。第 4 章带宠物走，与猫的淡出同步提前
  const ownerOp = scene === 'c'
    ? win(t, s.ph[0] - 0.6, s.ph[0]) * (1 - win(t, s.ph[1] + 0.4, s.ph[1] + 1.0))
    : scene === 'd'
      ? win(t, 0.25, 0.7) * (1 - win(t, s.ph[0] + 0.6, s.ph[0] + 1.2)) : 0;
  const ownerDx = -26 * (scene === 'd' ? win(t, 0.3, s.ph[0] + 0.4) : win(t, s.ph[0], s.ph[1]));

  const cardTint = purify ? C.ok : C.accent;
  // 状态卡引导线终点：猫守护环右上缘（第 4 章猫离车后指向其原座位）
  const lead = {x: 684, y: 430};

  return (
    <AbsoluteFill style={{background: C.stageBg, fontFamily: F_UI}}>
      <svg viewBox="0 0 1000 560" style={{position: 'absolute', inset: 0, width: 1920, height: 1075}}>
        <defs>
          {/* 照片圆角裁切：等高 fit 居中的竖图面板 */}
          <clipPath id="petPhotoClip">
            <rect x={PET_FRAME.x} y={PET_FRAME.y} width={PET_FRAME.w} height={PET_FRAME.h} rx={12} />
          </clipPath>
        </defs>

        {/* 实拍背景（前两排俯视）+ 极轻白纱让 UI 与浅色叠层读得清 */}
        <g clipPath="url(#petPhotoClip)">
          <image href={ES8_FRONT2ROWS_URI} x={PET_FRAME.x} y={PET_FRAME.y} width={PET_FRAME.w} height={PET_FRAME.h} />
          <rect x={PET_FRAME.x} y={PET_FRAME.y} width={PET_FRAME.w} height={PET_FRAME.h} fill="#FFFFFF" opacity={0.1} />
        </g>

        {/* 恒温气流（第 3 章宠物模式）：沿岛台中线自前向后 → 尾端出风口分两股扇向二排的猫
            （扇股终点收在猫左缘 578.6 之外，避免可见段被猫剪纸盖掉） */}
        {petMode && (
          <g opacity={0.9}>
            {[
              ['M 495 96 C 496 180 496 260 495 326', 0],
              ['M 486 334 C 498 388 532 428 566 452', 0.33],
              ['M 507 334 C 522 392 552 448 574 498', 0.66],
            ].map(([d, off], i) => (
              <path key={i} d={d as string} fill="none" stroke={C.accent}
                strokeWidth={3} strokeLinecap="round" strokeDasharray="10 14"
                strokeDashoffset={-frac(t * 0.55 + (off as number)) * 24} opacity={0.75} />
            ))}
          </g>
        )}

        {/* 除味净化（第 4 章）：绿色气流沿左/中/右三条通道自前向后扫向二排 +
            二排坐垫异味粒子消散 + 净化星光（坐标均为 photo 实测换算，见 pet-data） */}
        {purify && (
          <g>
            {[
              ['M 298 96 C 300 200 302 320 318 470', 0],
              ['M 495 92 C 495 200 497 310 501 478', 0.4],
              ['M 676 96 C 675 200 672 320 652 474', 0.8],
            ].map(([d, off], i) => (
              <path key={i} d={d as string} fill="none" stroke={C.ok}
                strokeWidth={3} strokeLinecap="round" strokeDasharray="9 15"
                strokeDashoffset={-frac(t * 0.6 + (off as number)) * 24} opacity={0.8} />
            ))}
            {/* 异味粒子：从二排长椅面（stage y≈470–520）升起并散去 */}
            {[[390, 490], [470, 472], [545, 498], [612, 478], [652, 502], [505, 518]].map(([px, py], i) => {
              const kk = frac((t - s.ph[2]) / 2.2 - i * 0.14);
              return (
                <circle key={i} cx={px} cy={py - 52 * kk} r={5 - 2 * kk}
                  fill={C.ink3} opacity={0.42 * (1 - kk)} />
              );
            })}
            {[[425, 445], [560, 432], [633, 468], [495, 507]].map(([px, py], i) => {
              const kk = frac((t - s.ph[2]) / 1.8 - i * 0.2);
              const sc = kk < 0.4 ? kk / 0.4 : 1 - (kk - 0.4) / 0.6;
              return (
                <g key={i} transform={`translate(${px} ${py}) scale(${(sc * 1.1).toFixed(2)})`} opacity={sc}>
                  <path d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z" fill={C.ok} />
                </g>
              );
            })}
          </g>
        )}

        {/* 检测高亮环（第 2 章）：椭圆围住猫身。画在猫剪纸之下——
            底弧被猫身遮住中段，读作「环绕到身后」，不横穿主体 */}
        {scene === 'b' && ph >= 1 && (
          <g transform={`translate(${catC.x} ${catC.y})`}>
            {[0, 0.5].map((d, i) => {
              const kk = frac(t * 0.7 + d);
              return <ellipse key={i} rx={64 + 26 * kk} ry={80 + 26 * kk} fill="none"
                stroke={C.accent} strokeWidth={2.6} opacity={0.8 * (1 - kk)} />;
            })}
            {detected && <ellipse rx={72} ry={88} fill="none" stroke={C.accent} strokeWidth={2.6} strokeDasharray="6 6" />}
          </g>
        )}

        {/* 守护环（第 3 章宠物模式持续态）：同样画在猫之下 */}
        {petMode && (
          <ellipse cx={catC.x} cy={catC.y} rx={76 + 3 * Math.sin(t * 2)} ry={92 + 4 * Math.sin(t * 2)}
            fill="none" stroke={C.accent} strokeWidth={2.6} strokeDasharray="7 9" opacity={0.8} />
        )}

        {/* 猫：接地投影 + 正面坐姿照片剪纸，坐在二排长椅右侧座位坐垫上 */}
        {catOp > 0.01 && (
          <g opacity={catOp}>
            <ellipse cx={G.cat.x} cy={G.cat.y + 2} rx={54} ry={7} fill="#5C7070" opacity={0.16} />
            <g transform={`translate(${G.cat.x} ${G.cat.y}) scale(${k.toFixed(5)} ${(k * sy).toFixed(5)})`}>
              <image href={CAT_FRONT_URI} x={-CAT_FRONT.w / 2} y={-CAT_FRONT.h}
                width={CAT_FRONT.w} height={CAT_FRONT.h} />
            </g>
          </g>
        )}

        {/* 定位硬件徽标（胸口挂牌位） */}
        {tagOp > 0.01 && <ChestTag x={chest.x} y={chest.y} pulse={tagPulse} op={tagOp} />}

        {/* 车主离车（第 3/4 章）：左门区箭头向车外 + 文案（照片上小字带白描边） */}
        {ownerOp > 0.01 && (
          <g opacity={ownerOp} transform={`translate(${ownerDx.toFixed(1)} 0)`}>
            <path d={`M${G.door.arrowX} ${G.door.arrowY} H${G.door.arrowX - 96}`} stroke={C.accent}
              strokeWidth={3.5} strokeLinecap="round" fill="none" />
            <path d={`M${G.door.arrowX - 88} ${G.door.arrowY - 9} L${G.door.arrowX - 104} ${G.door.arrowY} L${G.door.arrowX - 88} ${G.door.arrowY + 9} Z`} fill={C.accent} />
            <text x={G.door.arrowX - 48} y={G.door.arrowY - 18} textAnchor="middle" fontSize={15}
              fontWeight={600} fill={C.ink} {...OUT}>
              {scene === 'd' ? '车主带宠物离车' : '车主离车'}
            </text>
          </g>
        )}

        {/* 落锁徽标：右门内饰条暗区（第 3 章 ph1 起 / 第 4 章再次落锁） */}
        {locked && (
          <g transform={`translate(${G.door.lockX} ${G.door.lockY})`}
            opacity={Math.min(1, win(t, s.ph[1], s.ph[1] + 0.4) * 2)}>
            <rect x={-26} y={-16} width={52} height={32} rx={9} fill={C.panel} stroke={C.accent} strokeWidth={2} />
            <rect x={-7} y={-4} width={14} height={12} rx={2.5} fill={C.accent} />
            <path d="M-4 -4 v-5 a4 4 0 0 1 8 0 v5" fill="none" stroke={C.accent} strokeWidth={2.4} />
            <text x={0} y={34} textAnchor="middle" fontSize={13} fontWeight={600} fill={C.ink} {...OUT}>车辆落锁</text>
          </g>
        )}

        {/* 第 1 章：硬件特写（右竖带中段）→ 佩戴后徽标接管 */}
        {scene === 'a' && (
          <g>
            <CollarShowcase x={G.showcase.x} y={G.showcase.y}
              pulse={ph >= 2 ? t * 0.7 : ph === 0 ? t * 0.5 : 0} op={1} />
            <text x={G.showcase.x} y={G.showcase.y + 62} textAnchor="middle" fontSize={15}
              fontWeight={600} fill={C.ink}>宠物定位硬件</text>
            <text x={G.showcase.x} y={G.showcase.y + 82} textAnchor="middle" fontSize={11.5}
              fill={C.ink2}>概念示意 · 外观待定义</text>
            {/* ph2 车机搜索：顶部真实中控屏 ↔ 猫胸前硬件 的信号弧（动画虚线） */}
            {ph >= 2 && (
              <path d={`M ${G.screen.cx} ${(G.screen.bottom + 4).toFixed(1)} Q 505 280 ${(chest.x - 4).toFixed(1)} ${(chest.y - 10).toFixed(1)}`}
                fill="none" stroke={C.accent} strokeWidth={2.4}
                strokeDasharray="6 8" strokeDashoffset={-frac(t * 0.8) * 28} opacity={0.9} />
            )}
            {/* 连接成功：右竖带状态卡位（与其余章节状态卡同一信息位） */}
            {paired && (
              <g opacity={Math.min(1, win(t, s.ph[2], s.ph[2] + 0.5) * 2)}>
                <rect x={G.card.x + 15} y={G.card.y + 24} width={200} height={44} rx={10}
                  fill={C.panel} stroke={C.ok} strokeWidth={2} />
                <circle cx={G.card.x + 41} cy={G.card.y + 46} r={11} fill={C.okWash} stroke={C.ok} strokeWidth={2} />
                <path d={`M${G.card.x + 36} ${G.card.y + 46} L${G.card.x + 40} ${G.card.y + 50} L${G.card.x + 47} ${G.card.y + 41}`}
                  fill="none" stroke={C.ok} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
                <text x={G.card.x + 61} y={G.card.y + 52} fontSize={16} fontWeight={600} fill={C.ink}>已连接</text>
              </g>
            )}
          </g>
        )}

        {/* 车机状态卡（概念 UI）：右竖带上段，引导线指向二排的猫 */}
        {(scene === 'b' || scene === 'c' || scene === 'd') && ph >= 2 && (
          <g opacity={Math.min(1, win(t, s.ph[2], s.ph[2] + 0.45) * 2)}
            transform={`translate(${G.card.x + G.card.w / 2} ${G.card.y + G.card.h / 2}) scale(${easeOutBack(win(t, s.ph[2], s.ph[2] + 0.45)).toFixed(3)}) translate(${-(G.card.x + G.card.w / 2)} ${-(G.card.y + G.card.h / 2)})`}>
            {/* 引导线：卡片下缘 → 猫守护环缘（第 4 章猫离车后指向其原座位），端点圆点 */}
            <path d={`M ${G.card.x + 20} ${G.card.y + G.card.h} C 772 292 724 384 ${lead.x} ${lead.y}`}
              fill="none" stroke={cardTint} strokeWidth={2.2} strokeDasharray="5 6" opacity={0.85} />
            <circle cx={lead.x} cy={lead.y} r={3.5} fill={cardTint} />
            <rect x={G.card.x} y={G.card.y} width={G.card.w} height={G.card.h} rx={14}
              fill={C.panel} stroke={cardTint} strokeWidth={2} />
            <circle cx={G.card.x + 28} cy={G.card.y + 30} r={12} fill={C.ink} />
            <circle cx={G.card.x + 23.8} cy={G.card.y + 28} r={2.4} fill={cardTint} />
            <circle cx={G.card.x + 32.2} cy={G.card.y + 28} r={2.4} fill={cardTint} />
            <text x={G.card.x + 50} y={G.card.y + 36} fontSize={16.5} fontWeight={700} fill={C.ink}>
              {scene === 'b' ? '检测到宠物在车内'
                : purify ? (ph >= 4 ? '除味净化已完成' : '宠物除味处理中')
                : '宠物模式已开启'}
            </text>
            <text x={G.card.x + 20} y={G.card.y + 62} fontSize={13} fill={C.ink2}>
              {scene === 'b' ? '定位硬件信号来自车内'
                : purify ? (ph >= 4 ? '车内空气恢复清新' : '正在完成一轮空气净化')
                : `车内保持 ${temp.toFixed(1)}°C 稳定舒适`}
            </text>
            <text x={G.card.x + G.card.w - 10} y={G.card.y + 84} textAnchor="end" fontFamily={F_DATA}
              fontSize={10.5} letterSpacing="0.1em" fill={C.ink3}>概念状态卡 · UI 待确认</text>
          </g>
        )}

        {/* 完成勾（右竖带，HUD 药丸与状态卡之间） */}
        {doneCk > 0 && (
          <g opacity={Math.min(1, doneCk * 2)}
            transform={`translate(${G.done.x} ${G.done.y}) scale(${easeOutBack(doneCk).toFixed(3)}) translate(${-G.done.x} ${-G.done.y})`}>
            <circle cx={G.done.x} cy={G.done.y} r={17} fill={C.panel} stroke={C.ok} strokeWidth={2.5} />
            <path d={`M${G.done.x - 8} ${G.done.y} L${G.done.x - 2} ${G.done.y + 6} L${G.done.x + 9} ${G.done.y - 6}`}
              fill="none" stroke={C.ok} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
      </svg>

      {/* HUD：左右竖带顶部各一枚药丸（照片不被压） */}
      <div style={{
        position: 'absolute', top: 24, left: 24, right: 24, display: 'flex',
        justifyContent: 'space-between', fontFamily: F_DATA, fontSize: 21,
        letterSpacing: '0.12em', color: C.ink3,
      }}>
        <span style={{background: 'rgba(255,255,255,0.88)', border: `1px solid ${C.line}`, borderRadius: 999, padding: '6px 16px'}}>
          ES8 前两排 · 俯视实拍
        </span>
        <span style={{background: 'rgba(255,255,255,0.88)', border: `1px solid ${C.line}`, borderRadius: 999, padding: '6px 16px'}}>
          车内 <b style={{color: C.accent, fontWeight: 600, fontVariantNumeric: 'tabular-nums'}}>{temp.toFixed(1)}°C</b>
          {' · '}<b style={{color: purify ? C.ok : C.accent, fontWeight: 600}}>{s.hudRight(t)}</b>
        </span>
      </div>

      {/* 章节标签（居中，压在照片顶部暗色仪表台上，panel 底保证可读；3.6s 淡出） */}
      <div style={{
        position: 'absolute', top: 24, left: 0, right: 0, display: 'flex', justifyContent: 'center',
        opacity: Math.min(win(t, 0.2, 0.7), 1 - win(t, 3.0, 3.6)),
      }}>
        <span style={{
          fontSize: 22, color: C.ink2, background: C.panel,
          border: `1.5px solid ${C.line}`, borderRadius: 999, padding: '8px 22px',
        }}>{s.chip}</span>
      </div>

      {/* 状态 pill：自动触发徽标（左竖带上段，HUD 药丸正下方） */}
      <div style={{position: 'absolute', left: 24, top: 96}}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 14, padding: '13px 22px', borderRadius: 999,
          background: C.panel, border: `1.5px solid ${ph > 1 ? C.accent : C.line}`,
          fontSize: 21, color: ph > 1 ? C.ink : C.ink2, whiteSpace: 'nowrap',
        }}>
          <i style={{
            width: 14, height: 14, borderRadius: '50%', flex: 'none',
            background: ph > 1 ? C.accent : C.ink3,
            boxShadow: ph > 1 ? `0 0 0 5px ${C.accentWash}` : 'none',
          }} />
          {scene === 'a' ? '设备配对 · 车机自动搜索' : '自动触发 · 无需手动设置'}
          {ph > 1 && scene !== 'a' && (
            <em style={{
              fontStyle: 'normal', fontFamily: F_DATA, fontSize: 12, letterSpacing: '0.14em',
              color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 4, padding: '2px 8px',
            }}>AUTO</em>
          )}
        </div>
      </div>

      {/* 字幕 + 进度点：左竖带**垂直居中**（宽 436 ≤ 带宽 467，不压照片）。
          ⚠️ 不许放画面四角——信息卡四角禁区是全局规则(bag-data.CORNERS 同款),
          曾因放到左下角被用户点名返工,别再挪回去 */}
      <div style={{
        position: 'absolute', left: 24, width: 436, top: 460,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 18,
          background: C.panel, border: `1.5px solid ${C.line}`, borderRadius: 18,
          padding: '22px 24px',
        }}>
          {/* 竖排进度圆点 */}
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
            {[0, 1, 2, 3, 4].map((i) => (
              <React.Fragment key={i}>
                {i > 0 && (
                  <i style={{width: 2, height: 16, background: i <= ph ? C.accent : C.line}} />
                )}
                <span style={{
                  width: 13, height: 13, borderRadius: '50%',
                  background: i <= ph ? C.accent : C.line,
                  transform: i === ph ? 'scale(1.25)' : 'none',
                }} />
              </React.Fragment>
            ))}
          </div>
          <div style={{flex: 1, minWidth: 0}}>
            <div style={{
              fontFamily: F_DATA, fontSize: 15, letterSpacing: '0.14em',
              color: C.ink3, marginBottom: 10,
            }}>{`步骤 ${String(ph + 1).padStart(2, '0')} / 05`}</div>
            <div style={{
              fontSize: 25, fontWeight: 700, lineHeight: 1.36, color: ph === 4 ? C.ok : C.ink,
              opacity: capK, transform: `translateY(${(1 - capK) * 10}px)`,
            }}>{s.caps[ph]}</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
