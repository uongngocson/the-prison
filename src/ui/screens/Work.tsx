// CR-LAB-01 UI (19): U39 bảng công việc, U40/U41 station, U42 bàn mộc, U43 dụng cụ, U44 bàn giao & tổng kết.
// Số liệu/nhãn đọc từ domain revision; nút chỉ gọi lệnh domain (không tự cấp quyền tới station).
import { useState } from 'react';
import { useUI } from '../store';
import { Panel, Empty } from '../components';
import { Icon } from '../icons';
import { controller } from '../../app/controller';
import { useSettings } from '../settings';
import type { GameState, LabourAssignment } from '../../domain/types';
import {
  acceptWork, cancelWork, currentAssignment, fmtQty, handover, issueKit, offers, orderOf, readOrientation, spotDirty, stepIndex, windowOf, workOf,
  type HandoverSummary,
} from '../../domain/labour';
import {
  CLEAN_SPOTS, CROP, DESTINATION, PATCH_STATE_LABEL, PLOT_GROWTH, PLOT_STAGE_LABEL, POND_FEEDS_PER_DAY, POND_STAGE_LABEL, QC_CRITERIA, SHIFT_WINDOWS, TOOL_TYPES,
  TRAY_PATTERN, UNAVAILABLE_WORKS, WOOD_STAGE_LABEL, WORKS, WORK_BY_ID, type WorkId,
} from '../../content/labour';
import { PROP_BY_ID, ZONE_BY_ID } from '../../content/world';
import { WEEKDAY_LABEL, dayOf, dayOfWeek, fmtClock, fmtMoney } from '../../domain/util';

const close = () => useUI.getState().open(null);
const go = (view: string, extra: Record<string, string> = {}) => useUI.getState().open('work', { view, ...extra });
const toast = (text: string, ok = true) => useUI.getState().toast({ id: `w_${Date.now()}`, text, severity: ok ? 'success' : 'warning' });
const KIND_LABEL = { production: 'Sản xuất', vocational: 'Học nghề', service: 'Phục vụ chung' } as const;
const WORK_ICON: Record<WorkId, string> = { W01: 'leaf', W05: 'fish', W06: 'flower', W08: 'saw', W15: 'broom' };

export function WorkPanel() {
  useUI((s) => s.rev);
  const params = useUI((s) => s.overlayParams);
  const s = controller.s;
  if (!s?.labour) return null;
  const view = params.view ?? 'hub';
  if (view === 'tools') return <ToolsView s={s} />;
  if (view === 'handover') return <HandoverView s={s} />;
  if (view === 'wood') return <WoodView s={s} />;
  if (view === 'station') return <StationView s={s} target={params.target ?? ''} />;
  return <HubView s={s} />;
}

/** Dòng phụ dưới tiêu đề panel (tiêu đề chính đã ở thanh panel — không lặp lại). */
function Head({ sub }: { title?: string; sub: string }) {
  return <header className="wk-head"><p>{sub}</p></header>;
}
function Chip({ tone, children }: { tone: 'ok' | 'info' | 'warn' | 'accent' | 'muted'; children: React.ReactNode }) {
  return <span className={`wk-chip ${tone}`}>{children}</span>;
}
function Steps({ items, current }: { items: { label: string; done: boolean }[]; current: number }) {
  return (
    <ol className="wk-steps">
      {items.map((it, i) => (
        <li key={i} className={it.done ? 'done' : i === current ? 'cur' : ''} aria-current={i === current ? 'step' : undefined}>
          <span className="wk-num">{it.done ? <Icon name="check" size={14} /> : String(i + 1).padStart(2, '0')}</span><span>{it.label}</span>
        </li>
      ))}
    </ol>
  );
}
function shiftSteps(a: LabourAssignment) {
  const w = workOf(a);
  const idx = stepIndex(a);
  return { idx, items: w.stepLabels.map((label, i) => ({ label: i === 2 ? `${label} (${a.tasks.filter((t) => t.done).length}/${a.tasks.length})` : label, done: i < idx })) };
}
function nextHint(s: GameState, a: LabourAssignment): string {
  const w = workOf(a);
  const i = stepIndex(a);
  if (i === 0) return s.minute < a.start - 45 ? `Nhận dụng cụ từ ${fmtClock(a.start - 45)} tại Kho & kiểm nhận.` : 'Đến Kho & kiểm nhận (L27) để nhận bộ dụng cụ.';
  if (i === 1) return s.minute < a.start ? `Ca bắt đầu ${fmtClock(a.start)} tại ${ZONE_BY_ID[w.zone].name}.` : `Đến ${ZONE_BY_ID[w.zone].name} để bắt đầu.`;
  if (i === 2) return `Việc tiếp theo: ${a.tasks.find((t) => !t.done)?.label}.`;
  if (i === 3) return 'Mang dụng cụ về điểm cân & kiểm nhận (L27) để bàn giao.';
  return 'Ca đã được ghi nhận.';
}

// ======================= U39 =======================
function HubView({ s }: { s: GameState }) {
  const [sel, setSel] = useState<WorkId | null>(null);
  const [win, setWin] = useState<string>('');
  const cur = currentAssignment(s);
  const all = offers(s);
  const today = dayOf(s.minute);
  const recent = s.labour!.receipts.slice(-3).reverse();
  return (
    <Panel title="Công việc và phân công" onClose={close}>
      <div className="wk">
        <Head title="Công việc và phân công" sub={`Ca hôm nay · ${WEEKDAY_LABEL[dayOfWeek(s.minute)]}, ngày ${today}`} />
        <div className={`wk-grid ${sel ? 'has-sel' : ''}`}>
          <div className="wk-cards" role="list">
            {WORKS.map((w, i) => {
              const mine = cur && cur.workId === w.id;
              const open = all.filter((o) => o.work.id === w.id && !o.reason);
              const tone = mine ? 'ok' : open.length ? 'accent' : 'info';
              const label = mine ? (cur.state === 'active' ? 'Đang làm' : 'Đã phân công') : open.length ? 'Có lịch phù hợp' : 'Xem điều kiện';
              return (
                <button key={w.id} role="listitem" className={`wk-card ${sel === w.id ? 'on' : ''}`} onClick={() => { setSel(w.id); setWin(''); }} aria-label={`${w.title}. ${label}`}>
                  <span className="wk-badge">{i + 1}</span>
                  <span className="wk-card-title"><Icon name={WORK_ICON[w.id]} size={20} /> {w.title}</span>
                  <span className="wk-card-line">{w.short}</span>
                  <span className="wk-card-sub">{mine ? `${fmtClock(cur.start)} – ${fmtClock(cur.end)}` : `${KIND_LABEL[w.kind]} · ${ZONE_BY_ID[w.zone].name}`}</span>
                  <Chip tone={tone}>{label}</Chip>
                </button>
              );
            })}
          </div>
          <aside className="wk-side">
            {sel ? <Detail s={s} id={sel} win={win} setWin={setWin} back={() => setSel(null)} /> : cur ? <Assigned s={s} a={cur} /> : (
              <div className="wk-empty">
                <span className="wk-label">Ca đang được giao</span>
                <p className="wk-big">Chưa có ca</p>
                <p className="wk-muted">Chọn một công việc bên trái để xem giờ, nơi làm và nhận phân công.</p>
              </div>
            )}
          </aside>
        </div>
        <section className="wk-later">
          <span className="wk-label">Nghề chưa mở</span>
          <div className="wk-later-list">{UNAVAILABLE_WORKS.map((u) => <span key={u.id} className="wk-later-item"><b>{u.title}</b><em>{u.reason}</em></span>)}</div>
        </section>
        {recent.length > 0 && <section className="wk-receipts"><span className="wk-label">Phiếu gần nhất</span>{recent.map((r) => <p key={r.id}><span>{fmtClock(r.minute)}</span>{r.text}</p>)}</section>}
      </div>
    </Panel>
  );
}

function Assigned({ s, a }: { s: GameState; a: LabourAssignment }) {
  const w = workOf(a);
  const { idx, items } = shiftSteps(a);
  const where = idx === 0 || idx === 3 ? 'L27' : w.zone;
  return (
    <div className="wk-assigned">
      <span className="wk-label">Ca đang được giao</span>
      <p className="wk-big">{w.title} · {windowOf(a.window).label}</p>
      <p className="wk-muted">{fmtClock(a.start)} – {fmtClock(a.end)} · {targetLabel(s, a)}</p>
      <Steps items={items} current={idx} />
      <p className="wk-hint">{nextHint(s, a)}</p>
      <div className="wk-actions">
        <button className="btn primary big" onClick={() => { useUI.getState().set({ waypoint: where, overlay: null }); }}>Chỉ đường tới {ZONE_BY_ID[where].name}</button>
        {a.state === 'assigned' && !a.kitIssued && <button className="btn" onClick={() => { const r = controller.exec<{ ok: boolean; message: string }>((c) => cancelWork(c, a.id)); if (r) toast(r.message, r.ok); }}>Yêu cầu đổi việc</button>}
      </div>
    </div>
  );
}
function targetLabel(s: GameState, a: LabourAssignment) {
  if (a.workId === 'W01') return `Luống ${a.target}`;
  if (a.workId === 'W05') return `Ao ${a.target}`;
  if (a.workId === 'W06') return `Ô ${a.target}`;
  if (a.workId === 'W08') return `Lệnh ${a.target} · ${TRAY_PATTERN.label}`;
  return 'Sân sinh hoạt';
}

function Detail({ s, id, win, setWin, back }: { s: GameState; id: WorkId; win: string; setWin: (v: string) => void; back: () => void }) {
  const w = WORK_BY_ID[id];
  const slots = offers(s).filter((o) => o.work.id === id);
  const chosen = slots.find((o) => `${o.day}:${o.win.id}` === win) ?? slots.find((o) => !o.reason);
  const needOrientation = w.orientation && !s.labour!.orientation[id];
  const accept = () => {
    if (!chosen) return;
    const r = controller.exec<{ ok: boolean; message: string }>((c) => acceptWork(c, id, chosen.win.id, chosen.day));
    if (r) toast(r.message, r.ok);
    if (r?.ok) back();
  };
  return (
    <div className="wk-detail">
      <button className="wk-back" onClick={back}><Icon name="back" size={16} /> Danh sách</button>
      <span className="wk-label">{KIND_LABEL[w.kind]}</span>
      <p className="wk-big">{w.title}</p>
      <p className="wk-muted">{w.short} · {ZONE_BY_ID[w.zone].name}</p>
      <div className="wk-kv"><span>Dụng cụ</span><b>{w.kit.map((k) => TOOL_TYPES[k].label).join(', ')}</b></div>
      {w.material && <div className="wk-kv"><span>Vật tư</span><b>{w.material.label}</b></div>}
      <div className="wk-kv"><span>Ghi nhận</span><b>{fmtMoney(w.credit)} khi hoàn tất</b></div>
      <div className="wk-kv"><span>Hỗ trợ</span><b>{w.support}</b></div>
      {needOrientation ? (
        <div className="wk-orient">
          <b>Hướng dẫn an toàn</b><p>{w.orientation}</p>
          <button className="btn" onClick={() => controller.exec((c) => readOrientation(c, id))}>Tôi đã đọc</button>
        </div>
      ) : <>
        <span className="wk-label" style={{ marginTop: 6 }}>Chọn ca</span>
        <div className="wk-slots" role="radiogroup" aria-label="Chọn ca">
          {slots.map((o) => {
            const key = `${o.day}:${o.win.id}`;
            const on = chosen && `${chosen.day}:${chosen.win.id}` === key;
            return (
              <button key={key} role="radio" aria-checked={!!on} disabled={!!o.reason} className={`wk-slot ${on ? 'on' : ''}`} onClick={() => setWin(key)} title={o.reason ?? undefined}>
                <b>{o.day === dayOf(s.minute) ? 'Hôm nay' : 'Ngày mai'} · {o.win.label}</b><span>{fmtClock(o.start)} – {fmtClock(o.start + o.win.to - o.win.from)}</span>
                {o.reason && <em>{o.reason}</em>}
              </button>
            );
          })}
          {!slots.length && <Empty>Hết ca trong hôm nay và ngày mai.</Empty>}
        </div>
      </>}
      <div className="wk-actions">
        <button className="btn primary big" disabled={!chosen || !!needOrientation} onClick={accept}>Nhận phân công</button>
      </div>
    </div>
  );
}

// ======================= U40/U41 station detail =======================
function StationView({ s, target }: { s: GameState; target: string }) {
  const p = PROP_BY_ID[target];
  const l = s.labour!;
  const a = currentAssignment(s);
  let title = 'Khu lao động', sub = '', chip = '', tone: 'ok' | 'info' | 'warn' = 'info', stages: { label: string; done: boolean }[] = [], cur = 0, facts: [string, string][] = [];
  if (p?.kind === 'garden_bed') {
    const plot = l.plots.find((x) => x.id === p.meta?.plot)!;
    const order = ['empty', 'prepared', 'sown', 'seedling', 'growing', 'ready', 'harvested'] as const;
    cur = order.indexOf(plot.stage);
    title = 'Vườn rau'; sub = `Luống ${plot.id} · ${CROP.label} · vụ ${plot.cycleNo}`; chip = `Luống ${plot.id} · ${PLOT_STAGE_LABEL[plot.stage]}`; tone = plot.stage === 'ready' ? 'ok' : 'info';
    stages = ['Làm đất', 'Gieo', 'Cây con', 'Đang lớn', 'Thu hoạch'].map((label, i) => ({ label, done: [1, 2, 3, 4, 5][i] < cur || (i === 4 && cur === 6) }));
    const g = PLOT_GROWTH[plot.stage];
    const dry = s.minute - plot.lastWatered;
    facts = [
      ['Giai đoạn', PLOT_STAGE_LABEL[plot.stage]],
      ['Độ ẩm', !['sown', 'seedling', 'growing', 'prepared'].includes(plot.stage) ? '—' : dry < 8 * 60 ? 'Đủ ẩm' : dry < 26 * 60 ? 'Nên tưới trong ca' : 'Khô — cây tạm ngừng lớn'],
      ['Mốc tiếp theo', g ? `${PLOT_STAGE_LABEL[g.next]} sau ~${Math.max(1, Math.round((g.minutes - plot.growthMin) / 60))} giờ được tưới đủ` : plot.stage === 'ready' ? 'Có thể thu hoạch' : '—'],
      ['Người chăm gần nhất', plot.caretaker === 'player' ? 'Bạn' : plot.caretaker === 'team' ? 'Tổ vườn' : '—'],
      ['Nơi nhận sản phẩm', DESTINATION.veg],
    ];
  } else if (p && ['pond', 'pond_dock', 'feed_station'].includes(p.kind)) {
    const pond = l.pond;
    title = 'Ao cá'; sub = `Ao ${pond.id} · lứa ${pond.cohortNo} · theo kế hoạch được giao`; chip = `Ao ${pond.id} · ${POND_STAGE_LABEL[pond.stage]}`; tone = 'info';
    const day = Math.floor((s.minute - pond.stockedMinute) / 1440) + 1;
    facts = [
      ['Giai đoạn', `${POND_STAGE_LABEL[pond.stage]}${pond.stage === 'growing' ? ` · ngày nuôi ${day}` : ''}`],
      ['Quan sát gần nhất', pond.lastObservation === 'normal' ? 'Bình thường' : pond.lastObservation === 'check' ? 'Cần kiểm tra — đã báo cán bộ' : 'Chưa có'],
      ['Phần ăn hôm nay', `${pond.feedDay === dayOf(s.minute) ? pond.feeds : 0}/${POND_FEEDS_PER_DAY} phần`],
      ['Lịch thu', pond.stage === 'harvest_ready' ? 'Đến kỳ — cần lệnh thu trong ca' : 'Theo kế hoạch tổ'],
      ['Nơi nhận sản phẩm', DESTINATION.fish],
    ];
    stages = [{ label: 'Quan sát ao', done: false }, { label: 'Nhận phần thức ăn', done: false }, { label: 'Chăm theo kế hoạch', done: false }, { label: 'Ghi nhận / báo hỗ trợ', done: false }];
  } else if (p?.kind === 'flower_patch' || p?.kind === 'nursery_bench') {
    const patch = p.kind === 'flower_patch' ? l.patches.find((x) => x.id === p.meta?.patch)! : null;
    title = 'Vườn ươm & cảnh quan'; sub = patch ? `Ô ${patch.id} · trồng hoa theo mẫu` : `Bàn ươm · ${l.nurseryTrays} khay giống sẵn`; chip = patch ? `Ô ${patch.id} · ${PATCH_STATE_LABEL[patch.state]}` : `${l.nurseryTrays} khay sẵn sàng`;
    const order = ['need_care', 'weeded', 'planted', 'awaiting_check', 'accepted'];
    cur = patch ? order.indexOf(patch.state) : 0;
    stages = ['Làm cỏ, tỉa gọn', 'Trồng hoa theo mẫu', 'Gom phế liệu', 'Nghiệm thu'].map((label, i) => ({ label, done: i < cur }));
    facts = patch ? [['Trạng thái', PATCH_STATE_LABEL[patch.state]], ['Khay giống tại bàn ươm', `${l.nurseryTrays} khay`], ['Trước / sau', patch.state === 'need_care' ? 'Đang có cỏ dại' : 'Đã gọn, có hoa theo mẫu']] : [['Khay giống', `${l.nurseryTrays} khay`], ['Nguồn khay', 'Khay gỗ từ xưởng mộc sau nghiệm thu']];
  }
  const mine = a && ((p?.kind === 'garden_bed' && a.target === p.meta?.plot) || (a.workId === 'W05' && p && ['pond', 'pond_dock', 'feed_station'].includes(p.kind)) || (p?.kind === 'flower_patch' && a.target === p.meta?.patch));
  return (
    <Panel title={title} onClose={close}>
      <div className="wk">
        <Head title={title} sub={sub} />
        <div className="wk-grid">
          <div className={`wk-scene ${p?.kind === 'garden_bed' ? 'soil' : p && ['pond', 'pond_dock', 'feed_station'].includes(p.kind) ? 'water' : 'garden'}`}>
            <Chip tone={tone}>{chip}</Chip>
            <div className="wk-facts">{facts.map(([k, v]) => <div key={k} className="wk-kv"><span>{k}</span><b>{v}</b></div>)}</div>
            {stages.length > 0 && <div className="wk-stagebar" aria-label="Giai đoạn">{stages.map((st, i) => <span key={i} className={st.done ? 'done' : i === cur ? 'cur' : ''}>{st.label}</span>)}</div>}
          </div>
          <aside className="wk-side">
            <span className="wk-label">Việc trong ca</span>
            {mine && a ? <>
              <Steps items={a.tasks.map((t) => ({ label: t.label, done: t.done }))} current={a.tasks.findIndex((t) => !t.done)} />
              <p className="wk-muted">Ca kết thúc: {fmtClock(a.end)}</p>
              <p className="wk-hint">Đứng gần và nhấn {useSettings.getState().s.controls.touchMode === 'on' ? 'nút bàn tay' : 'E'} để làm việc tiếp theo.</p>
            </> : <p className="wk-muted">{a ? `Bạn đang có ca ${workOf(a).title}.` : 'Chưa có ca tại đây. Xem Bảng công việc để nhận phân công.'}</p>}
            <div className="wk-actions">
              <button className="btn primary big" onClick={close}>Tiếp tục công việc</button>
              <button className="btn" onClick={() => controller.openScreen('cases')}>Nhờ hỗ trợ</button>
              <button className="btn ghost" onClick={() => go('hub')}>Bảng công việc</button>
            </div>
          </aside>
        </div>
      </div>
    </Panel>
  );
}

// ======================= U42 bàn mộc =======================
function WoodView({ s }: { s: GameState }) {
  const a = currentAssignment(s);
  const assist = useSettings((st) => st.s.access.autoComplete);
  const [measure, setMeasure] = useState<string>(assist ? 'a' : '');
  const [assemble, setAssemble] = useState<string>(assist ? 'a' : '');
  const o = a && a.workId === 'W08' ? orderOf(s, a) : null;
  const run = (verb: string, params: Record<string, string> = {}) => {
    const r = controller.session!.interact('wood_bench', verb, params);
    if (!r.ok) toast(r.message ?? 'Chưa thể làm bước này.', false); else close();
    controller.bump();
  };
  const stage = o?.stage ?? 'brief';
  const order = ['blank', 'marked', 'assembled', 'finished'];
  const cur = Math.max(0, order.indexOf(stage));
  return (
    <Panel title="Xưởng mộc" onClose={close}>
      <div className="wk">
        <Head title="Xưởng mộc" sub={o ? `Bàn M-03 · ${TRAY_PATTERN.label} · Đồ dùng cho vườn ươm` : 'Bàn M-03 · chưa có lệnh'} />
        <div className="wk-grid">
          <div className="wk-scene wood">
            <Chip tone="ok">{o ? `${o.id} · ${WOOD_STAGE_LABEL[stage]}` : 'Bàn M-03'}</Chip>
            {!o ? <p className="wk-muted">Nhận ca Xưởng mộc ở Bảng công việc rồi nhận phôi tại kho.</p> : <>
              <div className="wk-pattern">
                <div className="wk-tray" aria-hidden><i /><i /><i /><i /></div>
                <div><b>{TRAY_PATTERN.label}</b><p>Đáy 40 × 30 cm · thành cao 8 cm · 4 thành, ghép thành dài trước.</p></div>
              </div>
              {o.failed.length > 0 && <p className="wk-warn">Cần làm lại: {o.failed.join(', ')}.</p>}
              {stage === 'blank' && <fieldset className="wk-choice"><legend>Đo & đánh dấu theo mẫu</legend>
                {TRAY_PATTERN.measure.map((m) => <label key={m.id} className={measure === m.id ? 'on' : ''}><input type="radio" name="measure" checked={measure === m.id} onChange={() => setMeasure(m.id)} />{m.text}{assist && m.ok && <em>Gợi ý</em>}</label>)}
              </fieldset>}
              {stage === 'marked' && <fieldset className="wk-choice"><legend>Thứ tự ghép</legend>
                {TRAY_PATTERN.assemble.map((m) => <label key={m.id} className={assemble === m.id ? 'on' : ''}><input type="radio" name="assemble" checked={assemble === m.id} onChange={() => setAssemble(m.id)} />{m.text}{assist && m.ok && <em>Gợi ý</em>}</label>)}
              </fieldset>}
              {stage === 'finished' && <p className="wk-hint">Khay đã hoàn thiện — mang tới điểm cân & kiểm nhận (L27). Tiêu chí: {QC_CRITERIA.join(' · ')}.</p>}
            </>}
            <p className="wk-caption"><b>Phôi → ghép → hoàn thiện → kiểm nhận</b><br />Thao tác được giản lược, có phương thức hỗ trợ.</p>
          </div>
          <aside className="wk-side">
            <span className="wk-label">Việc trong ca</span>
            <Steps items={['Đọc mẫu / nhận phôi', 'Đo và đánh dấu', 'Ghép / hoàn thiện', 'Gửi kiểm nhận'].map((label, i) => ({ label, done: o ? i <= cur && (i === 0 ? stage !== 'brief' : i === 1 ? cur >= 1 : i === 2 ? cur >= 3 : stage === 'accepted') : false }))} current={o ? Math.min(3, cur + 1) : 0} />
            {a && <p className="wk-muted">Ca kết thúc: {fmtClock(a.end)}</p>}
            <div className="wk-actions">
              {stage === 'blank' && <button className="btn primary big" disabled={!measure} onClick={() => run('lab_measure', { choice: measure })}>Đo & đánh dấu</button>}
              {stage === 'marked' && <button className="btn primary big" disabled={!assemble} onClick={() => run('lab_assemble', { choice: assemble })}>Ghép khay</button>}
              {stage === 'assembled' && <button className="btn primary big" onClick={() => run('lab_finish')}>Chà nhám hoàn thiện</button>}
              {(stage === 'finished' || !o || stage === 'brief') && <button className="btn primary big" onClick={() => { useUI.getState().set({ waypoint: 'L27', overlay: null }); }}>{stage === 'finished' ? 'Tới điểm kiểm nhận' : 'Tới kho nhận phôi'}</button>}
              <button className="btn" onClick={() => controller.openScreen('cases')}>Nhờ hỗ trợ</button>
            </div>
          </aside>
        </div>
      </div>
    </Panel>
  );
}

// ======================= U43 dụng cụ =======================
function ToolsView({ s }: { s: GameState }) {
  const l = s.labour!;
  const a = currentAssignment(s);
  if (!a) return (
    <Panel title="Dụng cụ và vật tư" onClose={close}><div className="wk"><Head title="Dụng cụ và vật tư" sub="Điểm cấp phát L27" />
      <Empty>Chưa có ca cần nhận dụng cụ.</Empty><div className="wk-actions"><button className="btn primary" onClick={() => go('hub')}>Mở Bảng công việc</button></div></div></Panel>
  );
  const w = workOf(a);
  const mine = l.tools.filter((t) => t.assignmentId === a.id);
  const rows = w.kit.map((type) => {
    const t = mine.find((x) => x.type === type);
    const avail = l.tools.some((x) => x.type === type && x.status === 'available');
    return { type, id: t?.id ?? l.tools.find((x) => x.type === type && x.status === 'available')?.id ?? '—', status: t ? 'Đã nhận' : a.kitReturned ? 'Đã trả' : avail ? 'Sẵn sàng' : 'Hết — chờ kiểm', ok: !!t || avail };
  });
  const issue = () => { const r = controller.exec<{ ok: boolean; message: string }>((c) => issueKit(c, a.id)); if (r) toast(r.message, r.ok); };
  return (
    <Panel title="Dụng cụ và vật tư" onClose={close}>
      <div className="wk">
        <Head title="Dụng cụ và vật tư" sub={`Ca ${w.title.toLowerCase()} · Điểm cấp phát L27 · Phiếu nhận trong game`} />
        <div className="wk-grid">
          <div className="wk-panel">
            <span className="wk-label">Bộ dụng cụ theo ca</span>
            <ul className="wk-tools">
              {rows.map((r) => (
                <li key={r.type} className={a.kitIssued ? 'on' : ''}>
                  <span className="wk-check" aria-hidden>{a.kitIssued && <Icon name="check" size={16} />}</span>
                  <span className="wk-tool"><b>{TOOL_TYPES[r.type].label}</b><em>{r.id} · dùng tại {ZONE_BY_ID[w.zone].name.toLowerCase()}</em></span>
                  <span className={`wk-tstat ${r.ok ? '' : 'warn'}`}>{r.status}</span>
                </li>
              ))}
              {w.material && (
                <li className={a.kitIssued ? 'on' : ''}>
                  <span className="wk-check" aria-hidden>{a.kitIssued && <Icon name="check" size={16} />}</span>
                  <span className="wk-tool"><b>{w.material.label}</b><em>Theo phân công · khác dụng cụ</em></span>
                  <span className="wk-tstat">{a.kitIssued ? `Còn ${a.materialLeft} ${w.material.unit}` : 'Đã giữ chỗ'}</span>
                </li>
              )}
            </ul>
          </div>
          <aside className="wk-side">
            <span className="wk-label">{a.kitIssued ? 'Đang giữ trong ca' : 'Xác nhận nhận'}</span>
            <p className="wk-text">Dụng cụ chỉ dùng trong phạm vi ca và được trả hoặc bàn giao khi kết thúc.</p>
            <p className="wk-big sm">{String(w.kit.length).padStart(2, '0')} dụng cụ{w.material ? ' · 01 bộ vật tư' : ''}</p>
            <p className="wk-muted">Có chênh lệch? Bạn có thể yêu cầu kiểm tra phiếu.</p>
            <div className="wk-actions">
              {!a.kitIssued ? <button className="btn primary big" onClick={issue}>Nhận bộ dụng cụ</button>
                : <button className="btn primary big" onClick={() => go('handover')}>Trả & bàn giao ca</button>}
              <button className="btn" onClick={() => { toast('Đã gửi yêu cầu kiểm tra phiếu cho cán bộ kho.'); }}>Yêu cầu kiểm tra</button>
            </div>
          </aside>
        </div>
      </div>
    </Panel>
  );
}

// ======================= U44 bàn giao & tổng kết =======================
function HandoverView({ s }: { s: GameState }) {
  const l = s.labour!;
  const [sum, setSum] = useState<HandoverSummary | null>(null);
  const a = currentAssignment(s) ?? l.assignments.filter((x) => x.state === 'settled').slice(-1)[0] ?? null;
  const settled = a?.state === 'settled';
  const batches = a ? l.batches.filter((b) => a.batchIds.includes(b.id)) : [];
  const done = a ? a.tasks.filter((t) => t.done).length : 0;
  const doIt = () => {
    if (!a) return;
    const r = controller.exec<{ ok: boolean; message: string; summary?: HandoverSummary }>((c) => handover(c, a.id));
    if (r) { toast(r.message, r.ok); if (r.summary) setSum(r.summary); }
  };
  if (!a) return (
    <Panel title="Bàn giao và tổng kết ca" onClose={close}><div className="wk"><Head title="Bàn giao và tổng kết ca" sub="Điểm cân & kiểm nhận · L27" />
      <Stock s={s} /><div className="wk-actions"><button className="btn primary" onClick={() => go('hub')}>Về bảng công việc</button></div></div></Panel>
  );
  const w = workOf(a);
  const lot = batches[0];
  return (
    <Panel title="Bàn giao và tổng kết ca" onClose={close}>
      <div className="wk">
        <Head title="Bàn giao và tổng kết ca" sub={`${w.title} · ${targetLabel(s, a)} · Ca ${fmtClock(a.start)} – ${fmtClock(a.end)}`} />
        <div className="wk-grid">
          <div className="wk-panel">
            {lot ? <Chip tone={lot.state === 'pending_check' ? 'warn' : 'ok'}>Lô {lot.id} · {lot.state === 'pending_check' ? 'Chờ kiểm nhận' : 'Đã kiểm nhận'}</Chip> : <Chip tone="muted">Ca không tạo lô sản phẩm</Chip>}
            <p className="wk-big">{lot ? 'Thành quả có nơi sử dụng rõ ràng' : 'Kết quả công việc'}</p>
            <div className="wk-table">
              {lot && <div><span>Sản lượng {lot.state === 'pending_check' ? 'cần kiểm' : 'được kiểm nhận'}</span><b>{fmtQty(lot)} {lot.kind === 'veg' ? 'rau' : lot.kind === 'fish' ? 'cá' : 'khay gỗ'}</b></div>}
              {lot && <div><span>Nơi nhận</span><b>{lot.destination}</b></div>}
              <div><span>Dụng cụ</span><b>{a.kitReturned ? `${String(w.kit.length).padStart(2, '0')} / ${String(w.kit.length).padStart(2, '0')} đã trả` : a.kitIssued ? `${String(w.kit.length).padStart(2, '0')} đang giữ — trả khi bàn giao` : 'Chưa nhận'}</b></div>
              <div><span>Kết quả công việc</span><b>{done === a.tasks.length ? 'Hoàn thành theo phân công' : `${done}/${a.tasks.length} việc`}</b></div>
              {(sum?.qc ?? []).map((q) => <div key={q}><span>Kiểm nhận</span><b>{q}</b></div>)}
            </div>
            <p className="wk-muted">Xem phiếu để theo dõi bàn giao và chỉnh sửa.</p>
          </div>
          <aside className="wk-side">
            <span className="wk-label">Tổng kết cá nhân</span>
            <p className="wk-big">{settled ? 'Ca đã hoàn tất' : 'Sẵn sàng bàn giao'}</p>
            <p className="wk-text">{settled ? `Bạn đã ${w.short.toLowerCase()} và hoàn tất bàn giao theo phân công.` : 'Bàn giao lô (nếu có), trả dụng cụ và kết ca. Thiếu việc vẫn được ghi nhận phần đã làm.'}</p>
            {settled && <Chip tone="ok">Ghi nhận ca: {fmtMoney(a.credit)}</Chip>}
            <p className="wk-muted">Kết quả học và ca làm được ghi riêng, không tự thay đổi mức án.</p>
            <div className="wk-actions">
              {!settled ? <button className="btn primary big" disabled={!['active', 'completed'].includes(a.state)} onClick={doIt}>Bàn giao & kết ca</button>
                : <button className="btn primary big" onClick={() => controller.openScreen('property')}>Xem phiếu bàn giao</button>}
              <button className="btn" onClick={() => go('hub')}>Về bảng công việc</button>
            </div>
            {!['active', 'completed', 'settled'].includes(a.state) && <p className="wk-hint">Ca chưa bắt đầu — làm việc tại khu được giao trước.</p>}
          </aside>
        </div>
      </div>
    </Panel>
  );
}
function Stock({ s }: { s: GameState }) {
  const l = s.labour!;
  const rows = l.batches.slice(-6).reverse();
  return (
    <div className="wk-panel">
      <span className="wk-label">Kho · lô gần đây</span>
      {!rows.length ? <Empty>Chưa có lô nào.</Empty> : <div className="wk-table">{rows.map((b) => <div key={b.id}><span>{b.id} · {b.team ? 'tổ' : 'bạn'}</span><b>{fmtQty(b)} → {b.destination}</b></div>)}</div>}
      <div className="wk-table"><div><span>Hạt giống</span><b>{l.seedPacks} gói</b></div><div><span>Thức ăn cá</span><b>{l.feedStock} phần</b></div><div><span>Khay giống</span><b>{l.nurseryTrays} khay</b></div><div><span>Sân sinh hoạt</span><b>{CLEAN_SPOTS.filter((x) => !spotDirty(s, x)).length}/{CLEAN_SPOTS.length} điểm sạch</b></div></div>
    </div>
  );
}

// ======================= HUD strip (desktop + mobile) =======================
export function workHud(s: GameState | null) {
  if (!s?.labour) return null;
  const a = currentAssignment(s);
  if (!a || s.minute < a.start - 90) return null;
  const w = workOf(a);
  const { idx } = shiftSteps(a);
  return { title: w.title, icon: WORK_ICON[w.id as WorkId], step: idx, total: 4, hint: nextHint(s, a), end: fmtClock(a.end), active: a.state === 'active' || a.state === 'completed', tasks: a.tasks, label: w.stepLabels[Math.min(3, idx)] };
}
export function WorkHudCard({ compact }: { compact?: boolean }) {
  useUI((st) => st.rev); useUI((st) => st.hud?.clock);
  const h = workHud(controller.s);
  if (!h) return null;
  if (compact) return (
    <button className={`m-work ${h.active ? 'act' : ''}`} onClick={() => go('hub')} aria-label={`Ca ${h.title}: ${h.hint}`}>
      <Icon name={h.icon} size={14} /><span>{h.title} · {Math.min(4, h.step + 1)}/4</span>
    </button>
  );
  return (
    <button className="box wk-hud" onClick={() => go('hub')} style={{ pointerEvents: 'auto' }}>
      <span className="wk-hud-top"><span className="wk-label">Ca đang làm</span><span className="small muted">đến {h.end}</span></span>
      <b><Icon name={h.icon} size={16} /> {h.title} · Bước {Math.min(4, h.step + 1)}/4</b>
      {h.active ? <span className="wk-hud-tasks">{h.tasks.map((t) => <span key={t.id} className={t.done ? 'done' : ''}>{t.done ? '✓' : '○'} {t.label}</span>)}</span> : <span className="small">{h.hint}</span>}
    </button>
  );
}
