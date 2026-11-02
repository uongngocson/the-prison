// U06 HUD, U16 Interaction prompt, U18 toasts, subtitles, U15 Dialogue.
import { useEffect } from 'react';
import { useUI } from '../store';
import { useSettings } from '../settings';
import { Bar, Key } from '../components';
import { controller } from '../../app/controller';
import { useTouchUI } from './TouchControls';
import { MobileHud } from './MobileHud';
import { CustodyHudLine } from './Custody';
import { Icon } from '../icons';

export function Hud() {
  const hud = useUI((s) => s.hud);
  const focus = useUI((s) => s.focus);
  const toasts = useUI((s) => s.toasts);
  const subtitle = useUI((s) => s.subtitle);
  const dismiss = useUI((s) => s.dismiss);
  const dialogue = useUI((s) => s.dialogue);
  const overlay = useUI((s) => s.overlay);
  const minimal = useSettings((s) => s.s.access.hudMinimal);
  const subScale = useSettings((s) => s.s.access.subtitleScale);
  const showSubs = useSettings((s) => s.s.access.subtitles);
  const touch = useTouchUI();
  useEffect(() => {
    const t = setInterval(() => {
      const now = performance.now();
      for (const x of useUI.getState().toasts) if (!x.persistent && now - x.at > 6000) useUI.getState().dismiss(x.id);
    }, 1000);
    return () => clearInterval(t);
  }, []);
  if (!hud) return null;
  if (touch) return <MobileHud />;
  const hidden = !!overlay;
  return (
    <div className="hud" aria-hidden={hidden}>
      {!hidden && <div className="crosshair" />}
      <div className="hud-tl box">
        <div className="clock">{hud.clock} <span className="small muted">{hud.period}</span></div>
        <div className="small">{hud.dayLabel.split(' · ').slice(0, 2).join(' · ')}</div>
        {!minimal && <>
          <div className="small"><span className="muted">Hiện tại:</span> {hud.activity}</div>
          <div className="small"><span className="muted">Vị trí:</span> {hud.zone}{hud.cell ? ` · ${hud.cell}` : ''} · {hud.weather}</div>
        </>}
        <CustodyHudLine />
      </div>
      {hud.tutorial && !hidden && <div className="tip box" role="note">💡 {hud.tutorial} <button className="btn sm ghost" style={{ pointerEvents: 'auto' }} onClick={() => controller.session?.skipTutorial()}>Bỏ qua hướng dẫn</button></div>}
      {hud.waypoint && !hidden && <div className="waypoint box">➜ {hud.waypoint.label} · {hud.waypoint.dist} m <span style={{ display: 'inline-block', transform: `rotate(${hud.waypoint.dir}rad)` }}>⬆</span></div>}
      <div className="hud-tr">
        {hud.quest && (
          <div className="box">
            <div className="small muted">Nhiệm vụ đang theo dõi <Key action="journal" /></div>
            <div style={{ fontWeight: 700 }}>{hud.quest.title}</div>
            {hud.quest.objectives.slice(0, minimal ? 1 : 2).map((o, i) => <div key={i} className="small">{i === 0 ? '◆' : '◇'} {o.text}</div>)}
            {hud.quest.where && <div className="small muted">Khu vực: {hud.quest.where}</div>}
          </div>
        )}
        <div className="box small row" style={{ justifyContent: 'space-between' }}>
          <span>💳 {hud.money}</span>
          <span>Đời sống <Key action="life" />{hud.lifeBadges ? <span className="badge">{hud.lifeBadges}</span> : null}</span>
        </div>
      </div>
      {!minimal && (
        <div className="hud-bl box" aria-label="Nhu cầu">
          {hud.needs.map((n) => (
            <div key={n.key} className={`need ${n.value < 10 ? 'crit' : n.value < 25 ? 'low' : ''}`} title={`Gần nhất: ${n.cause}`}>
              <span className="small">{n.value < 25 ? '⚠ ' : ''}{n.label}</span><Bar value={n.value} label={n.label} /><span className="small">{n.value}</span>
            </div>
          ))}
        </div>
      )}
      <div className="hud-br small muted kb-only">
        <div>{hud.saveStatus}{hud.saveStatus === 'Lưu thất bại' ? ' ⚠' : ''}</div>
        <div><Key action="schedule" /> Lịch · <Key action="map" /> Bản đồ · <Key action="inventory" /> Túi · <Key action="profile" /> Hồ sơ · <Key action="pause" /> Menu</div>
      </div>
      {hud.action && !hidden && (
        <div className="action-bar box" role="status">
          <div className="small">{hud.action.label}...</div>
          <Bar value={hud.action.progress * 100} label="Tiến độ" />
          {touch ? <div className="row" style={{ justifyContent: 'center', pointerEvents: 'auto' }}><button className="btn sm" onClick={() => controller.onKeyAction('skip')}>Tua nhanh</button><button className="btn sm" onClick={() => controller.onKeyAction('cancel')}>Hủy (không nhận kết quả)</button></div>
            : <div className="small muted"><Key action="skip" /> Tua nhanh · <Key action="cancel" /> Hủy (không nhận kết quả)</div>}
        </div>
      )}
      {!hud.action && focus && !hidden && !dialogue && (
        <div className="prompt box" role="status" aria-live="polite">
          <div style={{ fontWeight: 600 }}>{focus.label}</div>
          {focus.verbs.slice(0, 4).map((v, i) => (
            <div key={v.verb} className="verb">
              {touch ? <button className={`btn sm ${i === 0 ? 'primary' : ''}`} style={{ pointerEvents: 'auto' }} disabled={!v.enabled} onClick={() => controller.doVerb(focus.id, v.verb)}>Chọn</button>
                : i === 0 ? <Key action="interact" /> : <button className="btn sm" style={{ pointerEvents: 'auto' }} disabled={!v.enabled} onClick={() => controller.doVerb(focus.id, v.verb)}>{i + 1}</button>}
              <span style={{ opacity: v.enabled ? 1 : 0.6 }}>{v.label}{v.duration ? <span className="muted small"> · {v.duration} phút game</span> : null}</span>
              {!v.enabled && v.reason && <span className="reason">({v.reason})</span>}
            </div>
          ))}
          {focus.verbs.length > 1 && <div className="small muted">{touch ? 'Chạm “Chọn” để làm hành động khác' : 'Phím số 2–4 hoặc nhấp để chọn hành động khác'}</div>}
        </div>
      )}
      {hud.mode === 'seated' && !hidden && !touch && <div className="prompt box small" style={{ bottom: '16%' }}>Đang ngồi — di chuyển hoặc <Key action="cancel" /> để đứng dậy</div>}
      {subtitle && showSubs && (
        <div className="subtitle" style={{ fontSize: `${18 * subScale}px` }} role="status" aria-live="polite"><b>{subtitle.speaker}:</b> {subtitle.text}</div>
      )}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.severity}`} role={t.severity === 'error' ? 'alert' : undefined}>
            <span style={{ flex: 1 }}>{t.text}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Đóng thông báo">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Number keys for secondary verbs while no overlay is open. */
export function useVerbHotkeys() {
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const ui = useUI.getState();
      if (ui.overlay || ui.dialogue || ui.screen !== 'game') return;
      const n = Number(e.key);
      if (n >= 2 && n <= 4 && ui.focus) {
        const v = ui.focus.verbs[n - 1];
        if (v?.enabled) controller.doVerb(ui.focus.id, v.verb);
      }
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, []);
}

export function Dialogue() {
  const d = useUI((s) => s.dialogue);
  const history = useUI((s) => s.dialogueHistory);
  const touchD = useTouchUI();
  const subScale = useSettings((s) => s.s.access.subtitleScale);
  useEffect(() => {
    if (!d) return;
    const kd = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 9 && d.choices[n - 1]) { e.preventDefault(); controller.choose(d.choices[n - 1].id); }
      else if ((e.key === 'Enter' || e.key === ' ' || e.code === 'KeyE') && d.canContinue && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); controller.continueDialogue(); }
      else if (e.key === 'Escape') { e.preventDefault(); controller.endDialogue(); }
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, [d]);
  if (!d) return null;
  return (
    <section className="dialogue box panel" data-touch={touchD || undefined} role="dialog" aria-label={`Hội thoại với ${d.speaker}`} style={{ ['--ss' as string]: subScale } as React.CSSProperties}>
      <div className="panel-body">
        {touchD && <button className="icon-btn dlg-x" onClick={() => controller.endDialogue()} aria-label="Kết thúc hội thoại"><Icon name="close" size={18} /></button>}
        <details className="small muted dlg-hist" style={{ marginBottom: 6 }}>
          <summary>Lịch sử hội thoại</summary>
          <div style={{ maxHeight: 140, overflow: 'auto' }}>{history.slice(0, -1).map((h, i) => <div key={i}><b>{h.speaker || '—'}:</b> {h.text}</div>)}</div>
        </details>
        <div className="speaker">{d.speaker}</div>
        <div className="line">{d.text}</div>
        <div className="choices">
          {d.choices.map((c, i) => <button key={c.id} className="btn" onClick={() => controller.choose(c.id)} autoFocus={i === 0}>{!touchD && <span className="kbd">{i + 1}</span>} {c.text}</button>)}
          {d.canContinue && <button className="btn primary" onClick={() => controller.continueDialogue()} autoFocus>Tiếp tục {!touchD && <span className="kbd">Enter</span>}</button>}
          {!touchD && <button className="btn ghost sm" onClick={() => controller.endDialogue()}>Kết thúc hội thoại <span className="kbd">Esc</span></button>}
        </div>
      </div>
    </section>
  );
}
