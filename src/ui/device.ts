// Device profile: phone / tablet / desktop, touch, orientation, gamepad. Reactive store + body classes for CSS.
import { create } from 'zustand';

export type FormFactor = 'phone' | 'tablet' | 'desktop';
export interface DeviceInfo {
  form: FormFactor;
  touch: boolean; // has touch screen
  coarse: boolean; // primary pointer is coarse (finger)
  portrait: boolean;
  width: number;
  height: number;
  gamepad: string | null;
  standalone: boolean;
}

function detect(prev?: DeviceInfo): DeviceInfo {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const short = Math.min(w, h);
  const form: FormFactor = coarse && short < 600 ? 'phone' : coarse && short < 1100 ? 'tablet' : w < 600 ? 'phone' : 'desktop';
  return {
    form, touch, coarse, portrait: h > w, width: w, height: h, gamepad: prev?.gamepad ?? null,
    standalone: matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches,
  };
}

export const useDevice = create<DeviceInfo>(() => detect());

function apply() {
  const d = detect(useDevice.getState());
  useDevice.setState(d);
  const b = document.body.classList;
  b.toggle('dev-phone', d.form === 'phone');
  b.toggle('dev-tablet', d.form === 'tablet');
  b.toggle('dev-desktop', d.form === 'desktop');
  b.toggle('dev-touch', d.coarse);
  b.toggle('dev-portrait', d.portrait);
  document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
}

let started = false;
export function startDeviceWatch() {
  if (started) return;
  started = true;
  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', () => setTimeout(apply, 150));
  window.visualViewport?.addEventListener('resize', apply);
  window.addEventListener('gamepadconnected', (e) => useDevice.setState({ gamepad: (e as GamepadEvent).gamepad.id }));
  window.addEventListener('gamepaddisconnected', () => useDevice.setState({ gamepad: null }));
}

/** Touch UI is shown when the primary pointer is a finger, unless the player overrides it in settings. */
export function touchUIActive(mode: 'auto' | 'on' | 'off'): boolean {
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  return useDevice.getState().coarse;
}

export async function enterFullscreen() {
  try {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    if (!document.fullscreenElement) await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await o?.lock?.('landscape').catch(() => undefined);
  } catch { /* iOS Safari: không hỗ trợ fullscreen cho trang — vẫn chơi bình thường */ }
}
export const fullscreenSupported = () => !!(document.documentElement.requestFullscreen || (document.documentElement as unknown as { webkitRequestFullscreen?: unknown }).webkitRequestFullscreen);
