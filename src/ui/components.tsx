// Primitive components (05 design system): Panel (dialog w/ focus trap + Esc), Tabs, KeyCap, Bar, Status.
import { useEffect, useRef, type ReactNode } from 'react';
import { useSettings, keyLabel, type ActionName } from './settings';
import { useDevice } from './device';

export function Panel({ title, onClose, children, width, footer, tabs, labelledBy }: { title: string; onClose?: () => void; children: ReactNode; width?: 'narrow' | 'mid'; footer?: ReactNode; tabs?: ReactNode; labelledBy?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const origin = useRef<Element | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    origin.current = document.activeElement;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>('[data-autofocus], button, [href], input, select, textarea');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeRef.current) { e.stopPropagation(); e.preventDefault(); closeRef.current(); }
      if (e.key === 'Tab' && el) {
        const f = [...el.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')];
        if (!f.length) return;
        const i = f.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    };
    el?.addEventListener('keydown', onKey);
    return () => { el?.removeEventListener('keydown', onKey); (origin.current as HTMLElement | null)?.focus?.(); };
  }, []);
  const id = labelledBy ?? `p_${title.replace(/\W+/g, '')}`;
  return (
    <div className="overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div ref={ref} className={`panel ${width ?? ''}`} role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="panel-head">
          <h2 id={id}>{title}</h2>
          <div className="spacer" />
          {onClose && <button className="btn sm ghost" onClick={onClose} aria-label="Đóng">Đóng <span className="kbd">Esc</span></button>}
        </div>
        {tabs}
        <div className="panel-body">{children}</div>
        {footer && <div className="panel-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string; badge?: number }[]; value: T; onChange: (t: T) => void; label: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.id} role="tab" className="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          onKeyDown={(e) => {
            const i = tabs.findIndex((x) => x.id === value);
            if (e.key === 'ArrowRight') onChange(tabs[(i + 1) % tabs.length].id);
            if (e.key === 'ArrowLeft') onChange(tabs[(i - 1 + tabs.length) % tabs.length].id);
          }}>
          {t.label}{t.badge ? <span className="badge" aria-label={`${t.badge} mục mới`}>{t.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Key({ action }: { action: ActionName }) {
  const code = useSettings((x) => x.s.controls.bindings[action]);
  const mode = useSettings((x) => x.s.controls.touchMode);
  const coarse = useDevice((d) => d.coarse);
  if (mode === 'on' || (mode === 'auto' && coarse)) return null; // cảm ứng: không hiển thị phím
  return <span className="kbd">{keyLabel(code)}</span>;
}

export function Bar({ value, max = 100, label }: { value: number; max?: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return <div className="bar" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max} aria-label={label}><i style={{ width: `${pct}%` }} /></div>;
}

export function Status({ kind, children }: { kind?: 'ok' | 'warn' | 'err'; children: ReactNode }) {
  return <span className={`status ${kind ?? ''}`}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="muted">{children}</p>;
}
