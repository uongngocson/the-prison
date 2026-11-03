// U01 Landing, U02 Auth, U04 Menu, U05 Loading, U24 Lobby (P2), U25 Fatal/Recovery, Credits, Ending.
import { useEffect, useState } from 'react';
import { SLOGAN } from '../../site/slogan';
import { useUI } from '../store';
import { Panel } from '../components';
import { useDevice } from '../device';
import { controller } from '../../app/controller';
import { hasAnySave, slotOfLatest } from '../../persistence/localStore';
import type { SaveEnvelope } from '../../persistence/saveCodec';
import { cloud } from '../../persistence/cloud';
import { fmtClock } from '../../domain/util';
import { POLICY_PROFILE } from '../../content/life';
import { GateScene, SloganTicker, SLOGANS, FACILITY_NAME } from './GateScene';
import { Icon } from '../icons';

function capabilities() {
  const c = document.createElement('canvas');
  const webgl2 = !!c.getContext('webgl2');
  const wasm = typeof WebAssembly === 'object';
  const idb = typeof indexedDB !== 'undefined';
  const wide = window.innerWidth >= 1280 && window.innerHeight >= 680;
  const touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;
  const gamepad = typeof navigator.getGamepads === 'function';
  return { webgl2, wasm, idb, wide, touchOnly, gamepad, ok: webgl2 };
}

/** Menu poster: the same fictional gate scene, compact. */
export function Poster() {
  return <GateScene compact />;
}

export function Landing() {
  const set = useUI((s) => s.set);
  const [cap] = useState(capabilities);
  const [modal, setModal] = useState<null | 'law' | 'about'>(null);
  const portrait = useDevice((d) => d.portrait && d.width < 700);
  return (
    <main className={`home ${portrait ? 'home-portrait' : ''}`} id="main">
      <div className="home-bg"><GateScene portrait={portrait} /></div>
      <header className="home-bar">
        <div className="home-brand"><span className="brand-mark" aria-hidden>ND</span><b>MỘT NGÀY MỚI</b><small className="home-brand-sub">NEW DAY CORRECTIONAL FACILITY</small></div>
        <nav className="home-nav">
          <button onClick={() => setModal('about')}>Giới thiệu</button>
          <button onClick={() => set({ screen: 'auth' })}>Đăng nhập</button>
        </nav>
      </header>
      <section className="home-hero">
        <h1 className="home-slogan">{SLOGAN}</h1>
        <p className="home-eyebrow">{FACILITY_NAME} · Cơ sở hư cấu</p>
        <p className="home-lead">Kỷ luật · Giáo dục · Việc làm · Tái hòa nhập</p>
        <div className="home-cta" id="cta">
          <button className="btn primary lg" disabled={!cap.ok} onClick={() => set({ screen: 'menu' })} data-autofocus>▶ Chơi ngay</button>
        </div>
        {!cap.ok && <p className="home-warn" role="alert">Trình duyệt chưa hỗ trợ WebGL2 · hãy cập nhật để chơi.</p>}
      </section>
      <SloganTicker />

      {modal === 'law' && (
        <Panel title="Thông báo của trại" onClose={() => setModal(null)} width="mid">
          <p className="law-lead">“{SLOGANS[0].text}”</p>
          <ul className="law-list">
            {SLOGANS.slice(1).map((sl) => <li key={sl.text}><span aria-hidden>{sl.icon}</span>{sl.text}</li>)}
          </ul>
          <p className="muted small">Nội dung mang tính giáo dục, không phải tư vấn pháp lý.</p>
        </Panel>
      )}
      {modal === 'about' && (
        <Panel title="Giới thiệu" onClose={() => setModal(null)} width="mid">
          <p>Mô phỏng đời sống 3D trong một cơ sở cải huấn <b>hư cấu</b> phong cách Mỹ: sinh hoạt, học, làm, giữ liên lạc gia đình, chuẩn bị ngày về. Không vũ khí, vượt ngục hay tiền thật · có ẩu đả và biệt giam (tắt được).</p>
          <dl className="kv small">
            <dt>Nội dung</dt><dd>18 khu · 60 nhân vật · 18 nhiệm vụ</dd>
            <dt>Thiết bị</dt><dd>Máy tính, máy tính bảng, điện thoại, tay cầm</dd>
            <dt>WebGL2</dt><dd>{cap.webgl2 ? '✓ Có' : '✗ Không'}</dd>
            <dt>Lưu cục bộ</dt><dd>{cap.idb ? '✓ Có' : '✗ Không'}</dd>
          </dl>
          <p className="muted small">{FACILITY_NAME} cùng mọi nhân vật, quy định trong game là hư cấu. {POLICY_PROFILE.jurisdictionLabel}.</p>
        </Panel>
      )}
    </main>
  );
}

/** Khung màn hình kiểu game: cảnh cổng trại phủ toàn màn + lớp tối bên trái cho menu. */
function GameShell({ children, portrait }: { children: React.ReactNode; portrait: boolean }) {
  return (
    <main className={`gm ${portrait ? 'gm-portrait' : ''}`} id="main">
      <div className="gm-bg" aria-hidden><GateScene portrait={portrait} cover /></div>
      <div className="gm-shade" aria-hidden />
      {children}
    </main>
  );
}
function Brand() {
  return (
    <header className="gm-brand">
      <span className="gm-mark" aria-hidden>ND</span>
      <div><h1>MỘT NGÀY MỚI</h1><p>New Day Correctional Facility · Tái hòa nhập</p></div>
    </header>
  );
}

export function Auth() {
  const set = useUI((s) => s.set);
  const portrait = useDevice((d) => d.portrait && d.width < 700);
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const [user, setUser] = useState<{ email?: string } | null | undefined>(undefined);
  const configured = cloud.configured();
  useEffect(() => { cloud.user().then(setUser).catch(() => setUser(null)); }, []);
  const valid = /.+@.+\..+/.test(email);
  return (
    <GameShell portrait={portrait}>
      <section className="gm-panel gm-auth" aria-labelledby="auth-title">
        <button className="gm-back" onClick={() => set({ screen: 'menu' })} aria-label="Quay lại"><Icon name="back" size={20} /></button>
        <div className="gm-avatar" aria-hidden><Icon name="user" size={34} /></div>
        <h2 id="auth-title">Tài khoản</h2>
        {user ? <>
          <span className="gm-status ok">Đã đăng nhập</span>
          <p className="gm-email">{user.email}</p>
          <p className="gm-sub">Save được đồng bộ giữa các thiết bị.</p>
          <button className="gm-btn primary" onClick={() => set({ screen: 'menu' })} data-autofocus>Vào game</button>
          <button className="gm-btn" onClick={async () => { await cloud.signOut(); setUser(null); }}>Đăng xuất</button>
        </> : <>
          <span className="gm-status">{user === undefined ? 'Đang kiểm tra…' : 'Đang chơi với tư cách khách'}</span>
          <p className="gm-sub">Đăng nhập để giữ save trên mọi thiết bị. Không bắt buộc.</p>
          {configured ? (
            <form className="gm-form" onSubmit={async (e) => { e.preventDefault(); if (!valid) return; setState('sending'); const r = await cloud.signIn(email); setState(r.ok ? 'sent' : 'error'); setMsg(r.message); }}>
              <label className="gm-input">
                <Icon name="talk" size={18} />
                <input type="email" inputMode="email" autoComplete="email" placeholder="Email của bạn" value={email} onChange={(e) => { setEmail(e.target.value); setState('idle'); }} aria-label="Email" />
              </label>
              <button className="gm-btn primary" disabled={state === 'sending' || !valid}>{state === 'sending' ? 'Đang gửi…' : 'Gửi liên kết đăng nhập'}</button>
              {state === 'sent' && <p className="gm-note ok" role="status">Đã gửi! Mở email trên thiết bị này để đăng nhập.</p>}
              {state === 'error' && <p className="gm-note err" role="alert">{msg || 'Không gửi được, thử lại sau.'}</p>}
            </form>
          ) : <p className="gm-note">Chưa bật đồng bộ đám mây · vẫn chơi đủ, xuất/nhập file save được.</p>}
          <div className="gm-or"><span>hoặc</span></div>
          <button className="gm-btn" onClick={() => set({ screen: 'menu' })} data-autofocus>Chơi ngay không cần tài khoản</button>
        </>}
      </section>
    </GameShell>
  );
}

export function Menu() {
  const set = useUI((s) => s.set);
  const open = useUI((s) => s.open);
  const overlay = useUI((s) => s.overlay);
  const portrait = useDevice((d) => d.portrait && d.width < 700);
  const [latest, setLatest] = useState<SaveEnvelope | null | undefined>(undefined);
  const [user, setUser] = useState<{ email?: string } | null>(null);
  useEffect(() => { hasAnySave().then(setLatest).catch(() => setLatest(null)); }, [overlay]);
  useEffect(() => { cloud.user().then(setUser).catch(() => setUser(null)); controller.pendingOnline = null; }, []);
  const cont = async () => { const slot = await slotOfLatest(); if (slot) await controller.continueFrom(slot); };
  const items: { icon: string; label: string; go: () => void; primary?: boolean }[] = [
    { icon: 'forward', label: 'Hành trình mới', go: () => set({ screen: 'create' }), primary: !latest },
    { icon: 'globe', label: 'Chơi trực tuyến', go: () => set({ screen: 'lobby' }) },
    { icon: 'save', label: 'Quản lý save', go: () => open('saves') },
    { icon: 'settings', label: 'Cài đặt', go: () => open('settings') },
  ];
  return (
    <GameShell portrait={portrait}>
      <Brand />
      <nav className="gm-menu" aria-label="Menu chính">
        {latest && (
          <button className="gm-continue" onClick={cont} data-autofocus>
            <span className="gm-play" aria-hidden><Icon name="forward" size={26} /></span>
            <span className="gm-cont-text">
              <b>Tiếp tục</b>
              <span>{latest.meta.name} · Ngày {latest.meta.day} · {fmtClock(latest.meta.minute)}</span>
              <em>{latest.meta.zone}</em>
            </span>
          </button>
        )}
        {items.map((it) => (
          <button key={it.label} className={`gm-item ${it.primary ? 'primary' : ''}`} onClick={it.go} data-autofocus={it.primary || undefined}>
            <Icon name={it.icon} size={22} /><span>{it.label}</span>
          </button>
        ))}
        {latest === undefined && <p className="gm-loading" role="status">Đang đọc save…</p>}
      </nav>
      <button className="gm-account" onClick={() => set({ screen: 'auth' })} aria-label="Tài khoản">
        <span className="gm-avatar sm" aria-hidden><Icon name="user" size={20} /></span>
        <span className="gm-acc-text"><b>{user?.email ? user.email.split('@')[0] : 'Khách'}</b><em>{user ? 'Đã đồng bộ' : 'Đăng nhập để đồng bộ'}</em></span>
      </button>
    </GameShell>
  );
}

const LOAD_TIPS = ['Nhấn K để xem lịch trong ngày', 'Nhấn L để mở Đời sống', 'Nhấn H để mở Sổ tay', 'Nhấn E để tương tác với đồ vật và người', 'Giữ Shift để chạy', 'Đi ngủ đúng giờ để hồi năng lượng'];
const LOAD_TIPS_TOUCH = ['Kéo cần trái để di chuyển', 'Chạm nút bàn tay để tương tác', 'Mở Menu ở góc phải để xem lịch, túi đồ, hồ sơ', 'Đi ngủ đúng giờ để hồi năng lượng'];

export function Loading() {
  const l = useUI((s) => s.loading);
  const touch = useDevice((d) => d.touch);
  const [tip] = useState(() => Math.floor(Math.random() * 100));
  const tips = touch ? LOAD_TIPS_TOUCH : LOAD_TIPS;
  const pct = Math.round(l.progress * 100);
  return (
    <main className="loading-screen" aria-busy={!l.error}>
      <div className="ld-inner">
        <div className="ld-title">Một Ngày Mới</div>
        {!l.error ? <>
          <div className="ld-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Đang tải"><i style={{ width: `${Math.max(4, pct)}%` }} /></div>
          <div className="ld-row"><span>{l.stage}</span><b>{pct}%</b></div>
          <div aria-live="polite" className="sr">{pct % 25 === 0 ? `${pct}%` : ''}</div>
          <p className="ld-tip">{tips[tip % tips.length]}</p>
        </> : (
          <div className="ld-err" role="alert">
            <b>Không thể tải</b>
            <p>{l.error}</p>
            <div className="row" style={{ justifyContent: 'center' }}><button className="btn primary" onClick={() => location.reload()}>Thử lại</button><button className="btn" onClick={() => controller.quitToMenu()}>Về menu</button></div>
          </div>
        )}
      </div>
    </main>
  );
}

export function Lobby() {
  const set = useUI((s) => s.set);
  return (
    <main className="page"><div className="page-inner" style={{ maxWidth: 640 }}>
      <div className="card">
        <h2>Chơi cùng bạn — chưa mở</h2>
        <p>Chế độ nhiều người chơi (phòng riêng 4 người, máy chủ quyết định trạng thái) nằm trong lộ trình mở rộng P2 và chưa được triển khai ở bản này.</p>
        <p className="muted">Nhân vật đơn người chơi sẽ không được chuyển vào chế độ nhiều người (save đơn là “không tin cậy”), để giữ công bằng khi chế độ này ra mắt.</p>
        <button className="btn" onClick={() => set({ screen: 'menu' })} data-autofocus>Quay lại menu</button>
      </div>
    </div></main>
  );
}

export function Credits() {
  const set = useUI((s) => s.set);
  return (
    <main className="page"><div className="page-inner" style={{ maxWidth: 760 }}>
      <div className="card">
        <h2>Giới thiệu & ghi công</h2>
        <p>Một Ngày Mới là trò chơi mô phỏng hư cấu. Mọi nhân vật, cơ sở, quy định, giờ giấc và số liệu trong game là thiết kế trò chơi, không mô tả nơi hay pháp luật có thật, không phải lời khuyên pháp lý hay y tế.</p>
        <p className="muted">Công nghệ: Babylon.js (Apache-2.0), React (MIT), Zustand (MIT), Vite (MIT). Toàn bộ hình khối, âm thanh và nhạc nền được tạo thủ tục trong mã, không dùng tài sản bên thứ ba.</p>
        <p className="muted">Chính sách mô phỏng: {POLICY_PROFILE.id} v{POLICY_PROFILE.version} — {POLICY_PROFILE.reviewStatus}.</p>
        <button className="btn" onClick={() => set({ screen: 'menu' })} data-autofocus>Quay lại</button>
      </div>
    </div></main>
  );
}

export function Fatal() {
  const f = useUI((s) => s.fatal);
  const set = useUI((s) => s.set);
  if (!f) return null;
  return (
    <div className="overlay" role="alertdialog" aria-labelledby="fatal_t">
      <div className="panel narrow"><div className="panel-body">
        <h2 id="fatal_t" tabIndex={-1}>{f.title}</h2>
        <p>{f.message}</p>
        <p className="muted small">Mã hỗ trợ: {f.code}-{Date.now().toString(36).slice(-6).toUpperCase()}</p>
        <div className="row">
          <button className="btn primary" onClick={() => set({ fatal: null })} data-autofocus>Thử tiếp tục</button>
          <button className="btn" onClick={() => { set({ fatal: null }); controller.quitToMenu(); }}>Về menu (giữ save)</button>
        </div>
      </div></div>
    </div>
  );
}

export function Ending() {
  const e = useUI((s) => s.ending);
  const rm = false;
  if (!e) return null;
  return (
    <main className="page"><div className="page-inner" style={{ maxWidth: 760, paddingTop: '8vh' }}>
      <div className="card">
        <h1>{e.title}</h1>
        {e.text.map((t, i) => <p key={i} style={{ fontSize: 18 }} className={rm ? '' : ''}>{t}</p>)}
        <h3 style={{ marginTop: 16 }}>Tổng kết hành trình</h3>
        <ul>{e.summary.map((s) => <li key={s}>{s}</li>)}</ul>
        <p className="muted small">Hành trình đã lưu ở trạng thái kết thúc · có thể chơi tự do ở bản sao.</p>
        <div className="row">
          <button className="btn primary" onClick={() => controller.quitToMenu()} data-autofocus>Về menu chính</button>
          <button className="btn" onClick={() => controller.sandboxFork()}>Chơi tự do (bản sao riêng)</button>
        </div>
      </div>
    </div></main>
  );
}
