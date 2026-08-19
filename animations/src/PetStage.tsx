import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {ES8_CABIN_SIDE_URI} from './es8-cabin-photo';
import {PhotoDog, dogPhotoXf} from './PetsPhoto';
import {DOG_PHOTO} from './pets-photo';
import {
  F_DATA, F_UI, PET_FRAME, PET_GEO as G, PET_SCENES, type PetKey,
  T_COLORS as C, easeOutBack, frac, petState, win,
} from './pet-data';

/* ─── 实拍舞台 ────────────────────────────────────────────────────────────
   背景：ES8 前排正侧实拍（车头朝左），取景/坐标标定见 pet-data.PET_FRAME 注释。
   狗：真实边牧照片剪纸 PhotoDog（原点=掌距中点×地线，头天然朝右），
   外层 scale(-1 1) 镜像成头朝车头（左），坐在近侧（主驾）坐垫上。
   配色纪律：车内矢量物件（项圈/胸背带）取内饰同族色（皮革 #54463A / 米白 #F5F2EA），
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
    {/* 白色柔光底盘：深皮革项圈在暗色车窗区也读得出 */}
    <circle r={32} fill="#FFFFFF" opacity={0.85} />
    {/* 项圈：深皮革圈 + 米白吊牌（与 PetsPhoto 胸背带同族色） */}
    <circle r={20} fill="none" stroke="#54463A" strokeWidth={7} />
    <circle cy={20} r={9} fill="#F5F2EA" stroke="#54463A" strokeWidth={2} />
    <circle cy={20} r={2.6} fill={C.accent} />
  </g>
);

/* ─── 定位硬件徽标（挂在狗胸/颈，位置由 PhotoDog 位姿变换实时求出） ───── */
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
  const {ph, paired, detected, locked, petMode, petGone, purify, temp} = st;

  const capK = win(t, ph === 0 ? 0 : s.ph[ph - 1], (ph === 0 ? 0 : s.ph[ph - 1]) + 0.45);
  const doneCk = t >= s.ph[3] + 0.3 ? win(t, s.ph[3] + 0.3, s.ph[3] + 0.75) : 0;

  // 狗：第 4 章随车主离车淡出——在 ph0 结束前(1.4s)走完，字幕「宠物已离车」出现时狗已不在
  const dogOp = scene === 'd' ? 1 - win(t, s.ph[0] - 0.8, s.ph[0]) : 1;

  // 胸/颈徽标锚点：把照片内锚点(chestImg)过一遍 PhotoDog 的 bodyXf（sit 位姿），
  // 再镜像到舞台——徽标始终贴在呼吸起伏中的狗身上，不漂
  const k9 = G.dog.h / (DOG_PHOTO.groundY - DOG_PHOTO.witherY);
  const lx = (G.chestImg.x - DOG_PHOTO.pawMidX) * k9;
  const ly = (G.chestImg.y - DOG_PHOTO.groundY) * k9;
  const xf = dogPhotoXf('sit', t, false);
  const pvx = xf.pivotX * G.dog.h;
  const sx1 = pvx + (lx - pvx) * xf.sx, sy1 = ly * xf.sy;
  const rr = (xf.rot * Math.PI) / 180;
  const chest = {
    x: G.dog.x - (pvx + (sx1 - pvx) * Math.cos(rr) - sy1 * Math.sin(rr)),
    y: G.dog.y + ((sx1 - pvx) * Math.sin(rr) + sy1 * Math.cos(rr) + xf.dy),
  };
  // 徽标出现时机：第 1 章佩戴后；其余章节从头佩戴
  const tagOp = (scene === 'a' ? win(t, s.ph[0], s.ph[0] + 0.5) : 1) * dogOp;
  const tagPulse = scene === 'a' ? (ph >= 2 ? t * 0.7 : 0) : (scene === 'b' && ph >= 1 && !detected ? t * 0.7 : 0);

  // 狗外接框（目测校核用：x 428–630 · y ≈308–442），检测/守护环圆心取其中心
  const dogC = {x: 529, y: 372};

  // 车主离车（第 3/4 章）：门侧箭头 + 文案。第 4 章带宠物走，箭头与狗的淡出同步提前
  const ownerOp = scene === 'c'
    ? win(t, s.ph[0] - 0.6, s.ph[0]) * (1 - win(t, s.ph[1] + 0.4, s.ph[1] + 1.0))
    : scene === 'd'
      ? win(t, 0.25, 0.7) * (1 - win(t, s.ph[0] + 0.6, s.ph[0] + 1.2)) : 0;
  const ownerDx = -26 * (scene === 'd' ? win(t, 0.3, s.ph[0] + 0.4) : win(t, s.ph[0], s.ph[1]));

  const cardTint = purify ? C.ok : C.accent;

  return (
    <AbsoluteFill style={{background: C.stageBg, fontFamily: F_UI}}>
      <svg viewBox="0 0 1000 560" style={{position: 'absolute', inset: 0, width: 1920, height: 1075}}>
        {/* 实拍背景（取景排除左下角轮毂，用户指定）+ 极轻白纱让 UI 读得清 */}
        <image href={ES8_CABIN_SIDE_URI} x={PET_FRAME.x} y={PET_FRAME.y} width={PET_FRAME.w} height={PET_FRAME.h} />
        <rect x={0} y={0} width={1000} height={560} fill="#FFFFFF" opacity={0.12} />

        {/* 恒温气流（第 3 章宠物模式）：仪表台出风口 → 前排坐垫上的狗（UI 标注层） */}
        {petMode && [0, 0.5].map((d, i) => (
          <g key={i} opacity={0.9}>
            <path d="M310 245 C 380 255, 432 292, 478 336" fill="none" stroke={C.accent}
              strokeWidth={3} strokeLinecap="round" strokeDasharray="10 14"
              strokeDashoffset={-frac(t * 0.55 + d) * 24} opacity={0.75} />
            <path d="M330 300 C 392 315, 434 344, 470 376" fill="none" stroke={C.accent}
              strokeWidth={3} strokeLinecap="round" strokeDasharray="10 14"
              strokeDashoffset={-frac(t * 0.55 + d) * 24} opacity={0.75} />
          </g>
        ))}

        {/* 除味净化（第 4 章）：绿色气流横扫前排 + 坐垫异味粒子消散 + 净化星光 */}
        {purify && (
          <g>
            {/* 三条高度错开的净化气流，横扫前排、收在后门内饰板（x≈830），不落在座椅主体上 */}
            {[
              ['M300 250 C 460 178, 640 184, 828 292', 0],
              ['M304 268 C 466 196, 646 202, 836 310', 0.4],
              ['M310 286 C 472 216, 652 222, 842 328', 0.8],
            ].map(([d, off], i) => (
              <path key={i} d={d as string} fill="none" stroke={C.ok}
                strokeWidth={3} strokeLinecap="round" strokeDasharray="9 15"
                strokeDashoffset={-frac(t * 0.6 + (off as number)) * 24} opacity={0.8} />
            ))}
            {/* 异味粒子：从空出的坐垫面(x 420–640 · y≈395–430)升起并散去 */}
            {[[436, 424], [604, 410], [478, 402], [645, 428], [524, 418], [560, 398]].map(([px, py], i) => {
              const k = frac((t - s.ph[2]) / 2.2 - i * 0.14);
              return (
                <circle key={i} cx={px} cy={py - 52 * k} r={5 - 2 * k}
                  fill={C.ink3} opacity={0.42 * (1 - k)} />
              );
            })}
            {[[458, 386], [586, 366], [532, 424], [648, 392]].map(([px, py], i) => {
              const k = frac((t - s.ph[2]) / 1.8 - i * 0.2);
              const sc = k < 0.4 ? k / 0.4 : 1 - (k - 0.4) / 0.6;
              return (
                <g key={i} transform={`translate(${px} ${py}) scale(${(sc * 1.1).toFixed(2)})`} opacity={sc}>
                  <path d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z" fill={C.ok} />
                </g>
              );
            })}
          </g>
        )}

        {/* 狗：接地投影 + 照片剪纸（镜像成头朝车头/左），坐在主驾坐垫上 */}
        {dogOp > 0.01 && (
          <g>
            <ellipse cx={dogC.x} cy={G.dog.y + 3} rx={82} ry={9} fill="#5C7070" opacity={0.16 * dogOp} />
            <g transform={`translate(${G.dog.x} ${G.dog.y}) scale(-1 1)`}>
              <PhotoDog t={t} pose="sit" h={G.dog.h} op={dogOp} />
            </g>
          </g>
        )}

        {/* 定位硬件徽标（胸背带吊牌位） */}
        {tagOp > 0.01 && <ChestTag x={chest.x} y={chest.y} pulse={tagPulse} op={tagOp} />}

        {/* 检测高亮环（第 2 章）：围住狗外接框 */}
        {scene === 'b' && ph >= 1 && (
          <g transform={`translate(${dogC.x} ${dogC.y})`}>
            {[0, 0.5].map((d, i) => {
              const k = frac(t * 0.7 + d);
              return <circle key={i} r={92 + 40 * k} fill="none" stroke={C.accent}
                strokeWidth={2.6} opacity={0.8 * (1 - k)} />;
            })}
            {detected && <circle r={98} fill="none" stroke={C.accent} strokeWidth={2.6} strokeDasharray="6 6" />}
          </g>
        )}

        {/* 守护环（第 3 章宠物模式持续态） */}
        {petMode && (
          <circle cx={dogC.x} cy={dogC.y} r={100 + 4 * Math.sin(t * 2)} fill="none"
            stroke={C.accent} strokeWidth={2.6} strokeDasharray="7 9" opacity={0.8} />
        )}

        {/* 车主离车（第 3/4 章）：门侧箭头 + 文案（照片上小字带白描边） */}
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

        {/* 落锁徽标：开启的主驾门区域（第 3 章 ph1 起 / 第 4 章再次落锁） */}
        {locked && (
          <g transform={`translate(${G.door.lockX} ${G.door.lockY})`}
            opacity={Math.min(1, win(t, s.ph[1], s.ph[1] + 0.4) * 2)}>
            <rect x={-26} y={-16} width={52} height={32} rx={9} fill={C.panel} stroke={C.accent} strokeWidth={2} />
            <rect x={-7} y={-4} width={14} height={12} rx={2.5} fill={C.accent} />
            <path d="M-4 -4 v-5 a4 4 0 0 1 8 0 v5" fill="none" stroke={C.accent} strokeWidth={2.4} />
            <text x={0} y={34} textAnchor="middle" fontSize={13} fontWeight={600} fill={C.ink} {...OUT}>车辆落锁</text>
          </g>
        )}

        {/* 第 1 章：硬件特写（后门车窗暗区）→ 佩戴后淡出，徽标接管 */}
        {scene === 'a' && (
          <g>
            <CollarShowcase x={G.showcase.x} y={G.showcase.y}
              pulse={ph >= 2 ? t * 0.7 : ph === 0 ? t * 0.5 : 0} op={1} />
            <text x={G.showcase.x} y={G.showcase.y + 62} textAnchor="middle" fontSize={15}
              fontWeight={600} fill={C.ink} {...OUT}>宠物定位硬件</text>
            <text x={G.showcase.x} y={G.showcase.y + 82} textAnchor="middle" fontSize={11.5}
              fill={C.ink2} {...OUT} strokeWidth={3}>概念示意 · 外观待定义</text>
            {/* ph2 车机搜索：中控屏 ↔ 狗胸前硬件 的信号弧（动画虚线） */}
            {ph >= 2 && (
              <path d={`M258 232 Q 368 236 ${(chest.x - 12).toFixed(1)} ${(chest.y - 6).toFixed(1)}`}
                fill="none" stroke={C.accent} strokeWidth={2.4}
                strokeDasharray="6 8" strokeDashoffset={-frac(t * 0.8) * 28} opacity={0.9} />
            )}
            {/* 连接成功：贴中控屏上方（与其余章节状态卡同一信息位） */}
            {paired && (
              <g opacity={Math.min(1, win(t, s.ph[2], s.ph[2] + 0.5) * 2)}>
                <rect x={G.card.x + 40} y={G.card.y + 22} width={200} height={44} rx={10}
                  fill={C.panel} stroke={C.ok} strokeWidth={2} />
                <circle cx={G.card.x + 66} cy={G.card.y + 44} r={11} fill={C.okWash} stroke={C.ok} strokeWidth={2} />
                <path d={`M${G.card.x + 61} ${G.card.y + 44} L${G.card.x + 65} ${G.card.y + 48} L${G.card.x + 72} ${G.card.y + 39}`}
                  fill="none" stroke={C.ok} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
                <text x={G.card.x + 86} y={G.card.y + 50} fontSize={16} fontWeight={600} fill={C.ink}>已连接</text>
                {/* 指向中控屏的小三角（卡片下缘 → 屏幕上缘 y=206） */}
                <path d={`M${G.screen.cx - 8} ${G.card.y + 66} L${G.screen.cx} ${G.screen.top - 2} L${G.screen.cx + 8} ${G.card.y + 66} Z`} fill={C.ok} />
              </g>
            )}
          </g>
        )}

        {/* 车机状态卡（概念 UI）：悬于仪表台上方，小三角直指照片里的中控屏 */}
        {(scene === 'b' || scene === 'c' || scene === 'd') && ph >= 2 && (
          <g opacity={Math.min(1, win(t, s.ph[2], s.ph[2] + 0.45) * 2)}
            transform={`translate(${G.card.x + G.card.w / 2} ${G.card.y + G.card.h / 2}) scale(${easeOutBack(win(t, s.ph[2], s.ph[2] + 0.45)).toFixed(3)}) translate(${-(G.card.x + G.card.w / 2)} ${-(G.card.y + G.card.h / 2)})`}>
            <rect x={G.card.x} y={G.card.y} width={G.card.w} height={G.card.h} rx={14}
              fill={C.panel} stroke={cardTint} strokeWidth={2} />
            {/* 指引：卡片下缘小三角 → 中控屏上缘（车机通知锚定实车屏幕） */}
            <path d={`M${G.screen.cx - 9} ${G.card.y + G.card.h - 1} L${G.screen.cx} ${G.screen.top - 2} L${G.screen.cx + 9} ${G.card.y + G.card.h - 1} Z`}
              fill={cardTint} />
            <circle cx={G.card.x + 32} cy={G.card.y + 34} r={13} fill={C.ink} />
            <circle cx={G.card.x + 27.4} cy={G.card.y + 32} r={2.6} fill={cardTint} />
            <circle cx={G.card.x + 36.6} cy={G.card.y + 32} r={2.6} fill={cardTint} />
            <text x={G.card.x + 56} y={G.card.y + 32} fontSize={17} fontWeight={700} fill={C.ink}>
              {scene === 'b' ? '检测到宠物在车内' : purify ? '宠物除味处理中' : '宠物模式已开启'}
            </text>
            <text x={G.card.x + 56} y={G.card.y + 58} fontSize={13.5} fill={C.ink2}>
              {scene === 'b' ? '定位硬件信号来自车内'
                : purify ? '正在完成一轮空气净化'
                : `车内保持 ${temp.toFixed(1)}°C 稳定舒适`}
            </text>
            <text x={G.card.x + G.card.w - 10} y={G.card.y + 84} textAnchor="end" fontFamily={F_DATA}
              fontSize={10.5} letterSpacing="0.1em" fill={C.ink3}>概念状态卡 · UI 待确认</text>
          </g>
        )}

        {/* 完成勾（右上暗区，避开头枕 712–781） */}
        {doneCk > 0 && (
          <g opacity={Math.min(1, doneCk * 2)}
            transform={`translate(${G.done.x} ${G.done.y}) scale(${easeOutBack(doneCk).toFixed(3)}) translate(${-G.done.x} ${-G.done.y})`}>
            <circle cx={G.done.x} cy={G.done.y} r={17} fill={C.panel} stroke={C.ok} strokeWidth={2.5} />
            <path d={`M${G.done.x - 8} ${G.done.y} L${G.done.x - 2} ${G.done.y + 6} L${G.done.x + 9} ${G.done.y - 6}`}
              fill="none" stroke={C.ok} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
      </svg>

      {/* HUD（照片顶部偏暗 → 文字装进半透明白 pill 保证可读） */}
      <div style={{
        position: 'absolute', top: 24, left: 32, right: 32, display: 'flex',
        justifyContent: 'space-between', fontFamily: F_DATA, fontSize: 21,
        letterSpacing: '0.12em', color: C.ink3,
      }}>
        <span style={{background: 'rgba(255,255,255,0.88)', border: `1px solid ${C.line}`, borderRadius: 999, padding: '6px 16px'}}>
          ES8 前排 · 实拍座舱
        </span>
        <span style={{background: 'rgba(255,255,255,0.88)', border: `1px solid ${C.line}`, borderRadius: 999, padding: '6px 16px'}}>
          车内 <b style={{color: C.accent, fontWeight: 600, fontVariantNumeric: 'tabular-nums'}}>{temp.toFixed(1)}°C</b>
          {' · '}<b style={{color: purify ? C.ok : C.accent, fontWeight: 600}}>{s.hudRight(t)}</b>
        </span>
      </div>

      {/* 章节标签 */}
      <div style={{
        position: 'absolute', top: 24, left: 0, right: 0, display: 'flex', justifyContent: 'center',
        opacity: Math.min(win(t, 0.2, 0.7), 1 - win(t, 3.0, 3.6)),
      }}>
        <span style={{
          fontSize: 22, color: C.ink2, background: C.panel,
          border: `1.5px solid ${C.line}`, borderRadius: 999, padding: '8px 22px',
        }}>{s.chip}</span>
      </div>

      {/* 状态 pill：自动触发徽标（挡风玻璃上方暗区，状态卡正上方，右缘对齐卡右缘 316→607px 屏） */}
      <div style={{
        position: 'absolute', left: 46, right: 1313, top: 96,
        display: 'flex', justifyContent: 'flex-end',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '14px 24px', borderRadius: 999,
          background: C.panel, border: `1.5px solid ${ph > 1 ? C.accent : C.line}`,
          fontSize: 23, color: ph > 1 ? C.ink : C.ink2, whiteSpace: 'nowrap',
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

      {/* 字幕 + 进度点：左下暗区（门槛/地板），右缘 610px 屏 ≈ 舞台 318 < 坐垫前缘 395 */}
      <div style={{
        position: 'absolute', left: 46, width: 564, bottom: 36,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 22,
          background: C.panel, border: `1.5px solid ${C.line}`, borderRadius: 18,
          padding: '24px 26px',
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
              fontSize: 29, fontWeight: 700, lineHeight: 1.32, color: ph === 4 ? C.ok : C.ink,
              opacity: capK, transform: `translateY(${(1 - capK) * 10}px)`,
            }}>{s.caps[ph]}</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
