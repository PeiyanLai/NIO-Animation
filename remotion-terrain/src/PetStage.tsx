import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {
  F_DATA, F_UI, PET_SCENES, type PetKey, T_COLORS as C,
  easeOutBack, frac, petState, win,
} from './pet-data';

/* ─── 比例化概念座舱（平面图，车头朝上）──────────────────────────────────
   依据 ES9 座舱布局绘制：2+2+2 六座、天空岛中轴、横向中控宽屏 + NOMI、
   氛围灯带、扬声器点位。非实拍、非 CAD。 */
const Cabin: React.FC = () => (
  <g>
    {/* 车身外壳 */}
    <rect x={-150} y={-232} width={300} height={464} rx={54} fill={C.panel} stroke={C.line} strokeWidth={2.5} />
    <rect x={-136} y={-218} width={272} height={436} rx={44} fill="none" stroke={C.lineSoft} strokeWidth={2} />

    {/* 仪表台 + 中控宽屏 + NOMI */}
    <rect x={-120} y={-206} width={240} height={26} rx={12} fill={C.lineSoft} />
    <rect x={-46} y={-200} width={92} height={14} rx={4} fill={C.ink} opacity={0.82} />
    <circle cx={0} cy={-216} r={13} fill={C.ink} />
    <circle cx={-4.6} cy={-218} r={2.6} fill={C.accent} />
    <circle cx={4.6} cy={-218} r={2.6} fill={C.accent} />

    {/* 方向盘 */}
    <circle cx={-76} cy={-160} r={23} fill="none" stroke={C.ink3} strokeWidth={3} />
    <circle cx={-76} cy={-160} r={6} fill={C.ink3} />

    {/* 天空岛中轴（贯穿一二排） */}
    <rect x={-19} y={-176} width={38} height={250} rx={16} fill={C.lineSoft} stroke={C.line} strokeWidth={1.6} />
    <rect x={-13} y={34} width={26} height={30} rx={5} fill={C.ink} opacity={0.72} />

    {/* 一排双座 */}
    <rect x={-118} y={-128} width={80} height={94} rx={20} fill={C.accentWash} stroke={C.line} strokeWidth={2} />
    <rect x={38} y={-128} width={80} height={94} rx={20} fill={C.accentWash} stroke={C.line} strokeWidth={2} />
    {/* 椅背娱乐屏 */}
    <rect x={-102} y={-26} width={48} height={9} rx={3} fill={C.ink} opacity={0.6} />
    <rect x={54} y={-26} width={48} height={9} rx={3} fill={C.ink} opacity={0.6} />

    {/* 二排行政双座 + 外侧扶手 */}
    <rect x={-118} y={12} width={80} height={100} rx={20} fill={C.accentWash} stroke={C.line} strokeWidth={2} />
    <rect x={38} y={12} width={80} height={100} rx={20} fill={C.accentWash} stroke={C.line} strokeWidth={2} />
    <rect x={-133} y={32} width={14} height={60} rx={7} fill={C.lineSoft} stroke={C.line} strokeWidth={1.4} />
    <rect x={119} y={32} width={14} height={60} rx={7} fill={C.lineSoft} stroke={C.line} strokeWidth={1.4} />

    {/* 三排长椅 */}
    <rect x={-118} y={142} width={236} height={80} rx={20} fill={C.accentWash} stroke={C.line} strokeWidth={2} />

    {/* 氛围灯带 */}
    <path d="M-140 -170 L-140 190" stroke={C.warn} strokeWidth={3} strokeLinecap="round" opacity={0.55} />
    <path d="M140 -170 L140 190" stroke={C.warn} strokeWidth={3} strokeLinecap="round" opacity={0.55} />

    {/* 扬声器点位 */}
    <g fill={C.warn} opacity={0.45}>
      <circle cx={-128} cy={-178} r={4} /><circle cx={128} cy={-178} r={4} />
      <circle cx={-136} cy={-48} r={4} /><circle cx={136} cy={-48} r={4} />
      <circle cx={-136} cy={78} r={4} /><circle cx={136} cy={78} r={4} />
      <circle cx={-128} cy={188} r={4} /><circle cx={128} cy={188} r={4} />
    </g>
  </g>
);

/* ─── 宠物（二排右座）：圆头 + 椭圆身 + 耳朵 + 尾巴 ─────────────────── */
const Pet: React.FC<{breathe: number}> = ({breathe}) => (
  <g transform={`translate(78 58) scale(${(1 + breathe * 0.02).toFixed(3)})`}>
    <ellipse cx={0} cy={6} rx={22} ry={17} fill="#C9A882" stroke="#A8875F" strokeWidth={2} />
    <circle cx={0} cy={-16} r={15} fill="#D9BE9B" stroke="#A8875F" strokeWidth={2} />
    <path d="M-13 -26 L-17 -38 L-5 -31 Z" fill="#C9A882" stroke="#A8875F" strokeWidth={1.6} />
    <path d="M13 -26 L17 -38 L5 -31 Z" fill="#C9A882" stroke="#A8875F" strokeWidth={1.6} />
    <circle cx={-5} cy={-17} r={2.2} fill={C.ink} />
    <circle cx={5} cy={-17} r={2.2} fill={C.ink} />
    <ellipse cx={0} cy={-10} rx={3.4} ry={2.6} fill={C.ink} />
    <path d="M18 14 q14 6 10 18" stroke="#A8875F" strokeWidth={3.4} fill="none" strokeLinecap="round" />
    {/* 定位硬件项圈 */}
    <path d="M-13 -4 q13 7 26 0" stroke={C.accent} strokeWidth={4} fill="none" strokeLinecap="round" />
    <circle cx={0} cy={2} r={4.6} fill={C.accent} />
  </g>
);

/* ─── 人物（圆头 + 胶囊身）─────────────────────────────────────────── */
const Person: React.FC<{x: number; y: number; op: number}> = ({x, y, op}) => (
  <g transform={`translate(${x} ${y})`} opacity={op}>
    <rect x={-11} y={-8} width={22} height={38} rx={11} fill={C.ink3} />
    <circle cx={0} cy={-20} r={11} fill={C.ink2} />
  </g>
);

/* ─── 定位硬件（中性图标：项圈 + 信号）────────────────────────────── */
const Collar: React.FC<{x: number; y: number; scale: number; pulse: number}> = ({x, y, scale, pulse}) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`}>
    {pulse > 0 && [0, 0.33, 0.66].map((d, i) => {
      const k = frac(pulse - d);
      return <circle key={i} r={16 + 26 * k} fill="none" stroke={C.accent} strokeWidth={2.4} opacity={0.85 * (1 - k)} />;
    })}
    <circle r={15} fill="none" stroke={C.accent} strokeWidth={5} />
    <circle cy={15} r={7} fill={C.accent} />
    <path d="M-2.6 12.6 h5.2 M-2.6 16 h5.2" stroke={C.panel} strokeWidth={1.6} strokeLinecap="round" />
  </g>
);

export const PetStage: React.FC<{scene: PetKey}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = PET_SCENES[scene];
  const t = Math.min(frame / fps, s.T - 0.001);
  const ph = petState(scene, t).ph;

  const CX = 500, CY = 280;
  const capK = win(t, ph === 0 ? 0 : s.ph[ph - 1], (ph === 0 ? 0 : s.ph[ph - 1]) + 0.45);
  const breathe = Math.sin(t * 2.2);

  // 各章特有状态（由 pet-data.petState 纯函数给出，断言共用同一逻辑）
  const st = petState(scene, t);
  const {paired, detected, locked, petMode, petGone, purify, temp} = st;
  const doneCk = t >= s.ph[3] + 0.3 ? win(t, s.ph[3] + 0.3, s.ph[3] + 0.75) : 0;

  // 车主位置（第 3 章离车、第 4 章带宠物离车）
  const ownerOut = (scene === 'c' || scene === 'd') ? win(t, s.ph[0], s.ph[1]) : 0;
  const ownerX = -78 - ownerOut * 260;                       // 座舱局部坐标：驾驶位 → 向左离车
  const ownerOp = 1 - win(t, s.ph[1] - 0.5, s.ph[1] + 0.1);  // 离车后完全消失

  return (
    <AbsoluteFill style={{background: C.stageBg, fontFamily: F_UI}}>
      <svg viewBox="0 0 1000 560" style={{position: 'absolute', inset: 0, width: 1920, height: 1075}}>
        {/* 座舱 */}
        <g transform={`translate(${CX} ${CY})`}>
          <ellipse cx={0} cy={244} rx={168} ry={12} fill="#5C7070" opacity={0.1} />
          <Cabin />

          {/* 恒温气流（宠物模式开启时，从出风口流向二排） */}
          {petMode && [0, 0.5].map((d, i) => (
            <g key={i} opacity={0.9}>
              <path d="M-60 -178 C -70 -110, -80 -40, -60 40" fill="none" stroke={C.accent}
                strokeWidth={3} strokeLinecap="round" strokeDasharray="10 14"
                strokeDashoffset={-frac(t * 0.55 + d) * 24} opacity={0.75} />
              <path d="M60 -178 C 70 -110, 80 -40, 60 40" fill="none" stroke={C.accent}
                strokeWidth={3} strokeLinecap="round" strokeDasharray="10 14"
                strokeDashoffset={-frac(t * 0.55 + d) * 24} opacity={0.75} />
            </g>
          ))}

          {/* 除味净化气流（绿色）+ 异味粒子消散 + 净化星光 */}
          {purify && (
            <g>
              {[0, 0.4, 0.8].map((d, i) => (
                <path key={i} d="M-70 -176 C -30 -60, 30 -60, 70 -176" fill="none" stroke={C.ok}
                  strokeWidth={3} strokeLinecap="round" strokeDasharray="9 15"
                  strokeDashoffset={-frac(t * 0.6 + d) * 24} opacity={0.8} />
              ))}
              {[[-64, 40], [70, 30], [-20, 96], [46, 110], [-88, 118], [16, 8]].map(([px, py], i) => {
                const k = frac((t - s.ph[2]) / 2.2 - i * 0.14);
                return (
                  <circle key={i} cx={px} cy={py - 46 * k} r={5 - 2 * k}
                    fill={C.ink3} opacity={0.42 * (1 - k)} />
                );
              })}
              {[[-52, 22], [58, 62], [-8, 128], [96, 6]].map(([px, py], i) => {
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

          {/* 宠物 */}
          {!petGone && <Pet breathe={breathe} />}

          {/* 检测高亮环（第 2 章） */}
          {scene === 'b' && ph >= 1 && (
            <g transform="translate(78 58)">
              {[0, 0.5].map((d, i) => {
                const k = frac(t * 0.7 + d);
                return <circle key={i} r={34 + 34 * k} fill="none" stroke={C.accent}
                  strokeWidth={2.6} opacity={0.8 * (1 - k)} />;
              })}
              {detected && <circle r={40} fill="none" stroke={C.accent} strokeWidth={2.6} strokeDasharray="6 6" />}
            </g>
          )}

          {/* 守护环（宠物模式持续态） */}
          {petMode && (
            <circle cx={78} cy={58} r={52 + 4 * Math.sin(t * 2)} fill="none"
              stroke={C.accent} strokeWidth={2.6} strokeDasharray="7 9" opacity={0.8} />
          )}

          {/* 车主 */}
          {(scene === 'c' || scene === 'd') && (
            <Person x={ownerX} y={-72} op={ownerOp} />
          )}

          {/* 落锁标识 */}
          {locked && (
            <g transform="translate(0 -262)" opacity={Math.min(1, win(t, s.ph[1], s.ph[1] + 0.4) * 2)}>
              <rect x={-26} y={-16} width={52} height={32} rx={9} fill={C.panel} stroke={C.accent} strokeWidth={2} />
              <rect x={-7} y={-4} width={14} height={12} rx={2.5} fill={C.accent} />
              <path d="M-4 -4 v-5 a4 4 0 0 1 8 0 v5" fill="none" stroke={C.accent} strokeWidth={2.4} />
            </g>
          )}
        </g>

        {/* 第 1 章：硬件配对特写 */}
        {scene === 'a' && (
          <g>
            <Collar x={200} y={190} scale={1.5} pulse={ph >= 2 ? t * 0.7 : 0} />
            <text x={200} y={268} textAnchor="middle" fontSize={16} fill={C.ink2}>宠物定位硬件</text>
            <text x={200} y={288} textAnchor="middle" fontSize={12} fill={C.ink3}>概念示意 · 外观待定义</text>
            {ph >= 2 && (
              <path d={`M240 190 Q330 190 ${CX - 160} 130`} fill="none" stroke={C.accent} strokeWidth={2.4}
                strokeDasharray="6 8" strokeDashoffset={-frac(t * 0.8) * 28} opacity={0.9} />
            )}
            {paired && (
              <g opacity={Math.min(1, win(t, s.ph[2], s.ph[2] + 0.5) * 2)}>
                <rect x={150} y={330} width={200} height={44} rx={10} fill={C.panel} stroke={C.ok} strokeWidth={2} />
                <circle cx={176} cy={352} r={11} fill={C.okWash} stroke={C.ok} strokeWidth={2} />
                <path d="M171 352 L175 356 L182 347" fill="none" stroke={C.ok} strokeWidth={2.6}
                  strokeLinecap="round" strokeLinejoin="round" />
                <text x={196} y={358} fontSize={16} fontWeight={600} fill={C.ink}>已连接</text>
              </g>
            )}
          </g>
        )}

        {/* 车机状态卡（概念 UI） */}
        {(scene === 'b' || scene === 'c' || scene === 'd') && ph >= 2 && (
          <g opacity={Math.min(1, win(t, s.ph[2], s.ph[2] + 0.45) * 2)}
            transform={`translate(196 250) scale(${easeOutBack(win(t, s.ph[2], s.ph[2] + 0.45)).toFixed(3)})`}>
            <rect x={-140} y={-46} width={280} height={92} rx={14} fill={C.panel}
              stroke={purify ? C.ok : C.accent} strokeWidth={2} />
            <circle cx={-108} cy={-12} r={13} fill={C.ink} />
            <circle cx={-112.6} cy={-14} r={2.6} fill={purify ? C.ok : C.accent} />
            <circle cx={-103.4} cy={-14} r={2.6} fill={purify ? C.ok : C.accent} />
            <text x={-84} y={-14} fontSize={17} fontWeight={700} fill={C.ink}>
              {scene === 'b' ? '检测到宠物在车内' : purify ? '宠物除味处理中' : '宠物模式已开启'}
            </text>
            <text x={-84} y={12} fontSize={13.5} fill={C.ink2}>
              {scene === 'b' ? '定位硬件信号来自车内'
                : purify ? '正在完成一轮空气净化'
                : `车内保持 ${temp.toFixed(1)}°C 稳定舒适`}
            </text>
            <text x={130} y={32} textAnchor="end" fontFamily={F_DATA} fontSize={10.5}
              letterSpacing="0.1em" fill={C.ink3}>概念状态卡 · UI 待确认</text>
          </g>
        )}

        {/* 完成勾 */}
        {doneCk > 0 && (
          <g opacity={Math.min(1, doneCk * 2)}
            transform={`translate(830 120) scale(${easeOutBack(doneCk).toFixed(3)}) translate(-830 -120)`}>
            <circle cx={830} cy={120} r={17} fill={C.panel} stroke={C.ok} strokeWidth={2.5} />
            <path d="M822 120 L828 126 L839 114" fill="none" stroke={C.ok} strokeWidth={4}
              strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
      </svg>

      {/* HUD */}
      <div style={{
        position: 'absolute', top: 24, left: 32, right: 32, display: 'flex',
        justifyContent: 'space-between', fontFamily: F_DATA, fontSize: 21,
        letterSpacing: '0.12em', color: C.ink3,
      }}>
        <span>座舱平面 · 概念示意</span>
        <span>
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

      {/* 状态 pill：自动触发 → AUTO 徽标 */}
      <div style={{position: 'absolute', left: 32, bottom: 120}}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '16px 26px', borderRadius: 999,
          background: C.panel, border: `1.5px solid ${ph > 1 ? C.accent : C.line}`,
          fontSize: 23, color: ph > 1 ? C.ink : C.ink2,
        }}>
          <i style={{
            width: 14, height: 14, borderRadius: '50%',
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

      {/* 字幕 + 进度点 */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 30, display: 'flex',
        alignItems: 'center', justifyContent: 'space-between', padding: '0 36px',
      }}>
        <div style={{
          fontSize: 34, fontWeight: 700, color: ph === 4 ? C.ok : C.ink,
          opacity: capK, transform: `translateY(${(1 - capK) * 10}px)`,
        }}>{s.caps[ph]}</div>
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
