import React from 'react';
import {AbsoluteFill, Img, useCurrentFrame, useVideoConfig} from 'remotion';
import {ES9_TOP_URI} from './es9-top-photo';
import {
  CARD_H, CARD_W, CAR_BBOX, CAR_H, CAR_SCALE, CAR_SRC, CAR_TOP_BODY, CAR_W, F_DATA, F_UI,
  HEADLIGHTS, HEADLIGHT_FILLS, NEIGHBORS, PK_SCENES, SLOT, SLOT_L, SLOT_R, T_COLORS as C, TOP_ANCHORS,
  buildPark, cardBox, easeOutBack, leadPoint, poseAt, win,
} from './parking-data';

/** 车辆贴图（车头朝上），以车身中心为原点；ego=true 时描一圈主色轮廓，与邻车区分 */
const CarTop: React.FC<{opacity?: number; ego?: boolean}> = ({opacity = 1, ego = false}) => (
  <g
    opacity={opacity}
    transform={`scale(${CAR_SCALE}) translate(${-(CAR_BBOX.x0 + CAR_BBOX.x1) / 2} ${-(CAR_BBOX.y0 + CAR_BBOX.y1) / 2})`}
  >
    <image href={ES9_TOP_URI} width={CAR_SRC.w} height={CAR_SRC.h} mask="url(#carTopMask)" />
    {/* 前大灯：三层实心刀锋（暗壳 → 暖白灯体 → 高亮灯芯）。
        照片里的灯带只有几像素，在浅底上会糊掉，叠这一层让它读得出来 */}
    {HEADLIGHT_FILLS.map((L) => (
      <g key={L.key} fill={L.fill} opacity={L.opacity}>
        <path d={HEADLIGHTS.left[L.key]} />
        <path d={HEADLIGHTS.right[L.key]} />
      </g>
    ))}
    {ego && <path d={CAR_TOP_BODY} fill="none" stroke={C.accent} strokeWidth={5} opacity={0.55} />}
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

/** 转角标注：车身轴线（虚线）+ 转角圆弧 + 读数（读数反向旋转，保持水平可读） */
const SteerAnnot: React.FC<{ax: number; ay: number; deg: number; th: number; op: number; side: number}> =
  ({ax, ay, deg, th, op, side}) => {
    if (op <= 0.01) return null;
    const x = (ax - 0.5) * CAR_W;
    const y = (ay - 0.5) * CAR_H;
    const R = 38;
    const a0 = -90, a1 = -90 + deg;
    const p = (a: number) => `${(R * Math.cos(a * Math.PI / 180)).toFixed(2)},${(R * Math.sin(a * Math.PI / 180)).toFixed(2)}`;
    return (
      <g transform={`translate(${x} ${y})`} opacity={op}>
        <line x1={0} y1={0} x2={0} y2={-R - 4} stroke={C.ink4} strokeWidth={1.4} strokeDasharray="4 4" />
        <line x1={0} y1={0}
          x2={(R + 4) * Math.cos(a1 * Math.PI / 180)} y2={(R + 4) * Math.sin(a1 * Math.PI / 180)}
          stroke={C.accent} strokeWidth={1.8} />
        <path d={`M${p(a0)} A${R} ${R} 0 0 ${deg > 0 ? 1 : 0} ${p(a1)}`}
          fill="none" stroke={C.accent} strokeWidth={2.4} />
        <g transform={`translate(${(side * 46).toFixed(1)} ${-R - 6}) rotate(${(-th).toFixed(2)})`}>
          <rect x={-30} y={-13} width={60} height={26} rx={13} fill={C.panel} stroke={C.accent} strokeWidth={1.4} />
          <text x={0} y={5} textAnchor="middle" fontFamily={F_DATA} fontSize={16} fill={C.accent}>
            {Math.abs(deg).toFixed(0)}°
          </text>
        </g>
      </g>
    );
  };

export const ParkingStage: React.FC<{scene: 'a' | 'b'}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = PK_SCENES[scene];
  const built = buildPark(s);
  const t = Math.min(frame / fps, built.T - 0.001);

  const {x, y, th, f, r, rx, ry, ph, seg} = poseAt(built, t);

  const showPlan = t >= built.tTap && t < built.tDone;
  const planOp = showPlan ? Math.min(1, win(t, built.tTap, built.tTap + 0.3) * 0.85) : 0;
  const ck = t >= built.tDone + 0.4 ? win(t, built.tDone + 0.4, built.tDone + 0.85) : 0;
  const tapK = seg.type === 'still' && seg.tap ? win(t, seg.t0, seg.t0 + 0.8) : -1;
  const phStart = built.phStarts[ph] ?? 0;
  const capK = win(t, phStart, phStart + 0.45);
  const slotState = t < built.tTap ? 'idle' : t < built.tDone ? 'active' : 'done';
  // 转角标注只在「打角说明」相位出现
  const p2 = built.phStarts[2], p3 = built.phStarts[3];
  const annOp = Math.min(win(t, p2 + 0.3, p2 + 0.75), 1 - win(t, p3 - 0.35, p3 - 0.05));

  // stage(1000×560) → css(1920×1075)
  const KX = 1.92, KY = 1075 / 560;
  const card = cardBox(x, y, th);
  const tipY = card.top + 36;
  const [leadX, leadY] = leadPoint(x, y, th);
  const accent = ph === 4 ? C.ok : C.accent;

  return (
    <AbsoluteFill style={{background: C.stageBg, fontFamily: F_UI}}>
      <Img src={ES9_TOP_URI} style={{position: 'absolute', width: 1, height: 1, opacity: 0}} />
      <svg viewBox="0 0 1000 560" style={{position: 'absolute', inset: 0, width: 1920, height: 1075}}>
        <defs>
          <mask id="carTopMask">
            <path d={CAR_TOP_BODY} fill="#fff" />
          </mask>
        </defs>

        {/* 车位列：开口朝左（虚线，临车道），右侧封闭 */}
        <line x1={SLOT_L} y1={0} x2={SLOT_L} y2={560}
          stroke={C.ink3} strokeWidth={2} strokeDasharray="10 8" opacity={0.5} />
        <line x1={SLOT_R} y1={0} x2={SLOT_R} y2={560}
          stroke={C.ink3} strokeWidth={2.5} opacity={0.55} />
        <path d={`M${SLOT_L} ${SLOT.y - SLOT.h / 2} H${SLOT_R}`}
          stroke={C.ink3} strokeWidth={2.5} opacity={0.55} />
        <path d={`M${SLOT_L} ${SLOT.y + SLOT.h / 2} H${SLOT_R}`}
          stroke={C.ink3} strokeWidth={2.5} opacity={0.55} />

        {/* 目标车位高亮 */}
        <rect
          x={SLOT_L + 3} y={SLOT.y - SLOT.h / 2 + 3}
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

        {/* 目标虚影 */}
        <rect x={SLOT.x - CAR_W / 2} y={SLOT.y - CAR_H / 2} width={CAR_W} height={CAR_H} rx={16}
          fill="none" stroke={C.accent} strokeWidth={2} strokeDasharray="7 7" opacity={planOp} />

        {/* 主车：整体随航向旋转（接地阴影 / 示意轮 / 车身轴线都跟着转） */}
        <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${th.toFixed(3)})`}>
          <ellipse cx={0} cy={CAR_H / 2 - 6} rx={CAR_W * 0.42} ry={8} fill="#5C7070" opacity={0.14} />
          <CarTop ego />
          {/* 车身纵轴参考线：与车位竖线对照即可读出偏航 */}
          <line x1={0} y1={-CAR_H / 2 - 26} x2={0} y2={CAR_H / 2 + 26}
            stroke={C.accent} strokeWidth={1.4} strokeDasharray="6 6" opacity={planOp ? 0.6 : 0.35} />
          <SteerWheel ax={TOP_ANCHORS['wheel.fl'].x} ay={TOP_ANCHORS['wheel.fl'].y} deg={f} />
          <SteerWheel ax={TOP_ANCHORS['wheel.fr'].x} ay={TOP_ANCHORS['wheel.fr'].y} deg={f} />
          <SteerWheel ax={TOP_ANCHORS['wheel.rl'].x} ay={TOP_ANCHORS['wheel.rl'].y} deg={r} />
          <SteerWheel ax={TOP_ANCHORS['wheel.rr'].x} ay={TOP_ANCHORS['wheel.rr'].y} deg={r} />
          <SteerAnnot ax={TOP_ANCHORS['wheel.fr'].x} ay={TOP_ANCHORS['wheel.fr'].y} deg={f} th={th} op={annOp} side={1} />
          <SteerAnnot ax={TOP_ANCHORS['wheel.rl'].x} ay={TOP_ANCHORS['wheel.rl'].y} deg={r} th={th} op={annOp} side={-1} />
        </g>

        {/* 规划路径：后轴点轨迹（画在车身之上，否则会被车体挡住） */}
        <polyline points={built.plan} fill="none" stroke={C.accent} strokeWidth={2.2}
          strokeDasharray="5 6" strokeLinecap="round" strokeLinejoin="round" opacity={planOp} />
        <circle cx={rx} cy={ry} r={4} fill={C.panel} stroke={accent} strokeWidth={2} opacity={planOp ? 1 : 0.5} />

        {/* 信息卡指引线：卡片 → 车身左侧（落点随车身旋转） */}
        <g opacity={0.9}>
          <path d={`M${card.right} ${tipY} L${leadX.toFixed(2)} ${leadY.toFixed(2)}`} stroke={accent}
            strokeWidth={1.6} strokeDasharray="5 5" fill="none" />
          <circle cx={leadX} cy={leadY} r={3.5} fill={accent} />
          <path d={`M${card.right} ${tipY - 9} L${card.right + 13} ${tipY} L${card.right} ${tipY + 9} Z`}
            fill={accent} />
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
        opacity: Math.min(win(t, 0.2, 0.7), 1 - win(t, 3.4, 4.0)),
      }}>
        <span style={{
          fontSize: 22, color: C.ink2, background: C.panel,
          border: `1.5px solid ${C.line}`, borderRadius: 999, padding: '8px 22px',
        }}>{s.chip}</span>
      </div>

      {/* 贴车信息卡（跟随车身，像弹窗一样从车旁弹出） */}
      <div style={{
        position: 'absolute',
        left: card.left * KX, top: card.top * KY,
        width: CARD_W * KX, boxSizing: 'border-box',
        background: C.panel, border: `1.5px solid ${accent}`,
        borderRadius: 20, padding: '20px 26px 22px',
        boxShadow: '0 10px 28px rgba(92,112,112,0.16)',
      }}>
        {/* 头部：功能状态 + 步骤号 */}
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
              background: ph > 0 ? accent : C.ink3,
              boxShadow: ph > 0 ? `0 0 0 5px ${ph === 4 ? C.okWash : C.accentWash}` : 'none',
            }} />
            <span style={{fontSize: 21, color: ph > 0 ? C.ink : C.ink2}}>
              {scene === 'a' ? '四轮转向 · 摆正车头' : '四轮转向 · 平移入位'}
            </span>
          </div>
          <span style={{fontFamily: F_DATA, fontSize: 17, color: C.ink3, letterSpacing: '0.08em'}}>
            {String(ph + 1).padStart(2, '0')} / 05
          </span>
        </div>

        <div style={{height: 1, background: C.line, margin: '15px 0 16px'}} />

        {/* 字幕 */}
        <div style={{
          fontSize: 25, lineHeight: 1.35, fontWeight: 700,
          color: ph === 4 ? C.ok : C.ink,
          opacity: capK, transform: `translateY(${(1 - capK) * 8}px)`,
        }}>{s.caps[ph]}</div>

        {/* 读数：前轮 / 后轮 / 车身偏航 */}
        <div style={{
          display: 'flex', gap: 18, marginTop: 16, fontFamily: F_DATA, fontSize: 19,
          color: C.ink2, fontVariantNumeric: 'tabular-nums',
        }}>
          <span>前轮 <b style={{color: C.accent, fontWeight: 600}}>{(f >= 0 ? '+' : '') + f.toFixed(0)}°</b></span>
          <span>后轮 <b style={{color: C.accent, fontWeight: 600}}>{(r >= 0 ? '+' : '') + r.toFixed(1)}°</b></span>
          <span>车身 <b style={{color: Math.abs(th) < 0.3 ? C.ok : C.warn, fontWeight: 600}}>{Math.abs(th).toFixed(1)}°</b></span>
        </div>

        {/* 进度点 */}
        <div style={{display: 'flex', gap: 11, marginTop: 18}}>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} style={{
              width: 12, height: 12, borderRadius: '50%',
              background: i <= ph ? accent : C.line,
              transform: i === ph ? 'scale(1.25)' : 'none',
            }} />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
