// Touch controls (phone/tablet): virtual joystick, drag-to-look + pinch-zoom, contextual action buttons, menu bar.
// Gamepad UI navigation for overlays (D-pad/A/B). Keyboard & mouse keep working on hybrid devices.
import { useEffect, useRef, useState } from 'react';
import { useUI } from '../store';
import { useSettings } from '../settings';
import { useDevice } from '../device';
import { Icon } from '../icons';
import { controller } from '../../app/controller';
import { audio } from '../../audio/audio';

export function useTouchUI(): boolean {
  const mode = useSettings((s) => s.s.controls.touchMode);
  const coarse = useDevice((d) => d.coarse);
  return mode === 'on' || (mode === 'auto' && coarse);
}

function Joystick({ size, side }: { size: number; side: 'left' | 'right' }) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0, active: false });
  const pid = useRef<number | null>(null);
  const R = 56 * size;
  const update = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
    const v = controller.view;
    if (v) { v.virtual.x = dx / R; v.virtual.y = -dy / R; v.virtual.run = len > R * 0.95; }
    setKnob({ x: dx, y: dy, active: true });
  };
  const end = () => {
    pid.current = null;
    const v = controller.view;
    if (v) { v.virtual.x = 0; v.virtual.y = 0; v.virtual.run = false; }
    setKnob({ x: 0, y: 0, active: false });
  };
  return (
    <div ref={base} className={`joystick ${side}`} style={{ width: R * 2 + 24, height: R * 2 + 24 }} role="application" aria-label="Cần điều khiển di chuyển. Đẩy ra mép để chạy."
      onPointerDown={(e) => { audio.resume(); pid.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); update(e); }}
      onPointerMove={(e) => { if (pid.current === e.pointerId) update(e); }}
      onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
      <div className="joy-ring" />
      <div className={`joy-knob ${knob.active ? 'on' : ''}`} style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      {Math.hypot(knob.x, knob.y) > R * 0.95 && <span className="joy-run">Chạy</span>}
    </div>
  );
}

/** Drag anywhere in the look zone to rotate the camera; two fingers pinch to zoom; quick tap = interact. */
function LookZone({ side }: { side: 'left' | 'right' }) {
  const pts = useRef(new Map<number, { x: number; y: number; t: number; moved: number }>());
  const pinch = useRef<number | null>(null);
  const sens = useSettings((s) => s.s.controls.touchSensitivity);
  return (
    <div className={`look-zone ${side}`} aria-hidden
      onPointerDown={(e) => { audio.resume(); e.currentTarget.setPointerCapture(e.pointerId); pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 }); }}
      onPointerMove={(e) => {
        const p = pts.current.get(e.pointerId);
        if (!p) return;
        const dx = e.clientX - p.x, dy = e.clientY - p.y;
        p.moved += Math.abs(dx) + Math.abs(dy);
        p.x = e.clientX; p.y = e.clientY;
        if (pts.current.size >= 2) {
          const [a, b] = [...pts.current.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (pinch.current !== null) controller.view?.zoom((pinch.current - d) * 0.01);
          pinch.current = d;
          return;
        }
        controller.view?.look(dx, dy, sens);
      }}
      onPointerUp={(e) => {
        const p = pts.current.get(e.pointerId);
        pts.current.delete(e.pointerId);
        if (pts.current.size < 2) pinch.current = null;
        if (p && p.moved < 10 && performance.now() - p.t < 250) controller.onKeyAction('interact'); // chạm nhanh = tương tác
      }}
      onPointerCancel={(e) => { pts.current.delete(e.pointerId); pinch.current = null; }} />
  );
}

export function TouchControls() {
  const touch = useTouchUI();
  const hud = useUI((s) => s.hud);
  const focus = useUI((s) => s.focus);
  const overlay = useUI((s) => s.overlay);
  const dialogue = useUI((s) => s.dialogue);
  const size = useSettings((s) => s.s.controls.joystickSize);
  const left = useSettings((s) => s.s.controls.leftHanded);
  const [crouch, setCrouch] = useState(false);
  if (!touch || !hud || overlay || dialogue) return null;
  const verbs = focus?.verbs ?? [];
  const first = verbs.find((v) => v.enabled);
  const blocked = !first && verbs[0];
  const acting = hud.action;
  const seated = hud.mode === 'seated';
  const tap = (fn: () => void) => () => { audio.resume(); fn(); };
  const targetName = focus?.label.split(' · ')[0];
  return (
    <div className={`touch-layer ${left ? 'lefty' : ''}`}>
      <LookZone side={left ? 'left' : 'right'} />
      <Joystick size={size} side={left ? 'right' : 'left'} />
      <div className={`m-actions ${left ? 'left' : 'right'}`}>
        {acting ? (
          <>
            <div className="m-label"><b>{acting.label}</b><span>{Math.round(acting.progress * 100)}%</span></div>
            <div className="m-act-row">
              <button className="m-small" onClick={tap(() => controller.onKeyAction('cancel'))} aria-label="Hủy (không nhận kết quả)"><Icon name="close" /></button>
              <button className="m-main" onClick={tap(() => controller.onKeyAction('skip'))} aria-label="Tua nhanh" style={{ ['--p' as string]: acting.progress } as React.CSSProperties}>
                <Icon name="forward" size={30} />
              </button>
            </div>
          </>
        ) : (
          <>
            {focus && (
              <div className="m-label">
                <b>{targetName}</b>
                <span>{first ? first.label : blocked ? blocked.reason ?? 'Chưa dùng được' : ''}</span>
              </div>
            )}
            {verbs.filter((v) => v.enabled && v !== first).slice(0, 2).map((v) => (
              <button key={v.verb} className="m-chip" onClick={tap(() => controller.doVerb(focus!.id, v.verb))}>{v.label}</button>
            ))}
            <div className="m-act-row">
              <div className="m-small-col">
                {seated
                  ? <button className="m-small" onClick={tap(() => controller.session?.standUp())} aria-label="Đứng dậy"><Icon name="stand" /></button>
                  : <button className={`m-small ${crouch ? 'on' : ''}`} aria-pressed={crouch} aria-label="Cúi" onClick={tap(() => { controller.view?.toggleCrouch(); setCrouch(!!controller.view?.crouching); })}><Icon name="crouch" /></button>}
                <button className="m-small" onClick={tap(() => controller.view?.toggleShoulder())} aria-label="Đổi vai camera"><Icon name="camera" /></button>
              </div>
              <button className={`m-main ${first ? 'ready' : ''}`} disabled={!first} onClick={tap(() => controller.onKeyAction('interact'))} aria-label={first ? first.label : 'Không có gì để tương tác'}>
                <Icon name={focus?.kind === 'npc' ? 'talk' : 'hand'} size={30} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Kept for API compatibility; orientation hint now lives in the mobile HUD as a small pill. */
export function RotateHint() { return null; }

/** Gamepad navigation inside menus/overlays: D-pad/left stick moves focus, A activates, B closes. */
export function useGamepadUI() {
  useEffect(() => {
    let raf = 0;
    let prev: boolean[] = [];
    let lastMove = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const ui = useUI.getState();
      const menuOpen = ui.overlay !== null || ui.dialogue !== null || ui.screen !== 'game';
      if (!menuOpen) { prev = []; return; }
      const pads = navigator.getGamepads ? [...navigator.getGamepads()] : [];
      const gp = pads.find((p) => p && p.connected);
      if (!gp) return;
      const pressed = gp.buttons.map((b) => b.pressed);
      const edge = (i: number) => !!pressed[i] && !prev[i];
      const now = performance.now();
      const ay = gp.axes[1] ?? 0;
      const ax = gp.axes[0] ?? 0;
      const dir = edge(12) || (ay < -0.6 && now - lastMove > 220) ? -1 : edge(13) || (ay > 0.6 && now - lastMove > 220) ? 1 : edge(14) || (ax < -0.6 && now - lastMove > 220) ? -1 : edge(15) || (ax > 0.6 && now - lastMove > 220) ? 1 : 0;
      if (dir) {
        lastMove = now;
        const scope = document.querySelector('[role=dialog]') ?? document.body;
        const list = [...scope.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select, [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
        const i = list.indexOf(document.activeElement as HTMLElement);
        const next = list[(i + dir + list.length) % list.length] ?? list[0];
        next?.focus();
        next?.scrollIntoView({ block: 'nearest' });
      }
      if (edge(0)) (document.activeElement as HTMLElement | null)?.click();
      if (edge(1) || (edge(9) && ui.overlay === 'pause')) {
        const dlg = document.querySelector('[role=dialog]');
        const target = dlg && dlg.contains(document.activeElement) ? document.activeElement! : dlg ?? document.body;
        target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      }
      prev = pressed;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
}
