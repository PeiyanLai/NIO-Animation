import React from 'react';
import {AbsoluteFill, Img, useCurrentFrame, useVideoConfig} from 'remotion';
import {
  CAR_BODY, ARCHES, F_DATA, F_UI, SCENES, SPEED, T_COLORS as C, TERRA, WHEEL_R,
  easeOutBack, frac, modeAt, phaseOf, terrAt, win,
} from './data';

import {PHOTO_URI} from './photo';

const PHOTO = PHOTO_URI;

// ─── 车轮（胎圈静态 + 辐条随滚动旋转） ───────────────────────────────────
const WheelTire: React.FC = () => (
  <g>
    <circle r={104} fill="#0B0D10" opacity={0.4} />
    <circle r={100} fill="#141619" />
    <circle r={100} fill="none" stroke="#2A2E33" strokeWidth={3} />
    <circle r={84} fill="#23272C" />
  </g>
);

const SPOKES: Array<[string, string]> = [
  ['M-6.8 -18.8 L-25.8 -60.8 L-3.5 -65.9 L-2.1 -19.9 Z', '#B7BEC6'],
  ['M2.1 -19.9 L3.5 -65.9 L25.8 -60.8 L6.8 -18.8 Z', '#8D949C'],
  ['M16.1 -25.3 L33.0 -54.9 L42.0 -48.3 L19.1 -23.1 Z', '#3E444B'],
  ['M15.8 -12.3 L49.8 -43.3 L61.6 -23.7 L18.3 -8.1 Z', '#B7BEC6'],
  ['M19.6 -4.2 L63.8 -17.1 L65.7 5.8 L20.0 0.7 Z', '#8D949C'],
  ['M29.0 7.5 L62.4 14.4 L58.9 25.0 L27.9 11.0 Z', '#3E444B'],
  ['M16.6 11.2 L56.6 34.0 L41.5 51.3 L13.4 14.9 Z', '#B7BEC6'],
  ['M10.0 17.3 L35.9 55.4 L14.8 64.3 L5.5 19.2 Z', '#8D949C'],
  ['M1.8 29.9 L5.6 63.8 L-5.6 63.8 L-1.8 29.9 Z', '#3E444B'],
  ['M-5.5 19.2 L-14.8 64.3 L-35.9 55.4 L-10.0 17.3 Z', '#B7BEC6'],
  ['M-13.4 14.9 L-41.5 51.3 L-56.6 34.0 L-16.6 11.2 Z', '#8D949C'],
  ['M-27.9 11.0 L-58.9 25.0 L-62.4 14.4 L-29.0 7.5 Z', '#3E444B'],
  ['M-20.0 0.7 L-65.7 5.8 L-63.8 -17.1 L-19.6 -4.2 Z', '#B7BEC6'],
  ['M-18.3 -8.1 L-61.6 -23.7 L-49.8 -43.3 L-15.8 -12.3 Z', '#8D949C'],
  ['M-19.1 -23.1 L-42.0 -48.3 L-33.0 -54.9 L-16.1 -25.3 Z', '#3E444B'],
];

const WheelSpokes: React.FC = () => (
  <g transform="scale(1.2)">
    {SPOKES.map(([d, fill], i) => (
      <path key={i} d={d} fill={fill} />
    ))}
    <circle r={70} fill="none" stroke="#A8AFB7" strokeWidth={5} />
    <circle r={19} fill="#1B1E22" stroke="#5E656D" strokeWidth={3} />
    <circle r={6} fill="#C9CDD2" />
  </g>
);

// ─── 地形纹理 pattern（夜间色） ───────────────────────────────────────────
const Patterns: React.FC = () => (
  <>
    <pattern id="pat-asphalt" patternUnits="userSpaceOnUse" width={140} height={140} y={420}>
      <rect fill={TERRA.asphalt.dk} x={10} y={34} width={46} height={3} rx={1.5} />
      <rect fill={TERRA.asphalt.dk} x={86} y={78} width={38} height={3} rx={1.5} />
      <rect fill={TERRA.asphalt.dk} x={34} y={112} width={30} height={3} rx={1.5} />
    </pattern>
    <pattern id="pat-mud" patternUnits="userSpaceOnUse" width={140} height={140} y={420}>
      <ellipse fill={TERRA.mud.dk} cx={36} cy={38} rx={16} ry={7} />
      <ellipse fill={TERRA.mud.dk} cx={104} cy={70} rx={20} ry={8} />
      <ellipse fill={TERRA.mud.dk} cx={56} cy={110} rx={13} ry={6} />
      <path stroke={TERRA.mud.dk} fill="none" strokeWidth={2} d="M8 88 q10 -6 20 0 q10 6 20 0" />
    </pattern>
    <pattern id="pat-sand" patternUnits="userSpaceOnUse" width={140} height={140} y={420}>
      <path stroke={TERRA.sand.dk} fill="none" strokeWidth={2} d="M6 44 q17 -12 34 0 q17 12 34 0" />
      <path stroke={TERRA.sand.dk} fill="none" strokeWidth={2} d="M66 100 q17 -12 34 0 q17 12 34 0" />
      <circle fill={TERRA.sand.dk} cx={112} cy={36} r={3} />
      <circle fill={TERRA.sand.dk} cx={30} cy={116} r={3} />
    </pattern>
    <pattern id="pat-snow" patternUnits="userSpaceOnUse" width={140} height={140} y={420}>
      <circle fill={TERRA.snow.dk} cx={30} cy={40} r={4} />
      <circle fill={TERRA.snow.dk} cx={96} cy={66} r={3} />
      <circle fill={TERRA.snow.dk} cx={58} cy={108} r={4} />
      <path d="M118 104 l0 -14 M111 97 l14 0 M113 92 l10 10 M123 92 l-10 10"
        stroke={TERRA.snow.dk} strokeWidth={1.8} fill="none" />
    </pattern>
    <pattern id="pat-wet" patternUnits="userSpaceOnUse" width={140} height={140} y={420}>
      <path stroke={TERRA.wet.dk} fill="none" strokeWidth={2} d="M8 46 q12 -7 24 0 q12 7 24 0 q12 -7 24 0" />
      <path stroke={TERRA.wet.dk} fill="none" strokeWidth={2} d="M50 100 q12 -7 24 0 q12 7 24 0" />
      <rect fill={TERRA.wet.dk} x={96} y={30} width={26} height={3} rx={1.5} />
    </pattern>
    <pattern id="pat-gravel" patternUnits="userSpaceOnUse" width={140} height={140} y={420}>
      <circle fill={TERRA.gravel.dk} cx={24} cy={42} r={6} />
      <circle fill={TERRA.gravel.dk} cx={52} cy={36} r={4} />
      <circle fill={TERRA.gravel.dk} cx={92} cy={60} r={7} />
      <circle fill={TERRA.gravel.dk} cx={120} cy={44} r={4} />
      <circle fill={TERRA.gravel.dk} cx={40} cy={102} r={6} />
      <circle fill={TERRA.gravel.dk} cx={78} cy={114} r={5} />
      <circle fill={TERRA.gravel.dk} cx={116} cy={98} r={6} />
    </pattern>
  </>
);

// ─── 场景舞台：一切皆为 t 的纯函数 ────────────────────────────────────────
export const Stage: React.FC<{scene: 'a' | 'b' | 'c'}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = SCENES[scene];
  const t = Math.min(frame / fps, s.T - 0.001);

  const ph = phaseOf(s, t);
  const terr = terrAt(s, t);
  const mode = modeAt(s, t);
  const modeOn = mode !== null;

  const dx = SPEED * t;
  const bob = Math.sin(t * 5) * 1.2;
  const deg = ((dx / WHEEL_R) * 57.2958) % 360;

  // 气泡（场景 a/b）
  let bk = 0;
  if (s.bub) {
    if (t >= s.ph[1] && t < s.pressAt! + 0.5) bk = win(t, s.ph[1], s.ph[1] + 0.45);
    if (t >= s.pressAt! + 0.5) bk = 1 - win(t, s.pressAt! + 0.5, s.pressAt! + 0.9);
  }

  // 完成确认
  const ck = t >= s.tDone + 0.3 ? win(t, s.tDone + 0.3, s.tDone + 0.75) : 0;

  // 识别脉冲（相位 1 循环，三道弧错峰）
  const scanActive = ph === 1;
  const scanT = t - s.ph[0];
  const scanOp = (delay: number) =>
    scanActive && scanT >= delay ? 0.95 * (1 - frac((scanT - delay) / 1.1)) : 0;

  // 按键涟漪（a/b 相位 3 起两轮）
  const rippleK =
    s.pressAt !== undefined && t >= s.pressAt && t < s.pressAt + 1.6
      ? frac((t - s.pressAt) / 0.8)
      : -1;

  // 扬尘（模式开启循环，三粒错峰 0.9s）
  const sprayDot = (delay: number) => {
    if (!modeOn) return {op: 0, x: 0, y: 0};
    const k = frac((t - delay) / 0.9);
    const op = k < 0.15 ? (k / 0.15) * 0.7 : 0.7 * (1 - (k - 0.15) / 0.85);
    return {op, x: -46 * k, y: -26 * k};
  };

  // 徽标呼吸环（2s 循环）
  const ringK = modeOn ? frac(t / 2) : 0;

  // 抓地标识淡入
  const gripShow = modeOn
    ? s.startMode === 'auto' || s.startMode ? 0.9 : Math.min(0.9, win(t, s.activateAt ?? 0, (s.activateAt ?? 0) + 0.4) * 0.9)
    : 0;

  // 字幕入场
  const phStart = ph === 0 ? 0 : s.ph[ph - 1];
  const capK = win(t, phStart, phStart + 0.45);

  const hudMode = mode ? TERRA[mode].label : '标准';
  const badgeTxt = mode ? `全地形 · ${TERRA[mode].label}模式` : '全地形模式 · 未开启';
  const badgeDot = mode ? TERRA[mode].base : TERRA.asphalt.base;

  const capDone = ph === 4;

  return (
    <AbsoluteFill style={{background: C.stageBg, fontFamily: F_UI}}>
      {/* 预载真车照片（Img 阻塞渲染直至加载完成，确保 SVG image 同帧就绪） */}
      <Img src={PHOTO} style={{position: 'absolute', width: 1, height: 1, opacity: 0}} />

      <svg
        viewBox="0 0 1000 560"
        style={{position: 'absolute', left: 0, top: 2, width: 1920, height: 1075}}
      >
        <defs>
          <mask id="carMask">
            <path d={CAR_BODY} fill="#fff" />
            {ARCHES.map((a, i) => (
              <circle key={i} cx={a.cx} cy={a.cy} r={a.r} fill="#000" />
            ))}
          </mask>
          <Patterns />
        </defs>

        {/* 地形带（滚动） */}
        <g transform={`translate(${-dx} 0)`}>
          {s.bands.map((b, i) => (
            <g key={i}>
              <rect fill={TERRA[b.terr].base} x={b.x} y={420} width={b.w} height={140} />
              <rect fill={`url(#pat-${b.terr})`} x={b.x} y={420} width={b.w} height={140} />
            </g>
          ))}
        </g>

        {/* 接地阴影（浅色底：轮下压暗 + 整车软投影） */}
        <ellipse cx={563.3} cy={420} rx={52} ry={7} fill="#2E3D3D" opacity={0.34} />
        <ellipse cx={254.8} cy={420} rx={50} ry={7} fill="#2E3D3D" opacity={0.34} />
        <ellipse cx={409} cy={421} rx={210} ry={8} fill="#5C7070" opacity={0.14} />

        {/* 轮腔（暗底）：填满轮拱开口，使轮胎与轮眉之间留出机械缝隙 */}
        <circle cx={563.3} cy={368.9} r={51.7} fill="#151A1A" />
        <circle cx={254.8} cy={368.9} r={49.5} fill="#151A1A" />

        {/* 矢量车轮：画在车身下层，上沿被翼子板遮挡，尺寸取照片实测胎圈 */}
        <g transform="translate(563.3 368.9) scale(0.484)">
          <WheelTire />
          <g transform={`rotate(${deg.toFixed(1)})`}>
            <WheelSpokes />
          </g>
        </g>
        <g transform="translate(254.8 368.9) scale(0.473)">
          <WheelTire />
          <g transform={`rotate(${deg.toFixed(1)})`}>
            <WheelSpokes />
          </g>
        </g>

        {/* 车身照片（抠形 + 镜像 + 微浮动）——最后绘制，覆盖轮子上沿 */}
        <g transform={`translate(120 ${(201.7 + bob).toFixed(2)})`}>
          <g transform="scale(0.55)">
            <g transform="translate(1020 0) scale(-1 1)">
              <image
                href={PHOTO}
                width={1020}
                height={460}
                mask="url(#carMask)"
              />
            </g>
          </g>
        </g>

        {/* 尾部扬尘 */}
        <g transform="translate(200 404)">
          {([0, 0.3, 0.6] as const).map((d, i) => {
            const p = sprayDot(d);
            const base = [{r: 4, cx: 0, cy: 0}, {r: 3, cx: 8, cy: 6}, {r: 3.5, cx: -6, cy: 10}][i];
            return (
              <circle
                key={i}
                r={base.r}
                cx={base.cx + p.x}
                cy={base.cy + p.y}
                fill={C.ink3}
                opacity={p.op}
              />
            );
          })}
        </g>

        {/* 抓地标识 */}
        <path d="M228 440 q26 9 52 0" stroke={C.accent} strokeWidth={2.5} fill="none"
          strokeLinecap="round" opacity={gripShow} />
        <path d="M535 440 q26 9 52 0" stroke={C.accent} strokeWidth={2.5} fill="none"
          strokeLinecap="round" opacity={gripShow} />

        {/* 激光雷达识别脉冲 */}
        <path d="M725 305 A 70 70 0 0 1 795 375" stroke={C.accent} strokeWidth={2.5} fill="none" opacity={scanOp(0)} />
        <path d="M725 305 A 105 105 0 0 1 830 410" stroke={C.accent} strokeWidth={2.5} fill="none" opacity={scanOp(0.3)} />
        <path d="M725 305 A 140 140 0 0 1 865 445" stroke={C.accent} strokeWidth={2.5} fill="none" opacity={scanOp(0.6)} />

        {/* 模式徽标 */}
        {modeOn && ringK > 0 && (
          <rect
            x={56} y={60} width={228} height={40} rx={20}
            fill="none" stroke={C.accent} strokeWidth={2}
            opacity={0.6 * (1 - ringK)}
            transform={`translate(${170 * (1 - (1 + 0.18 * ringK))} ${80 * (1 - (1 + 0.18 * ringK))}) scale(${1 + 0.18 * ringK})`}
          />
        )}
        <rect x={60} y={64} width={220} height={32} rx={16}
          fill={modeOn ? C.accentWash : C.panel}
          stroke={modeOn ? C.accent : C.line} strokeWidth={1.5} />
        <circle cx={80} cy={80} r={6} fill={badgeDot} />
        <text x={96} y={85} fontSize={14.5} fontWeight={600} fill={modeOn ? C.accent : C.ink2}>
          {badgeTxt}
        </text>

        {/* NOMI 提醒气泡 */}
        {s.bub && bk > 0 && (
          <g
            opacity={Math.min(1, bk * 2)}
            transform={`translate(500 170) scale(${easeOutBack(bk).toFixed(3)})`}
          >
            <rect x={-240} y={-42} width={480} height={84} rx={14}
              fill={C.panel} stroke={C.accent} strokeWidth={2} />
            <circle cx={-206} cy={0} r={15} fill={C.nvRoof} />
            <circle cx={-211} cy={-3} r={3} fill={C.accent} />
            <circle cx={-201} cy={-3} r={3} fill={C.accent} />
            <text x={-178} y={-8} fontSize={17} fontWeight={700} fill={C.ink}>{s.bub[0]}</text>
            <text x={-178} y={18} fontSize={14.5} fill={C.ink2}>{s.bub[1]}</text>
            <text x={228} y={30} textAnchor="end" fontSize={10.5} fill={C.accent}
              fontFamily={F_DATA} letterSpacing="0.1em">方向盘按键 · 一键确认</text>
          </g>
        )}

        {/* 完成确认 */}
        {ck > 0 && (
          <g
            opacity={Math.min(1, ck * 2)}
            transform={`translate(500 240) scale(${easeOutBack(ck).toFixed(3)}) translate(-500 -240)`}
          >
            <circle cx={500} cy={240} r={17} fill={C.panel} stroke={C.ok} strokeWidth={2.5} />
            <path d="M492 240 L498 246 L509 234" fill="none" stroke={C.ok}
              strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
      </svg>

      {/* HUD */}
      <div style={{
        position: 'absolute', top: 24, left: 32, right: 32,
        display: 'flex', justifyContent: 'space-between',
        fontFamily: F_DATA, fontSize: 21, letterSpacing: '0.12em', color: C.ink3,
      }}>
        <span>侧视图 · DRIVE VIEW</span>
        <span>
          模式 <b style={{color: C.accent, fontWeight: 600}}>{hudMode}</b>
          {' · '}路面 <b style={{color: C.accent, fontWeight: 600}}>{TERRA[terr].label}</b>
        </span>
      </div>

      {/* 场景标签（开场 3 秒淡入淡出） */}
      <div style={{
        position: 'absolute', top: 24, left: 0, right: 0, display: 'flex', justifyContent: 'center',
        opacity: Math.min(win(t, 0.2, 0.7), 1 - win(t, 3.0, 3.6)),
      }}>
        <span style={{
          fontFamily: F_UI, fontSize: 22, color: C.ink2,
          background: C.panel, border: `1.5px solid ${C.line}`,
          borderRadius: 999, padding: '8px 22px',
        }}>{s.chip}</span>
      </div>

      {/* 方向盘按键 pill + 涟漪 */}
      <div style={{position: 'absolute', left: 32, bottom: 120}}>
        <div style={{
          position: 'relative',
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '16px 26px', borderRadius: 999,
          background: C.panel,
          border: `1.5px solid ${ph > 0 ? C.accent : C.line}`,
          fontSize: 23, color: ph > 0 ? C.ink : C.ink2,
        }}>
          {rippleK >= 0 && (
            <div style={{
              position: 'absolute', inset: -5, borderRadius: 999,
              border: `3px solid ${C.accent}`,
              opacity: 0.9 * (1 - rippleK),
              transform: `scale(${1 + 0.45 * rippleK})`,
            }} />
          )}
          <i style={{
            width: 14, height: 14, borderRadius: '50%',
            background: ph > 0 ? C.accent : C.ink3,
            boxShadow: ph > 0 ? `0 0 0 5px ${C.accentWash}` : 'none',
          }} />
          {s.pill}
        </div>
      </div>

      {/* 底部字幕 + 进度点 */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 30,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 36px',
      }}>
        <div style={{
          fontSize: 34, fontWeight: 700, letterSpacing: '0.01em',
          color: capDone ? C.ok : C.ink,
          opacity: capK, transform: `translateY(${(1 - capK) * 10}px)`,
          textShadow: '0 2px 12px rgba(0,0,0,.55)',
        }}>
          {s.caps[ph]}
        </div>
        <div style={{display: 'flex', gap: 12}}>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} style={{
              width: 13, height: 13, borderRadius: '50%',
              background: i <= ph ? C.accent : C.line,
              transform: i === ph ? 'scale(1.25)' : 'none',
            }} />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
