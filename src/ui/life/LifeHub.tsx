// "Đời sống" hub — U26–U35 (11). Owner-only projections; mọi nút gửi intent qua controller.exec → domain authority.
import { useEffect, useState } from 'react';
import { useUI } from '../store';
import { Panel, Tabs, Empty, Status } from '../components';
import { controller } from '../../app/controller';
import * as L from '../../domain/life';
import { ITEM_BY_ID } from '../../content/items';
import { CASE_FACTS, DIETS, FUNCTIONAL_NEEDS, LETTER_TOPICS, ORIENTATION_TOPICS, POLICY_PROFILE, PROGRAMS, SERVICES, SERVICE_BY_ID } from '../../content/life';
import { NPC_BY_ID } from '../../content/npcs';
import { ZONE_BY_ID, CELL_ROOMS } from '../../content/world';
import { WEEKDAY_LABEL, dayOf, dayOfWeek, fmtClock, fmtDayClock, fmtMoney } from '../../domain/util';
import type { CaseState, GameState } from '../../domain/types';

const close = () => useUI.getState().open(null);
const ex = <T,>(fn: (ctx: import('../../domain/core').Ctx) => T) => controller.exec<T>(fn);
const aid = (p: string) => `${p}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;

const CASE_STATE: Record<CaseState, [string, 'ok' | 'warn' | 'err' | undefined]> = {
  submitted: ['Đã gửi', undefined], acknowledged: ['Đã tiếp nhận', undefined], in_review: ['Đang xem xét', 'warn'], answered: ['Đã phản hồi', 'ok'], appealed: ['Đang xem xét lại', 'warn'], resolved: ['Đã giải quyết', 'ok'], withdrawn: ['Đã rút', undefined],
};

export function LifeHub() {
  useUI((s) => s.rev);
  const tab = useUI((s) => s.lifeTab);
  const set = useUI((s) => s.set);
  const s = controller.s!;
  const c = L.lifeSummaryCounts(s);
  const admitted = s.life.episode.state !== 'arrived' && s.life.episode.state !== 'orienting';
  return (
    <Panel title="Đời sống" onClose={admitted ? close : undefined} footer={`${POLICY_PROFILE.jurisdictionLabel}. Thông tin ở đây là riêng tư của bạn.`}
      tabs={<Tabs label="Đời sống" value={tab} onChange={(t) => set({ lifeTab: t })} tabs={[
        { id: 'journey', label: 'Hồ sơ hành trình' }, { id: 'property', label: 'Tài sản' }, { id: 'store', label: 'Tài khoản & cửa hàng', badge: c.readyOrders },
        { id: 'contacts', label: 'Liên lạc', badge: c.unreadLetters }, { id: 'cases', label: 'Yêu cầu', badge: c.answeredCases }, { id: 'support', label: 'Chăm sóc & nhu cầu' },
        { id: 'programs', label: 'Học tập & công việc' }, { id: 'incidents', label: 'Sự việc', badge: c.incidents }, { id: 'transfer', label: 'Chuyển nơi', badge: c.transitions }, { id: 'release', label: 'Kế hoạch rời cơ sở' },
      ]} />}>
      {!admitted && tab !== 'journey' ? <p className="notice">Hãy hoàn tất tiếp nhận ở tab “Hồ sơ hành trình” trước.</p> : <>
        {tab === 'journey' && <Journey s={s} />}
        {tab === 'property' && <Property s={s} />}
        {tab === 'store' && <Store s={s} />}
        {tab === 'contacts' && <Contacts s={s} />}
        {tab === 'cases' && <Cases s={s} />}
        {tab === 'support' && <Support s={s} />}
        {tab === 'programs' && <Programs s={s} />}
        {tab === 'incidents' && <Incidents s={s} />}
        {tab === 'transfer' && <Transfer s={s} />}
        {tab === 'release' && <Release s={s} />}
      </>}
    </Panel>
  );
}

// ---------------- U26 Admission / journey ----------------
function Journey({ s }: { s: GameState }) {
  const ep = s.life.episode;
  const steps: { id: L.AdmissionStep; label: string }[] = [
    { id: 'identity', label: 'Xác nhận danh tính & tình trạng' }, { id: 'orientation', label: 'Định hướng: nội quy & quyền' }, { id: 'property', label: 'Kiểm kê & ký gửi tài sản' },
    { id: 'support', label: 'Nhu cầu & hỗ trợ (tùy chọn)' }, { id: 'housing', label: 'Phân chỗ ở' },
  ];
  const cur = steps.find((x) => !ep.admissionSteps[x.id]);
  const [family, setFamily] = useState(ep.familyContext);
  const [diet, setDiet] = useState(s.life.diet);
  const [needs, setNeeds] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const finish = () => { controller.session!.exec(() => undefined); const cell = CELL_ROOMS.find((c) => c.beds.includes(L.currentBed(s) ?? '')); if (cell) { s.player.pos = { x: cell.door.x, y: 0, z: cell.door.z - cell.inward * 0.85 }; s.player.zone = 'L02'; s.player.lastSafe = { ...s.player.pos }; if (!s.discoveredZones.includes('L02')) s.discoveredZones.push('L02'); } controller.bump(); close(); };
  if (cur) return (
    <div className="split">
      <div className="adm-progress" aria-hidden>Bước {steps.findIndex((x) => x.id === cur.id) + 1}/{steps.length}<i><b style={{ width: `${(steps.findIndex((x) => x.id === cur.id) / steps.length) * 100}%` }} /></i></div>
      <ol className="col adm-steps" aria-label="Các bước tiếp nhận">{steps.map((x) => <li key={x.id} className="small" style={{ color: ep.admissionSteps[x.id] ? 'var(--positive)' : x.id === cur.id ? 'var(--accent)' : undefined }}>{ep.admissionSteps[x.id] ? '✓ ' : ''}{x.label}</li>)}</ol>
      <div className="card">
        <p className="small muted">Thông tin trong thế giới hư cấu · Cán bộ tiếp nhận: {NPC_BY_ID.tam.name}</p>
        {cur.id === 'identity' && <>
          <h3>Xin chào, {s.character.name}</h3>
          <dl className="kv"><dt>Mã trong thế giới game</dt><dd>{ep.id.slice(-8).toUpperCase()}</dd><dt>Tình trạng (hư cấu)</dt><dd>Đã có quyết định thi hành — hồ sơ hư cấu</dd><dt>Hồ sơ chính sách</dt><dd>{POLICY_PROFILE.id} v{POLICY_PROFILE.version}</dd></dl>
          <p className="small muted">Không có tội danh hay chỉ số nào được gán theo ngoại hình. Mốc thời gian là theo câu chuyện, không phải công thức pháp lý.</p>
          <button className="btn primary" onClick={() => ex((c) => L.admissionStep(c, 'identity'))} data-autofocus>Xác nhận</button>
        </>}
        {cur.id === 'orientation' && <>
          <h3>Định hướng</h3>
          {ORIENTATION_TOPICS.map((t) => (
            <div key={t.id} className="notice" style={{ marginBottom: 6 }}>
              <b>{t.title}</b> {ep.orientation[t.id] === 'acknowledged' && <Status kind="ok">đã hiểu</Status>}
              {(open === t.id || true) && <p className="small">{t.body}</p>}
              <div className="row"><button className="btn sm" onClick={() => ex((c) => L.acknowledgeTopic(c, t.id))}>Tôi đã hiểu</button><button className="btn sm ghost" onClick={() => setOpen(t.id)}>Hỏi lại cán bộ</button></div>
              {open === t.id && <p className="small muted">Cán bộ Tâm: “Nói ngắn gọn: {t.body.split('.')[0].toLowerCase()}. Có gì chưa rõ, bạn có thể hỏi lại bất cứ lúc nào ở Sổ tay (H).”</p>}
            </div>
          ))}
          <p className="small muted">Xác nhận đã hiểu không có nghĩa là từ bỏ quyền nào. Bạn có thể xem lại bất kỳ lúc nào.</p>
          <button className="btn primary" onClick={() => ex((c) => L.admissionStep(c, 'orientation'))}>Tiếp tục</button>
        </>}
        {cur.id === 'property' && <>
          <h3>Kiểm kê tài sản cá nhân</h3>
          <table className="tbl"><thead><tr><th>Vật phẩm</th><th>Xử lý</th><th>Lý do</th></tr></thead><tbody>
            {s.inventory.bag.filter((x) => x && ITEM_BY_ID[x.itemId].personal).map((x) => <tr key={x!.uid}><td>{ITEM_BY_ID[x!.itemId].icon} {ITEM_BY_ID[x!.itemId].name}</td><td>{x!.itemId === 'photo' ? 'Giữ trong phòng' : 'Ký gửi tại kho'}</td><td className="small muted">{x!.itemId === 'photo' ? 'Được phép giữ' : 'Theo nội quy hư cấu; trả lại khi rời cơ sở'}</td></tr>)}
          </tbody></table>
          <p className="small">Bạn cũng được cấp: khăn, xà phòng, bàn chải, bộ đồ sạch, chăn, 2 phong bì.</p>
          <button className="btn primary" onClick={() => ex((c) => L.admissionStep(c, 'property'))}>Xác nhận và nhận biên nhận</button>
        </>}
        {cur.id === 'support' && <>
          <h3>Nhu cầu & hỗ trợ (tùy chọn)</h3>
          <p className="small muted">Không cần giấy tờ y tế. Không nhập thông tin thật. Có thể bỏ qua và đổi sau.</p>
          <fieldset style={{ border: 'none', padding: 0 }}><legend>Bối cảnh gia đình (câu chuyện)</legend><div className="row">
            {(['family', 'estranged', 'none'] as const).map((f) => <button key={f} className={`btn sm ${family === f ? 'primary' : ''}`} aria-pressed={family === f} onClick={() => setFamily(f)}>{{ family: 'Có gia đình liên lạc', estranged: 'Ít liên lạc', none: 'Không có gia đình' }[f]}</button>)}</div></fieldset>
          <fieldset style={{ border: 'none', padding: 0 }}><legend>Chế độ ăn</legend><div className="row">{DIETS.map((d) => <button key={d.id} className={`btn sm ${diet === d.id ? 'primary' : ''}`} aria-pressed={diet === d.id} onClick={() => setDiet(d.id)}>{d.label}</button>)}</div></fieldset>
          <fieldset style={{ border: 'none', padding: 0 }}><legend>Nhu cầu chức năng</legend>
            {FUNCTIONAL_NEEDS.map((n) => <label key={n.id} className="row small"><input type="checkbox" checked={needs.includes(n.id)} onChange={(e) => setNeeds(e.target.checked ? [...needs, n.id] : needs.filter((x) => x !== n.id))} />{n.label} <span className="muted">— {n.effect}</span></label>)}</fieldset>
          <div className="row"><button className="btn primary" onClick={() => ex((c) => L.admissionStep(c, 'support', { familyContext: family, diet, needs }))}>Lưu và tiếp tục</button><button className="btn" onClick={() => ex((c) => L.admissionStep(c, 'support', {}))}>Bỏ qua</button></div>
        </>}
        {cur.id === 'housing' && <>
          <h3>Phân chỗ ở</h3>
          <p>Bạn được xếp <b>Giường 3A, Phòng 3</b>, Khu phòng ở — gần lối đi chung. Bạn cùng phòng: <b>Tư</b>.</p>
          <p className="small muted">Lý do: còn chỗ phù hợp, gần lối đi. Có thể xin đổi phòng qua cán bộ khu ở hoặc mục Yêu cầu.</p>
          <button className="btn primary" onClick={() => { ex((c) => L.admissionStep(c, 'housing')); finish(); }}>Nhận chỗ ở và vào khu phòng ở</button>
        </>}
        <hr style={{ borderColor: 'var(--line)', margin: '16px 0' }} />
        <button className="btn ghost sm" onClick={() => { ex((c) => L.skipAdmission(c, { familyContext: family })); finish(); }}>Bỏ qua phần trình bày (vẫn tạo đủ biên nhận, đồ cấp phát và chỗ ở)</button>
      </div>
    </div>
  );
  const legal = s.life.bookings.filter((b) => b.kind === 'legal');
  return (
    <div className="grid2">
      <div className="card">
        <h3>Hồ sơ hành trình (hư cấu)</h3>
        <dl className="kv small">
          <dt>Mã</dt><dd>{ep.id.slice(-8).toUpperCase()}</dd>
          <dt>Trạng thái</dt><dd>{{ arrived: 'Mới đến', orienting: 'Đang định hướng', admitted: 'Đã tiếp nhận', transferring: 'Đang chuyển', released: 'Đã rời cơ sở', archived: 'Lưu trữ' }[ep.state]}</dd>
          <dt>Tình trạng</dt><dd>Thi hành theo câu chuyện (không phải pháp luật thật)</dd>
          <dt>Ngày đến</dt><dd>{fmtDayClock(ep.arrivalMinute)}</dd>
          <dt>Chỗ ở</dt><dd>{L.currentBed(s)?.replace('cell_', 'Phòng ').replace('_bed_', ', giường ').toUpperCase() ?? '—'}</dd>
          <dt>Mốc xem xét</dt><dd>Từ Ngày {ep.releaseEligibleDay} theo câu chuyện — không có công thức “ngoan là được ra”</dd>
          <dt>Gia đình</dt><dd>{{ family: 'Có liên lạc', estranged: 'Ít liên lạc', none: 'Không có' }[ep.familyContext]}</dd>
        </dl>
      </div>
      <div className="card">
        <h3>Thông tin pháp lý hư cấu & hẹn riêng</h3>
        <p className="small">Buổi hẹn riêng với cán bộ hồ sơ giúp hiểu tình trạng và các mốc tiếp theo. Nội dung là riêng tư.</p>
        <BookingPicker serviceId="legal" s={s} />
        {legal.map((b) => <div key={b.id} className="small">{fmtDayClock(b.start)} · {bookingState(b.state)}{b.reason ? ` · ${b.reason}` : ''}</div>)}
        <h3 style={{ marginTop: 8 }}>Định hướng đã xem</h3>
        {ORIENTATION_TOPICS.map((t) => <div key={t.id} className="small">{ep.orientation[t.id] === 'acknowledged' ? '✓' : '○'} {t.title}</div>)}
        <button className="btn sm" onClick={() => useUI.getState().open('handbook')}>Mở Sổ tay</button>
      </div>
    </div>
  );
}

const bookingState = (st: string) => ({ requested: 'Đã yêu cầu', booked: 'Đã đặt', waiting: 'Đang chờ', active: 'Đang diễn ra', completed: 'Hoàn tất', excused: 'Được miễn', missed: 'Đã lỡ', cancelled: 'Đã hủy', rescheduled: 'Cần đổi lịch' } as Record<string, string>)[st] ?? st;

function BookingPicker({ serviceId, s, participant }: { serviceId: string; s: GameState; participant?: string }) {
  const slots = L.bookingSlots(s, serviceId);
  const [t, setT] = useState<number | ''>('');
  const [msg, setMsg] = useState('');
  const sv = SERVICE_BY_ID[serviceId];
  return (
    <div className="row" style={{ margin: '6px 0' }}>
      <select value={t} onChange={(e) => setT(e.target.value ? Number(e.target.value) : '')} aria-label={`Chọn giờ ${sv.name}`}>
        <option value="">— Chọn giờ ({sv.name}) —</option>
        {slots.map((x) => <option key={x} value={x}>{WEEKDAY_LABEL[dayOfWeek(x)]} Ngày {dayOf(x)} {fmtClock(x)}</option>)}
      </select>
      <button className="btn sm" disabled={t === ''} onClick={() => { const r = ex((c) => L.book(c, serviceId, Number(t), participant, aid('bk'))); setMsg(r?.ok ? 'Đã đặt lịch.' : r?.message ?? ''); setT(''); }}>Đặt lịch</button>
      {slots.length === 0 && <span className="small muted">Hết chỗ trong 3 ngày tới — thử lại sau hoặc dùng {sv.fallback === 'letter' ? 'thư' : 'kênh khác'}.</span>}
      <span role="status" className="small">{msg}</span>
    </div>
  );
}

// ---------------- U27 Property ----------------
function Property({ s }: { s: GameState }) {
  const [sel, setSel] = useState<string | null>(s.life.receipts[s.life.receipts.length - 1]?.id ?? null);
  const r = s.life.receipts.find((x) => x.id === sel);
  const kind = { deposit: 'Ký gửi', issue: 'Cấp phát', inspect: 'Kiểm tra', transfer: 'Chuyển', return: 'Hoàn trả', replace: 'Đổi/thay', purchase: 'Mua hàng' };
  return (
    <div className="split">
      <div className="col">
        <h3>Đang ký gửi</h3>
        {s.inventory.stored.length === 0 ? <Empty>Không có.</Empty> : s.inventory.stored.map((x) => <div key={x.uid} className="small">{ITEM_BY_ID[x.itemId].icon} {ITEM_BY_ID[x.itemId].name} ×{x.qty}</div>)}
        <h3 style={{ marginTop: 8 }}>Biên nhận ({s.life.receipts.length})</h3>
        {[...s.life.receipts].reverse().slice(0, 30).map((x) => <button key={x.id} className="item-row" aria-selected={sel === x.id} onClick={() => setSel(x.id)}>{kind[x.kind]} · {fmtDayClock(x.minute)}{x.state === 'disputed' ? ' · đang khiếu nại' : ''}</button>)}
      </div>
      <div className="card">
        {!r ? <Empty>Chọn biên nhận.</Empty> : <>
          <h3>Biên nhận {kind[r.kind]} — {r.id.slice(-6).toUpperCase()}</h3>
          <p className="small muted">{fmtDayClock(r.minute)} · trạng thái: {r.state} · không thể chỉnh sửa (sửa đổi tạo biên nhận mới liên kết)</p>
          <table className="tbl"><thead><tr><th>Vật phẩm</th><th>SL</th><th>Từ → Đến</th><th>Lý do</th></tr></thead><tbody>
            {r.lines.map((l, i) => <tr key={i}><td>{l.qty ? `${ITEM_BY_ID[l.itemId]?.icon ?? ''} ${ITEM_BY_ID[l.itemId]?.name ?? l.itemId}` : '—'}</td><td>{l.qty || ''}</td><td className="small">{l.from} → {l.to}</td><td className="small">{l.reason}</td></tr>)}
          </tbody></table>
          {r.state !== 'disputed' && (r.kind === 'deposit' || r.kind === 'inspect') && <button className="btn sm" onClick={() => ex((c) => L.disputeReceipt(c, r.id))}>Báo thiếu / sai — gửi yêu cầu xem xét</button>}
          {r.state === 'disputed' && <p className="notice small">Đang khiếu nại — theo dõi ở tab Yêu cầu. Lịch sử biên nhận được giữ nguyên.</p>}
        </>}
      </div>
    </div>
  );
}

// ---------------- U28 Account & store ----------------
function Store({ s }: { s: GameState }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const acc = s.life.account;
  const q = s.life.quotes.find((x) => x.id === quoteId);
  const lines = Object.entries(cart).filter(([, n]) => n > 0).map(([itemId, qty]) => ({ itemId, qty }));
  useEffect(() => { if (!s.flags.viewed_statement) { s.flags.viewed_statement = true; controller.exec(() => undefined); } }, [s]);
  return (
    <div className="grid2">
      <div className="card">
        <h3>Tài khoản tín chỉ hư cấu</h3>
        <dl className="kv"><dt>Khả dụng</dt><dd><b>{fmtMoney(L.available(s))}</b></dd><dt>Đang giữ cho đơn</dt><dd>{fmtMoney(acc.reserved)}</dd><dt>Tổng số dư</dt><dd>{fmtMoney(acc.balance)}</dd><dt>Trạng thái</dt><dd>{acc.state === 'settled' ? 'Đã quyết toán' : 'Đang mở'}</dd></dl>
        <p className="small muted">Không có tiền thật, nạp tiền hay rút tiền. Nguồn: trợ cấp tuần (Thứ Hai), ca làm, người thân (câu chuyện).</p>
        <h3>Sao kê</h3>
        <table className="tbl small"><tbody>
          {acc.entries.filter((e) => e.account === 'player').slice(-12).reverse().map((e) => <tr key={e.id}><td>{fmtDayClock(e.minute)}</td><td>{e.reason}</td><td style={{ color: e.direction === 'credit' ? 'var(--positive)' : 'var(--error)' }}>{e.direction === 'credit' ? '+' : '−'}{fmtMoney(e.amount)}</td></tr>)}
          {acc.entries.length === 0 && <tr><td className="muted">Chưa có giao dịch.</td></tr>}
        </tbody></table>
        <h3 style={{ marginTop: 8 }}>Đơn hàng</h3>
        {s.life.orders.length === 0 && <Empty>Chưa có đơn.</Empty>}
        {[...s.life.orders].reverse().slice(0, 8).map((o) => <div key={o.id} className="small notice" style={{ marginBottom: 4 }}>
          <b>{o.id.slice(-5).toUpperCase()}</b> · {fmtMoney(o.total)} · <Status kind={o.state === 'delivered' ? 'ok' : o.state === 'ready' ? 'warn' : undefined}>{{ quoted: 'Báo giá', reserved: 'Đã giữ', preparing: 'Đang chuẩn bị', ready: 'Sẵn sàng nhận', delivered: 'Đã nhận', cancelled: 'Đã hủy', refunded: 'Đã hoàn' }[o.state]}</Status>
          <div>{o.lines.map((l) => `${ITEM_BY_ID[l.itemId].name} ×${l.qty}`).join(', ')}</div>
          {['preparing', 'ready'].includes(o.state) && <button className="btn sm" onClick={() => ex((c) => L.cancelOrder(c, o.id))}>Hủy đơn (hoàn tiền giữ)</button>}
          {o.state === 'ready' && <span className="muted"> · Nhận tại Quầy dịch vụ</span>}
        </div>)}
      </div>
      <div className="card">
        <h3>Danh mục (ngày đặt: Thứ Hai, Thứ Tư, Thứ Sáu)</h3>
        <table className="tbl small"><thead><tr><th>Mặt hàng</th><th>Giá</th><th>Còn</th><th>SL</th></tr></thead><tbody>
          {L.CATALOG.map((it) => <tr key={it.id}><td>{it.icon} {it.name}{it.essential ? ' (có cấp miễn phí)' : ''}</td><td>{fmtMoney(it.price!)}</td><td>{s.world.stock[it.id] ?? 0}</td>
            <td><input type="number" min={0} max={5} value={cart[it.id] ?? 0} onChange={(e) => { setQuoteId(null); setCart({ ...cart, [it.id]: Math.max(0, Math.min(5, Math.floor(Number(e.target.value) || 0))) }); }} style={{ width: 64 }} aria-label={`Số lượng ${it.name}`} /></td></tr>)}
        </tbody></table>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn" disabled={!lines.length} onClick={() => { const r = ex((c) => L.quote(c, lines)); if (r?.ok) { setQuoteId(r.quoteId!); setMsg(`Báo giá ${fmtMoney(r.total!)} — hiệu lực 2 giờ game. Chưa trừ tiền.`); } else setMsg(r?.message ?? ''); }}>Tạo báo giá</button>
          {q && <button className="btn primary" onClick={() => { const r = ex((c) => L.placeOrder(c, q.id, aid('ord'))); setMsg(r?.ok ? 'Đã đặt hàng.' : r?.message ?? ''); if (r?.ok) { setCart({}); setQuoteId(null); } }}>Xác nhận đặt {fmtMoney(q.total)}</button>}
        </div>
        <p role="status" className="small">{msg}</p>
        <div className="notice small">Vật dụng thiết yếu (xà phòng, khăn, bàn chải, phong bì, suất dự phòng) luôn nhận miễn phí tại Quầy dịch vụ hoặc quầy giặt — kể cả khi số dư bằng 0.</div>
      </div>
    </div>
  );
}

// ---------------- U29 Contacts / letters / calls / visits ----------------
function Contacts({ s }: { s: GameState }) {
  const [cid, setCid] = useState(s.life.contacts[0]?.id ?? '');
  const [topic, setTopic] = useState(LETTER_TOPICS[0].id);
  const [msg, setMsg] = useState('');
  const c = s.life.contacts.find((x) => x.id === cid);
  const letters = s.life.correspondence.filter((x) => x.contactId === cid);
  const unreadIncoming = s.life.correspondence.filter((x) => x.direction === 'incoming' && x.state === 'delivered' && !x.read);
  return (
    <div className="split">
      <div className="col">
        <h3>Người liên hệ (hư cấu)</h3>
        {s.life.contacts.map((x) => <button key={x.id} className="item-row" aria-selected={cid === x.id} onClick={() => setCid(x.id)}>{x.nameKey}{s.life.correspondence.some((l) => l.contactId === x.id && l.direction === 'incoming' && l.state === 'delivered' && !l.read) ? <span className="badge">thư</span> : null}</button>)}
        <p className="small muted">Không nhập địa chỉ, số điện thoại hay tên người thật. Không cần micro/camera.</p>
        {unreadIncoming.length > 0 && <p className="notice small">{unreadIncoming.length} thư chưa đọc.</p>}
      </div>
      {c && <div className="card">
        <h3>{c.nameKey}</h3>
        <p className="small muted">Kênh: {c.channels.map((ch) => ({ letter: 'Thư', call: 'Gọi', visit: 'Thăm gặp', legal: 'Liên lạc pháp lý riêng' }[ch])).join(', ')}</p>
        {c.channels.includes('letter') && <>
          <h3>Viết thư</h3>
          <div className="row"><select value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Chủ đề thư">{LETTER_TOPICS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
            <button className="btn sm" disabled={s.player.zone !== 'L16'} title={s.player.zone !== 'L16' ? 'Gửi tại Góc liên lạc' : ''} onClick={() => { const r = ex((ctx) => L.sendLetter(ctx, c.id, topic, aid('letter'))); setMsg(r?.message ?? ''); }}>Gửi thư (dùng 1 phong bì)</button></div>
          {s.player.zone !== 'L16' && <p className="small muted">Gửi thư tại Góc liên lạc (L16). Bạn vẫn có thể đọc thư ở bất kỳ đâu.</p>}
        </>}
        {c.channels.includes('call') && <><h3>Hẹn cuộc gọi</h3><BookingPicker serviceId="call" s={s} participant={c.id} /></>}
        {c.channels.includes('visit') && <><h3>Hẹn thăm gặp</h3><BookingPicker serviceId="visit" s={s} participant={c.id} /></>}
        {c.channels.includes('legal') && <p className="notice small">Liên lạc pháp lý được xử lý riêng tư qua mục Hồ sơ hành trình › Hẹn cố vấn — không qua kiểm tra thư thông thường.</p>}
        <p role="status" className="small">{msg}</p>
        <h3>Thư & cuộc gọi</h3>
        {letters.length === 0 && <Empty>Chưa có.</Empty>}
        {[...letters].reverse().map((l) => <div key={l.id} className="notice small" style={{ marginBottom: 4 }}>
          <b>{l.direction === 'outgoing' ? 'Đã gửi' : l.channel === 'letter' ? 'Thư đến' : l.channel === 'call' ? 'Cuộc gọi' : 'Thăm gặp'}</b> · {fmtDayClock(l.minute)} · {l.direction === 'outgoing' ? ({ processing: 'đang xử lý', delivered: 'đã chuyển', returned: 'bị trả lại' } as Record<string, string>)[l.state] ?? l.state : l.state === 'processing' ? 'đang trên đường' : ''}
          <div>{l.channel === 'letter' ? LETTER_TOPICS.find((t) => t.id === l.topic)?.label : l.topic}</div>
          {l.direction === 'incoming' && l.channel === 'letter' && l.state === 'delivered' && (l.read ? <p>“{LETTER_TOPICS.find((t) => t.id === l.topic)?.reply}”</p> : <button className="btn sm" onClick={() => ex((ctx) => L.readLetter(ctx, l.id))}>Đọc thư</button>)}
        </div>)}
        <h3>Lịch hẹn</h3>
        {s.life.bookings.filter((b) => b.participant === c.id).map((b) => <div key={b.id} className="small">{SERVICE_BY_ID[b.serviceId].name} · {fmtDayClock(b.start)} · {bookingState(b.state)}{b.reason ? ` — ${b.reason}` : ''} {['booked', 'waiting'].includes(b.state) && <button className="btn sm" onClick={() => ex((ctx) => L.cancelBooking(ctx, b.id))}>Hủy</button>}</div>)}
      </div>}
    </div>
  );
}

// ---------------- U30 Requests / cases ----------------
function Cases({ s }: { s: GameState }) {
  const [sel, setSel] = useState<string | null>(null);
  const [cat, setCat] = useState<keyof typeof CASE_FACTS>('general');
  const [msg, setMsg] = useState('');
  const cs = s.life.cases.find((x) => x.id === sel);
  const groups: { id: keyof typeof CASE_FACTS; label: string }[] = [{ id: 'general', label: 'Hỏi chung' }, { id: 'property', label: 'Tài sản' }, { id: 'housing', label: 'Chỗ ở' }, { id: 'legal', label: 'Hồ sơ hư cấu' }, { id: 'care', label: 'Chăm sóc (khẩn được ưu tiên)' }, { id: 'safety', label: 'An toàn / bị gây áp lực (khẩn)' }, { id: 'maintenance', label: 'Thiết bị hỏng' }];
  return (
    <div className="split">
      <div className="col">
        <h3>Gửi yêu cầu mới</h3>
        <select value={cat} onChange={(e) => setCat(e.target.value as keyof typeof CASE_FACTS)} aria-label="Loại yêu cầu">{groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select>
        <p className="small muted">Nội dung: {CASE_FACTS[cat][0].label}</p>
        <button className="btn primary" onClick={() => { const c = ex((ctx) => cat === 'housing' ? (L.requestRoomMove(ctx), ctx.s.life.cases[ctx.s.life.cases.length - 1]) : L.submitCase(ctx, cat, 0, aid(`case_${cat}`))); setSel(c?.id ?? null); setMsg('Đã gửi — có biên nhận. Không mất phí, không ảnh hưởng uy tín.'); }}>Gửi yêu cầu</button>
        <p role="status" className="small">{msg}</p>
        <h3>Yêu cầu của bạn</h3>
        {s.life.cases.length === 0 && <Empty>Chưa có yêu cầu.</Empty>}
        {[...s.life.cases].reverse().map((c) => <button key={c.id} className="item-row" aria-selected={sel === c.id} onClick={() => setSel(c.id)}>{c.id.slice(-6).toUpperCase()} · {c.facts[0].slice(0, 28)} <span className="spacer" /><Status kind={CASE_STATE[c.state][1]}>{CASE_STATE[c.state][0]}</Status></button>)}
      </div>
      <div className="card">
        {!cs ? <Empty>Chọn một yêu cầu để xem tiến trình.</Empty> : <>
          <h3>Yêu cầu {cs.id.slice(-6).toUpperCase()}</h3>
          <dl className="kv small"><dt>Nội dung</dt><dd>{cs.facts.join('; ')}</dd><dt>Trạng thái</dt><dd>{CASE_STATE[cs.state][0]}</dd><dt>Người xử lý</dt><dd>{cs.assignedActor ? NPC_BY_ID[cs.assignedActor]?.name : 'Vai trò trực (ngoài màn hình)'} · {cs.assignedRole}</dd><dt>Hạn phản hồi</dt><dd>{fmtDayClock(cs.dueMinute)}</dd>{cs.parentCaseId && <><dt>Xem xét lại của</dt><dd>{cs.parentCaseId.slice(-6).toUpperCase()}</dd></>}</dl>
          <div className="timeline" style={{ margin: '8px 0' }}>{cs.history.map((h, i) => <div key={i} className="small"><span className="muted">{fmtDayClock(h.minute)}</span> — {h.text}</div>)}</div>
          {cs.response && <p className="notice">{cs.response}</p>}
          <div className="row">
            {cs.state === 'answered' && <><button className="btn" onClick={() => ex((ctx) => L.respondCase(ctx, cs.id, true))}>Chấp nhận phản hồi</button><button className="btn" onClick={() => ex((ctx) => L.respondCase(ctx, cs.id, false))}>Yêu cầu xem xét lại (người độc lập)</button></>}
            {!['resolved', 'withdrawn', 'answered'].includes(cs.state) && <button className="btn ghost" onClick={() => ex((ctx) => L.withdrawCase(ctx, cs.id))}>Rút yêu cầu</button>}
          </div>
          <p className="small muted">Gửi đơn không bao giờ bị phạt. Rút yêu cầu không xóa lịch sử.</p>
        </>}
      </div>
    </div>
  );
}

// ---------------- U31 Care & needs ----------------
function Support({ s }: { s: GameState }) {
  const func = s.life.support.find((p) => p.kind === 'functional');
  const care = s.life.support.find((p) => p.kind === 'care');
  const [flags, setFlags] = useState<string[]>(func?.flags ?? []);
  return (
    <div className="grid2">
      <div className="card">
        <h3>Nhu cầu chức năng (tùy chọn, riêng tư)</h3>
        <p className="small muted">Không nhập thông tin y tế thật. Đây là nhu cầu của nhân vật trong game, khác với cài đặt trợ năng giao diện (Cài đặt › Trợ năng).</p>
        {FUNCTIONAL_NEEDS.map((n) => <label key={n.id} className="row small"><input type="checkbox" checked={flags.includes(n.id)} onChange={(e) => setFlags(e.target.checked ? [...flags, n.id] : flags.filter((x) => x !== n.id))} />{n.label}<span className="muted">— {n.effect}</span></label>)}
        <button className="btn sm" onClick={() => ex((c) => L.setFunctionalNeeds(c, flags))}>Lưu nhu cầu</button>
        <h3 style={{ marginTop: 12 }}>Chế độ ăn</h3>
        <div className="row">{DIETS.map((d) => <button key={d.id} className={`btn sm ${s.life.diet === d.id ? 'primary' : ''}`} aria-pressed={s.life.diet === d.id} onClick={() => ex((c) => L.setDiet(c, d.id))}>{d.label}</button>)}</div>
        <h3 style={{ marginTop: 12 }}>Sinh hoạt văn hóa / tinh thần</h3>
        <div className="row">{([['opted_in', 'Tham gia sinh hoạt văn hóa'], ['nonreligious', 'Giờ suy ngẫm không tôn giáo'], ['opted_out', 'Không tham gia']] as const).map(([v, l]) => <button key={v} className={`btn sm ${s.life.culturalOptIn === v ? 'primary' : ''}`} aria-pressed={s.life.culturalOptIn === v} onClick={() => ex((c) => L.setCulture(c, v))}>{l}</button>)}</div>
        <p className="small muted">Lựa chọn này không ảnh hưởng uy tín, kỹ năng hay cách NPC đánh giá bạn.</p>
      </div>
      <div className="card">
        <h3>Chăm sóc sức khỏe</h3>
        <p className="small">Không chẩn đoán thật. Kế hoạch nghỉ giúp được miễn trừ ca làm/lớp và điểm danh.</p>
        {care && <p className="notice small">Kế hoạch: {care.state === 'active' ? `đang hiệu lực${care.restUntilMinute && care.restUntilMinute > s.minute ? ` — nghỉ đến ${fmtDayClock(care.restUntilMinute)}` : ''}` : care.state === 'review_needed' ? 'cần xem lại — hãy đặt hẹn' : care.state}</p>}
        <BookingPicker serviceId="care" s={s} />
        <button className="btn sm" onClick={() => ex((c) => L.submitCase(c, 'care', 0, aid('care')))}>Cần chăm sóc sớm (yêu cầu khẩn)</button>
        <h3 style={{ marginTop: 12 }}>Trò chuyện hỗ trợ</h3>
        <p className="small">Với điều phối viên Cô Linh hoặc người lắng nghe đồng đẳng (Quân). Có thể từ chối/bỏ qua bất kỳ lúc nào, không bị phạt.</p>
        <BookingPicker serviceId="support" s={s} />
        <h3 style={{ marginTop: 12 }}>Lịch hẹn</h3>
        {s.life.bookings.filter((b) => ['care', 'support'].includes(b.kind)).map((b) => <div key={b.id} className="small">{SERVICE_BY_ID[b.serviceId].name} · {fmtDayClock(b.start)} · {bookingState(b.state)} {['booked'].includes(b.state) && <button className="btn sm" onClick={() => ex((c) => L.cancelBooking(c, b.id))}>Hủy</button>}</div>)}
      </div>
    </div>
  );
}

// ---------------- U32 Programs ----------------
function Programs({ s }: { s: GameState }) {
  const [msg, setMsg] = useState('');
  return (
    <div>
      <p className="small muted">Khóa học và ca làm có lịch, điều khoản và cách tham gia tương đương. Điểm danh khác với XP; buổi vắng có lý do được học bù. Giấy ghi nhận chỉ có giá trị trong game.</p>
      <table className="tbl"><thead><tr><th>Chương trình</th><th>Lịch</th><th>Điều khoản</th><th>Tiến độ</th><th /></tr></thead><tbody>
        {PROGRAMS.map((p) => { const e = s.life.programs.find((x) => x.programId === p.id); const active = e && ['enrolled', 'in_progress'].includes(e.state); return (
          <tr key={p.id}>
            <td><b>{p.name}</b><div className="small muted">{p.kind === 'study' ? 'Học tập' : 'Công việc'} · {ZONE_BY_ID[p.zone].name} · phụ trách {NPC_BY_ID[p.supervisor]?.name}</div></td>
            <td className="small">{p.days.map((d) => WEEKDAY_LABEL[d].replace('Thứ ', 'T')).join(', ')}<br />{fmtClock(p.from)}–{fmtClock(p.to)}</td>
            <td className="small">{p.terms}{p.wagePerShift ? ` Ghi nhận ${fmtMoney(p.wagePerShift)}/ca.` : ''}<div className="muted">Biến thể hỗ trợ: {p.supportVariant}</div></td>
            <td className="small">{e ? <>{({ enrolled: 'Đã đăng ký', in_progress: 'Đang tham gia', completed: 'Hoàn thành', withdrawn: 'Đã rút', excused: 'Được miễn', paused: 'Tạm dừng', waitlisted: 'Danh sách chờ', available: '' } as Record<string, string>)[e.state]}{p.units.length ? ` · ${e.completedUnits.length}/${p.units.length} bài` : ''}{e.credits ? ` · ${fmtMoney(e.credits)}` : ''}
              <div className="muted">{e.attendance.slice(-4).map((a) => `${a.sessionKey.split(':')[1] ? 'N' + a.sessionKey.split(':')[1] : ''} ${{ attended: '✓', excused: 'miễn', missed: 'vắng', partial: 'một phần' }[a.outcome]}`).join(' · ')}</div></> : '—'}</td>
            <td>{active ? <button className="btn sm" onClick={() => ex((c) => L.withdrawProgram(c, p.id))}>Rút</button> : e?.state === 'completed' ? <Status kind="ok">Xong</Status> : <button className="btn sm" onClick={() => { const r = ex((c) => L.enroll(c, p.id)); setMsg(r?.message ?? ''); }}>Đăng ký</button>}</td>
          </tr>); })}
      </tbody></table>
      <p role="status" className="small">{msg}</p>
      <p className="small muted">Đến đúng khu trong giờ học/ca và tương tác với bàn học / bàn làm việc / quầy để tham gia. Không có việc vẫn được ăn uống và nhận vật dụng thiết yếu đầy đủ.</p>
    </div>
  );
}

// ---------------- U33 Incidents ----------------
function Incidents({ s }: { s: GameState }) {
  const list = [...s.life.incidents].reverse();
  const st: Record<string, string> = { reported: 'Đã ghi nhận', notified: 'Đã thông báo — mời trình bày', in_review: 'Đang xem xét', decided: 'Đã quyết định', appealed: 'Đang xem xét lại', overturned: 'Đã hủy quyết định', expired: 'Hết hiệu lực', dismissed: 'Không xử lý' };
  return (
    <div className="col">
      <p className="small muted">Cáo buộc khác với kết luận. Quyết định dựa trên dữ kiện và lời trình bày — không dựa trên ngoại hình hay uy tín. Không hệ quả nào ảnh hưởng ăn uống, vệ sinh, chăm sóc, liên lạc hay quyền gửi đơn.</p>
      {list.length === 0 && <Empty>Không có sự việc nào.</Empty>}
      {list.map((i) => (
        <div key={i.id} className="card">
          <h3>{i.facts[0]?.text} <Status kind={i.state === 'dismissed' || i.state === 'overturned' ? 'ok' : i.state === 'decided' ? 'warn' : undefined}>{st[i.state]}</Status></h3>
          <dl className="kv small"><dt>Quy tắc (hư cấu)</dt><dd>{i.ruleId === 'roll_call' ? 'Có mặt khi điểm danh (trừ khi có lịch được phép)' : i.ruleId}</dd><dt>Dữ kiện đã biết</dt><dd>{i.facts.map((f) => `${f.text} — nguồn: ${f.provenance}`).join('; ')}</dd><dt>Hạn trình bày</dt><dd>{fmtDayClock(i.dueMinute)}</dd>{i.decision && <><dt>Quyết định</dt><dd>{i.decision}</dd></>}{i.consequence && <><dt>Hiệu lực đến</dt><dd>{fmtDayClock(i.consequence.untilMinute)}</dd></>}</dl>
          {['notified', 'in_review'].includes(i.state) && <div className="row" style={{ marginTop: 6 }}>{L.RESPONSE_OPTIONS.map((r) => <button key={r.id} className={`btn sm ${i.responses.includes(r.id) ? 'primary' : ''}`} onClick={() => ex((c) => L.respondIncident(c, i.id, r.id))}>{r.label}</button>)}</div>}
          {i.state === 'decided' && <button className="btn sm" onClick={() => ex((c) => L.appealIncident(c, i.id))}>Yêu cầu xem xét lại</button>}
          <div className="timeline" style={{ marginTop: 6 }}>{i.history.map((h, k) => <div key={k} className="small"><span className="muted">{fmtDayClock(h.minute)}</span> — {h.text}</div>)}</div>
        </div>
      ))}
    </div>
  );
}

// ---------------- U34 Transfer ----------------
function Transfer({ s }: { s: GameState }) {
  const [msg, setMsg] = useState('');
  const list = [...s.life.transitions].reverse().filter((t) => t.kind === 'room_move');
  return (
    <div className="col">
      <p className="small muted">Chuyển phòng giữ nguyên toàn bộ đồ đạc, tài khoản, lịch hẹn và tiến trình. Chỉ hoàn tất khi chỗ mới đã được giữ.</p>
      <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => { ex((c) => L.requestRoomMove(c)); setMsg('Đã gửi yêu cầu đổi phòng — theo dõi ở tab Yêu cầu.'); }}>Xin đổi phòng</button>
      <p role="status" className="small">{msg}</p>
      {list.length === 0 && <Empty>Chưa có đề xuất chuyển nơi.</Empty>}
      {list.map((t) => (
        <div key={t.id} className="card">
          <h3>Chuyển phòng: {t.fromAnchor.replace('cell_', 'P').replace('_bed_', '-').toUpperCase()} → {t.toAnchor.replace('cell_', 'P').replace('_bed_', '-').toUpperCase()}</h3>
          <p className="small">Trạng thái: <b>{({ proposed: 'Đề xuất', approved: 'Đã duyệt', packing: 'Đang đóng gói', staged: 'Đã giữ chỗ mới', in_transit: 'Đang chuyển', committed: 'Hoàn tất', cancelled: 'Đã hủy', recovering: 'Đang khôi phục' } as Record<string, string>)[t.state]}</b></p>
          <p className="small muted">Ảnh hưởng lịch hẹn: không (lịch theo giờ, không theo phòng). Tủ cá nhân đi theo bạn.</p>
          {t.state === 'proposed' && <div className="row">
            <button className="btn primary" onClick={() => { const r = ex((c) => L.confirmTransition(c, t.id)); setMsg(r?.message ?? ''); }}>Xác nhận đã đóng gói & chuyển</button>
            <button className="btn" onClick={() => ex((c) => L.cancelTransition(c, t.id))}>Không chuyển nữa</button>
          </div>}
        </div>
      ))}
    </div>
  );
}

// ---------------- U35 Release ----------------
const GOALS: { key: keyof GameState['life']['reintegration']['goals']; label: string; opts: string[] }[] = [
  { key: 'housing', label: 'Nơi ở', opts: ['Về ở với gia đình', 'Nhà ở tạm của chương trình cộng đồng (hư cấu)', 'Thuê phòng chung với bạn'] },
  { key: 'work', label: 'Việc làm', opts: ['Xin việc ở xưởng mộc', 'Phụ bếp nhà hàng', 'Mở tiệm sửa xe nhỏ cùng bạn'] },
  { key: 'study', label: 'Học tập', opts: ['Học tiếp khóa nghề buổi tối', 'Học lấy bằng lái', 'Tự học qua thư viện'] },
  { key: 'finance', label: 'Tài chính', opts: ['Lập ngân sách tuần đầu', 'Để dành một phần thu nhập', 'Nhờ cố vấn hướng dẫn chi tiêu'] },
  { key: 'contact', label: 'Liên lạc', opts: ['Gặp gia đình tuần đầu', 'Giữ liên lạc với bạn cũ', 'Tham gia nhóm cộng đồng'] },
  { key: 'support', label: 'Hỗ trợ', opts: ['Gặp cố vấn cộng đồng hàng tuần', 'Tham gia nhóm hỗ trợ đồng đẳng', 'Chưa cần, biết nơi liên hệ'] },
];
function Release({ s }: { s: GameState }) {
  const plan = s.life.reintegration;
  const eligible = L.releaseEligible(s);
  const [confirm, setConfirm] = useState(false);
  const n = Object.values(plan.goals).filter(Boolean).length;
  const pending = s.life.orders.filter((o) => ['preparing', 'ready'].includes(o.state)).length;
  const q06 = s.quests.Q06?.state;
  return (
    <div className="grid2">
      <div className="card">
        <h3>Mục tiêu kế hoạch ({n}/6)</h3>
        <p className="small muted">Chọn những gì thực tế với bạn. Thiếu mục tiêu vẫn được hỗ trợ; không cần kỹ năng tối đa hay tiền.</p>
        {GOALS.map((g) => (
          <label key={g.key} className="field small" style={{ marginBottom: 6 }}>{g.label}
            <select value={plan.goals[g.key] ?? ''} onChange={(e) => ex((c) => L.setPlanGoal(c, g.key, e.target.value || null))}>
              <option value="">— Chưa chọn —</option>{g.opts.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
        ))}
        {plan.knownNextSteps.length > 0 && <><h3>Bước tiếp theo đã biết</h3><ul className="small">{plan.knownNextSteps.map((k) => <li key={k}>{k}</li>)}</ul></>}
      </div>
      <div className="card">
        <h3>Mốc xem xét theo câu chuyện</h3>
        <p className="small">{q06 !== 'active' && q06 !== 'completed' ? 'Mốc này mở ra khi bạn đi tới chương cuối của câu chuyện (nhiệm vụ “Hướng về phía trước”).' : eligible ? 'Đã đến mốc — bạn có thể xác nhận rời cơ sở tại Bàn kế hoạch (L18).' : `Mốc xem xét: từ Ngày ${s.life.episode.releaseEligibleDay}. Hôm nay là Ngày ${dayOf(s.minute)}.`}</p>
        <h3>Quyết toán khi rời</h3>
        <ul className="small">
          <li>Tài sản ký gửi trả lại: {s.inventory.stored.map((x) => ITEM_BY_ID[x.itemId].name).join(', ') || 'không có'}</li>
          <li>Số dư tài khoản quyết toán: {fmtMoney(s.life.account.balance)}</li>
          <li>Đơn hàng chưa nhận sẽ được hủy và hoàn tiền giữ: {pending}</li>
          <li>Lịch hẹn còn lại sẽ được hủy có ghi lý do.</li>
        </ul>
        {s.life.episode.state === 'released' ? <Status kind="ok">Đã rời cơ sở</Status> : !confirm
          ? <button className="btn primary" disabled={!eligible || s.player.zone !== 'L18'} onClick={() => setConfirm(true)}>Xác nhận rời cơ sở</button>
          : <div className="notice"><p>Hành trình sẽ kết thúc và được lưu ở trạng thái “đã rời”. Không thể quay lại vòng sinh hoạt của hành trình này (có thể chơi tự do ở bản sao riêng).</p>
            <div className="row"><button className="btn primary" onClick={() => { const r = ex((c) => L.depart(c)); if (!r?.ok) useUI.getState().toast({ id: 'dep', text: r?.message ?? '', severity: 'warning' }); }}>Tôi đã sẵn sàng</button><button className="btn" onClick={() => setConfirm(false)}>Chưa</button></div></div>}
        {eligible && s.player.zone !== 'L18' && <p className="small muted">Đến Hướng nghiệp & chuẩn bị ra (L18) để xác nhận.</p>}
      </div>
    </div>
  );
}

export const _services = SERVICES;
