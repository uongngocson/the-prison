// Đóng/mở trang web (bảo trì) — app_config.site.
import { useEffect, useState } from 'react';
import * as api from '../api';
import { dateTime } from '../format';
import { act, Badge, Confirm, ErrorBox, Loading, PageHead, Toggle, useLoad } from '../ui';
import { DEFAULT_SITE, parseSite, type SiteConfig } from '../../config/remote';
import { SLOGAN } from '../../site/slogan';

/** ISO → giá trị ô datetime-local (giờ của máy admin) và ngược lại. */
const toLocalInput = (iso: string | null) => { if (!iso) return ''; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); };
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

export function SitePage() {
  const rows = useLoad(() => api.configRows(), []);
  const raw = rows.data?.find((r) => r.key === 'site');
  const saved: SiteConfig = parseSite(raw?.value);
  const [f, setF] = useState<SiteConfig>(saved);
  const [confirm, setConfirm] = useState<'close' | 'open' | null>(null);
  useEffect(() => { if (rows.data) setF(parseSite(rows.data.find((r) => r.key === 'site')?.value)); }, [rows.data]);
  const dirty = f.title !== saved.title || f.message !== saved.message || f.reopenAt !== saved.reopenAt;
  const valid = f.title.trim().length >= 2 && f.title.length <= 60 && f.message.trim().length >= 2 && f.message.length <= 400;
  const save = async (next: SiteConfig, msg: string) => {
    if (await act(() => api.saveConfig('site', { ...next, title: next.title.trim(), message: next.message.trim() }), msg)) rows.reload();
  };
  return (
    <>
      <PageHead title="Trang web" sub="Đóng trang để bảo trì: người chơi chỉ thấy thông báo, không vào được game">
        {rows.data && (saved.open ? <Badge tone="ok">Đang mở</Badge> : <Badge tone="bad">Đang đóng</Badge>)}
      </PageHead>
      {rows.error && <ErrorBox error={rows.error} onRetry={rows.reload} />}
      {rows.loading && !rows.data ? <Loading rows={4} /> : (
        <>
          <section className={`ad-card ${saved.open ? '' : 'ad-card-alert'}`}>
            <header className="ad-card-head"><div><h3>Trạng thái truy cập</h3><p>{raw?.updated_at ? `Cập nhật ${dateTime(raw.updated_at)}` : 'Chưa từng thay đổi'}{!raw && rows.data ? ' · chưa chạy migration 0006' : ''}</p></div></header>
            <label className="ad-inline">
              <Toggle label="Mở trang web" checked={saved.open} onChange={(v) => setConfirm(v ? 'open' : 'close')} />
              <span><b>{saved.open ? 'Trang web đang mở' : 'Trang web đang đóng'}</b>
                <small>{saved.open ? 'Người chơi vào game bình thường.' : 'Người chơi chỉ thấy màn hình thông báo. Admin đã đăng nhập vẫn xem được trang.'}</small></span>
            </label>
            <p className="ad-muted small">Khi đóng: người đang chơi được lưu tiến trình rồi chuyển sang màn hình thông báo trong khoảng 1 phút. Trang quản trị không bị ảnh hưởng.</p>
          </section>

          <div className="ad-grid">
            <section className="ad-card">
              <header className="ad-card-head"><div><h3>Nội dung thông báo</h3><p>Hiện cho người chơi khi trang đóng.</p></div></header>
              <label className="ad-field"><span>Tiêu đề</span><input value={f.title} maxLength={60} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
              <label className="ad-field"><span>Lời nhắn</span><textarea rows={4} maxLength={400} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /><small className="ad-muted">{f.message.length}/400</small></label>
              <label className="ad-field"><span>Dự kiến mở lại (không bắt buộc)</span>
                <div className="ad-row"><input type="datetime-local" value={toLocalInput(f.reopenAt)} onChange={(e) => setF({ ...f, reopenAt: fromLocalInput(e.target.value) })} />{f.reopenAt && <button className="ad-link" onClick={() => setF({ ...f, reopenAt: null })}>Xóa</button>}</div>
              </label>
              <div className="ad-row">
                <button className="ad-btn primary" disabled={!dirty || !valid} onClick={() => void save({ ...saved, title: f.title, message: f.message, reopenAt: f.reopenAt }, 'Đã lưu nội dung thông báo')}>Lưu nội dung</button>
                <button className="ad-btn" disabled={!dirty} onClick={() => setF(saved)}>Hoàn tác</button>
                <button className="ad-btn" onClick={() => setF({ ...f, title: DEFAULT_SITE.title, message: DEFAULT_SITE.message })}>Dùng mẫu mặc định</button>
              </div>
              {!valid && <p className="ad-err-text">Tiêu đề 2–60 ký tự, lời nhắn 2–400 ký tự.</p>}
            </section>
            <section className="ad-card">
              <header className="ad-card-head"><div><h3>Xem trước</h3><p>Người chơi sẽ thấy như thế này.</p></div><a className="ad-link" href="/" target="_blank" rel="noreferrer">Mở trang chủ ↗</a></header>
              <div className="ad-preview">
                <div className="ad-preview-card">
                  <div className="ad-preview-brand">“{SLOGAN}”</div>
                  <div className="ad-preview-icon" aria-hidden>🔧</div>
                  <b>{f.title || '—'}</b>
                  <p>{f.message || '—'}</p>
                  {f.reopenAt && <small>Dự kiến mở lại: {dateTime(f.reopenAt)}</small>}
                  <span className="ad-preview-btn">Thử lại</span>
                </div>
              </div>
            </section>
          </div>
        </>
      )}
      {confirm === 'close' && <Confirm title="Đóng trang web?" text="Mọi người chơi sẽ không vào được game cho đến khi bạn mở lại. Người đang chơi được lưu tiến trình rồi chuyển sang màn hình thông báo." okLabel="Đóng trang web"
        onClose={() => setConfirm(null)} onConfirm={async () => { await save({ ...saved, ...(dirty && valid ? { title: f.title, message: f.message, reopenAt: f.reopenAt } : {}), open: false }, 'Đã đóng trang web'); setConfirm(null); }} />}
      {confirm === 'open' && <Confirm title="Mở lại trang web?" text="Người chơi sẽ vào game bình thường ngay (màn hình thông báo tự chuyển trong vòng 1 phút)." okLabel="Mở trang web"
        onClose={() => setConfirm(null)} onConfirm={async () => { await save({ ...saved, open: true }, 'Đã mở lại trang web'); setConfirm(null); }} />}
    </>
  );
}
