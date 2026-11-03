// Consistent line-icon set (24×24, stroke 2) for the mobile game UI — thay emoji không đồng bộ.
import type { ReactNode } from 'react';

const P: Record<string, ReactNode> = {
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  leaf: <><path d="M5 19c0-8 6-14 15-14 0 9-6 15-14 15" /><path d="M5 19l8-8" /></>,
  fish: <><path d="M3 12c3-4 7-5 11-5 3 0 5 2 7 5-2 3-4 5-7 5-4 0-8-1-11-5z" /><path d="M3 12l-1-3M3 12l-1 3" /><circle cx="16" cy="11" r="0.8" /></>,
  flower: <><circle cx="12" cy="8" r="2.2" /><path d="M12 5.8V3M14.2 8H17M12 10.2V13M9.8 8H7" /><path d="M12 13v8M12 17c-2 0-4-1-5-3M12 17c2 0 4-1 5-3" /></>,
  saw: <><path d="M3 15l12-9 4 4-12 9z" /><path d="M6 14l1 1M9 12l1 1M12 10l1 1" /><path d="M17 4l3 3" /></>,
  broom: <><path d="M14 3l-4 10" /><path d="M6 13h8l2 8H4z" /><path d="M7 17v4M10 17v4M13 17v4" /></>,
  work: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5h6v2M3 12h18" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" /></>,
  send: <path d="M4 12l16-8-6 16-2.5-6.5z" />,
  flag: <><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  dice: <><rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="9" cy="9" r="1.2" /><circle cx="15" cy="15" r="1.2" /><circle cx="15" cy="9" r="1.2" /><circle cx="9" cy="15" r="1.2" /></>,
  back: <path d="M15 5l-7 7 7 7" />,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  quest: <><path d="M6 3h9l4 4v14H6z" /><path d="M9 11h7M9 15h7M9 7h3" /></>,
  map: <><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></>,
  bag: <><path d="M5 8h14l-1 13H6z" /><path d="M9 8V6a3 3 0 016 0v2" /></>,
  home: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6" /></>,
  book: <><path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z" /><path d="M4 19V5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
  save: <><path d="M5 3h11l3 3v15H5z" /><path d="M8 3v5h7V3M8 21v-7h8v7" /></>,
  pause: <path d="M8 5v14M16 5v14" />,
  expand: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  hand: <path d="M8 13V6a1.5 1.5 0 013 0v5V4.5a1.5 1.5 0 013 0V11V5.5a1.5 1.5 0 013 0V14c0 4-2.5 7-6 7s-5-2-6.5-4.5L3 13a1.5 1.5 0 012.5-1.7L8 14" />,
  talk: <path d="M4 5h16v11H9l-5 4z" />,
  crouch: <><circle cx="12" cy="5" r="2" /><path d="M12 8l-3 5h5l2 6M9 13l-3 6" /></>,
  camera: <><path d="M3 12a9 9 0 0115-6.7M21 12a9 9 0 01-15 6.7" /><path d="M18 2v4h-4M6 22v-4h4" /></>,
  forward: <path d="M4 6l7 6-7 6zM13 6l7 6-7 6z" />,
  stand: <><circle cx="12" cy="5" r="2" /><path d="M12 8v7M8 11h8M12 15l-3 6M12 15l3 6" /></>,
  rotate: <><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M2 14a6 6 0 006 6M22 10a6 6 0 00-6-6" /></>,
  bulb: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 00-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0012 3z" /></>,
  energy: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  hunger: <><path d="M7 3v8a2 2 0 004 0V3M9 11v10" /><path d="M17 3c-2 0-3 3-3 6s1 4 3 4v8" /></>,
  hygiene: <path d="M12 3s6 7 6 11a6 6 0 01-12 0c0-4 6-11 6-11z" />,
  mood: <><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4.5 4.5 0 007 0M9 9.5h.01M15 9.5h.01" /></>,
  arrow: <path d="M12 3l7 16-7-4-7 4z" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  // ---------- xung đột ----------
  fist: <><path d="M6 9h11a2 2 0 012 2v3a6 6 0 01-6 6h-2a5 5 0 01-5-5z" /><path d="M9.5 9v4M13 9v4M16.5 9v3.5" /><path d="M6 13.5h3.5" /></>,
  shield: <path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z" />,
  shove: <><path d="M3 12h10M9 8l4 4-4 4" /><path d="M16 5v14M20 7v10" /></>,
  exit: <><path d="M14 4h5v16h-5" /><path d="M10 8l-4 4 4 4M6 12h10" /></>,
  siren: <><path d="M7 18v-6a5 5 0 0110 0v6" /><path d="M5 21h14v-3H5zM12 2v2M4.2 5.2l1.4 1.4M19.8 5.2l-1.4 1.4" /></>,
  peace: <><circle cx="12" cy="12" r="9" /><path d="M12 3v18M12 12l-6.4 6.4M12 12l6.4 6.4" /></>,
  down: <><circle cx="17" cy="7" r="2" /><path d="M3 17h13l4-4M8 17l3-4" /><path d="M3 21h18" /></>,
  cuffs: <><circle cx="7" cy="15" r="4" /><circle cx="17" cy="15" r="4" /><path d="M10 12l4 0M7 11V8a2 2 0 014 0M13 8a2 2 0 014 0v3" /></>,
};

export function Icon({ name, size = 22, className, label }: { name: keyof typeof P | string; size?: number; className?: string; label?: string }) {
  return (
    <svg className={`ico ${className ?? ''}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {P[name] ?? P.chevron}
    </svg>
  );
}

/** Circular gauge with an icon in the centre (needs). */
export function Ring({ value, icon, label, size = 40 }: { value: number; icon: string; label: string; size?: number }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const tone = v < 10 ? 'crit' : v < 25 ? 'low' : 'ok';
  return (
    <div className={`ring ${tone}`} style={{ width: size, height: size }} role="img" aria-label={`${label} ${Math.round(v)}`}>
      <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden>
        <circle cx="20" cy="20" r={r} className="ring-bg" />
        <circle cx="20" cy="20" r={r} className="ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} transform="rotate(-90 20 20)" />
      </svg>
      <Icon name={icon} size={size * 0.42} />
    </div>
  );
}
