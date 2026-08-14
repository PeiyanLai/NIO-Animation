import React from 'react';
import {AbsoluteFill, Img, useCurrentFrame, useVideoConfig} from 'remotion';
import {ET9_URI} from './et9-photo';
import {
  CAR_BBOX, CAR_SRC, CAR_TOP_BODY, F_DATA, F_MAX, F_UI, NEIGHBORS, PK_SCENES, R_MAX,
  SLOT, T_COLORS as C, TOP_ANCHORS, buildPark, easeOutBack, win,
} from './parking-data';

// 车身在舞台上的显示尺寸：车长 250px（与车位 h=250 匹配，车位比车略长）
const CAR_H = 236;
const SCALE = CAR_H / (CAR_BBOX.y1 - CAR_BBOX.y0);
const CAR_W = (CAR_BBOX.x1 - CAR_BBOX.x0) * SCALE;

/** 车辆贴图（车头朝上），以车身中心为原点 */
const CarTop: React.FC<{opacity?: number}> = ({opacity = 1}) => (
  <g
    opacity={opacity}
    transform={`scale(${SCALE}) translate(${-(CAR_BBOX.x0 + CAR_BBOX.x1) / 2} ${-(CAR_BBOX.y0 + CAR_BBOX.y1) / 2})`}
  >
    <image href={ET9_URI} width={CAR_SRC.w} height={CAR_SRC.h} mask="url(#carTopMask)" />
  </g>
);

/** 转向示意轮：俯拍照片看不到车轮，用 HMI 风格示意层表现转角 */
const SteerWheel: React.FC<{ax: number; ay: number; deg: number}> = ({ax, ay, deg}) => {
  const x = (ax - 0.5) * CAR_W;
  const y = (ay - 0.5) * CAR_H;
  return (
    <g transform={`translate(${x} ${y}) rotate(${deg.toFixed(2)})`}>
      <rect x={-5} y={-13} width={10} height={26} rx={5} fill="#151A1A" opacity={0.9} />
      <rect x={-5} y={-13} width={10} height={26} rx={5} fill="none" stroke={C.accent} strokeWidth={2} />
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

  return (
    <AbsoluteFill style={{background: C.stageBg, fontFamily: F_UI}}>
      <Img src={ET9_URI} style={{position: 'absolute', width: 1, height: 1, opacity: 0}} />
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

          {/* 转角标注（动作阶段显示） */}
          {ph >= 2 && ph <= 3 && (
            <g opacity={0.95}>
              <line x1={-CAR_W / 2 - 92} y1={-CAR_H * 0.245} x2={-CAR_W / 2 - 10} y2={-CAR_H * 0.245}
                stroke={C.ink2} strokeWidth={1.5} />
              <text x={-CAR_W / 2 - 98} y={-CAR_H * 0.245 - 6} textAnchor="end" fontSize={15} fontWeight={700} fill={C.ink}>前轮 40°</text>
              <line x1={-CAR_W / 2 - 92} y1={CAR_H * 0.26} x2={-CAR_W / 2 - 10} y2={CAR_H * 0.26}
                stroke={C.ink2} strokeWidth={1.5} />
              <text x={-CAR_W / 2 - 98} y={CAR_H * 0.26 - 6} textAnchor="end" fontSize={15} fontWeight={700} fill={C.ink}>后轮 8°</text>
              <text x={-CAR_W / 2 - 98} y={CAR_H * 0.26 + 14} textAnchor="end" fontSize={12} fill={C.ink3}>同向 · 车身保持摆正</text>
            </g>
          )}
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

      {/* HUD */}
      <div style={{
        position: 'absolute', top: 24, left: 32, right: 32, display: 'flex',
        justifyContent: 'space-between', fontFamily: F_DATA, fontSize: 21,
        letterSpacing: '0.12em', color: C.ink3,
      }}>
        <span>俯视图 · TOP VIEW</span>
        <span>
          前轮 <b style={{color: C.accent, fontWeight: 600, fontVariantNumeric: 'tabular-nums'}}>
            {(a > 0 ? '+' : '') + a.toFixed(0)}°
          </b>
          {' · '}后轮 <b style={{color: C.accent, fontWeight: 600, fontVariantNumeric: 'tabular-nums'}}>
            {(a > 0 ? '+' : '') + rearA.toFixed(1)}°
          </b>
        </span>
      </div>

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

      {/* 一键泊入 pill */}
      <div style={{position: 'absolute', left: 32, bottom: 120}}>
        <div style={{
          position: 'relative', display: 'flex', alignItems: 'center', gap: 14,
          padding: '16px 26px', borderRadius: 999, background: C.panel,
          border: `1.5px solid ${ph > 0 ? C.accent : C.line}`,
          fontSize: 23, color: ph > 0 ? C.ink : C.ink2,
        }}>
          {tapK >= 0 && (
            <div style={{
              position: 'absolute', inset: -5, borderRadius: 999,
              border: `3px solid ${C.accent}`,
              opacity: 0.9 * (1 - (tapK % 0.5) / 0.5),
              transform: `scale(${1 + 0.45 * ((tapK % 0.5) / 0.5)})`,
            }} />
          )}
          <i style={{
            width: 14, height: 14, borderRadius: '50%',
            background: ph > 0 ? C.accent : C.ink3,
            boxShadow: ph > 0 ? `0 0 0 5px ${C.accentWash}` : 'none',
          }} />
          一键平移泊入
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
