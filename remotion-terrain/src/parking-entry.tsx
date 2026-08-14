import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Player, type PlayerRef} from '@remotion/player';
import {ParkingStage} from './ParkingStage';
import {PK_SCENES, buildPark, F_DATA, F_UI, T_COLORS as C} from './parking-data';

type K = 'a' | 'b';

const NOTES: [string, string][] = [
  ['运动原理', '前轮最大 40°、后轮同向最大 8° 打角，车身不旋转、始终摆正；斜向前挪与反向后挪交替，纵向位移相互抵消，净效果是每步横移一小段。'],
  ['为什么是碎步', '前后邻车限死了每步的纵向余量——全程只能小幅匀步蹭移，这正是该功能在狭小车位的核心价值。'],
  ['视角说明', '车辆为 ET9 实拍高位俯视照片抠形贴图（非正投影俯视）。俯视看不到车轮，四个转向指示为 HMI 示意层，用于表达转角，非实车轮位渲染。'],
  ['实现方式', 'Remotion（React）帧驱动，useCurrentFrame() 纯函数时间轴；全时间轴断言校验转角上限、终点精度与邻车间距。'],
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
        <p style={{margin: '8px 0 0', maxWidth: '68ch', color: C.ink2, fontSize: 14}}>
          具备后轮转向的车型，可在前后停满的车位旁「横向平移」入位：前轮最大打角 40°、后轮同向最大 8°，
          车身始终保持摆正，以小幅「斜向前挪 → 反向后挪」全程匀步蹭移。点击画面可暂停逐帧查看。
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
