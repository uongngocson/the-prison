// U03 Character Creation (F01): preview 3D riêng (dispose khi thoát), chọn không cần kéo, randomize/undo, double-submit guard.
import { lazy, Suspense, useState } from 'react';
import { HAIR, RES_OUTFIT, SKIN } from '../../presentation/palette';
import type { Appearance } from '../../domain/types';
import { validateName, normalizeName } from '../../domain/newgame';
import { useUI } from '../store';
import { controller } from '../../app/controller';

const BODY: { id: Appearance['body']; label: string }[] = [{ id: 'slim', label: 'Mảnh' }, { id: 'medium', label: 'Vừa' }, { id: 'broad', label: 'Đậm' }];
const HAIRS = ['Tóc ngắn', 'Cắt sát', 'Tóc dài', 'Không tóc'];
const HAIR_COLORS = ['Đen', 'Nâu sẫm', 'Nâu', 'Muối tiêu'];
const OUTFITS = ['Sọc xanh rêu', 'Sọc xanh than', 'Sọc xám'];
const SKIN_LABEL = ['Sáng', 'Sáng vừa', 'Trung bình', 'Ngăm', 'Sẫm'];
const Preview = lazy(() => import('./CreatePreview'));

function Swatches({ label, colors, value, names, onChange, striped }: { label: string; colors: string[]; value: number; names: string[]; onChange: (i: number) => void; striped?: boolean }) {
  return (
    <fieldset style={{ border: 'none', padding: 0, margin: '8px 0' }}>
      <legend>{label}: <b>{names[value]}</b></legend>
      <div className="row">
        {colors.map((c, i) => <button key={c} className="swatch" style={{ background: striped ? `repeating-linear-gradient(0deg, ${c} 0 6px, #e8e6dc 6px 12px)` : c }} aria-label={names[i]} aria-pressed={value === i} onClick={() => onChange(i)} />)}
      </div>
    </fieldset>
  );
}

function Choice<T extends string | number>({ label, opts, value, onChange }: { label: string; opts: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <fieldset style={{ border: 'none', padding: 0, margin: '8px 0' }}>
      <legend>{label}</legend>
      <div className="row">{opts.map((o) => <button key={String(o.id)} className={`btn sm ${value === o.id ? 'primary' : ''}`} aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{o.label}</button>)}</div>
    </fieldset>
  );
}

export function Create() {
  const set = useUI((s) => s.set);
  const [look, setLook] = useState<Appearance>({ body: 'medium', skin: 1, hair: 0, hairColor: 0, outfit: 0 });
  const [history, setHistory] = useState<Appearance[]>([]);
  const [name, setName] = useState('');
  const [family, setFamily] = useState<'family' | 'estranged' | 'none'>('family');
  const [rot, setRot] = useState(0);
  const [pending, setPending] = useState(false);
  const err = name ? validateName(name) : null;
  const upd = (p: Partial<Appearance>) => { setHistory((h) => [...h.slice(-19), look]); setLook({ ...look, ...p }); };
  const random = () => upd({ body: BODY[Math.floor(Math.random() * 3)].id, skin: Math.floor(Math.random() * 5), hair: Math.floor(Math.random() * 4), hairColor: Math.floor(Math.random() * 4), outfit: Math.floor(Math.random() * 3) });
  const start = async () => {
    if (pending || validateName(name)) return;
    setPending(true);
    await controller.startNew({ name: normalizeName(name), appearance: look, familyContext: family });
  };
  return (
    <main className="page"><div className="page-inner">
      <h1>Tạo nhân vật</h1>
      <p className="muted mobile-hide">Ngoại hình chỉ mang tính thẩm mỹ — không ảnh hưởng chỉ số, cách NPC đối xử hay kết quả xem xét.</p>
      <div className="create-grid">
        <div>
          <Suspense fallback={<div className="preview3d" role="status" style={{ display: 'grid', placeItems: 'center' }}>Đang tải xem trước 3D...</div>}><Preview look={look} rot={rot} /></Suspense>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn sm" onClick={() => setRot((r) => r - Math.PI / 4)} aria-label="Xoay trái">⟲ Xoay trái</button>
            <button className="btn sm" onClick={() => setRot(0)}>Mặt trước</button>
            <button className="btn sm" onClick={() => setRot((r) => r + Math.PI / 4)} aria-label="Xoay phải">Xoay phải ⟳</button>
          </div>
        </div>
        <div className="card">
          <Choice label="Dáng người" opts={BODY} value={look.body} onChange={(v) => upd({ body: v })} />
          <Swatches label="Màu da" colors={SKIN} names={SKIN_LABEL} value={look.skin} onChange={(i) => upd({ skin: i })} />
          <Choice label="Kiểu tóc" opts={HAIRS.map((l, i) => ({ id: i, label: l }))} value={look.hair} onChange={(v) => upd({ hair: v })} />
          <Swatches label="Màu tóc" colors={HAIR} names={HAIR_COLORS} value={look.hairColor} onChange={(i) => upd({ hairColor: i })} />
          <Swatches striped label="Đồng phục kẻ sọc" colors={RES_OUTFIT} names={OUTFITS} value={look.outfit} onChange={(i) => upd({ outfit: i })} />
          <Choice label="Bối cảnh gia đình (câu chuyện hư cấu, đổi được khi tiếp nhận)" opts={[{ id: 'family' as const, label: 'Có gia đình liên lạc' }, { id: 'estranged' as const, label: 'Ít liên lạc' }, { id: 'none' as const, label: 'Không có gia đình' }]} value={family} onChange={setFamily} />
          <label className="field" style={{ marginTop: 8 }}>Tên hiển thị (2–24 ký tự)
            <input type="text" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} aria-invalid={!!err} aria-describedby="nameerr" onKeyDown={(e) => { if (e.key === 'Enter') void start(); }} />
          </label>
          <p id="nameerr" className="small" style={{ color: 'var(--error)', minHeight: 20 }}>{err ?? ''}</p>
          <div className="row create-cta">
            <button className="btn" onClick={random}>Ngẫu nhiên</button>
            <button className="btn" disabled={!history.length} onClick={() => { setLook(history[history.length - 1]); setHistory((h) => h.slice(0, -1)); }}>Hoàn tác</button>
            <span className="spacer" />
            <button className="btn ghost" onClick={() => set({ screen: 'menu' })}>Quay lại</button>
            <button className="btn primary" disabled={!name || !!err || pending} onClick={start}>{pending ? 'Đang tạo...' : 'Bắt đầu hành trình'}</button>
          </div>
        </div>
      </div>
    </div></main>
  );
}
