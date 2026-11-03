// Mobile/touch HUD: compact status (clock + need rings), quest chip, icon nav, single toast, tip pill,
// and a grid quick-menu sheet. Desktop keeps the full text HUD.
import { useEffect, useState } from 'react';
import { SleepBanner } from './Hud';
import { useUI } from '../store';
import { useSettings } from '../settings';
import { controller } from '../../app/controller';
import { Icon, Ring } from '../icons';
import { enterFullscreen, fullscreenSupported, useDevice } from '../device';
import { audio } from '../../audio/audio';
import { custodyHud } from './Custody';
import { WorkHudCard } from './Work';
import { OnlineChip, QueueChip } from './Online';

const NEED_ICON: Record<string, string> = { energy: 'energy', hunger: 'hunger', hygiene: 'hygiene', mood: 'mood' };
const tap = (fn: () => void) => () => { audio.resume(); fn(); };

export function MobileHud() {
  const hud = useUI((s) => s.hud);
  const overlay = useUI((s) => s.overlay);
  const dialogue = useUI((s) => s.dialogue);
  const toasts = useUI((s) => s.toasts);
  const subtitle = useUI((s) => s.subtitle);
  const dismiss = useUI((s) => s.dismiss);
  const open = useUI((s) => s.open);
  const showSubs = useSettings((s) => s.s.access.subtitles);
  const portrait = useDevice((d) => d.portrait);
  const [rotateSeen, setRotateSeen] = useState(false);
  useEffect(() => {
    const t = setInterval(() => {
      const now = performance.now();
      for (const x of useUI.getState().toasts) if (!x.persistent && now - x.at > 3500) useUI.getState().dismiss(x.id);
    }, 500);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (!portrait) return; const t = setTimeout(() => setRotateSeen(true), 5000); return () => clearTimeout(t); }, [portrait]);
  if (!hud) return null;
  const hidden = !!overlay || !!dialogue;
  const toast = toasts[toasts.length - 1];
  const obj = hud.quest?.objectives[0]?.text;
  return (
    <div className="mhud" aria-hidden={!!overlay}>
      {hud.sleepWake && !hidden && <SleepBanner wake={hud.sleepWake} />}
      {!hidden && <>
        <button className="m-status" onClick={tap(() => controller.openScreen('schedule'))} aria-label={`${hud.clock}, ${hud.activity}. Mở lịch`}>
          <span className="m-clock">{hud.clock}</span>
          <span className="m-period">{hud.shared ? '⟳ chung' : hud.period}</span>
        </button>
        <div className="m-needs" aria-label="Nhu cầu">
          {hud.needs.map((n) => <Ring key={n.key} value={n.value} icon={NEED_ICON[n.key]} label={n.label} size={34} />)}
        </div>
        <nav className="m-nav" aria-label="Điều hướng nhanh">
          <button onClick={tap(() => open('map'))} aria-label="Bản đồ"><Icon name="map" /></button>
          <button onClick={tap(() => open('journal'))} aria-label="Nhiệm vụ"><Icon name="quest" /></button>
          <button onClick={tap(() => open('quickmenu'))} aria-label="Menu">
            <Icon name="menu" />{hud.lifeBadges ? <span className="m-dot" aria-label={`${hud.lifeBadges} mục mới`} /> : null}
          </button>
        </nav>
        {(() => { const c = custodyHud(); return c ? (
          <button className={`m-phase ${c.confined ? 'conf' : 'act'}`} onClick={tap(() => open(c.confined ? 'incell' : 'custody'))} aria-label={`${c.phase}, ${c.room}. Tiếp: ${c.next}`}>
            <Icon name="lock" size={14} /><span>{c.phase}</span>
          </button>) : null; })()}
        <WorkHudCard compact />
        <div className="m-online"><OnlineChip compact /><QueueChip compact /></div>
        {hud.quest && (
          <button className="m-quest" onClick={tap(() => open('journal'))}>
            <b>{hud.quest.title}</b>
            {obj && <span>{obj}</span>}
          </button>
        )}
        {hud.waypoint && (
          <div className="m-way"><span style={{ transform: `rotate(${hud.waypoint.dir}rad)` }}><Icon name="arrow" size={14} /></span>{hud.waypoint.label} · {hud.waypoint.dist} m</div>
        )}
        {toast ? (
          <div className={`m-toast ${toast.severity}`} role={toast.severity === 'error' ? 'alert' : 'status'} onClick={() => dismiss(toast.id)}>{toast.text}</div>
        ) : hud.tutorial ? (
          <div className="m-tip" role="note"><Icon name="bulb" size={16} /><span>{hud.tutorial}</span>
            <button onClick={() => controller.session?.skipTutorial()} aria-label="Bỏ qua hướng dẫn"><Icon name="close" size={16} /></button></div>
        ) : portrait && !rotateSeen ? (
          <div className="m-tip" role="note"><Icon name="rotate" size={16} /><span>Xoay ngang để có tầm nhìn rộng hơn</span>
            <button onClick={() => setRotateSeen(true)} aria-label="Đóng"><Icon name="close" size={16} /></button></div>
        ) : null}
        {hud.saveStatus === 'Lưu thất bại' && <div className="m-savefail" role="alert">Lưu thất bại — mở Menu để lưu lại</div>}
      </>}
      {subtitle && showSubs && !dialogue && <div className="m-sub" role="status"><b>{subtitle.speaker}</b> {subtitle.text}</div>}
    </div>
  );
}

/** Grid quick menu (bottom sheet) — gom mọi màn hình vào một chỗ thay vì 8 nút trên HUD. */
export function QuickMenu() {
  const set = useUI((s) => s.set);
  const open = useUI((s) => s.open);
  const hud = useUI((s) => s.hud);
  const close = () => open(null);
  const items: { icon: string; label: string; badge?: number; go: () => void }[] = [
    { icon: 'calendar', label: 'Lịch', go: () => controller.openScreen('schedule') },
    { icon: 'quest', label: 'Nhiệm vụ', go: () => open('journal') },
    { icon: 'map', label: 'Bản đồ', go: () => open('map') },
    { icon: 'bag', label: 'Túi đồ', go: () => open('inventory') },
    { icon: 'home', label: 'Đời sống', badge: hud?.lifeBadges, go: () => set({ overlay: 'life' }) },
    { icon: 'user', label: 'Hồ sơ', go: () => set({ overlay: 'profile', profileTab: 'profile' }) },
    { icon: 'work', label: 'Công việc', go: () => open('work', { view: 'hub' }) },
    ...(custodyHud() ? [{ icon: 'lock', label: 'Chế độ', go: () => open('custody') }] : []),
    { icon: 'book', label: 'Sổ tay', go: () => open('handbook') },
    { icon: 'save', label: 'Lưu game', go: () => open('saves') },
    { icon: 'settings', label: 'Cài đặt', go: () => open('settings') },
    { icon: 'pause', label: 'Tạm dừng', go: () => open('pause') },
  ];
  if (fullscreenSupported() && !document.fullscreenElement) items.push({ icon: 'expand', label: 'Toàn màn hình', go: () => { void enterFullscreen(); close(); } });
  useEffect(() => {
    const kd = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, []);
  return (
    <div className="qm-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="qm-sheet" role="dialog" aria-modal="true" aria-label="Menu">
        <div className="qm-head">
          <span>{hud ? `${hud.clock} · ${hud.zone}` : 'Menu'}</span>
          <span className="qm-money">{hud?.money}</span>
          <button className="icon-btn" onClick={close} aria-label="Đóng" data-autofocus><Icon name="close" /></button>
        </div>
        <div className="qm-grid">
          {items.map((it) => (
            <button key={it.label} className="qm-item" onClick={tap(it.go)}>
              <span className="qm-ico"><Icon name={it.icon} size={26} />{it.badge ? <span className="m-badge">{it.badge}</span> : null}</span>
              <span>{it.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
