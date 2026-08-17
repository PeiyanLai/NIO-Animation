import React from 'react';
import {AbsoluteFill, Img, useCurrentFrame, useVideoConfig} from 'remotion';
import {ES9_TOP_URI} from './es9-top-photo';
import {
  CAR_BBOX, CAR_SRC, CAR_TOP_BODY, F_DATA, F_MAX, F_UI, NEIGHBORS, PK_SCENES, R_MAX,
  SLOT, T_COLORS as C, TOP_ANCHORS, buildPark, easeOutBack, win,
} from './parking-data';

// 车身显示尺寸：车长 236px ↔ 5365mm（22.73 mm/px），车宽由 CAR_BBOX 等比推出 ≈ 90px ↔ 2046mm
const CAR_H = 236;
const SCALE = CAR_H / (CAR_BBOX.y1 - CAR_BBOX.y0);
const CAR_W = (CAR_BBOX.x1 - CAR_BBOX.x0) * SCALE;

/** 车辆贴图（车头朝上），以车身中心为原点 */
const CarTop: React.FC<{opacity?: number}> = ({opacity = 1}) => (
  <g
    opacity={opacity}
    transform={`scale(${SCALE}) translate(${-(CAR_BBOX.x0 + CAR_BBOX.x1) / 2} ${-(CAR_BBOX.y0 + CAR_BBOX.y1) / 2})`}
  >
    <image href={ES9_TOP_URI} width={CAR_SRC.w} height={CAR_SRC.h} mask="url(#carTopMask)" />
  </g>
);

/** 转向示意轮：俯视照片看不到车轮，用 HMI 示意层表现转角；尺寸按实车 275/40R23（12 × 35px） */
const SteerWheel: React.FC<{ax: number; ay: number; deg: number}> = ({ax, ay, deg}) => {
  const x = (ax - 0.5) * CAR_W;
  const y = (ay - 0.5) * CAR_H;
  return (
    <g transform={`translate(${x} ${y}) rotate(${deg.toFixed(2)})`}>
      <rect x={-6} y={-17.5} width={12} height={35} rx={6} fill="#151A1A" opacity={0.92} />
      <rect x={-6} y={-17.5} width={12} height={35} rx={6} fill="none" stroke={C.accent} strokeWidth={2} />
    </g>
  );
};

export const ParkingStage: React.FC<{scene: 'a' | 'b'}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = PK_SCENES[scene];
  const built = buildPark(s);
  const t = Math.min(frame / fps, built.T - 0.001);

  // 定位当前段
  let seg = built.segs[built.segs.length - 1];
  for (const sg of built.segs) if (t < sg.t0 + sg.dur) { seg = sg; break; }
  const k = win(t, seg.t0, seg.t0 + seg.dur);
  const ke = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;

  let x: number, y: number, a: number;
  if (seg.type === 'move') {
    a = seg.a;
    x = seg.fx + (seg.tx - seg.fx) * ke;
    y = seg.fy + (seg.ty - seg.fy) * ke;
  } else if (seg.type === 'steer') {
    a = seg.from + (seg.to - seg.from) * ke;
    x = seg.x; y = seg.y;
  } else {
    a = 0; x = seg.x; y = seg.y;
  }

  const ph = seg.ph;
  const rearA = (a * R_MAX) / F_MAX;
  const showPlan = t >= built.tTap && t < built.tDone;
  const planOp = showPlan ? Math.min(1, win(t, built.tTap, built.tTap + 0.3) * 0.85) : 0;
  const ck = t >= built.tDone + 0.4 ? win(t, built.tDone + 0.4, built.tDone + 0.85) : 0;
  const tapK = seg.type === 'tap' ? win(t, seg.t0, seg.t0 + 0.8) : -1;
  const phStart = built.phStarts[ph] ?? 0;
  const capK = win(t, phStart, phStart + 0.45);
  const slotState = t < built.tTap ? 'idle' : t < built.tDone ? 'active' : 'done';

  // 信息卡贴车左下方，随车移动（禁止放画面边角）；stage(1000×560) → css(1920×1075)
  const KX = 1.92, KY = 1075 / 560;
  const CARD_W = 274, CARD_H = 176;
  const cardRight = Math.min(Math.max(x - CAR_W / 2 - 28, 202), 500);
  const cardCY = Math.min(Math.max(y + 140, 130), 466);
  const cardTop = cardCY - CARD_H / 2;
  const tipY = cardTop + 36;
  const leadX = x - CAR_W / 2 - 8;
  const leadY = y + CAR_H * 0.22;

  return (
    <AbsoluteFill style={{background: C.stageBg, fontFamily: F_UI}}>
      <Img src={ES9_TOP_URI} style={{position: 'absolute', width: 1, height: 1, opacity: 0}} />
      <svg viewBox="0 0 1000 560" style={{position: 'absolute', inset: 0, width: 1920, height: 1075}}>
        <defs>
          <mask id="carTopMask">
            <path d={CAR_TOP_BODY} fill="#fff" />
          </mask>
        </defs>

        {/* 车位列：开口朝左（虚线），右侧封闭 */}
        <line x1={SLOT.x - SLOT.w / 2} y1={0} x2={SLOT.x - SLOT.w / 2} y2={560}
          stroke={C.ink3} strokeWidth={2} strokeDasharray="10 8" opacity={0.5} />
        <line x1={SLOT.x + SLOT.w / 2} y1={0} x2={SLOT.x + SLOT.w / 2} y2={560}
          stroke={C.ink3} strokeWidth={2.5} opacity={0.55} />
        <path d={`M${SLOT.x - SLOT.w / 2} ${SLOT.y - SLOT.h / 2} H${SLOT.x + SLOT.w / 2}`}
          stroke={C.ink3} strokeWidth={2.5} opacity={0.55} />
        <path d={`M${SLOT.x - SLOT.w / 2} ${SLOT.y + SLOT.h / 2} H${SLOT.x + SLOT.w / 2}`}
          stroke={C.ink3} strokeWidth={2.5} opacity={0.55} />

        {/* 目标车位高亮 */}
        <rect
          x={SLOT.x - SLOT.w / 2 + 3} y={SLOT.y - SLOT.h / 2 + 3}
          width={SLOT.w - 6} height={SLOT.h - 6} rx={4}
          fill={slotState === 'done' ? C.okWash : C.accentWash}
          stroke={slotState === 'done' ? C.ok : C.accent}
          strokeWidth={2}
          opacity={slotState === 'idle' ? 0 : 1}
        />

        {/* 邻车（同一资产，压暗表示非主角） */}
        {NEIGHBORS.map((n, i) => (
          <g key={i} transform={`translate(${n.x} ${n.y})`} opacity={0.72}>
            <CarTop />
          </g>
        ))}

        {/* 规划路径（碎步折线） */}
        <polyline points={built.plan} fill="none" stroke={C.accent} strokeWidth={2}
          strokeDasharray="4 7" strokeLinecap="round" opacity={planOp} />

        {/* 目标虚影 */}
        <rect x={SLOT.x - CAR_W / 2} y={SLOT.y - CAR_H / 2} width={CAR_W} height={CAR_H} rx={16}
          fill="none" stroke={C.accent} strokeWidth={2} strokeDasharray="7 7" opacity={planOp} />

        {/* 主车 + 转向示意轮 */}
        <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}>
          <ellipse cx={0} cy={CAR_H / 2 - 6} rx={CAR_W * 0.42} ry={8} fill="#5C7070" opacity={0.14} />
          <CarTop />
          <SteerWheel ax={TOP_ANCHORS['wheel.fl'].x} ay={TOP_ANCHORS['wheel.fl'].y} deg={a} />
          <SteerWheel ax={TOP_ANCHORS['wheel.fr'].x} ay={TOP_ANCHORS['wheel.fr'].y} deg={a} />
          <SteerWheel ax={TOP_ANCHORS['wheel.rl'].x} ay={TOP_ANCHORS['wheel.rl'].y} deg={rearA} />
          <SteerWheel ax={TOP_ANCHORS['wheel.rr'].x} ay={TOP_ANCHORS['wheel.rr'].y} deg={rearA} />

        </g>

        {/* 信息卡指引线：卡片 → 车身左下角 */}
        <g opacity={0.9}>
          <path d={`M${cardRight} ${tipY} L${leadX} ${leadY}`} stroke={ph === 4 ? C.ok : C.accent}
            strokeWidth={1.6} strokeDasharray="5 5" fill="none" />
          <circle cx={leadX} cy={leadY} r={3.5} fill={ph === 4 ? C.ok : C.accent} />
          <path d={`M${cardRight} ${tipY - 9} L${cardRight + 13} ${tipY} L${cardRight} ${tipY + 9} Z`}
            fill={ph === 4 ? C.ok : C.accent} />
        </g>

        {/* 完成确认 */}
        {ck > 0 && (
          <g opacity={Math.min(1, ck * 2)}
            transform={`translate(${SLOT.x + 118} 120) scale(${easeOutBack(ck).toFixed(3)}) translate(${-(SLOT.x + 118)} -120)`}>
            <circle cx={SLOT.x + 118} cy={120} r={17} fill={C.panel} stroke={C.ok} strokeWidth={2.5} />
            <path d={`M${SLOT.x + 110} 120 L${SLOT.x + 116} 126 L${SLOT.x + 127} 114`}
              fill="none" stroke={C.ok} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
      </svg>

      {/* 视图标签（非信息展示，仅标注这是俯视图） */}
      <div style={{
        position: 'absolute', top: 24, left: 32, fontFamily: F_DATA, fontSize: 21,
        letterSpacing: '0.12em', color: C.ink3,
      }}>俯视图 · TOP VIEW</div>

      {/* 场景标签 */}
      <div style={{
        position: 'absolute', top: 24, left: 0, right: 0, display: 'flex', justifyContent: 'center',
        opacity: Math.min(win(t, 0.2, 0.7), 1 - win(t, 3.0, 3.6)),
      }}>
        <span style={{
          fontSize: 22, color: C.ink2, background: C.panel,
          border: `1.5px solid ${C.line}`, borderRadius: 999, padding: '8px 22px',
        }}>{s.chip}</span>
      </div>

      {/* 贴车信息卡（跟随车身，像弹窗一样从车旁弹出） */}
      <div style={{
        position: 'absolute',
        left: (cardRight - CARD_W) * KX, top: cardTop * KY,
        width: CARD_W * KX, boxSizing: 'border-box',
        background: C.panel, border: `1.5px solid ${ph === 4 ? C.ok : C.accent}`,
        borderRadius: 20, padding: '20px 26px 22px',
        boxShadow: '0 10px 28px rgba(92,112,112,0.16)',
      }}>
        {/* 头部：一键泊入状态 + 步骤号 */}
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
          <div style={{position: 'relative', display: 'flex', alignItems: 'center', gap: 12}}>
            {tapK >= 0 && (
              <div style={{
                position: 'absolute', left: -6, top: -6, width: 26, height: 26, borderRadius: '50%',
                border: `3px solid ${C.accent}`,
                opacity: 0.9 * (1 - (tapK % 0.5) / 0.5),
                transform: `scale(${1 + 0.9 * ((tapK % 0.5) / 0.5)})`,
              }} />
            )}
            <i style={{
              width: 14, height: 14, borderRadius: '50%', flex: 'none',
              background: ph > 0 ? (ph === 4 ? C.ok : C.accent) : C.ink3,
              boxShadow: ph > 0 ? `0 0 0 5px ${ph === 4 ? C.okWash : C.accentWash}` : 'none',
            }} />
            <span style={{fontSize: 21, color: ph > 0 ? C.ink : C.ink2}}>一键平移泊入</span>
          </div>
          <span style={{fontFamily: F_DATA, fontSize: 17, color: C.ink3, letterSpacing: '0.08em'}}>
            {String(ph + 1).padStart(2, '0')} / 05
          </span>
        </div>

        <div style={{height: 1, background: C.line, margin: '15px 0 16px'}} />

        {/* 字幕 */}
        <div style={{
          fontSize: 26, lineHeight: 1.35, fontWeight: 700,
          color: ph === 4 ? C.ok : C.ink,
          opacity: capK, transform: `translateY(${(1 - capK) * 8}px)`,
        }}>{s.caps[ph]}</div>

        {/* 转角读数 */}
        <div style={{
          display: 'flex', gap: 22, marginTop: 16, fontFamily: F_DATA, fontSize: 20,
          color: C.ink2, fontVariantNumeric: 'tabular-nums',
        }}>
          <span>前轮 <b style={{color: C.accent, fontWeight: 600}}>{(a > 0 ? '+' : '') + a.toFixed(0)}°</b></span>
          <span>后轮 <b style={{color: C.accent, fontWeight: 600}}>{(a > 0 ? '+' : '') + rearA.toFixed(1)}°</b></span>
        </div>

        {/* 进度点 */}
        <div style={{display: 'flex', gap: 11, marginTop: 18}}>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} style={{
              width: 12, height: 12, borderRadius: '50%',
              background: i <= ph ? (ph === 4 ? C.ok : C.accent) : C.line,
              transform: i === ph ? 'scale(1.25)' : 'none',
            }} />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
