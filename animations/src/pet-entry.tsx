import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Player, type PlayerRef} from '@remotion/player';
import {PetStage} from './PetStage';
import {PET_SCENES, type PetKey, F_DATA, F_UI, T_COLORS as C} from './pet-data';

const KEYS: PetKey[] = ['a', 'b', 'c', 'd'];

const NOTES: [string, string][] = [
  ['硬件与配对', '在商城购买宠物定位硬件，给宠物佩戴后即可与车机连接；连接后车机可检测宠物是否在车内。'],
  ['自动开启', '检测到宠物在车内时，车主离车锁车后自动开启宠物模式，使车辆保持稳定舒适的温度，全程无需手动设置。'],
  ['除味净化', '宠物离车并完成锁车后，空调自动进行宠物除味处理，完成一轮车内空气净化。'],
  ['演示说明（待确认）', '定位硬件外观、车机宠物模式卡片 UI 均为概念示意；座舱为 ES8 前排官方实拍，宠物为真实照片剪纸动效（单姿态整体运动）。温度数值为示意值，文档仅要求「稳定舒适」。'],
];

const App: React.FC = () => {
  const [scn, setScn] = useState<PetKey>('a');
  const [paused, setPaused] = useState(false);
  const ref = useRef<PlayerRef>(null);
  const s = PET_SCENES[scn];

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
          color: C.ink, letterSpacing: '-.01em'}}>宠物模式 · 功能演示</h1>
        <p style={{margin: '8px 0 0', maxWidth: '68ch', color: C.ink2, fontSize: 14}}>
          购买宠物定位硬件并给宠物佩戴后，车机即可连接硬件、检测宠物是否在车内；离车锁车后自动开启宠物模式保持稳定舒适温度，
          宠物离车锁车后自动完成一轮除味净化。按「绑定 → 识别 → 自动执行 → 退出与结果」四章展开，点击画面可暂停逐帧查看。
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
              <b style={{fontSize: 13.5, fontWeight: 600, color: C.ink}}>{PET_SCENES[k].chip}</b>
              <span style={{fontSize: 12, color: on ? C.accent : C.ink3}}>{PET_SCENES[k].sub}</span>
            </button>
          );
        })}
      </div>

      <div style={{background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6,
        padding: 12, position: 'relative'}}>
        <Player ref={ref} key={scn} component={PetStage} inputProps={{scene: scn}}
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
