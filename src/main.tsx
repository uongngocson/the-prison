import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DEFAULT_SITE, fetchRemoteConfig, type SiteConfig } from './config/remote';

const root = createRoot(document.getElementById('root')!);

// Sau mỗi lần deploy, tên các file JS đổi: người đang mở bản cũ sẽ tải hỏng phần code tải sau (vd. màn tạo nhân vật).
// Tự tải lại trang MỘT lần để lấy bản mới (tiến trình đã được lưu khi rời trang); không lặp lại trong 60 giây.
window.addEventListener('vite:preloadError', (e) => {
  try {
    const KEY = 'mnm.chunkReloadAt';
    if (Date.now() - Number(sessionStorage.getItem(KEY) ?? 0) < 60_000) return;
    sessionStorage.setItem(KEY, String(Date.now()));
    e.preventDefault();
    location.reload();
  } catch { /* không có sessionStorage: để lỗi hiển thị như cũ */ }
});
const SB_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Trạng thái đóng/mở trang (lỗi mạng → coi như mở: không khóa người chơi vì sự cố kết nối). */
async function siteState(): Promise<SiteConfig> {
  if (!SB_URL || !SB_KEY) return DEFAULT_SITE;
  return (await fetchRemoteConfig(SB_URL, SB_KEY, 3500)).site;
}
/** Admin đã đăng nhập vẫn xem được trang khi bảo trì. */
async function viewerIsAdmin(): Promise<boolean> {
  try {
    const { cloud } = await import('./persistence/cloud');
    if (!(await cloud.user())) return false;
    const { data } = await (await cloud.sb()).rpc('is_admin');
    return data === true;
  } catch { return false; }
}
function startGame(adminPreview = false) {
  void import('./ui/noSelect').then((m) => m.lockGameGestures());
  if (adminPreview) (window as unknown as { __mnmAdminPreview?: boolean }).__mnmAdminPreview = true;
  void Promise.all([import('./App'), import('./ui/styles.css'), adminPreview ? import('./site/Maintenance') : null]).then(([{ default: App }, , m]) =>
    root.render(<StrictMode>{m && <m.AdminPreviewBar />}<App /></StrictMode>));
}

// /admin: trang quản trị riêng (không tải engine 3D hay CSS của game; luôn vào được kể cả khi bảo trì)
if (/^\/admin\/?$/.test(location.pathname)) {
  void import('./admin/AdminApp').then(({ AdminApp }) => root.render(<StrictMode><AdminApp /></StrictMode>));
} else {
  void siteState().then(async (site) => {
    if (site.open) return startGame();
    if (await viewerIsAdmin()) return startGame(true);
    const { Maintenance } = await import('./site/Maintenance');
    root.render(<StrictMode><Maintenance site={site} recheck={async () => (await siteState()).open} /></StrictMode>);
  });
}
