// U01 Landing, U02 Auth, U04 Menu, U05 Loading, U24 Lobby (P2), U25 Fatal/Recovery, Credits, Ending.
import { useEffect, useState } from 'react';
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
        <div className="home-brand"><span className="brand-mark">★</span><b>MỘT NGÀY MỚI</b></div>
        <nav className="home-nav">
          <button onClick={() => setModal('about')}>Giới thiệu</button>
          <button onClick={() => set({ screen: 'auth' })}>Đăng nhập</button>
        </nav>
      </header>
      <section className="home-hero">
        <h1>Một ngày mới</h1>
        <p className="home-lead">Kỷ luật · Học tập · Lao động · Trở về với gia đình</p>
        <div className="home-cta" id="cta">
          <button className="btn primary lg" disabled={!cap.ok} onClick={() => set({ screen: 'menu' })} data-autofocus>▶ Chơi ngay</button>
        </div>
        {!cap.ok && <p className="home-warn" role="alert">Trình duyệt không hỗ trợ WebGL2 — hãy cập nhật trình duyệt để chơi.</p>}
      </section>
      <SloganTicker />

      {modal === 'law' && (
        <Panel title="Tuyên truyền pháp luật" onClose={() => setModal(null)} width="mid">
          <p className="law-lead">“{SLOGANS[0].text}”</p>
          <ul className="law-list">
            {SLOGANS.slice(1).map((sl) => <li key={sl.text}><span aria-hidden>{sl.icon}</span>{sl.text}</li>)}
          </ul>
          <p className="muted small">Nội dung mang tính giáo dục ý thức chấp hành pháp luật, không phải tư vấn pháp lý.</p>
        </Panel>
      )}
      {modal === 'about' && (
        <Panel title="Giới thiệu" onClose={() => setModal(null)} width="mid">
          <p>Mô phỏng đời sống 3D trong một trại giam <b>hư cấu</b>: sinh hoạt, học tập, lao động, giữ liên lạc với gia đình và chuẩn bị ngày trở về. Không có chiến đấu, vượt ngục hay tiền thật.</p>
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

export function Auth() {
  const set = useUI((s) => s.set);
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const configured = cloud.configured();
  return (
    <main className="page"><div className="page-inner" style={{ maxWidth: 520 }}>
      <div className="card">
        <h2>Đăng nhập tùy chọn</h2>
        <p className="muted">Tài khoản chỉ dùng để đồng bộ save giữa các thiết bị. Không đăng nhập vẫn chơi đầy đủ.</p>
        {!configured && <p className="notice">Bản cài đặt này chưa cấu hình dịch vụ đám mây (biến môi trường VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Bạn có thể chơi khách và dùng Xuất/Nhập file save.</p>}
        {configured && (
          <form onSubmit={async (e) => { e.preventDefault(); setState('sending'); const r = await cloud.signIn(email); setState(r.ok ? 'sent' : 'error'); setMsg(r.message); }}>
            <label className="field">Email<input type="text" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-describedby="authmsg" /></label>
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn primary" disabled={state === 'sending' || !email.includes('@')}>Gửi liên kết đăng nhập</button>
            </div>
            <p id="authmsg" role="status" className="muted small">{state === 'sent' ? 'Nếu địa chỉ hợp lệ, liên kết đăng nhập đã được gửi. Mở email trên thiết bị này.' : state === 'error' ? msg : ''}</p>
          </form>
        )}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => set({ screen: 'menu' })} data-autofocus>Tiếp tục không tài khoản</button>
          <button className="btn ghost" onClick={() => set({ screen: 'landing' })}>Quay lại</button>
        </div>
      </div>
    </div></main>
  );
}

export function Menu() {
  const set = useUI((s) => s.set);
  const open = useUI((s) => s.open);
  const overlay = useUI((s) => s.overlay);
  const [latest, setLatest] = useState<SaveEnvelope | null | undefined>(undefined);
  useEffect(() => { hasAnySave().then(setLatest).catch(() => setLatest(null)); }, [overlay]);
  const cont = async () => { const slot = await slotOfLatest(); if (slot) await controller.continueFrom(slot); };
  return (
    <main className="page"><div className="page-inner">
      <div className="hero">
        <nav className="col" style={{ maxWidth: 420 }} aria-label="Menu chính">
          <h1>Một Ngày Mới</h1>
          {latest && <button className="btn primary" onClick={cont} data-autofocus>Tiếp tục — {latest.meta.name}, Ngày {latest.meta.day} {fmtClock(latest.meta.minute)}, {latest.meta.zone}<br /><span className="small" style={{ fontWeight: 400 }}>Lưu lúc {new Date(latest.savedAt).toLocaleString('vi-VN')}</span></button>}
          <button className={`btn ${latest ? '' : 'primary'}`} onClick={() => set({ screen: 'create' })} data-autofocus={!latest || undefined}>Hành trình mới</button>
          <button className="btn" onClick={() => open('saves')}>Quản lý save</button>
          <button className="btn" onClick={() => open('settings')}>Cài đặt</button>
          <button className="btn" onClick={() => set({ screen: 'auth' })}>Tài khoản {cloud.configured() ? '' : '(chưa cấu hình)'}</button>
          <button className="btn" onClick={() => set({ screen: 'lobby' })}>Chơi cùng bạn (thử nghiệm)</button>
          <button className="btn ghost" onClick={() => set({ screen: 'credits' })}>Giới thiệu & ghi công</button>
          {latest === undefined && <p className="muted small" role="status">Đang đọc save...</p>}
        </nav>
        <div className="poster"><Poster /></div>
      </div>
      <footer className="muted small mobile-hide">Bản dựng 1.1.0 · nội dung {`nd-1.1.0`} · {POLICY_PROFILE.jurisdictionLabel}</footer>
    </div></main>
  );
}

export function Loading() {
  const l = useUI((s) => s.loading);
  const set = useUI((s) => s.set);
  const idx = l.stages.indexOf(l.stage);
  return (
    <main className="page" aria-busy={!l.error}><div className="page-inner" style={{ maxWidth: 640, paddingTop: '10vh' }}>
      <div className="loading-art">Đang chuẩn bị không gian...</div>
      <h2 style={{ marginTop: 16 }}>{l.error ? 'Không thể tải' : l.stage}</h2>
      {!l.error && <div aria-live="polite" className="sr">{Math.round(l.progress * 100) % 25 === 0 ? `${Math.round(l.progress * 100)}%` : ''}</div>}
      <ol className="stage-list">
        {l.stages.map((s, i) => <li key={s} className={i < idx ? 'done' : i === idx ? 'active' : ''}>{i < idx ? '✓ ' : ''}{s}</li>)}
      </ol>
      {l.error && (
        <div className="notice" role="alert">
          <p>{l.error}</p>
          <p className="muted small">Tiến trình của bạn không bị thay đổi.</p>
          <div className="row"><button className="btn primary" onClick={() => location.reload()}>Thử lại</button><button className="btn" onClick={() => controller.quitToMenu()}>Về menu</button></div>
        </div>
      )}
      <p className="muted small" style={{ marginTop: 16 }}>Mẹo: Nhấn <span className="kbd">K</span> xem lịch, <span className="kbd">L</span> mở Đời sống, <span className="kbd">H</span> mở Sổ tay.</p>
    </div></main>
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
        <p className="muted small">Hành trình đã được lưu ở trạng thái kết thúc (không quay lại vòng sinh hoạt). Bạn có thể bắt đầu bản sao riêng để tiếp tục khám phá tự do.</p>
        <div className="row">
          <button className="btn primary" onClick={() => controller.quitToMenu()} data-autofocus>Về menu chính</button>
          <button className="btn" onClick={() => controller.sandboxFork()}>Chơi tự do (bản sao riêng)</button>
        </div>
      </div>
    </div></main>
  );
}
