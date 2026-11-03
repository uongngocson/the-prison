// Định dạng hiển thị cho trang admin (giờ Việt Nam).
const TZ = 'Asia/Ho_Chi_Minh';
const dtf = new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const df = new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, day: '2-digit', month: '2-digit' });

export const dateTime = (iso: string | null | undefined) => (iso ? dtf.format(new Date(iso)) : '—');
/** 'YYYY-MM-DD' → 'dd/MM' (không lệch múi giờ). */
export const dayLabel = (day: string) => { const [, m, d] = day.split('-'); return `${d}/${m}`; };
export const shortDate = (iso: string) => df.format(new Date(iso));

export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—';
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'vừa xong';
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} ngày trước`;
  return shortDate(iso);
}
export function minutes(m: number): string {
  if (m < 60) return `${m} phút`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} giờ ${r} phút` : `${h} giờ`;
}
export const shortId = (id: string | null | undefined) => (id ? id.slice(0, 8) : '—');
export const PLATFORM: Record<string, string> = { phone: 'Điện thoại', tablet: 'Máy tính bảng', desktop: 'Máy tính' };
export const ERROR_KIND: Record<string, string> = { error: 'Lỗi JS', promise: 'Promise', ui: 'Giao diện', fatal: 'Nghiêm trọng', loop: 'Vòng lặp 3D', online: 'Trực tuyến', ai: 'AI', save: 'Lưu game', other: 'Khác' };
