// CR-TIME-01: hộp xác nhận chuyển tới giờ chung khi vào phòng trực tuyến (F87).
import { create } from 'zustand';

export interface ClockJump { clock: string; fromDay: number; toDay: number; hours: number; skipped: string[] }
interface State { jump: ClockJump | null; resolve: ((ok: boolean) => void) | null }
export const useClockPrompt = create<State>(() => ({ jump: null, resolve: null }));

/** Hỏi người chơi; trả về true nếu đồng ý chuyển giờ. */
export function askClockJump(jump: ClockJump): Promise<boolean> {
  useClockPrompt.getState().resolve?.(false);
  return new Promise((resolve) => useClockPrompt.setState({ jump, resolve: (ok) => { useClockPrompt.setState({ jump: null, resolve: null }); resolve(ok); } }));
}
