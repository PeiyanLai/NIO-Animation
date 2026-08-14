import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Player} from '@remotion/player';
import {Stage} from './Stage';
import {SCENES, F_DATA, F_UI, T_COLORS as C} from './data';

type ScnKey = 'a' | 'b' | 'c';

const SUB: Record<ScnKey, string> = {
  a: '驶入雪地自动提醒，方向盘按键开启',
  b: '雪地转沙地，主动提醒一键切换',
  c: '泥地 / 沙地 / 雪地 / 湿地 / 碎石',
};

const NOTES: [string, string][] = [
  ['自动识别与提醒', '驶入对应地形（如雪地、泥地）时，系统自动识别并提醒：「已驶入[地形]，是否为您打开全地形模式？」'],
  ['便捷激活', '方向盘按键一键进入对应模式，无需进设置菜单。'],
  ['场景切换识别', '行驶中路面切换（如柏油转沙地）时，系统主动识别并提醒：「已驶入沙地，是否为您切换到沙地模式？」'],
  ['实现方式', 'Remotion（React）帧驱动组件，useCurrentFrame() 纯函数动画；ES9 官方照片抠形贴图 + 矢量滚动轮毂。同一份源码可直接导出 MP4。'],
];

const App: React.FC = () => {
  const [scn, setScn] = useState<ScnKey>('a');
  const s = SCENES[scn];
  const dur = Math.round(s.T * 30);

  return (
    <div style={{
      maxWidth: 1080, margin: '0 auto', padding: '28px 18px 56px',
      display: 'flex', flexDirection: 'column', gap: 18, fontFamily: F_UI,
    }}>
      <header style={{paddingBottom: 16, borderBottom: `1px solid ${C.line}`}}>
        <p style={{
          fontFamily: F_DATA, fontSize: 11, letterSpacing: '.16em',
          textTransform: 'uppercase', color: C.ink3, margin: '0 0 6px',
        }}>Vehicle HMI · 用户教育动画</p>
        <h1 style={{
          fontSize: 'clamp(23px, 3.4vw, 32px)', lineHeight: 1.15, margin: 0,
          color: C.ink, letterSpacing: '-.01em',
        }}>全地形模式 · 功能演示</h1>
        <p style={{margin: '8px 0 0', maxWidth: '68ch', color: C.ink2, fontSize: 14}}>
          覆盖泥地、沙地、雪地、湿地、碎石五种地形。车辆驶入对应地形时系统自动识别并提醒「已驶入[地形]，是否为您打开全地形模式？」，
          方向盘按键一键进入；行驶中路面切换时同样主动提醒、一键切换。切换下方场景，播放器可暂停/拖拽逐帧查看。
        </p>
      </header>

      <div style={{display: 'flex', flexWrap: 'wrap', gap: 8}}>
        {(['a', 'b', 'c'] as ScnKey[]).map((k) => {
          const on = k === scn;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setScn(k)}
              style={{
                flex: '1 1 230px', textAlign: 'left', cursor: 'pointer',
                background: on ? C.accentWash : C.panel,
                border: `1px solid ${on ? C.accent : C.line}`,
                borderRadius: 4, padding: '10px 14px',
                fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 2,
              }}
            >
              <b style={{fontSize: 13.5, fontWeight: 600, color: C.ink}}>{SCENES[k].chip}</b>
              <span style={{fontSize: 12, color: on ? C.accent : C.ink3}}>{SUB[k]}</span>
            </button>
          );
        })}
      </div>

      <div style={{
        background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 12,
      }}>
        <Player
          key={scn}
          component={Stage}
          inputProps={{scene: scn}}
          durationInFrames={dur}
          fps={30}
          compositionWidth={1920}
          compositionHeight={1080}
          style={{width: '100%', borderRadius: 3, overflow: 'hidden'}}
          controls
          loop
          autoPlay
          clickToPlay={false}
        />
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
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
