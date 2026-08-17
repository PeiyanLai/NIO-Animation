import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Player, type PlayerRef} from '@remotion/player';
import {RampStage} from './RampStage';
import {
  CONCEPTUAL, F_DATA, F_UI, RAMP_KEYS, RAMP_SCENES, T_COLORS as C, type RampKey,
} from './ramp-data';

const NOTES: [string, string][] = [
  ['几何自洽', '装载口离地按 ES9 官方侧视照片推算 ≈ 787mm（9.9 mm/px 标尺）。坡长取 2000mm，于是坡度 = asin(787 / 2000) = 23°。三个数由同一组常量算出，全时间轴逐 0.02s 断言 sin(坡度) × 坡长 = 装载口高度。'],
  ['犬与车同一把尺', '犬按中大型犬概念形象建模：肩高 570mm、体长 950mm，与车共用 9.9 mm/px。肩高 / 车高 = 0.30，实车比值 570 / 1870 = 0.305，误差 1.6%。上坡时整只犬 rotate(−23°)，四足踩在 RAMP_FOOT–LIP 这条线上，支撑相掌心到坡面距离 < 0.01px。'],
  ['尾门与装载口', '尾门是车身照片的一部分：闭合时 mask 只有车身轮廓，开启时在同一 mask 里挖出装载口轮廓（同一条 path，所以闭合态与车身严丝合缝），抬起的尾门用同一张照片 clip 到该轮廓后绕铰链旋转 72°。洞里的装载口内景为概念示意，非实拍内饰。'],
  ['实现', 'Remotion 帧驱动纯函数时间轴，所有位置只依赖当前秒数，无 Math.random。四章可单独播放，点击画面暂停逐帧查看。'],
];

const App: React.FC = () => {
  const [scn, setScn] = useState<RampKey>('c1');
  const [paused, setPaused] = useState(false);
  const ref = useRef<PlayerRef>(null);
  const s = RAMP_SCENES[scn];

  useEffect(() => {
    const p = ref.current;
    if (!p) return;
    const on = () => setPaused(false);
    const off = () => setPaused(true);
    p.addEventListener('play', on);
    p.addEventListener('pause', off);
    return () => {
      p.removeEventListener('play', on);
      p.removeEventListener('pause', off);
    };
  }, [scn]);

  return (
    <div style={{
      maxWidth: 1080, margin: '0 auto', padding: '28px 18px 56px',
      display: 'flex', flexDirection: 'column', gap: 18, fontFamily: F_UI,
    }}>
      <header style={{paddingBottom: 16, borderBottom: `1px solid ${C.line}`}}>
        <p style={{
          fontFamily: F_DATA, fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase',
          color: C.ink3, margin: '0 0 6px',
        }}>Vehicle Ecosystem · 用户教育动画</p>
        <h1 style={{
          fontSize: 'clamp(23px, 3.4vw, 32px)', lineHeight: 1.15, margin: 0,
          color: C.ink, letterSpacing: '-.01em',
        }}>宠物上下车斜坡架 · 功能演示</h1>
        <p style={{margin: '8px 0 0', maxWidth: '70ch', color: C.ink2, fontSize: 14}}>
          中大型犬、老年犬上下后备箱不方便：装载口离地
          <b style={{color: C.ink}}> ≈ 787mm</b>
          ，犬得整只跳上去，落地冲击还伤关节。装一块
          <b style={{color: C.ink}}>坡长 2000mm、坡度 23°</b>
          的斜坡架，犬就能自己走进去。四章分别讲清高度差、不用架子的代价、架子怎么装、以及装完之后犬怎么上车。
          点击画面可暂停逐帧查看。
        </p>
      </header>

      <div style={{display: 'flex', flexWrap: 'wrap', gap: 8}}>
        {RAMP_KEYS.map((k) => {
          const on = k === scn;
          return (
            <button key={k} type="button" onClick={() => setScn(k)}
              style={{
                flex: '1 1 220px', textAlign: 'left', cursor: 'pointer',
                background: on ? C.accentWash : C.panel,
                border: `1px solid ${on ? C.accent : C.line}`,
                borderRadius: 4, padding: '10px 14px', fontFamily: 'inherit',
                display: 'flex', flexDirection: 'column', gap: 2,
              }}>
              <b style={{fontSize: 13.5, fontWeight: 600, color: C.ink}}>{RAMP_SCENES[k].chip}</b>
              <span style={{fontSize: 12, color: on ? C.accent : C.ink3}}>{RAMP_SCENES[k].sub}</span>
            </button>
          );
        })}
      </div>

      <div style={{
        background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6,
        padding: 12, position: 'relative',
      }}>
        <Player ref={ref} key={scn} component={RampStage} inputProps={{scene: scn}}
          durationInFrames={Math.round(s.T * 30)} fps={30}
          compositionWidth={1920} compositionHeight={1080}
          style={{width: '100%', borderRadius: 3, overflow: 'hidden'}}
          controls loop autoPlay clickToPlay />
        {paused && (
          <div style={{
            position: 'absolute', left: 24, top: 24, background: C.panel,
            border: `1.5px solid ${C.accent}`, color: C.accent, borderRadius: 999,
            padding: '6px 14px', fontSize: 12.5, fontWeight: 600, pointerEvents: 'none',
          }}>
            已暂停 · 点击画面继续
          </div>
        )}
      </div>

      <section style={{
        borderTop: `1px solid ${C.line}`, paddingTop: 16, display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16,
      }}>
        {NOTES.map(([h, p]) => (
          <div key={h}>
            <h3 style={{
              margin: '0 0 5px', fontFamily: F_DATA, fontSize: 11, letterSpacing: '.12em',
              textTransform: 'uppercase', color: C.ink3, fontWeight: 600,
            }}>{h}</h3>
            <p style={{margin: 0, fontSize: 13.5, color: C.ink2}}>{p}</p>
          </div>
        ))}
      </section>

      <section style={{
        borderTop: `1px solid ${C.line}`, paddingTop: 16,
        background: C.accentWash, borderRadius: 6, padding: '16px 18px',
      }}>
        <h3 style={{
          margin: '0 0 8px', fontFamily: F_DATA, fontSize: 11, letterSpacing: '.12em',
          textTransform: 'uppercase', color: C.ink3, fontWeight: 600,
        }}>演示说明（待确认）</h3>
        <ul style={{margin: 0, paddingLeft: 18, color: C.ink2, fontSize: 13.5, lineHeight: 1.65}}>
          {CONCEPTUAL.map((c) => <li key={c}>{c}</li>)}
        </ul>
      </section>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
