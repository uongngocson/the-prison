// Chế độ Thụ án — UI: U36 chọn chế độ, U37 chế độ thụ án, U38 sinh hoạt tại buồng, chip HUD.
// Mọi text "được tới" đọc từ evaluator domain — UI không tự suy luận quyền.
import { useEffect, useState } from 'react';
import { useUI } from '../store';
import { Panel, Tabs, Empty, Status } from '../components';
import { Icon } from '../icons';
import { controller } from '../../app/controller';
import type { Appearance, ExperienceMode, StartSegment } from '../../domain/types';
import type { CharacterDraft } from '../../domain/newgame';
import { PHASE_LABEL, PRESET_BY_ID, CUSTODY_SCHEDULE, SEGMENT_INFO, SHU_LEVELS, SHU_SCHEDULE } from '../../content/custody';
import { ZONE_BY_ID } from '../../content/world';
import {
  allowedZones, chapterEligible, closeChapter, currentGroup, homeRoom, isConfinedPhase, isVN, nextWindow,
  orderKindLabel, progress, sentenceLabel, validateSelection, windowAt, shuOrder, shuNextWindow, shuWindowAt, shuWindowApplies,
} from '../../domain/custody';
import { dayOf } from '../../domain/util';
import { ConflictReports } from './Conflict';
import { fmtClock, fmtDayClock } from '../../domain/util';

// ======================= U36 — một màn duy nhất: chế độ + mức án + ngẫu nhiên =======================
const DRAFT_KEY = 'mnm.setupDraft';
export interface SetupDraft { character: { name: string; appearance: Appearance; familyContext: CharacterDraft['familyContext'] }; mode: ExperienceMode; presetId: string; segment: StartSegment; step: number }
export function saveSetupDraft(d: SetupDraft) { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* private mode */ } }
export function loadSetupDraft(): SetupDraft | null {
  try { const raw = sessionStorage.getItem(DRAFT_KEY); return raw ? JSON.parse(raw) as SetupDraft : null; } catch { return null; }
}
function clearSetupDraft() { try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } }

/** Ít lựa chọn cho dễ chơi: 6 mức án tiêu biểu. */
const QUICK_PRESETS = ['VN-T01Y', 'VN-T03Y', 'VN-T05Y', 'VN-T10Y', 'VN-T20Y', 'VN-LIFE'];
const MODES: { id: ExperienceMode; icon: string; title: string; desc: string }[] = [
  { id: 'fictional_life', icon: 'home', title: 'Cốt truyện', desc: '7 ngày · tự do đi lại' },
  { id: 'vn_custody', icon: 'lock', title: 'Thụ án', desc: 'Có mức án · giờ ở buồng' },
];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export function Setup() {
  const set = useUI((s) => s.set);
  const [d, setD] = useState<SetupDraft | null>(() => loadSetupDraft());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (d) saveSetupDraft(d); }, [d]);
  if (!d) {
    return <main className="page setup2"><div className="setup-card"><p>Chưa có nhân vật.</p>
      <button className="btn primary" onClick={() => set({ screen: 'create' })}>Tạo nhân vật</button></div></main>;
  }
  const upd = (p: Partial<SetupDraft>) => { setError(null); setD({ ...d, ...p }); };
  const custody = d.mode === 'vn_custody';
  const presetId = QUICK_PRESETS.includes(d.presetId) ? d.presetId : 'VN-T05Y';
  const random = () => {
    const mode = pick(MODES).id;
    const p = pick(QUICK_PRESETS);
    upd({ mode, presetId: p, segment: pick(PRESET_BY_ID[p].segments.filter((x) => x !== 'shu')) }); // SHU chỉ khi người chơi tự chọn
  };
  const start = async () => {
    if (pending) return; // double-submit guard: một lineage
    const segment = PRESET_BY_ID[presetId].segments.includes(d.segment) ? d.segment : 'intake';
    if (custody && !validateSelection({ presetId, segment }).ok) { setError('Lựa chọn không hợp lệ, hãy chọn lại.'); return; }
    setPending(true);
    try {
      clearSetupDraft();
      await controller.startNew({ ...d.character, experienceMode: d.mode, presetId: custody ? presetId : undefined, segment: custody ? segment : undefined });
    } catch {
      saveSetupDraft(d);
      setError('Không tạo được hành trình. Thử lại nhé.');
      setPending(false);
    }
  };
  return (
    <main className="page setup2">
      <div className="setup-card">
        <div className="setup-top">
          <button className="icon-btn" onClick={() => set({ screen: 'create' })} aria-label="Quay lại" disabled={pending}><Icon name="back" size={20} /></button>
          <h1>Chọn chế độ</h1>
          <span className="setup-name">{d.character.name}</span>
        </div>
        <div className="mode-row" role="radiogroup" aria-label="Chế độ">
          {MODES.map((m) => (
            <button key={m.id} role="radio" aria-checked={d.mode === m.id} className={`mode-card ${d.mode === m.id ? 'on' : ''}`}
              onClick={() => upd({ mode: m.id, presetId })}>
              <Icon name={m.icon} size={30} />
              <b>{m.title}</b>
              <span>{m.desc}</span>
            </button>
          ))}
        </div>
        <div className={`sentence-row ${custody ? '' : 'off'}`} role="radiogroup" aria-label="Mức án" aria-disabled={!custody}>
          {QUICK_PRESETS.map((id) => (
            <button key={id} role="radio" aria-checked={custody && presetId === id} disabled={!custody} className={`chip ${custody && presetId === id ? 'on' : ''}`}
              onClick={() => upd({ presetId: id, segment: d.segment === 'shu' ? 'shu' : 'intake' })}>{PRESET_BY_ID[id].label}</button>
          ))}
        </div>
        <div className={`sentence-row ${custody ? '' : 'off'}`} role="radiogroup" aria-label="Điểm bắt đầu" aria-disabled={!custody}>
          {(['intake', 'shu'] as StartSegment[]).map((seg) => (
            <button key={seg} role="radio" aria-checked={custody && d.segment === seg} disabled={!custody} className={`chip ${seg === 'shu' ? 'chip-shu' : ''} ${custody && (d.segment === seg || (seg === 'intake' && d.segment !== 'shu')) ? 'on' : ''}`}
              onClick={() => upd({ segment: seg })}>{seg === 'shu' ? '⛓ Biệt giam SHU' : 'Tiếp nhận thường'}</button>
          ))}
        </div>
        {custody && d.segment === 'shu' && <p className="shu-warn" role="note"><b>⛓ Khắc nghiệt</b> · {SEGMENT_INFO.shu.desc}{PRESET_BY_ID[presetId].kind === 'life' ? ' · Chung thân: xét lại mỗi 5 ngày' : ''}</p>}
        {error && <p className="setup-err" role="alert">{error}</p>}
        <div className="setup-actions">
          <button className="btn" onClick={random} disabled={pending}><Icon name="dice" size={18} /> Ngẫu nhiên</button>
          <button className="btn primary big" onClick={start} disabled={pending}>{pending ? 'Đang vào...' : 'Bắt đầu'}</button>
        </div>
      </div>
    </main>
  );
}


// ======================= HUD chip =======================
/** Mốc thay đổi tiếp theo: lệnh (kỷ luật/bố trí riêng) ưu tiên hơn lịch nhóm. */
function nextChange(s: NonNullable<typeof controller.s>): { label: string; at: number; text: string } {
  if (shuOrder(s) && s.custody!.shu) { const nx = shuNextWindow(s); return { label: nx.label, at: nx.at, text: `${nx.label} ${fmtDayClock(nx.at)}` }; }
  const o = s.custody!.orders.find((x) => x.state === 'active' && (x.kind === 'discipline_confinement' || x.kind === 'separation'));
  if (o) {
    const at = o.endMinute ?? o.reviewAtMinute;
    const label = o.endMinute ? `${orderKindLabel(o.kind)} hết hiệu lực` : 'Xem xét lại bố trí riêng';
    return { label, at: at ?? s.minute, text: at ? `${label} ${fmtDayClock(at)}` : 'Theo quyết định' };
  }
  const nx = nextWindow(s);
  return { label: nx.label, at: nx.at, text: `${nx.label} ${fmtClock(nx.at)}` };
}

export function custodyHud() {
  const s = controller.s;
  if (!s || !isVN(s)) return null;
  const c = s.custody!;
  const room = homeRoom(s);
  return { phase: PHASE_LABEL[c.phase], confined: isConfinedPhase(c.phase), room: room?.label ?? 'Chưa bố trí', group: currentGroup(s), next: nextChange(s).text, window: windowAt(s).label };
}

export function CustodyHudLine() {
  useUI((s) => s.rev); useUI((s) => s.hud?.clock);
  const h = custodyHud();
  if (!h) return null;
  return (
    <button className="custody-line small" style={{ pointerEvents: 'auto' }} onClick={() => useUI.getState().open(h.confined ? 'incell' : 'custody')} aria-label={`Chế độ: ${h.phase}. ${h.confined ? 'Mở sinh hoạt tại buồng' : 'Mở hồ sơ chế độ'}`}>
      <span className={`ph ${h.confined ? 'conf' : 'act'}`}>{h.phase}</span> {h.room} · Tiếp: {h.next}
    </button>
  );
}

// ======================= U37 — gọn: Tổng quan / Lịch / Quyết định =======================
type CTab = 'record' | 'schedule' | 'decisions';
export function CustodyPanel() {
  useUI((s) => s.rev);
  const [tab, setTab] = useState<CTab>('record');
  const close = () => useUI.getState().open(null);
  const s = controller.s;
  if (!s || !isVN(s)) return <Panel title="Chế độ" onClose={close}><Empty>Không áp dụng ở chế độ này.</Empty></Panel>;
  const c = s.custody!;
  const pr = progress(s);
  const room = homeRoom(s);
  const g = currentGroup(s) === 'B' ? 'B' : 'A';
  const active = c.orders.filter((o) => o.state === 'active');
  const zones = allowedZones(s);
  return (
    <Panel title="Chế độ thụ án" onClose={close} width="mid" tabs={<Tabs label="Chế độ" value={tab} onChange={setTab} tabs={[{ id: 'record', label: 'Tổng quan' }, { id: 'schedule', label: 'Lịch' }, { id: 'decisions', label: 'Quyết định', badge: active.length || undefined }]} />}>
      {tab === 'record' && <>
        <ShuCard />
        <div className="stat-grid">
          <div className="stat"><span>Mức án</span><b>{sentenceLabel(c.judgment)}</b></div>
          <div className="stat"><span>Còn lại</span><b>{pr.remainingDays === null ? '—' : `${pr.remainingDays} ngày`}</b></div>
          <div className="stat"><span>Buồng</span><b>{room?.label.replace(/^Buồng /, '') ?? '—'}</b></div>
          <div className="stat"><span>Nhóm</span><b>{g}</b></div>
        </div>
        <p className="small"><span className={`ph ${isConfinedPhase(c.phase) ? 'conf' : 'act'}`}>{PHASE_LABEL[c.phase]}</span> · Tiếp: {nextChange(s).text}</p>
        <p className="small muted">Được tới: {zones.size ? [...zones].map((z) => ZONE_BY_ID[z].name).join(', ') : 'chỉ trong buồng'}</p>
      </>}
      {tab === 'schedule' && c.shu && shuOrder(s) && (
        <table className="tbl small sched"><tbody>
          {SHU_SCHEDULE.map((w) => { const ok = shuWindowApplies(w, c.shu!.level, dayOf(s.minute)); return <tr key={w.from} className={shuWindowAt(s.minute).from === w.from ? 'current' : ''} style={ok ? undefined : { opacity: 0.45 }}><td>{fmtClock(w.from)}–{fmtClock(w.to % 1440)}</td><td>{w.label}{!ok && w.minLevel > c.shu!.level ? `· từ cấp ${w.minLevel}` : !ok ? ' · không phải hôm nay' : ''}</td></tr>; })}
        </tbody></table>
      )}
      {tab === 'schedule' && !(c.shu && shuOrder(s)) && (
        <table className="tbl small sched"><tbody>
          {CUSTODY_SCHEDULE[g].map((w) => <tr key={w.from} className={windowAt(s).from === w.from ? 'current' : ''}><td>{fmtClock(w.from)}–{fmtClock(w.to % 1440)}</td><td>{w.label}</td></tr>)}
        </tbody></table>
      )}
      {tab === 'decisions' && <>
        <ConflictReports />
        {!c.orders.length && <Empty>Không có quyết định nào.</Empty>}
        {c.orders.slice().reverse().map((o) => (
          <div key={o.orderId} className="order-row">
            <b>{orderKindLabel(o.kind)}</b>
            <span className="small muted">{o.endMinute ? `đến ${fmtDayClock(o.endMinute)}` : o.reviewAtMinute ? `xem lại ${fmtDayClock(o.reviewAtMinute)}` : ''}</span>
            <Status kind={o.state === 'active' ? 'warn' : 'ok'}>{o.state === 'active' ? 'Hiệu lực' : 'Đã xong'}</Status>
          </div>
        ))}
        {active.length > 0 && <button className="btn sm" onClick={() => controller.openScreen('incidents')}>Xin xem xét lại</button>}
      </>}
    </Panel>
  );
}

// ======================= U38 — sinh hoạt tại buồng =======================
export function InCellPanel() {
  useUI((s) => s.rev); useUI((s) => s.hud?.clock);
  const close = () => useUI.getState().open(null);
  const s = controller.s;
  if (!s || !isVN(s)) return null;
  const c = s.custody!;
  const room = homeRoom(s);
  const nx = nextChange(s);
  const sess = controller.session!;
  const skipTo = (abs: number) => {
    const mins = Math.max(0, Math.min(abs - s.minute, 12 * 60));
    if (!mins) return;
    sess.fastForward(mins, false);
    controller.bump();
  };
  const shu = !!(shuOrder(s) && c.shu);
  const win = shu ? shuNextWindow(s) : nextWindow(s);
  const workout = { icon: 'energy', label: 'Tập tại buồng', go: () => { controller.exec((ctx) => { ctx.s.needs.energy = Math.max(0, ctx.s.needs.energy - 6); ctx.s.needs.mood = Math.min(100, ctx.s.needs.mood + 4); ctx.s.needCauses.mood = 'Hít đất, gập bụng trong buồng'; return true; }); skipTo(s.minute + 30); } };
  const acts: { icon: string; label: string; go: () => void }[] = shu ? [
    ...(c.shu!.level >= 2 ? [{ icon: 'book', label: 'Xe sách', go: () => { close(); controller.openScreen('library'); } }] : []),
    workout,
    { icon: 'energy', label: 'Nghỉ 1 giờ', go: () => { controller.exec((ctx) => { ctx.s.needs.energy = Math.min(100, ctx.s.needs.energy + 8); ctx.s.needCauses.energy = 'Nghỉ trên bệ nằm'; return true; }); skipTo(s.minute + 60); } },
    { icon: 'talk', label: 'Viết thư', go: () => controller.openScreen('contacts') },
    { icon: 'hand', label: 'Yêu cầu', go: () => controller.openScreen('cases') },
    { icon: 'user', label: 'Y tế tại buồng', go: () => controller.openScreen('support') },
    { icon: 'quest', label: 'Cấp SHU', go: () => useUI.getState().open('custody') },
  ] : [
    { icon: 'book', label: 'Đọc sách', go: () => { close(); controller.openScreen('library'); } },
    { icon: 'energy', label: 'Nghỉ 1 giờ', go: () => { controller.exec((ctx) => { ctx.s.needs.energy = Math.min(100, ctx.s.needs.energy + 8); ctx.s.needCauses.energy = 'Nghỉ tại buồng'; return true; }); skipTo(s.minute + 60); } },
    { icon: 'talk', label: 'Viết thư', go: () => controller.openScreen('contacts') },
    { icon: 'hand', label: 'Yêu cầu', go: () => controller.openScreen('cases') },
    { icon: 'user', label: 'Y tế', go: () => controller.openScreen('support') },
    { icon: 'quest', label: 'Quyết định', go: () => useUI.getState().open('custody') },
  ];
  return (
    <Panel title={room?.label ?? 'Buồng'} onClose={close} width="narrow">
      <p className="small"><span className={`ph ${isConfinedPhase(c.phase) ? 'conf' : 'act'}`}>{PHASE_LABEL[c.phase]}</span> · Tiếp: {nx.text}</p>
      <div className="incell-grid">
        {acts.map((a) => <button key={a.label} className="qm-item" onClick={a.go}><span className="qm-ico"><Icon name={a.icon} size={24} /></span><span>{a.label}</span></button>)}
      </div>
      <div className="row">
        <button className="btn primary" onClick={() => skipTo(win.at)}>Tua đến {fmtClock(win.at)}</button>
        <span className="spacer" />
        <button className="btn ghost" onClick={close}>Đóng</button>
      </div>
    </Panel>
  );
}

// ======================= Release tab card (F70) =======================
export function VnChapterCard() {
  useUI((s) => s.rev);
  const s = controller.s;
  if (!s || !isVN(s)) return null;
  const c = s.custody!;
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <h3>Chương 1</h3>
      <p className="small muted">Kết thúc chương không phải mãn hạn — bạn vẫn tiếp tục thụ án.</p>
      {c.chapter.state !== 'active' ? <Status kind="ok">Đã kết thúc chương</Status>
        : <button className="btn primary" disabled={!chapterEligible(s)} onClick={() => {
          const r = controller.exec<{ ok: boolean; message: string }>((ctx) => closeChapter(ctx));
          useUI.getState().toast({ id: 'chapter', text: r?.message ?? '', severity: r?.ok ? 'success' : 'warning' });
        }}>{chapterEligible(s) ? 'Kết thúc chương' : 'Mở vào ngày 7'}</button>}
    </div>
  );
}

// ======================= SHU — thẻ cấp step-down =======================
export function ShuCard() {
  useUI((s) => s.rev);
  const s = controller.s;
  const o = s ? shuOrder(s) : null;
  const sh = s?.custody?.shu;
  if (!s || !o || !sh) return null;
  const lv = SHU_LEVELS[sh.level - 1];
  const daysIn = Math.floor((s.minute - sh.levelSinceMinute) / 1440);
  const pct = sh.level === 3 && o.endMinute === null ? Math.min(100, (daysIn / lv.days) * 100) : Math.min(100, (daysIn / lv.days) * 100);
  return (
    <div className="shu-card" role="group" aria-label="Biệt giam SHU">
      <div className="shu-head"><span className="shu-tag">SHU</span><b>{lv.title}</b><span className="small muted">Ngày {daysIn + 1}/{lv.days} ở cấp này</span></div>
      <div className="shu-steps" aria-hidden>{SHU_LEVELS.map((l) => <i key={l.level} className={l.level < sh.level ? 'done' : l.level === sh.level ? 'cur' : ''}><span>{l.level}</span></i>)}</div>
      <div className="ld-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Tiến độ cấp hiện tại"><i style={{ width: `${Math.max(4, pct)}%` }} /></div>
      <ul className="shu-priv small">{lv.privileges.map((p) => <li key={p}>{p}</li>)}</ul>
      <p className="small muted">{o.endMinute !== null ? `Dự kiến chuyển về khu thường: ${fmtDayClock(o.endMinute)}` : `Chung thân — xét lại định kỳ: ${o.reviewAtMinute ? fmtDayClock(o.reviewAtMinute) : '—'}`}{sh.setbacks ? ` · Đã bị hạ cấp ${sh.setbacks} lần` : ''}</p>
    </div>
  );
}