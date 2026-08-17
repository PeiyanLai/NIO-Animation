import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Player, type PlayerRef} from '@remotion/player';
import {BagStage} from './BagStage';
import {
  BAG_KEYS, BAG_SCENES, CONCEPTUAL, F_DATA, F_UI, T_COLORS as C, type BagKey,
} from './bag-data';

const NOTES: [string, string][] = [
  ['两个视角、一把尺', '视角 A 座舱俯视 6.6 mm/px（座舱内宽 1620mm ↔ 245px，三排 H 点纵向 0/1050/2000mm）；视角 B 岛台剖面 2.4 mm/px（岛台上表面离地 560mm、总长 1150mm）。两视角各自标定，第一章用「高亮软包段 → 推近 → 淡出到剖面」过渡，不硬切。'],
  ['固定 ↔ 解锁是显式状态机', 'free → placed → locked → released 严格单向，每一次跃迁都落在一个用户动作相位内（放置 / 按压 / 按键），不许自动跳。逐 0.02s 全时间轴断言：包底 y 在锁定期间恒等于岛台上表面，解锁后单调上升。'],
  ['敞篷与锁止互不相干', '敞篷绕包体前上沿的铰链翻开 −108°（远端点手算后落在铰链左上方 = 向车头方向掀起）。第四章先合盖、再按键解锁，是两个独立动作；断言里要求同时存在「敞篷开 + 已锁」和「敞篷关 + 已锁」两种时刻。'],
  ['绳不许被拉长', '猫的胸背带扣点到包内锚点的距离全时间轴 ≤ 绳长 260mm（108.3px）。限位在数据层解析求解（由位姿反推坐骨 x 上限），不是画的时候凑出来的；活动范围画成以锚点为心、绳长为半径并被包体裁剪的弧。'],
  ['可及范围是算出来的', '主副驾肩点各画一个半径 700mm 的扇形，断言两个扇形都与宠物包矩形相交 —— 不是写一句「都够得着」。猫坐高 / 包高 = 1.03，头必须露在包外，「摸摸」的叙事才成立。'],
  ['实现', 'Remotion 帧驱动纯函数时间轴，位置只依赖当前秒数，无 Math.random；座舱为比例化概念矢量图（参考图带第三方水印，仅作绘制参考，未内联进本页）。四章可单独播放，点击画面暂停逐帧查看。'],
];

const App: React.FC = () => {
  const [scn, setScn] = useState<BagKey>('c1');
  const [paused, setPaused] = useState(false);
  const ref = useRef<PlayerRef>(null);
  const s = BAG_SCENES[scn];

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
        }}>Cockpit · 用户教育动画</p>
        <h1 style={{
          fontSize: 'clamp(23px, 3.4vw, 32px)', lineHeight: 1.15, margin: 0,
          color: C.ink, letterSpacing: '-.01em',
        }}>灵动宠物包 · 功能演示</h1>
        <p style={{margin: '8px 0 0', maxWidth: '70ch', color: C.ink2, fontSize: 14}}>
          针对猫这类小型宠物的车载便携包：固定在
          <b style={{color: C.ink}}>前排中央岛台的软包扶手段</b>
          上，往下一按就锁住；包里有栓扣拴住宠物；到地方
          <b style={{color: C.ink}}>按一下物理按键</b>
          就能解锁提走。四章分别讲清 拆装、栓扣、行驶中的三级固定、以及解锁带走。点击画面可暂停逐帧查看。
        </p>
      </header>

      <div style={{display: 'flex', flexWrap: 'wrap', gap: 8}}>
        {BAG_KEYS.map((k) => {
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
              <b style={{fontSize: 13.5, fontWeight: 600, color: C.ink}}>{BAG_SCENES[k].chip}</b>
              <span style={{fontSize: 12, color: on ? C.accent : C.ink3}}>{BAG_SCENES[k].sub}</span>
            </button>
          );
        })}
      </div>

      <div style={{
        background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6,
        padding: 12, position: 'relative',
      }}>
        <Player ref={ref} key={scn} component={BagStage} inputProps={{scene: scn}}
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
