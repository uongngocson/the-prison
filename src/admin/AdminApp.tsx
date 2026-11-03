// Trang quản trị /admin: đăng nhập (email OTP Supabase) → kiểm tra quyền admin → bảng điều khiển.
import { useCallback, useEffect, useState } from 'react';
import './admin.css';
import { cloud } from '../persistence/cloud';
import * as api from './api';
import { act, Modal, NavIcon, Notes, Segmented } from './ui';
import { useLive } from './live';
import { applyBotOverrides } from '../bots/personas';
import { OverviewPage } from './pages/Overview';
import { UsersPage } from './pages/Users';
import { OnlinePage } from './pages/Online';
import { BotsPage } from './pages/Bots';
import { ErrorsPage } from './pages/Errors';
import { ReportsPage } from './pages/Reports';
import { SitePage } from './pages/Site';

export type Page = 'overview' | 'users' | 'online' | 'bots' | 'errors' | 'reports' | 'site';
const NAV: { id: Page; label: string }[] = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'users', label: 'Người chơi' },
  { id: 'online', label: 'Trực tuyến' },
  { id: 'bots', label: 'Bạn tù AI' },
  { id: 'errors', label: 'Nhật ký lỗi' },
  { id: 'reports', label: 'Báo cáo' },
  { id: 'site', label: 'Trang web' },
];
const pageFromHash = (): Page => { const h = location.hash.slice(1).split('?')[0] as Page; return NAV.some((n) => n.id === h) ? h : 'overview'; };

/** Mở chi tiết người chơi từ trang khác (vd. từ lỗi / trực tuyến). */
export interface OpenUser { userId: string | null; visitorId: string | null; label?: string }

export function AdminApp() {
  const [auth, setAuth] = useState<'loading' | 'signed-out' | 'denied' | 'ok'>('loading');
  const [me, setMe] = useState<{ id: string; email: string } | null>(null);
  const check = useCallback(async () => {
    if (!cloud.configured()) { setAuth('signed-out'); return; }
    const s = await api.session().catch(() => null);
    setMe(s);
    if (!s) { setAuth('signed-out'); return; }
    const ok = await api.isAdmin().catch(() => false);
    setAuth(ok ? 'ok' : 'denied');
  }, []);
  useEffect(() => {
    document.title = 'Quản trị · Một Ngày Mới';
    void check();
    let unsub: (() => void) | undefined;
    void api.sb().then((c) => { const { data } = c.auth.onAuthStateChange(() => void check()); unsub = () => data.subscription.unsubscribe(); }).catch(() => undefined);
    return () => unsub?.();
  }, [check]);

  if (auth === 'loading') return <div className="ad-root ad-center"><div className="ad-spinner" aria-label="Đang tải" /></div>;
  if (auth === 'signed-out') return <Login />;
  if (auth === 'denied') return <Denied me={me!} />;
  return <Shell me={me!} />;
}

function Login() {
  const [mode, setMode] = useState<'password' | 'link'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const configured = cloud.configured();
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    if (mode === 'password') {
      // thành công → onAuthStateChange tự chuyển vào bảng điều khiển
      const r = await api.signInPassword(email, password);
      if (!r.ok) { setState('error'); setMsg(r.message); }
      return;
    }
    const r = await api.signIn(email);
    setState(r.ok ? 'sent' : 'error'); setMsg(r.message);
  };
  return (
    <div className="ad-root ad-center">
      <form className="ad-login" onSubmit={send}>
        <div className="ad-brand big"><span className="ad-logo" />Một Ngày Mới<small>Quản trị</small></div>
        {!configured && <p className="ad-errorbox">Chưa cấu hình Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).</p>}
        {state === 'sent' ? (
          <div className="ad-sent"><h2>Kiểm tra email</h2><p>Đã gửi liên kết đăng nhập tới <b>{email}</b>. Mở liên kết trên trình duyệt này để vào trang quản trị.</p><button type="button" className="ad-link" onClick={() => setState('idle')}>Quay lại</button></div>
        ) : (
          <>
            <Segmented label="Cách đăng nhập" value={mode} onChange={(v) => { setMode(v); setState('idle'); }} options={[{ value: 'password', label: 'Mật khẩu' }, { value: 'link', label: 'Liên kết email' }]} />
            <div style={{ height: 16 }} />
            <label className="ad-field"><span>Email quản trị</span><input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@vidu.com" autoComplete="username" /></label>
            {mode === 'password' && <label className="ad-field"><span>Mật khẩu</span><input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>}
            <button className="ad-btn primary block" disabled={!configured || state === 'sending'}>
              {state === 'sending' ? (mode === 'password' ? 'Đang đăng nhập…' : 'Đang gửi…') : (mode === 'password' ? 'Đăng nhập' : 'Gửi liên kết đăng nhập')}
            </button>
            {state === 'error' && <p className="ad-err-text" role="alert">{msg}</p>}
            {mode === 'link' && <p className="ad-muted small">Supabase giới hạn số email gửi mỗi giờ. Nếu đã có mật khẩu, nên dùng đăng nhập bằng mật khẩu.</p>}
          </>
        )}
      </form>
    </div>
  );
}

/** Đổi mật khẩu cho tài khoản admin đang đăng nhập. */
function PasswordDialog({ onClose }: { onClose: () => void }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    if (pw.length < 8) { setErr('Mật khẩu tối thiểu 8 ký tự.'); return; }
    if (pw !== pw2) { setErr('Hai mật khẩu không khớp.'); return; }
    setBusy(true); setErr('');
    if (await act(() => api.changePassword(pw), 'Đã đổi mật khẩu')) onClose();
    setBusy(false);
  };
  return (
    <Modal title="Đặt / đổi mật khẩu" onClose={onClose} footer={<>
      <button className="ad-btn" onClick={onClose}>Hủy</button>
      <button className="ad-btn primary" disabled={busy || !pw} onClick={() => void save()}>Lưu mật khẩu</button>
    </>}>
      <p className="ad-muted">Dùng mật khẩu này để đăng nhập trang quản trị mà không cần email.</p>
      <label className="ad-field"><span>Mật khẩu mới</span><input type="password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" autoFocus /></label>
      <label className="ad-field"><span>Nhập lại</span><input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" onKeyDown={(e) => e.key === 'Enter' && void save()} /></label>
      {err && <p className="ad-err-text">{err}</p>}
    </Modal>
  );
}

function Denied({ me }: { me: { id: string; email: string } }) {
  const sql = `insert into public.admins (user_id) values ('${me.id}');`;
  return (
    <div className="ad-root ad-center">
      <div className="ad-login">
        <div className="ad-brand big"><span className="ad-logo" />Một Ngày Mới<small>Quản trị</small></div>
        <h2>Chưa có quyền quản trị</h2>
        <p className="ad-muted">Tài khoản <b>{me.email}</b> đã đăng nhập nhưng chưa nằm trong danh sách admin. Chạy lệnh sau trong Supabase → SQL Editor (sau khi đã chạy migration 0004_admin.sql), rồi tải lại trang:</p>
        <pre className="ad-code">{sql}</pre>
        <div className="ad-row">
          <button className="ad-btn" onClick={() => void navigator.clipboard?.writeText(sql)}>Sao chép lệnh</button>
          <button className="ad-btn" onClick={() => location.reload()}>Tải lại</button>
          <button className="ad-btn" onClick={() => void api.signOut().then(() => location.reload())}>Đăng xuất</button>
        </div>
      </div>
    </div>
  );
}

function Shell({ me }: { me: { id: string; email: string } }) {
  const [page, setPage] = useState<Page>(pageFromHash);
  const [openUser, setOpenUser] = useState<OpenUser | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const live = useLive();
  // tên bạn tù theo bản đã chỉnh (cho mọi trang)
  useEffect(() => { void api.botOverrides().then(applyBotOverrides).catch(() => undefined); }, []);
  useEffect(() => {
    const h = () => setPage(pageFromHash());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  const go = (p: Page) => { location.hash = p; setPage(p); };
  const showUser = (u: OpenUser) => { setOpenUser(u); if (page !== 'users') go('users'); };
  const playing = live.players.filter((p) => p.state === 'playing').length;
  return (
    <div className="ad-root ad-shell">
      <nav className="ad-side" aria-label="Điều hướng quản trị">
        <div className="ad-brand"><span className="ad-logo" />Một Ngày Mới<small>Quản trị</small></div>
        <ul>
          {NAV.map((n) => (
            <li key={n.id}>
              <a href={`#${n.id}`} className={page === n.id ? 'on' : ''} aria-current={page === n.id ? 'page' : undefined} onClick={(e) => { e.preventDefault(); go(n.id); }}>
                <NavIcon name={n.id} /><span>{n.label}</span>
                {n.id === 'online' && <em className={`ad-live-dot ${live.connected ? 'on' : ''}`}>{playing}</em>}
              </a>
            </li>
          ))}
        </ul>
        <div className="ad-me">
          <span title={me.email}>{me.email}</span>
          <button className="ad-icon-btn" onClick={() => setPwOpen(true)} aria-label="Đổi mật khẩu" title="Đổi mật khẩu"><NavIcon name="key" /></button>
          <button className="ad-icon-btn" onClick={() => void api.signOut().then(() => location.reload())} aria-label="Đăng xuất" title="Đăng xuất"><NavIcon name="logout" /></button>
        </div>
      </nav>
      <main className="ad-main">
        {page === 'overview' && <OverviewPage live={live} go={go} />}
        {page === 'users' && <UsersPage live={live} open={openUser} setOpen={setOpenUser} />}
        {page === 'online' && <OnlinePage live={live} showUser={showUser} />}
        {page === 'bots' && <BotsPage live={live} />}
        {page === 'errors' && <ErrorsPage showUser={showUser} />}
        {page === 'reports' && <ReportsPage showUser={showUser} />}
        {page === 'site' && <SitePage />}
      </main>
      <Notes />
      {pwOpen && <PasswordDialog onClose={() => setPwOpen(false)} />}
    </div>
  );
}
