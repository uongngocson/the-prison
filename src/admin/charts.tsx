// Biểu đồ SVG gọn nhẹ cho trang admin: đường (crosshair + tooltip), cột (chồng), thanh ngang, ô số liệu.
// Màu theo vai trò (CSS --s1…--s3), nét mảnh, lưới nhạt, chú giải luôn có khi ≥2 chuỗi, có chế độ xem bảng.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export interface Series { key: string; label: string; color: string }
export type Row = { label: string } & Record<string, number | string>;

const nf = new Intl.NumberFormat('vi-VN');
export const fmt = (n: number) => nf.format(Math.round(n * 10) / 10);

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Trục y “đẹp”: 0 … max làm tròn, 4 vạch. */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}
const PAD = { l: 40, r: 12, t: 12, b: 26 };

export function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return <div className="ad-legend">{series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}</div>;
}

function Tooltip({ x, w, title, rows }: { x: number; w: number; title: string; rows: { label: string; color: string; value: string }[] }) {
  const left = Math.min(Math.max(x + 12, 0), Math.max(0, w - 180));
  return (
    <div className="ad-tip" style={{ left }} role="status">
      <b>{title}</b>
      {rows.map((r) => <div key={r.label}><i style={{ background: r.color }} /><span>{r.label}</span><em>{r.value}</em></div>)}
    </div>
  );
}

function XLabels({ data, x, h }: { data: Row[]; x: (i: number) => number; h: number }) {
  const every = Math.max(1, Math.ceil(data.length / 7));
  return <>{data.map((d, i) => (i % every === 0 || i === data.length - 1) && (i === data.length - 1 || data.length - 1 - i >= every / 2) ? <text key={i} x={x(i)} y={h - 8} textAnchor="middle" className="ad-axis">{d.label}</text> : null)}</>;
}
function YGrid({ ticks, y, w, format }: { ticks: number[]; y: (v: number) => number; w: number; format: (n: number) => string }) {
  return <>{ticks.map((t) => <g key={t}><line x1={PAD.l} x2={w - PAD.r} y1={y(t)} y2={y(t)} className="ad-gridline" /><text x={PAD.l - 6} y={y(t) + 3} textAnchor="end" className="ad-axis">{format(t)}</text></g>)}</>;
}

/** Biểu đồ đường theo thời gian, crosshair + tooltip khi rê/chạm. */
export function LineChart({ data, series, height = 220, format = fmt }: { data: Row[]; series: Series[]; height?: number; format?: (n: number) => string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0)));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const iw = Math.max(1, w - PAD.l - PAD.r);
  const x = (i: number) => PAD.l + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => PAD.t + (1 - v / top) * (height - PAD.t - PAD.b);
  const pick = (cx: number) => setHover(Math.max(0, Math.min(data.length - 1, Math.round(((cx - PAD.l) / iw) * (data.length - 1)))));
  return (
    <div ref={ref} className="ad-chart" onPointerLeave={() => setHover(null)}>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label={series.map((s) => s.label).join(', ')}
          onPointerMove={(e) => pick(e.clientX - e.currentTarget.getBoundingClientRect().left)} onPointerDown={(e) => pick(e.clientX - e.currentTarget.getBoundingClientRect().left)}>
          <YGrid ticks={ticks} y={y} w={w} format={format} />
          {series.map((s) => (
            <path key={s.key} d={data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(Number(d[s.key]) || 0).toFixed(1)}`).join('')} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={height - PAD.b} className="ad-cross" />}
          {hover !== null && series.map((s) => <circle key={s.key} cx={x(hover)} cy={y(Number(data[hover][s.key]) || 0)} r={4.5} fill={s.color} className="ad-dot" />)}
          <XLabels data={data} x={x} h={height} />
        </svg>
      )}
      {hover !== null && data[hover] && <Tooltip x={x(hover)} w={w} title={data[hover].label} rows={series.map((s) => ({ label: s.label, color: s.color, value: format(Number(data[hover][s.key]) || 0) }))} />}
    </div>
  );
}

/** Biểu đồ cột (chồng nếu ≥2 chuỗi), khe 2px giữa các phần, đầu cột bo 4px. */
export function BarChart({ data, series, height = 220, format = fmt }: { data: Row[]; series: Series[]; height?: number; format?: (n: number) => string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const total = (d: Row) => series.reduce((a, s) => a + (Number(d[s.key]) || 0), 0);
  const ticks = niceTicks(Math.max(1, ...data.map(total)));
  const top = ticks[ticks.length - 1];
  const iw = Math.max(1, w - PAD.l - PAD.r);
  const band = iw / Math.max(1, data.length);
  const bw = Math.max(2, Math.min(28, band * 0.68));
  const x = (i: number) => PAD.l + band * (i + 0.5);
  const y = (v: number) => PAD.t + (1 - v / top) * (height - PAD.t - PAD.b);
  return (
    <div ref={ref} className="ad-chart" onPointerLeave={() => setHover(null)}>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label={series.map((s) => s.label).join(', ')}>
          <YGrid ticks={ticks} y={y} w={w} format={format} />
          {data.map((d, i) => {
            let acc = 0;
            const segs = series.map((s) => { const v = Number(d[s.key]) || 0; const y0 = y(acc), y1 = y(acc + v); acc += v; return { s, v, y0, y1 }; }).filter((g) => g.v > 0);
            return (
              <g key={i} opacity={hover === null || hover === i ? 1 : 0.55}>
                {segs.map((g, j) => {
                  const last = j === segs.length - 1;
                  const h = Math.max(1, g.y0 - g.y1 - (j > 0 ? 2 : 0));
                  const r = last ? Math.min(4, bw / 2, h) : 0;
                  const x0 = x(i) - bw / 2, yTop = g.y1;
                  return <path key={g.s.key} fill={g.s.color} d={`M${x0},${yTop + h}V${yTop + r}${r ? `Q${x0},${yTop} ${x0 + r},${yTop}` : ''}H${x0 + bw - r}${r ? `Q${x0 + bw},${yTop} ${x0 + bw},${yTop + r}` : ''}V${yTop + h}Z`} />;
                })}
                <rect x={x(i) - band / 2} y={PAD.t} width={band} height={height - PAD.t - PAD.b} fill="transparent" onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)} />
              </g>
            );
          })}
          <XLabels data={data} x={x} h={height} />
        </svg>
      )}
      {hover !== null && data[hover] && <Tooltip x={x(hover)} w={w} title={data[hover].label} rows={[...series.map((s) => ({ label: s.label, color: s.color, value: format(Number(data[hover][s.key]) || 0) })), ...(series.length > 1 ? [{ label: 'Tổng', color: 'transparent', value: format(total(data[hover])) }] : [])]} />}
    </div>
  );
}

/** Danh sách thanh ngang (xếp hạng / tỉ trọng). */
export function HBars({ items, color = 'var(--s1)', format = fmt, empty = 'Chưa có dữ liệu' }: { items: { label: string; value: number; sub?: string }[]; color?: string; format?: (n: number) => string; empty?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const sum = items.reduce((a, i) => a + i.value, 0);
  if (!items.length) return <p className="ad-empty">{empty}</p>;
  return (
    <ul className="ad-hbars">
      {items.map((it) => (
        <li key={it.label} title={`${it.label}: ${format(it.value)}`}>
          <div className="ad-hbar-top"><span>{it.label}</span><b>{format(it.value)}<small>{sum ? ` · ${Math.round((it.value / sum) * 100)}%` : ''}</small></b></div>
          <div className="ad-hbar-track"><i style={{ width: `${(it.value / max) * 100}%`, background: color }} /></div>
          {it.sub && <small className="ad-hbar-sub">{it.sub}</small>}
        </li>
      ))}
    </ul>
  );
}

/** Thẻ biểu đồ: tiêu đề, chú giải, nút chuyển sang bảng số liệu. */
export function ChartCard({ title, sub, series, data, format = fmt, children, wide }: { title: string; sub?: string; series?: Series[]; data?: Row[]; format?: (n: number) => string; children: ReactNode; wide?: boolean }) {
  const [table, setTable] = useState(false);
  return (
    <section className={`ad-card ${wide ? 'wide' : ''}`}>
      <header className="ad-card-head">
        <div><h3>{title}</h3>{sub && <p>{sub}</p>}</div>
        {data && series && <button className="ad-link" onClick={() => setTable(!table)}>{table ? 'Biểu đồ' : 'Bảng'}</button>}
      </header>
      {series && !table && <Legend series={series} />}
      {table && data && series ? (
        <div className="ad-table-wrap small">
          <table className="ad-table"><thead><tr><th>Ngày</th>{series.map((s) => <th key={s.key} className="num">{s.label}</th>)}</tr></thead>
            <tbody>{[...data].reverse().map((d) => <tr key={d.label}><td>{d.label}</td>{series.map((s) => <td key={s.key} className="num">{format(Number(d[s.key]) || 0)}</td>)}</tr>)}</tbody></table>
        </div>
      ) : children}
    </section>
  );
}

/** Ô số liệu lớn. */
export function Stat({ label, value, hint, tone, onClick }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'warn' | 'bad' | 'good'; onClick?: () => void }) {
  const El = onClick ? 'button' : 'div';
  return (
    <El className={`ad-stat ${tone ?? ''} ${onClick ? 'click' : ''}`} onClick={onClick}>
      <span>{label}</span>
      <b>{value}</b>
      {hint && <small>{hint}</small>}
    </El>
  );
}

/** Thanh nhỏ (sparkline cột) cho bảng. */
export function MiniBars({ values, color = 'var(--s1)' }: { values: number[]; color?: string }) {
  const max = Math.max(1, ...values);
  return <span className="ad-mini" aria-hidden>{values.map((v, i) => <i key={i} style={{ height: `${Math.max(6, (v / max) * 100)}%`, background: v ? color : 'var(--line)' }} />)}</span>;
}
