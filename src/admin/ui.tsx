// Thành phần giao diện dùng chung của trang admin.
import { useEffect, useState, type ReactNode } from 'react';
import { create } from 'zustand';

// ---------- Thông báo nhỏ ----------
interface Note { id: number; text: string; tone: 'ok' | 'bad' }
export const useNotes = create<{ notes: Note[] }>(() => ({ notes: [] }));
let nid = 0;
export function notify(text: string, tone: Note['tone'] = 'ok') {
  const id = ++nid;
  useNotes.setState((s) => ({ notes: [...s.notes, { id, text, tone }] }));
  setTimeout(() => useNotes.setState((s) => ({ notes: s.notes.filter((n) => n.id !== id) })), 4000);
}
export function Notes() {
  const notes = useNotes((s) => s.notes);
  return <div className="ad-notes" aria-live="polite">{notes.map((n) => <div key={n.id} className={`ad-note ${n.tone}`}>{n.text}</div>)}</div>;
}

/** Chạy thao tác có thông báo kết quả. */
export async function act(fn: () => Promise<unknown>, ok: string): Promise<boolean> {
  try { await fn(); notify(ok); return true; } catch (e) { notify((e as Error).message, 'bad'); return false; }
}

// ---------- Tải dữ liệu ----------
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | null; error: string | null; loading: boolean; reload: () => void } {
  const [tick, setTick] = useState(0);
  const [st, setSt] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  useEffect(() => {
    let alive = true;
    setSt((s) => ({ ...s, loading: true }));
    fn().then((data) => alive && setSt({ data, error: null, loading: false })).catch((e: Error) => alive && setSt((s) => ({ data: s.data, error: e.message, loading: false })));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...st, reload: () => setTick((t) => t + 1) };
}

export function Loading({ rows = 3 }: { rows?: number }) {
  return <div className="ad-skel" aria-busy="true">{Array.from({ length: rows }, (_, i) => <i key={i} />)}</div>;
}
export function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return <div className="ad-errorbox" role="alert"><span>{error}</span>{onRetry && <button className="ad-btn" onClick={onRetry}>Thử lại</button>}</div>;
}

// ---------- Điều khiển ----------
export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="ad-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => <button type="button" key={String(o.value)} role="radio" aria-checked={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  );
}
export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={`ad-toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}><i /></button>
  );
}
export function Badge({ tone = 'muted', children }: { tone?: 'muted' | 'ok' | 'warn' | 'bad' | 'info' | 'accent'; children: ReactNode }) {
  return <span className={`ad-badge ${tone}`}>{children}</span>;
}
export function Search({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => v !== value && onChange(v), 300); return () => clearTimeout(t); }, [v, value, onChange]);
  return (
    <label className="ad-search">
      <svg viewBox="0 0 24 24" aria-hidden><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </label>
  );
}

// ---------- Ngăn kéo / hộp thoại ----------
export function Drawer({ title, sub, onClose, children, actions }: { title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode; actions?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="ad-scrim" onClick={onClose}>
      <aside className="ad-drawer" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="ad-drawer-head">
          <div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
          <button className="ad-icon-btn" onClick={onClose} aria-label="Đóng"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
        </header>
        {actions && <div className="ad-drawer-actions">{actions}</div>}
        <div className="ad-drawer-body">{children}</div>
      </aside>
    </div>
  );
}
export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="ad-scrim center" onClick={onClose}>
      <div className="ad-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <div className="ad-modal-body">{children}</div>
        <footer>{footer}</footer>
      </div>
    </div>
  );
}

/** Hộp thoại khóa chơi trực tuyến. */
export function BanDialog({ name, onClose, onConfirm }: { name: string; onClose: () => void; onConfirm: (reason: string, hours: number | null) => Promise<void> }) {
  const [reason, setReason] = useState('Ngôn từ không phù hợp khi trò chuyện');
  const [hours, setHours] = useState<number | null>(24);
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={`Khóa trực tuyến: ${name}`} onClose={onClose} footer={<>
      <button className="ad-btn" onClick={onClose}>Hủy</button>
      <button className="ad-btn danger" disabled={busy || reason.trim().length < 3} onClick={async () => { setBusy(true); await onConfirm(reason.trim(), hours); setBusy(false); }}>Khóa</button>
    </>}>
      <p className="ad-muted">Người chơi vẫn chơi ngoại tuyến được, nhưng không vào được phòng trực tuyến. Nếu đang trực tuyến, họ sẽ bị đưa ra trong vòng 1 phút.</p>
      <label className="ad-field"><span>Lý do (người chơi sẽ thấy)</span><input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} /></label>
      <div className="ad-field"><span>Thời hạn</span>
        <Segmented label="Thời hạn" value={hours ?? 0} onChange={(v) => setHours(v || null)} options={[{ value: 1, label: '1 giờ' }, { value: 24, label: '1 ngày' }, { value: 168, label: '7 ngày' }, { value: 720, label: '30 ngày' }, { value: 0, label: 'Vĩnh viễn' }]} />
      </div>
    </Modal>
  );
}

export function Confirm({ title, text, okLabel, onClose, onConfirm }: { title: string; text: string; okLabel: string; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose} footer={<>
      <button className="ad-btn" onClick={onClose}>Hủy</button>
      <button className="ad-btn danger" disabled={busy} onClick={async () => { setBusy(true); await onConfirm(); setBusy(false); }}>{okLabel}</button>
    </>}>
      <p>{text}</p>
    </Modal>
  );
}

// ---------- Biểu tượng điều hướng ----------
const P: Record<string, string> = {
  overview: 'M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7M22 21v-1a6 6 0 0 0-4-5.6',
  online: 'M12 20h.01M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 14 0M2 9.5a15 15 0 0 1 20 0',
  bots: 'M12 8V4M8 4h8M5 8h14v11H5zM9 13h.01M15 13h.01M9.5 16.5h5',
  errors: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  reports: 'M4 22V4M4 4h12l-2 4 2 4H4',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  refresh: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
  site: 'M12 2v10M18.4 6.6a9 9 0 1 1-12.8 0',
  key: 'M15.5 7.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0zM12 11v10M12 17h3M12 20h2',
};
export function NavIcon({ name }: { name: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden className="ad-ico"><path d={P[name]} /></svg>;
}

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <header className="ad-page-head">
      <div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>
      {children && <div className="ad-page-tools">{children}</div>}
    </header>
  );
}
