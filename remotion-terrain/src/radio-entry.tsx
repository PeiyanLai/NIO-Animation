import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Player, type PlayerRef} from '@remotion/player';
import {RadioStage} from './RadioStage';
import {RADIO_SCENES, type RadioKey, F_DATA, F_UI, T_COLORS as C} from './radio-data';

const KEYS: RadioKey[] = ['a', 'b', 'c', 'd'];

const NOTES: [string, string][] = [
  ['组队与共享', '在商城购买对讲机、在车机上完成连接后即可组队，一个小队最多 50 台车；组队后实时共享定位、车辆信息与导航目的地。有网时按方向盘中间按键讲话，全队同时收到。'],
  ['无网地形', '进入网络信号复杂的无网地形后，车载对讲机硬件自动组网，基础通信距离 5–8 公里；仍在网络覆盖区的车辆作为桥接节点把消息转发上云，远处的队友照样收得到。'],
  ['混合车队队形', '把对讲机交给朋友的非蔚来车后，让「有对讲机的两台车」分别守住队首与队尾，只有 App 的车夹在中间——中间的车即使弱网也在硬件对讲的覆盖里，不会走丢。'],
  ['演示说明（待确认）', '① 蔚来车的对讲能力内置在车上（方向盘按键发话），手持对讲机是可以转交的单独硬件——场景四里全队只有这一台，蔚来车主递出后自己只剩方向盘按键。场景二的四台都是蔚来车，因此都走车载对讲，第 3、4 台不显示手持机图标。② 5–8 km 为文档给出的基础通信距离，动画中的车距、分界线位置均为示意，非按比例尺绘制。③ 车辆、车机卡片、App 界面均为概念矢量示意，非实拍或最终 UI。'],
];

const App: React.FC = () => {
  const [scn, setScn] = useState<RadioKey>('a');
  const [paused, setPaused] = useState(false);
  const ref = useRef<PlayerRef>(null);
  const s = RADIO_SCENES[scn];

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
          color: C.ink, letterSpacing: '-.01em'}}>对讲机组队 · 车队互联演示</h1>
        <p style={{margin: '8px 0 0', maxWidth: '68ch', color: C.ink2, fontSize: 14}}>
          购买对讲机并在车机完成连接后即可组队（小队上限 50 台）：共享实时定位、车辆信息与导航目的地，按方向盘中键即可全队对讲。
          进入无网地形时，车载对讲机硬件在 5–8 公里内组网接力，有网车辆作桥接节点上云；朋友的非蔚来车也能靠对讲机 + App 入队。
          四个场景可切换，点击画面可暂停逐帧查看。
        </p>
      </header>

      <div style={{display: 'flex', flexWrap: 'wrap', gap: 8}}>
        {KEYS.map((k) => {
          const on = k === scn;
          return (
            <button key={k} type="button" onClick={() => setScn(k)}
              style={{flex: '1 1 230px', textAlign: 'left', cursor: 'pointer',
                background: on ? C.accentWash : C.panel,
                border: `1px solid ${on ? C.accent : C.line}`,
                borderRadius: 4, padding: '10px 14px', fontFamily: 'inherit',
                display: 'flex', flexDirection: 'column', gap: 2}}>
              <b style={{fontSize: 13.5, fontWeight: 600, color: C.ink}}>{RADIO_SCENES[k].chip}</b>
              <span style={{fontSize: 12, color: on ? C.accent : C.ink3}}>{RADIO_SCENES[k].sub}</span>
            </button>
          );
        })}
      </div>

      <div style={{background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6,
        padding: 12, position: 'relative'}}>
        <Player ref={ref} key={scn} component={RadioStage} inputProps={{scene: scn}}
          durationInFrames={Math.round(s.T * 30)} fps={30}
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
