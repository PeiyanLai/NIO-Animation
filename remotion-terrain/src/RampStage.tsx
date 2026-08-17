import React from 'react';
import {AbsoluteFill, Img, useCurrentFrame, useVideoConfig} from 'remotion';
import {PHOTO_URI} from './photo';
import {CAR_BODY} from './data';
import {Dog} from './Dog';
import {
  AP_PATH_PHOTO, AP_PATH_STAGE, CARD_H, CARD_W, CLEATS, DOG, GY, HINGE, HOLE, JUMPS, KX, KY, LIP,
  PILL, PLACE, RAMP_DEG, RAMP_DEG_TXT, RAMP_FOOT, RAMP_LEN, RAMP_THICK,
  RAMP_KEYS, RAMP_SCENES, REACH_MM, SHORT_PCT, TG_PATH_PHOTO, TG_PATH_STAGE,
  TIRES, TIRE_GROUND, T_COLORS as C, F_DATA, F_UI, cardBox, dogAt, easeOutBack,
  focusAt, gateDegAt, gateKAt, phaseOf, phaseStart, rampAt, rampJoint, rampPt, segLow,
  win, type RampKey, type RampState,
} from './ramp-data';

const N = (v: number) => v.toFixed(2);

/* ───────── 坡道板（局部坐标：x=0 下端 → x=len 上端，y=0 坡面，+y 向板下）───────── */
const Board: React.FC<{len: number; hook: boolean; lit: number}> = ({len, hook, lit}) => (
  <g>
    {/* 板体（厚度 RAMP_THICK ↔ 90mm） */}
    <rect x={0} y={0} width={len} height={RAMP_THICK} fill={C.accentDim} />
    <rect x={0} y={RAMP_THICK - 2.4} width={len} height={2.4} fill={C.ink4} />
    {/* 近侧护条 */}
    <rect x={0} y={-3.4} width={len} height={3.6} rx={1.4} fill={C.ink3} />
    {/* 防滑横棱（等距解析生成） */}
    {CLEATS.filter((c) => c < len - 7).map((c) => (
      <rect key={c} x={c} y={-5.8} width={2.4} height={5.6} rx={1} fill={C.ink4} />
    ))}
    {/* 端头封边 */}
    <rect x={-1.6} y={-3.4} width={3.2} height={RAMP_THICK + 3.4} rx={1.2} fill={C.ink3} />
    {/* 顶端挂钩：搭在门槛上 */}
    {hook && (
      <path
        d={`M${N(len - 17)} -3.4 L${N(len + 6)} -3.4 L${N(len + 6)} 12 L${N(len + 1.4)} 12 L${N(len + 1.4)} 1.6 L${N(len - 17)} 1.6 Z`}
        fill={C.ink2}
      />
    )}
    {/* 就位后坡面高亮（唯一落在坡道上的主色，面积极小） */}
    {lit > 0.01 && (
      <line x1={1} y1={-6.4} x2={len - 2} y2={-6.4} stroke={C.accent} strokeWidth={1.6}
        opacity={0.55 * lit} strokeLinecap="round" />
    )}
  </g>
);

/** 折叠斜坡架：段一（上）+ 段二（下），fold=180 时段二压在段一之上 */
const RampRig: React.FC<{r: RampState}> = ({r}) => {
  if (!r.on) return null;
  const j = rampJoint(r);
  const a1 = segLow(r.topX, r.topY, r.angA, r.segLen);
  const ang2 = r.angA + r.fold;
  const a2 = segLow(j.x, j.y, ang2, r.segLen);
  const settled = Math.abs(r.fold) < 0.5 && r.seated > 0.01;
  return (
    <g>
      <g transform={`translate(${N(a2.x)} ${N(a2.y)}) rotate(${N(-ang2)})`}>
        <Board len={r.segLen} hook={false} lit={settled ? r.seated : 0} />
      </g>
      <g transform={`translate(${N(a1.x)} ${N(a1.y)}) rotate(${N(-r.angA)})`}>
        <Board len={r.segLen} hook lit={settled ? r.seated : 0} />
      </g>
      {/* 折叠铰链 */}
      <circle cx={j.x} cy={j.y + RAMP_THICK / 2} r={3.1} fill={C.ink2} />
    </g>
  );
};

/* ───────── 信息块 ───────── */
const Pill: React.FC<{
  r: {x: number; y: number; w: number; h: number}; op: number; tone?: string;
  lines: [string, string?];
}> = ({r, op, tone = C.accent, lines}) => {
  if (op <= 0.01) return null;
  const two = lines[1] !== undefined;
  return (
    <g opacity={op}>
      <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={r.h / 2 > 16 ? 12 : r.h / 2}
        fill={C.panel} stroke={tone} strokeWidth={1.4} />
      {two ? (
        <>
          <text x={r.x + r.w / 2} y={r.y + 16} textAnchor="middle" fontFamily={F_UI}
            fontSize={11.5} fill={C.ink3}>{lines[0]}</text>
          <text x={r.x + r.w / 2} y={r.y + 34} textAnchor="middle" fontFamily={F_DATA}
            fontSize={16} fill={tone} fontWeight={600}>{lines[1]}</text>
        </>
      ) : (
        <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 5} textAnchor="middle" fontFamily={F_DATA}
          fontSize={14.5} fill={tone} fontWeight={600}>{lines[0]}</text>
      )}
    </g>
  );
};

/** 双向箭头（竖直） */
const VArrow: React.FC<{x: number; y0: number; y1: number; tone: string; op: number}> =
  ({x, y0, y1, tone, op}) => (
    <g opacity={op} stroke={tone} strokeWidth={1.8} fill={tone}>
      <line x1={x} y1={y0 + 5} x2={x} y2={y1 - 5} />
      <path d={`M${x} ${y0} l-4.4 7 h8.8 Z`} stroke="none" />
      <path d={`M${x} ${y1} l-4.4 -7 h8.8 Z`} stroke="none" />
    </g>
  );

/* ───────── 主组件 ───────── */
export const RampStage: React.FC<{scene: RampKey}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = RAMP_SCENES[scene];
  const t = Math.min(frame / fps, s.T - 0.001);

  const uid = scene;
  const gateDeg = gateDegAt(scene, t);
  const gateK = gateKAt(scene, t);
  const open = gateK > 0.002;
  const dog = dogAt(scene, t);
  const ramp = rampAt(scene, t);
  const focus = focusAt(scene, t);
  const card = cardBox(focus.x);
  const ph = phaseOf(s, t);
  const capK = win(t, phaseStart(s, ph), phaseStart(s, ph) + 0.42);
  const last = ph === s.ph.length - 1;
  const accent = last && scene === 'c4' ? C.ok : scene === 'c2' ? C.warn : C.accent;

  // 第一章：高度标尺
  const rulerOp = scene === 'c1' ? win(t, 5.6, 6.05) : 0;
  const rulerLabelOp = scene === 'c1' ? win(t, 5.95, 6.4) : 0;
  // 第二章：起跳参考线
  const lipLineOp = scene === 'c2' ? win(t, 2.0, 2.4) : 0;
  const apexOp = scene === 'c2' ? win(t, 2.9, 3.3) : 0;
  const apexY = dog.senior ? JUMPS[1].apex : JUMPS[0].apex;
  // 落地冲击环
  const impact = (() => {
    if (scene !== 'c2') return null;
    for (const j of JUMPS) {
      const k = win(t, j.t1, j.t1 + 0.55);
      if (k > 0 && k < 1) return {k, x: j.x1 + DOG.witherPx * 0.52, y: GY - DOG.witherPx * 0.42};
    }
    return null;
  })();
  // 第三/四章：坡度标注
  const triOp = scene === 'c3' ? win(t, 6.2, 6.6) : scene === 'c4' ? 0.34 : 0;
  // 坡长读数只在第三章讲；第四章犬要走过坡面中段，那里不能压卡片，只留坡度提示
  const lenOp = scene === 'c3' ? win(t, 6.4, 6.8) : 0;
  const angOp = scene === 'c3' ? win(t, 6.4, 6.8) : scene === 'c4' ? 0.6 : 0;
  // 第四章：完成勾
  const ck = scene === 'c4' ? win(t, 10.6, 11.05) : 0;

  const foot = RAMP_FOOT;
  const arcR = 44;
  const arcEnd = {
    x: foot.x + arcR * Math.cos((-RAMP_DEG * Math.PI) / 180),
    y: foot.y + arcR * Math.sin((-RAMP_DEG * Math.PI) / 180),
  };

  return (
    <AbsoluteFill style={{background: C.stageBg, fontFamily: F_UI}}>
      {/* 预载照片：Img 阻塞渲染，保证同帧 SVG image 已就绪 */}
      <Img src={PHOTO_URI} style={{position: 'absolute', width: 1, height: 1, opacity: 0}} />

      <svg viewBox="0 0 1000 560" style={{position: 'absolute', inset: 0, width: 1920, height: 1075}}>
        <defs>
          {/* 车身抠形：CAR_BODY + 照片自带轮胎；尾门开启时挖出装载口 */}
          <mask id={`carMask-${uid}`}>
            <path d={CAR_BODY} fill="#fff" />
            {TIRES.map((w, i) => (
              <circle key={i} cx={w.cx} cy={w.cy} r={w.r} fill="#fff" />
            ))}
            {open && <path d={AP_PATH_PHOTO} fill="#000" />}
          </mask>
          <clipPath id={`hole-${uid}`}>
            <path d={AP_PATH_STAGE} />
          </clipPath>
          <clipPath id={`gate-${uid}`}>
            <path d={TG_PATH_STAGE} />
          </clipPath>
          {/* 装载口内景：上半透出远侧玻璃/顶棚（偏亮），越往下越是行李厢阴影。
              整块画成纯黑会读成「车身被挖掉一块」，不是「看进去了」。 */}
          <linearGradient id={`cavity-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#B8CFD0" />
            <stop offset="34%" stopColor="#6E8384" />
            <stop offset="70%" stopColor="#334142" />
            <stop offset="100%" stopColor="#1B2323" />
          </linearGradient>
        </defs>

        {/* 地面（纯色，无网格线） */}
        <rect x={0} y={GY} width={1000} height={560 - GY} fill={C.line} />
        <line x1={0} y1={GY} x2={1000} y2={GY} stroke={C.accentDim} strokeWidth={2} />

        {/* 接地投影：整车 + 轮下压暗 + 尾门开启后车尾投影略变 */}
        <ellipse cx={760} cy={GY + 1} rx={228} ry={8} fill="#5C7070" opacity={0.16} />
        {TIRE_GROUND.map((w, i) => (
          <ellipse key={i} cx={w.x} cy={GY} rx={w.r * 0.92} ry={6.5} fill="#2E3D3D" opacity={0.3} />
        ))}
        <ellipse cx={520} cy={GY + 1} rx={62 + 20 * gateK} ry={6} fill="#5C7070"
          opacity={0.06 + 0.07 * gateK} />

        {/* ── 装载口内景（概念示意）：内腔暗部 + 载物平面 —— 洞很窄，只按比例画 ── */}
        {open && (
          <g clipPath={`url(#hole-${uid})`} opacity={gateK}>
            <rect x={HOLE.x0 - 4} y={HOLE.y0 - 4} width={HOLE.x1 - HOLE.x0 + 8}
              height={HOLE.y1 - HOLE.y0 + 8} fill={`url(#cavity-${uid})`} />
            {/* 载物平面：y 落在 LIP 高度 */}
            <rect x={HOLE.x0 - 4} y={LIP.y - 5.6} width={HOLE.x1 - HOLE.x0 + 8} height={6.6}
              fill={C.ink4} opacity={0.9} />
            <rect x={HOLE.x0 - 4} y={LIP.y - 6.2} width={HOLE.x1 - HOLE.x0 + 8} height={1.4}
              fill={C.line} opacity={0.85} />
          </g>
        )}

        {/* 斜坡架：画在车身照片之下，收在车里时自然被车身遮住、只从装载口露出 */}
        <RampRig r={ramp} />
        {ramp.on && ramp.seated > 0.02 && (
          <ellipse cx={foot.x + 4} cy={GY + 2} rx={26} ry={4.6} fill="#5C7070"
            opacity={0.16 * ramp.seated} />
        )}

        {/* 犬：画在车身照片之下，所以走到车尾时前身自然被车身遮住、只从装载口露出。
            跨过门槛之后换成「只从洞里可见」的那一份 —— 否则躯干后半截会挂在车外的空气里。 */}
        {dog.y >= GY - 0.5 && (
          <ellipse cx={dog.x} cy={GY + 1} rx={DOG.bodyPx * 0.46} ry={5}
            fill="#5C7070" opacity={0.16} />
        )}
        {dog.inside < 0.995 && (
          <g transform={`translate(${N(dog.x)} ${N(dog.y)}) rotate(${N(dog.rot)})`}>
            <Dog t={t} pose={dog.pose} h={DOG.witherPx} senior={dog.senior} op={1 - dog.inside} />
          </g>
        )}
        {dog.inside > 0.005 && (
          <g clipPath={`url(#hole-${uid})`}>
            <g transform={`translate(${N(dog.x)} ${N(dog.y)}) rotate(${N(dog.rot)})`}>
              <Dog t={t} pose={dog.pose} h={DOG.witherPx} senior={dog.senior} op={dog.inside} />
            </g>
          </g>
        )}

        {/* 车内背光：把洞里的一切（内景 / 坡架 / 犬）统一压暗 */}
        {open && (
          <g clipPath={`url(#hole-${uid})`}>
            <rect x={HOLE.x0 - 4} y={HOLE.y0 - 4} width={HOLE.x1 - HOLE.x0 + 8}
              height={HOLE.y1 - HOLE.y0 + 8} fill={C.ink} opacity={0.34 * gateK} />
          </g>
        )}

        {/* 车身照片（静止，用照片自己的轮子；尾门开启时车身上出现装载口的洞） */}
        <g transform={PLACE}>
          <image href={PHOTO_URI} width={1020} height={460} mask={`url(#carMask-${uid})`} />
        </g>

        {/* 抬起的尾门：同一张照片 clip 到轮廓，绕 HINGE 旋转。
            GATE_OPEN_DEG 定义在照片坐标系（已镜像），舞台里旋转方向取负号。 */}
        {open && (
          <g transform={`rotate(${N(-gateDeg)} ${N(HINGE.x)} ${N(HINGE.y)})`}>
            <g clipPath={`url(#gate-${uid})`}>
              <g transform={PLACE}>
                <image href={PHOTO_URI} width={1020} height={460} />
              </g>
            </g>
            <path d={TG_PATH_STAGE} fill="#1A1F1F" opacity={0.28} />
            <path d={TG_PATH_STAGE} fill="none" stroke={C.ink2} strokeWidth={1.5}
              strokeLinejoin="round" />
          </g>
        )}

        {/* ── 第一章：装载口离地高度标尺 ── */}
        {rulerOp > 0 && (
          <g opacity={rulerOp}>
            <line x1={432} y1={LIP.y} x2={LIP.x + 2} y2={LIP.y} stroke={C.accent}
              strokeWidth={1.4} strokeDasharray="5 4" />
            <line x1={432} y1={GY} x2={492} y2={GY} stroke={C.accent} strokeWidth={1.4}
              strokeDasharray="5 4" />
            <VArrow x={452} y0={LIP.y} y1={GY} tone={C.accent} op={1} />
            <circle cx={LIP.x} cy={LIP.y} r={3.4} fill={C.accent} />
          </g>
        )}
        <Pill r={PILL.c1H} op={rulerLabelOp} lines={['装载口离地（概念推算）', '≈ 787 mm']} />
        {rulerLabelOp > 0.01 && (
          <line x1={PILL.c1H.x + PILL.c1H.w - 12} y1={PILL.c1H.y + PILL.c1H.h}
            x2={452} y2={368} stroke={C.accent} strokeWidth={1.3} strokeDasharray="4 4"
            opacity={rulerLabelOp} />
        )}

        {/* ── 第二章：够不到的高度差 ── */}
        {lipLineOp > 0 && (
          <g opacity={lipLineOp}>
            <line x1={196} y1={LIP.y} x2={LIP.x} y2={LIP.y} stroke={C.accent} strokeWidth={1.5}
              strokeDasharray="6 5" />
            <circle cx={LIP.x} cy={LIP.y} r={3.2} fill={C.accent} />
          </g>
        )}
        {apexOp > 0 && (
          <g opacity={apexOp}>
            <rect x={196} y={LIP.y} width={252} height={apexY - LIP.y} fill={C.warn} opacity={0.16} />
            <line x1={196} y1={apexY} x2={448} y2={apexY} stroke={C.warn} strokeWidth={1.5}
              strokeDasharray="6 5" />
            <text x={322} y={(LIP.y + apexY) / 2 + 4.5} textAnchor="middle" fontFamily={F_UI}
              fontSize={11.5} fill={C.warn} fontWeight={700}>{`差 ~${SHORT_PCT}%`}</text>
          </g>
        )}
        <Pill r={PILL.c2Lip} op={lipLineOp} lines={['装载口下沿', '787 mm']} />
        <Pill r={PILL.c2Apex} op={apexOp} tone={C.warn}
          lines={['起跳最高点（前爪）', `≈ ${REACH_MM} mm`]} />
        {impact && (
          <g opacity={1 - impact.k}>
            <circle cx={impact.x} cy={impact.y} r={6 + 20 * impact.k} fill="none"
              stroke={C.warn} strokeWidth={2.6} />
            <circle cx={impact.x} cy={impact.y} r={3.4} fill={C.warn} />
          </g>
        )}

        {/* ── 第三/四章：坡度标注（直角三角形 + 角弧 + 三个读数）── */}
        {triOp > 0.01 && (
          <g opacity={triOp}>
            <line x1={foot.x} y1={GY} x2={LIP.x} y2={GY} stroke={C.ink3} strokeWidth={1.4}
              strokeDasharray="6 5" />
            <line x1={LIP.x} y1={GY} x2={LIP.x} y2={LIP.y} stroke={C.ink3} strokeWidth={1.4}
              strokeDasharray="6 5" />
            <path d={`M${LIP.x - 11} ${GY} L${LIP.x - 11} ${GY - 11} L${LIP.x} ${GY - 11}`}
              fill="none" stroke={C.ink3} strokeWidth={1.2} />
            <path d={`M${N(foot.x + arcR)} ${GY} A${arcR} ${arcR} 0 0 0 ${N(arcEnd.x)} ${N(arcEnd.y)}`}
              fill="none" stroke={C.accent} strokeWidth={2} />
            <text x={462} y={388} textAnchor="middle" fontFamily={F_DATA} fontSize={13}
              fill={C.ink2} transform="rotate(-90 462 388)">787 mm</text>
          </g>
        )}
        <Pill r={PILL.c3Len} op={lenOp} lines={['坡长（概念值）', '2000 mm']} />
        <Pill r={PILL.c3Ang} op={angOp} lines={[`坡度 ${RAMP_DEG_TXT}°`]} />
        {lenOp > 0.01 && (
          <>
            <line x1={PILL.c3Len.x + PILL.c3Len.w / 2} y1={PILL.c3Len.y + PILL.c3Len.h}
              x2={rampPt(0.5).x - 8} y2={rampPt(0.5).y - 8} stroke={C.accent} strokeWidth={1.3}
              strokeDasharray="4 4" opacity={lenOp} />
            <circle cx={rampPt(0.5).x - 8} cy={rampPt(0.5).y - 8} r={3} fill={C.accent}
              opacity={lenOp} />
          </>
        )}
        {angOp > 0.01 && (
          <line x1={PILL.c3Ang.x + PILL.c3Ang.w / 2} y1={PILL.c3Ang.y}
            x2={foot.x + 12} y2={GY - 6} stroke={C.accent} strokeWidth={1.3}
            strokeDasharray="4 4" opacity={angOp} />
        )}

        {/* 完成勾 */}
        {ck > 0 && (
          <g opacity={Math.min(1, ck * 2)}
            transform={`translate(452 296) scale(${N(easeOutBack(ck))}) translate(-452 -296)`}>
            <circle cx={452} cy={296} r={17} fill={C.panel} stroke={C.ok} strokeWidth={2.5} />
            <path d="M444 296 L450 302 L461 290" fill="none" stroke={C.ok} strokeWidth={4}
              strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}

        {/* 叙事卡的指向线：卡片右缘 → 焦点 */}
        <g opacity={0.92}>
          <path d={`M${N(card.x + card.w)} ${N(card.y + card.h * 0.62)} L${N(focus.x)} ${N(focus.y)}`}
            stroke={accent} strokeWidth={1.6} strokeDasharray="5 5" fill="none" />
          <circle cx={focus.x} cy={focus.y} r={3.5} fill={accent} />
          <path d={`M${N(card.x + card.w)} ${N(card.y + card.h * 0.62 - 9)} L${N(card.x + card.w + 13)} ${N(card.y + card.h * 0.62)} L${N(card.x + card.w)} ${N(card.y + card.h * 0.62 + 9)} Z`}
            fill={accent} />
        </g>
      </svg>

      {/* 视角标签（非信息展示，允许留在角上） */}
      <div style={{
        position: 'absolute', top: 24, left: 32, fontFamily: F_DATA, fontSize: 21,
        letterSpacing: '0.12em', color: C.ink3,
      }}>侧视图 · SIDE VIEW</div>

      {/* 章节标签（开场短暂出现） */}
      <div style={{
        position: 'absolute', top: 26, left: 0, right: 0, display: 'flex', justifyContent: 'center',
        opacity: Math.min(win(t, 0.2, 0.7), 1 - win(t, 3.0, 3.6)),
      }}>
        <span style={{
          fontSize: 22, color: C.ink2, background: C.panel,
          border: `1.5px solid ${C.line}`, borderRadius: 999, padding: '8px 22px',
        }}>{s.chip}</span>
      </div>

      {/* 贴主体的叙事卡（跟随焦点、clamp 在安全区） */}
      <div style={{
        position: 'absolute',
        left: card.x * KX, top: card.y * KY,
        width: CARD_W * KX, height: CARD_H * KY, boxSizing: 'border-box',
        background: C.panel, border: `1.5px solid ${accent}`,
        borderRadius: 20, padding: '18px 24px',
        boxShadow: '0 10px 28px rgba(92,112,112,0.16)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}>
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 11}}>
            <i style={{
              width: 13, height: 13, borderRadius: '50%', flex: 'none', background: accent,
              boxShadow: `0 0 0 5px ${accent === C.warn ? '#F6ECD6' : C.accentWash}`,
            }} />
            <span style={{fontSize: 19, color: C.ink2}}>{s.title}</span>
          </div>
          <span style={{fontFamily: F_DATA, fontSize: 16, color: C.ink3, letterSpacing: '0.08em'}}>
            {String(ph + 1).padStart(2, '0')} / 05
          </span>
        </div>
        <div style={{
          fontSize: 24, lineHeight: 1.3, fontWeight: 700, color: last ? accent : C.ink,
          opacity: capK, transform: `translateY(${(1 - capK) * 8}px)`,
        }}>{s.caps[ph]}</div>
        <div style={{display: 'flex', gap: 10}}>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} style={{
              width: 11, height: 11, borderRadius: '50%',
              background: i <= ph ? accent : C.line,
              transform: i === ph ? 'scale(1.25)' : 'none',
            }} />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const RAMP_COMPOSITIONS = RAMP_KEYS.map((k, i) => ({
  id: `Ramp${'ABCD'[i]}`,
  scene: k,
  frames: Math.round(RAMP_SCENES[k].T * 30),
}));

/** 自检：坡度/坡长/装载口高度必须自洽（断言脚本里也有一条同样的） */
export const RAMP_SELFCHECK =
  Math.abs(Math.sin((RAMP_DEG * Math.PI) / 180) * RAMP_LEN - (GY - LIP.y)) < 0.5;
