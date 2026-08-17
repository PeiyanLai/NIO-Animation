import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Player, type PlayerRef} from '@remotion/player';
import {ParkingStage} from './ParkingStage';
import {PK_SCENES, buildPark, F_DATA, F_UI, T_COLORS as C} from './parking-data';

type K = 'a' | 'b';

const NOTES: [string, string][] = [
  ['运动学模型', '四轮转向自行车模型，参考点取后轴中心：dψ/ds = cos δr · (tan δf − tan δr) / L。δr = 0 时退化为经典自行车模型；δf = δr 时 dψ/ds ≡ 0，车身不转 —— 这正是场景二的「纯平移」。'],
  ['前后不等 ⇒ 摆正车头', '场景一取前轮 40°、后轮同向 8°：两者不等，车身产生横摆。因为横摆角速度 ω ∝ v·tan δ，前进打 +δ 与倒车打 −δ 得到同号的横摆——所以来回蹭一次车头，偏航就单调减小一次，6 段共 79px 路程把 22° 摆回 0°。'],
  ['前后相等 ⇒ 整体平移', '场景二前后轮同为 8°：横摆恒为零，车身沿「车头方向 ± 8°」斜行。一对「斜向前挪 d + 反向后挪 d」纵向抵消、横向净得 2d·sin 8°；8 对碎步累积 56px，把最后半个车身整体挪进车位。'],
  ['视角与实现', '车辆为 ES9 实拍正俯视照片抠形贴图，按实车 5365 × 2029mm 归正（1px ≈ 22.7mm，轴距 3250mm ↔ 143px），车位取 2546mm 标准位。俯视看不到车轮，四个转向指示为 HMI 示意层。Remotion 帧驱动纯函数时间轴，轨迹由运动学解析积分生成，起点按「目标位姿 − 累计位移」反推，终点精确落位；全时间轴逐 0.02s 断言校验转角上限、横摆单调、终点精度、邻车间距与车位边界。'],
];

const App: React.FC = () => {
  const [scn, setScn] = useState<K>('a');
  const [paused, setPaused] = useState(false);
  const ref = useRef<PlayerRef>(null);
  const built = buildPark(PK_SCENES[scn]);

  useEffect(() => {
    const p = ref.current;
    if (!p) return;
    const on = () => setPaused(false);
    const off = () => setPaused(true);
    p.addEventListener('play', on);
    p.addEventListener('pause', off);
    return () => { p.removeEventListener('play', on); p.removeEventListener('pause', off); };
  }, [scn]);

  return (
    <div style={{maxWidth: 1080, margin: '0 auto', padding: '28px 18px 56px',
      display: 'flex', flexDirection: 'column', gap: 18, fontFamily: F_UI}}>
      <header style={{paddingBottom: 16, borderBottom: `1px solid ${C.line}`}}>
        <p style={{fontFamily: F_DATA, fontSize: 11, letterSpacing: '.16em',
          textTransform: 'uppercase', color: C.ink3, margin: '0 0 6px'}}>Vehicle HMI · 用户教育动画</p>
        <h1 style={{fontSize: 'clamp(23px, 3.4vw, 32px)', lineHeight: 1.15, margin: 0,
          color: C.ink, letterSpacing: '-.01em'}}>平移泊入 · 功能演示</h1>
        <p style={{margin: '8px 0 0', maxWidth: '70ch', color: C.ink2, fontSize: 14}}>
          人工没停好、车又卡在车位口时，四轮转向可以接管最后一段。两个场景对应两种打角关系：
          <b style={{color: C.ink}}>前轮 40° / 后轮同向 8°（前后不等）</b>让车身产生横摆，把翘在外的车头摆正；
          <b style={{color: C.ink}}>前后轮同为 8°（转角一致）</b>横摆归零，车身不转、整体平移。
          两条轨迹都由四轮转向运动学积分生成，不是手摆关键帧。点击画面可暂停逐帧查看。
        </p>
      </header>

      <div style={{display: 'flex', flexWrap: 'wrap', gap: 8}}>
        {(['a', 'b'] as K[]).map((k) => {
          const on = k === scn;
          return (
            <button key={k} type="button" onClick={() => setScn(k)}
              style={{flex: '1 1 260px', textAlign: 'left', cursor: 'pointer',
                background: on ? C.accentWash : C.panel,
                border: `1px solid ${on ? C.accent : C.line}`,
                borderRadius: 4, padding: '10px 14px', fontFamily: 'inherit',
                display: 'flex', flexDirection: 'column', gap: 2}}>
              <b style={{fontSize: 13.5, fontWeight: 600, color: C.ink}}>{PK_SCENES[k].chip}</b>
              <span style={{fontSize: 12, color: on ? C.accent : C.ink3}}>{PK_SCENES[k].sub}</span>
            </button>
          );
        })}
      </div>

      <div style={{background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6,
        padding: 12, position: 'relative'}}>
        <Player ref={ref} key={scn} component={ParkingStage} inputProps={{scene: scn}}
          durationInFrames={Math.round(built.T * 30)} fps={30}
          compositionWidth={1920} compositionHeight={1080}
          style={{width: '100%', borderRadius: 3, overflow: 'hidden'}}
          controls loop autoPlay clickToPlay />
        {paused && (
          <div style={{position: 'absolute', left: 24, top: 24, background: C.panel,
            border: `1.5px solid ${C.accent}`, color: C.accent, borderRadius: 999,
            padding: '6px 14px', fontSize: 12.5, fontWeight: 600, pointerEvents: 'none'}}>
            已暂停 · 点击画面继续
          </div>
        )}
      </div>

      <section style={{borderTop: `1px solid ${C.line}`, paddingTop: 16, display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16}}>
        {NOTES.map(([h, p]) => (
          <div key={h}>
            <h3 style={{margin: '0 0 5px', fontFamily: F_DATA, fontSize: 11, letterSpacing: '.12em',
              textTransform: 'uppercase', color: C.ink3, fontWeight: 600}}>{h}</h3>
            <p style={{margin: 0, fontSize: 13.5, color: C.ink2}}>{p}</p>
          </div>
        ))}
      </section>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
