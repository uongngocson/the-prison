// Màn hình bảo trì: hiện khi admin đóng trang web. Không tải engine 3D hay dữ liệu game.
import { useEffect, useState } from 'react';
import './maintenance.css';
import type { SiteConfig } from '../config/remote';
import { SLOGAN } from './slogan';

const fmt = (iso: string) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));

export function Maintenance({ site, recheck }: { site: SiteConfig; recheck: () => Promise<boolean> }) {
  const [checking, setChecking] = useState(false);
  const [last, setLast] = useState(Date.now());
  const retry = async () => {
    setChecking(true);
    const open = await recheck();
    setChecking(false);
    setLast(Date.now());
    if (open) location.reload();
  };
  // tự kiểm tra lại mỗi 60 giây: mở lại thì vào game ngay
  useEffect(() => {
    document.title = `${site.title} · Một Ngày Mới`;
    const t = setInterval(() => void retry(), 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <main className="mt-root">
      <div className="mt-glow" aria-hidden />
      <section className="mt-card" role="alert" aria-live="polite">
        <p className="mt-brand">“{SLOGAN}”</p>
        <div className="mt-icon" aria-hidden>
          <svg viewBox="0 0 48 48"><path d="M30.5 9.5a9 9 0 0 0-11.8 11.4L8.6 31a3.5 3.5 0 0 0 5 5l10.1-10.1A9 9 0 0 0 35 14.1l-5.3 5.3-4.7-1.2-1.2-4.7z" /></svg>
        </div>
        <h1>{site.title}</h1>
        <p className="mt-msg">{site.message}</p>
        {site.reopenAt && <p className="mt-eta">Dự kiến mở lại: <b>{fmt(site.reopenAt)}</b></p>}
        <button className="mt-btn" onClick={() => void retry()} disabled={checking}>{checking ? 'Đang kiểm tra…' : 'Thử lại'}</button>
        <p className="mt-note">Trang tự kiểm tra lại mỗi phút · lần cuối {new Date(last).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
      </section>
    </main>
  );
}

/** Thanh nhắc cho admin đang xem trang trong lúc bảo trì. */
export function AdminPreviewBar() {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <div className="mt-adminbar" role="status">
      Trang web đang <b>đóng (bảo trì)</b>. Bạn xem được vì là admin.
      <a href="/admin#site">Quản lý</a>
      <button onClick={() => setHidden(true)} aria-label="Ẩn">✕</button>
    </div>
  );
}
