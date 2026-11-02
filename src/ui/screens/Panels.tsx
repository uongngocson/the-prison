// U07 Pause, U08 Inventory, U12 Journal, U13 Map, U14 Handbook, U17 Schedule, sleep chooser, scene captions, boards.
import { useMemo, useState } from 'react';
import { useUI } from '../store';
import { useSettings, ACTION_LABEL, keyLabel, type ActionName } from '../settings';
import { Panel, Tabs, Key, Status, Empty } from '../components';
import { controller } from '../../app/controller';
import { ITEM_BY_ID, LIBRARY_BOOKS } from '../../content/items';
import { QUESTS, QUEST_BY_ID } from '../../content/quests';
import { DAILY, MEALS } from '../../content/schedule';
import { ZONES, ZONE_BY_ID, CELL_ROOMS } from '../../content/world';
import { ORIENTATION_TOPICS, POLICY_PROFILE, PROGRAMS, MENU, SERVICE_BY_ID } from '../../content/life';
import { NPC_BY_ID } from '../../content/npcs';
import { abandonQuest } from '../../domain/quests';
import { addItem, countItem, moveStack, removeItem, changeNeed, notify } from '../../domain/core';
import { currentBed } from '../../domain/life';
import { zoneHoursLabel } from '../../domain/actions';
import { WEEKDAY_LABEL, absMinuteAt, dayOf, dayOfWeek, fmtClock, fmtDayClock, minuteOfDay } from '../../domain/util';
import type { ContainerId, ZoneId } from '../../domain/types';
import { allowedZones, currentGroup, isVN, positionAllowed, reasonText } from '../../domain/custody';
import { CUSTODY_SCHEDULE } from '../../content/custody';

const close = () => useUI.getState().open(null);
const useRev = () => useUI((s) => s.rev);

// ---------------- U07 Pause ----------------
export function Pause() {
  const set = useUI((s) => s.set);
  const open = useUI((s) => s.open);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [msg, setMsg] = useState('');
  const dirty = controller.session?.dirty;
  return (
    <Panel title="Tạm dừng" onClose={close} width="narrow" footer="Đồng hồ trong game đã dừng khi mở menu (chơi đơn).">
      <div className="col">
        <button className="btn primary" onClick={close} data-autofocus>Tiếp tục</button>
        <button className="btn" onClick={async () => { setMsg('Đang lưu...'); const ok = await controller.save(controller.slot); setMsg(ok ? 'Đã lưu an toàn.' : 'Lưu thất bại — thử lại hoặc Xuất file.'); }}>Lưu ({controller.slot === 'auto' ? 'tự động' : controller.slot.replace('slot', 'ô ')})</button>
        <button className="btn" onClick={() => open('saves')}>Lưu / Tải / Xuất file</button>
        <button className="btn" onClick={() => set({ overlay: 'life' })}>Đời sống</button>
        <button className="btn" onClick={() => set({ overlay: 'profile', profileTab: 'profile' })}>Hồ sơ, quan hệ, kỹ năng, thành tựu</button>
        {controller.s?.custody && <button className="btn" onClick={() => set({ overlay: 'custody' })}>Chế độ thụ án</button>}
        <button className="btn" onClick={() => useUI.getState().open('work', { view: 'hub' })}>Công việc & phân công</button>
        <button className="btn" onClick={() => open('notifications')}>Lịch sử thông báo</button>
        <button className="btn" onClick={() => open('handbook')}>Sổ tay & trợ giúp</button>
        <button className="btn" onClick={() => open('settings')}>Cài đặt</button>
        {!confirmQuit ? <button className="btn danger" onClick={() => (dirty ? setConfirmQuit(true) : controller.quitToMenu())}>Về menu chính</button>
          : <div className="notice"><p>Có thay đổi chưa lưu. Lưu trước khi thoát?</p><div className="row">
            <button className="btn primary" onClick={async () => { if (await controller.save(controller.slot)) controller.quitToMenu(); }}>Lưu rồi thoát</button>
            <button className="btn danger" onClick={() => controller.quitToMenu()}>Thoát không lưu</button>
            <button className="btn" onClick={() => setConfirmQuit(false)}>Hủy</button></div></div>}
        <p role="status" className="small muted">{msg}</p>
      </div>
    </Panel>
  );
}

// ---------------- U08 Inventory ----------------
export function Inventory() {
  useRev();
  const params = useUI((s) => s.overlayParams);
  const s = controller.s!;
  const atLocker = params.locker === '1';
  const [tab, setTab] = useState<ContainerId>('bag');
  const [sel, setSel] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const slots = tab === 'bag' ? s.inventory.bag : tab === 'locker' ? s.inventory.locker : tab === 'mailbox' ? s.inventory.mailbox : s.inventory.stored;
  const st = sel !== null ? slots[sel] : null;
  const def = st ? ITEM_BY_ID[st.itemId] : null;
  const used = s.inventory.bag.filter(Boolean).length;
  const act = (fn: () => string | void) => { const r = controller.exec<string | void>(() => fn()); setMsg(typeof r === 'string' ? r : ''); };
  const use = (verb: string) => act(() => {
    const ctx = controller.session!.ctx;
    if (!st || !def) return;
    if (verb === 'eat') {
      if (!removeItem(ctx, st.itemId, 1, [tab])) return 'Không còn.';
      for (const [k, v] of Object.entries(def.effects ?? {})) changeNeed(ctx, k as 'hunger', v as number, `Ăn ${def.name.toLowerCase()}`);
      if (st.itemId === 'meal_tray') s.flags.tray_out = true;
      return `Đã dùng ${def.name}.`;
    }
    if (verb === 'equip') { s.equipped.outfit = s.equipped.outfit === st.uid ? null : st.uid; return s.equipped.outfit ? `Đã mặc ${def.name}.` : 'Đã thay về đồng phục.'; }
    if (verb === 'read') {
      if (st.itemId === 'handbook') { useUI.getState().open('handbook'); return; }
      return 'Hãy ngồi tại bàn đọc, ghế hoặc giường rồi chọn “Đọc sách” để đọc (có thời lượng).';
    }
  });
  const moveTo = (to: 'bag' | 'locker') => act(() => (moveStack(controller.session!.ctx, tab, sel!, to) ? (setSel(null), `Đã chuyển sang ${to === 'bag' ? 'túi' : 'tủ'}.`) : 'Không đủ chỗ — vật phẩm được giữ nguyên.'));
  return (
    <Panel title={`Túi đồ (${used}/12)`} onClose={close} tabs={<Tabs label="Kho" value={tab} onChange={(t) => { setTab(t); setSel(null); }} tabs={[
      { id: 'bag', label: 'Túi' }, { id: 'locker', label: atLocker ? 'Tủ cá nhân' : 'Tủ cá nhân (xem)' }, { id: 'mailbox', label: 'Hộp nhận đồ', badge: s.inventory.mailbox.length }, { id: 'stored', label: 'Tài sản ký gửi' },
    ]} />} footer={<>Phím mũi tên chọn ô · Enter hành động · Không cần kéo thả. {tab === 'stored' && 'Tài sản ký gửi chỉ xem — nhận lại khi rời cơ sở (biên nhận ở Đời sống › Tài sản).'}</>}>
      <div className="split3">
        <div className="small muted mobile-hide">
          <p>{tab === 'bag' && 'Đồ mang theo. 12 ô.'}{tab === 'locker' && (atLocker ? 'Tủ trong phòng của bạn — chuyển đồ qua lại tự do.' : 'Đến tủ cá nhân trong phòng để chuyển đồ.')}{tab === 'mailbox' && 'Phần thưởng/đồ khi túi đầy được giữ ở đây, không bị mất.'}{tab === 'stored' && 'Đồ ký gửi khi tiếp nhận.'}</p>
          <p>Đang mặc: {s.equipped.outfit ? ITEM_BY_ID[s.inventory.bag.find((x) => x?.uid === s.equipped.outfit)?.itemId ?? '']?.name ?? 'đồng phục' : 'Đồng phục được cấp'}</p>
        </div>
        <div role="grid" aria-label="Danh sách vật phẩm" className="inv-grid"
          onKeyDown={(e) => {
            const n = slots.length; if (!n) return;
            const cur = sel ?? 0;
            if (e.key === 'ArrowRight') setSel(Math.min(n - 1, cur + 1)); if (e.key === 'ArrowLeft') setSel(Math.max(0, cur - 1));
            if (e.key === 'ArrowDown') setSel(Math.min(n - 1, cur + 4)); if (e.key === 'ArrowUp') setSel(Math.max(0, cur - 4));
          }}>
          {slots.length === 0 && <Empty>Trống.</Empty>}
          {slots.map((x, i) => (
            <button key={i} role="gridcell" className="item-row" aria-selected={sel === i} onClick={() => setSel(i)} style={{ flexDirection: 'column', minHeight: 72, justifyContent: 'center' }} aria-label={x ? `${ITEM_BY_ID[x.itemId]?.name} ×${x.qty}` : 'Ô trống'}>
              {x ? <><span style={{ fontSize: 24 }}>{ITEM_BY_ID[x.itemId]?.icon}</span><span className="small">{ITEM_BY_ID[x.itemId]?.name.slice(0, 18)}</span><span className="small muted">×{x.qty}{s.equipped.outfit === x.uid ? ' · đang mặc' : ''}</span></> : <span className="muted small">—</span>}
            </button>
          ))}
        </div>
        <div className="card">
          {!def ? <Empty>Chọn một vật phẩm để xem chi tiết.</Empty> : <>
            <h3>{def.icon} {def.name}</h3>
            <p className="small">{def.desc}</p>
            <p className="small muted">Số lượng: {st!.qty} · Loại: {def.type}{def.questBound ? ' · vật phẩm nhiệm vụ' : ''}{def.essential ? ' · thiết yếu' : ''}</p>
            {st!.provenance && <p className="small muted">Nguồn gốc: {st!.provenance}</p>}
            {tab !== 'stored' && <div className="col">
              {def.actions.includes('eat') && <button className="btn" onClick={() => use('eat')}>Ăn / dùng</button>}
              {def.actions.includes('read') && <button className="btn" onClick={() => use('read')}>Đọc</button>}
              {def.actions.includes('equip') && tab === 'bag' && <button className="btn" onClick={() => use('equip')}>{s.equipped.outfit === st!.uid ? 'Cởi ra' : 'Mặc'}</button>}
              {atLocker && tab === 'bag' && <button className="btn" onClick={() => moveTo('locker')}>Cất vào tủ</button>}
              {(atLocker && tab === 'locker') && <button className="btn" onClick={() => moveTo('bag')}>Lấy vào túi</button>}
              {tab === 'mailbox' && <button className="btn" onClick={() => moveTo('bag')}>Lấy vào túi</button>}
              {def.questBound && <p className="small muted">Vật phẩm nhiệm vụ không thể bỏ.</p>}
            </div>}
          </>}
          <p role="status" className="small" style={{ color: 'var(--accent)' }}>{msg}</p>
        </div>
      </div>
    </Panel>
  );
}

// ---------------- U12 Journal ----------------
export function Journal() {
  useRev();
  const s = controller.s!;
  const [tab, setTab] = useState<'active' | 'done'>('active');
  const list = QUESTS.filter((q) => { const st = s.quests[q.id]?.state; return tab === 'active' ? st === 'active' || st === 'offered' : st === 'completed'; });
  const [sel, setSel] = useState<string | null>(s.trackedQuest);
  const q = sel ? QUEST_BY_ID[sel] : list[0];
  const p = q ? s.quests[q.id] : null;
  return (
    <Panel title="Nhật ký nhiệm vụ" onClose={close} tabs={<Tabs label="Trạng thái" value={tab} onChange={setTab} tabs={[{ id: 'active', label: 'Đang làm' }, { id: 'done', label: 'Đã xong' }]} />}>
      <div className="split">
        <div className="list" role="listbox" aria-label="Nhiệm vụ">
          {list.length === 0 && <Empty>{tab === 'active' ? 'Chưa có nhiệm vụ. Trò chuyện với mọi người để nhận việc.' : 'Chưa hoàn thành nhiệm vụ nào.'}</Empty>}
          {list.map((x) => <button key={x.id} className="item-row" aria-selected={q?.id === x.id} onClick={() => setSel(x.id)}>{x.kind === 'main' ? '★' : '•'} {x.title}{s.trackedQuest === x.id ? <span className="badge">theo dõi</span> : null}</button>)}
        </div>
        {q && p && (
          <div>
            <h3>{q.title} <span className="muted small">{q.kind === 'main' ? 'Chính' : 'Phụ'}</span></h3>
            <p>{q.summary}</p>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {q.objectives.map((o, i) => {
                const done = p.done[o.id] || p.state === 'completed';
                const cur = i === p.stage && p.state === 'active';
                if (!done && !cur && i > p.stage) return <li key={o.id} className="muted small">☐ ...</li>;
                return <li key={o.id} aria-label={`${o.text}: ${done ? 'xong' : 'chưa xong'}`}>{done ? '☑' : '☐'} {o.text}{o.where ? <span className="muted small"> — {ZONE_BY_ID[o.where].name}</span> : null}{cur && o.npc ? <span className="muted small"> (gặp {NPC_BY_ID[o.npc]?.name})</span> : null}</li>;
              })}
            </ul>
            <p className="small"><b>Phần thưởng:</b> {[...(q.reward.xp ?? []).map(([k, n]) => `${n} XP ${k === 'focus' ? 'Tập trung' : k === 'fitness' ? 'Thể lực' : 'Giao tiếp'}`), ...(q.reward.trust ?? []).map(([n, v]) => `+${v} tin cậy ${NPC_BY_ID[n]?.name}`), q.reward.credits ? `${q.reward.credits / 100} tín chỉ` : '', q.rewardByChoice ? 'thêm phần thưởng theo lựa chọn' : ''].filter(Boolean).join(', ') || 'trải nghiệm'}</p>
            <p className="small muted"><b>Nếu bị lỡ:</b> {q.alternative}</p>
            {p.state === 'completed' && <p className="notice">{q.recap}</p>}
            <div className="row">
              {p.state === 'active' && s.trackedQuest !== q.id && <button className="btn" onClick={() => { s.trackedQuest = q.id; controller.bump(); }}>Theo dõi trên HUD</button>}
              {p.state === 'active' && q.objectives[p.stage]?.where && <button className="btn" onClick={() => { useUI.getState().set({ waypoint: q.objectives[p.stage].where!, overlay: null }); }}>Chỉ đường</button>}
              {p.state === 'active' && q.abandonable && <button className="btn danger" onClick={() => controller.exec(() => abandonQuest(controller.session!.ctx, q.id))}>Tạm bỏ (có thể nhận lại)</button>}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

// ---------------- U13 Map ----------------
export function MapPanel() {
  useRev();
  const s = controller.s!;
  const [sel, setSel] = useState<ZoneId>(s.player.zone);
  const z = ZONE_BY_ID[sel];
  const known = (id: ZoneId) => s.discoveredZones.includes(id) || id === 'L03';
  const vnAllowed = isVN(s) ? allowedZones(s) : null;
  // F64: trong bối cảnh VN, "mở" = evaluator cho phép (có tên khu trên bản đồ không tự trao quyền).
  const open = (id: ZoneId) => vnAllowed ? vnAllowed.has(id) || id === s.player.zone : controller.session!.zoneIsOpen(id);
  const door = s.world.doors[`door_${sel}`];
  const route = sel === s.player.zone ? 'Bạn đang ở đây.' : vnAllowed && !open(sel) ? `Chưa được tới: ${reasonText(positionAllowed(s, (z.x0 + z.x1) / 2, (z.z0 + z.z1) / 2).reasonCode ?? 'AUTHORIZATION_REQUIRED')}` : !open(sel) ? `Đang đóng: ${door?.reason || 'ngoài giờ mở cửa'}` : `Lối đi: ${ZONE_BY_ID[s.player.zone].name} → Hành lang chính → ${z.name}`;
  const K = 0.72;
  const sx = (x: number) => (x + 104) * K;
  const KZ = 1.0; // z −36…32 (gồm khu lao động) vừa khung 72
  const sz = (zz: number) => (34 - zz) * KZ;
  return (
    <Panel title="Bản đồ (sơ đồ hư cấu)" onClose={close}>
      <div className="split map">
        <div className="list" role="listbox" aria-label="Danh sách khu">
          {[...ZONES].sort((a, b) => Number(known(b.id)) - Number(known(a.id))).map((x) => (
            <button key={x.id} className={`item-row ${known(x.id) ? '' : 'unknown'}`} aria-selected={sel === x.id} onClick={() => setSel(x.id)}>
              {x.id === s.player.zone ? '📍 ' : ''}{known(x.id) ? x.name : 'Khu chưa khám phá'}{!open(x.id) ? ' 🔒' : ''}
            </button>
          ))}
        </div>
        <div>
          <svg viewBox="0 0 160 72" aria-label="Sơ đồ các khu" role="img">
            {ZONES.map((x) => (
              <g key={x.id} className={`z ${x.id === s.player.zone ? 'cur' : ''} ${!open(x.id) ? 'closed' : ''}`} onClick={() => setSel(x.id)}>
                <rect x={sx(x.x0)} y={sz(x.z1)} width={(x.x1 - x.x0) * K} height={(x.z1 - x.z0) * KZ} fill={x.id === sel ? '#4b6468' : x.outdoor ? '#3e5a3e' : '#2b3b3e'} />
                <text x={sx((x.x0 + x.x1) / 2)} y={sz((x.z0 + x.z1) / 2) + 1} fontSize="2.6" textAnchor="middle" fill="#f2f0e8">{known(x.id) ? x.id : '?'}</text>
              </g>
            ))}
            <circle cx={sx(s.player.pos.x)} cy={sz(s.player.pos.z)} r="1.2" fill="#e8b77a" />
          </svg>
          <div className="card" style={{ marginTop: 12 }}>
            <h3>{known(sel) ? z.name : 'Khu chưa khám phá'}</h3>
            {known(sel) && <p className="small">{z.purpose}</p>}
            <p className="small"><b>Giờ mở:</b> {zoneHoursLabel(sel)} · <b>Trạng thái:</b> {open(sel) ? <Status kind="ok">Mở</Status> : <Status kind="warn">Đóng</Status>}</p>
            <p className="small">{route}</p>
            <button className="btn" disabled={sel === s.player.zone} onClick={() => { useUI.getState().set({ waypoint: sel, overlay: null }); }}>Đặt điểm đến trên HUD</button>
            <p className="muted small">Không có dịch chuyển nhanh — hãy đi bộ theo hành lang chính.</p>
          </div>
        </div>
      </div>
    </Panel>
  );
}

// ---------------- U17 Schedule ----------------
export function SchedulePanel() {
  useRev();
  const s = controller.s!;
  const m = minuteOfDay(s.minute);
  const day = dayOf(s.minute);
  const status = (from: number, to: number) => (m < from ? (from - m <= 30 ? ['Sắp bắt đầu', 'warn'] : ['Sắp tới', '']) : m < to ? (to - m <= 15 ? ['Sắp kết thúc', 'warn'] : ['Đang mở', 'ok']) : ['Đã qua', '']);
  const todaysPrograms = s.life.programs.filter((e) => ['enrolled', 'in_progress'].includes(e.state)).map((e) => PROGRAMS.find((p) => p.id === e.programId)!).filter((p) => p.days.includes(dayOfWeek(s.minute)));
  const bookings = s.life.bookings.filter((b) => ['booked', 'waiting'].includes(b.state)).sort((a, b) => a.start - b.start);
  return (
    <Panel title={`Lịch sinh hoạt — ${WEEKDAY_LABEL[dayOfWeek(s.minute)]}, Ngày ${day}`} onClose={close} footer="Giờ trong game. Một ngày game ≈ 48 phút thực (đổi trong Cài đặt). Hầu hết hoạt động là tự chọn; điểm danh có miễn trừ khi có lịch hẹn được phép.">
      <table className="tbl sched">
        <thead><tr><th>Giờ</th><th>Hoạt động</th><th>Nơi</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead>
        <tbody>
          {(isVN(s) ? CUSTODY_SCHEDULE[currentGroup(s) === 'B' ? 'B' : 'A'].map((w) => ({ id: `w${w.from}`, from: w.from, to: w.to, label: w.label, zones: w.zones, optional: w.kind === 'activity', hint: w.kind === 'activity' ? 'Đi theo lịch nhóm' : 'Ở trong buồng' })) : DAILY).map((r) => { const [label, kind] = status(r.from, r.to); return (
            <tr key={r.id} className={m >= r.from && m < r.to ? 'current' : ''}>
              <td>{fmtClock(r.from)}–{fmtClock(r.to % 1440)}</td>
              <td>{r.label}{r.optional ? '' : ' ●'}</td>
              <td className="small">{r.zones.length ? r.zones.map((z) => ZONE_BY_ID[z].name).join(', ') : 'Tại buồng'}</td>
              <td><Status kind={kind as 'ok' | 'warn' | undefined}>{label}</Status></td>
              <td className="small muted">{r.hint}</td>
            </tr>); })}
        </tbody>
      </table>
      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Lịch cá nhân hôm nay</h3>
          {todaysPrograms.length === 0 && <Empty>Chưa có khóa học/ca làm hôm nay. Đăng ký ở Đời sống › Học tập & công việc.</Empty>}
          {todaysPrograms.map((p) => <div key={p.id} className="small">{fmtClock(p.from)}–{fmtClock(p.to)} · {p.name} · {ZONE_BY_ID[p.zone].name}</div>)}
          {[1, 3, 5].includes(dayOfWeek(s.minute)) && <div className="small">19:00–20:30 · Nhóm đọc sách · Thư viện (tự chọn)</div>}
          <div className="small">16:00–17:00 · Buổi tập nhóm ngoài sân (khi không mưa)</div>
          <div className="small">19:00–20:30 · Sinh hoạt văn hóa / suy ngẫm · Phòng yên tĩnh (tự chọn)</div>
        </div>
        <div className="card">
          <h3>Lịch hẹn sắp tới</h3>
          {bookings.length === 0 && <Empty>Không có lịch hẹn.</Empty>}
          {bookings.map((b) => <div key={b.id} className="small">{fmtDayClock(b.start)} · {SERVICE_BY_ID[b.serviceId]?.name} · {ZONE_BY_ID[b.zone].name}</div>)}
          <h3 style={{ marginTop: 8 }}>Bữa ăn</h3>
          {MEALS.map((ml) => <div key={ml.id} className="small">{fmtClock(ml.from)}–{fmtClock(ml.to)} {ml.label}: {MENU[ml.id][s.life.diet]} {s.mealClaims[`${day}:${ml.id}`] ? '✓ đã nhận' : ''}</div>)}
        </div>
      </div>
    </Panel>
  );
}

// ---------------- U14 Handbook ----------------
export function Handbook() {
  const [q, setQ] = useState('');
  const bindings = useSettings((x) => x.s.controls.bindings);
  const articles = useMemo(() => {
    const ctl = (Object.keys(bindings) as ActionName[]).map((k) => `${ACTION_LABEL[k]}: ${keyLabel(bindings[k])}`).join(' · ');
    return [
      { id: 'controls', title: 'Điều khiển', body: `${ctl}. Nhấp vào khung hình để khóa chuột điều khiển camera; Esc để thả chuột/mở menu. Cuộn chuột để chỉnh khoảng cách camera. Phím số 2–4 chọn hành động phụ ở lời nhắc.` },
      { id: 'touch', title: 'Cảm ứng & tay cầm', body: 'Màn hình cảm ứng: cần điều khiển ảo ở góc dưới bên trái (đẩy ra mép để chạy), vuốt nửa phải màn hình để xoay camera, chụm/mở hai ngón để thu phóng, chạm nhanh để tương tác; nút ✋ thực hiện hành động chính, thanh biểu tượng phía trên mở lịch, nhiệm vụ, bản đồ, túi, đời sống, hồ sơ. Có chế độ thuận tay trái và chỉnh cỡ cần điều khiển trong Cài đặt › Điều khiển. Tay cầm (chuẩn Xbox/PlayStation): cần trái di chuyển, cần phải xoay camera, A tương tác, B hủy/đóng, X tua nhanh, Y đời sống, LB bản đồ, RB nhiệm vụ, Back lịch, Start tạm dừng, D-pad lên/xuống túi/hồ sơ, bấm cần trái chạy, bấm cần phải cúi. Trong menu dùng D-pad để di chuyển, A chọn, B quay lại.' },
      { id: 'interact', title: 'Tương tác', body: 'Đến gần đồ vật/người có vòng sáng vàng. Lời nhắc ở giữa màn hình cho biết hành động, thời lượng (phút game) và lý do nếu chưa dùng được. Hành động có thời lượng sẽ tua nhanh thời gian; có thể tua hết (F) hoặc hủy trước khi xong (Q) — hủy không nhận kết quả.' },
      { id: 'needs', title: 'Nhu cầu', body: 'Năng lượng, No bụng, Vệ sinh, Tâm trạng (0–100, cao là tốt). Ăn +35 no bụng, ngủ +8 năng lượng/giờ, tắm +60 vệ sinh. Chỉ số thấp chỉ gợi ý nhẹ và giảm tối đa 15% hiệu quả hoạt động — không chết, không khóa nhiệm vụ. Có thể bật “Nhu cầu nhẹ” trong Cài đặt.' },
      { id: 'save', title: 'Lưu game', body: 'Tự lưu mỗi phút khi có thay đổi, khi sang ngày mới và khi hoàn thành nhiệm vụ. Có 3 ô lưu thủ công; mỗi ô giữ 2 thế hệ gần nhất. Xuất file để sao lưu ngoài trình duyệt.' },
      ...ORIENTATION_TOPICS.map((t) => ({ id: t.id, title: t.title, body: t.body })),
      { id: 'fiction', title: 'Về mô hình hư cấu', body: `${POLICY_PROFILE.jurisdictionLabel}. Quyền tối thiểu trong game: ${POLICY_PROFILE.rightsFloor.join(', ')}. ${POLICY_PROFILE.reviewStatus}.` },
      { id: 'access', title: 'Trợ năng', body: 'Phụ đề luôn bật cho thông báo quan trọng; chỉnh cỡ chữ phụ đề, giảm chuyển động, tương phản cao, hoàn tất tự động hoạt động, ngày dài 72 phút, đổi phím — trong Cài đặt › Điều khiển & Trợ năng. Nhu cầu cá nhân của nhân vật (đi lại, nghe, ngôn ngữ...) chọn ở Đời sống › Chăm sóc.' },
    ];
  }, [bindings]);
  const shown = articles.filter((a) => !q || (a.title + a.body).toLowerCase().includes(q.toLowerCase()));
  const [sel, setSel] = useState('controls');
  const a = shown.find((x) => x.id === sel) ?? shown[0];
  return (
    <Panel title="Sổ tay sinh hoạt" onClose={close}>
      <div className="split">
        <div className="col">
          <label className="field">Tìm kiếm<input type="text" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          {shown.length === 0 && <div><Empty>Không có kết quả.</Empty><button className="btn sm" onClick={() => setQ('')}>Xóa bộ lọc</button></div>}
          {shown.map((x) => <button key={x.id} className="item-row" aria-selected={a?.id === x.id} onClick={() => setSel(x.id)}>{x.title}</button>)}
          <button className="btn" onClick={() => { controller.session?.replayTutorial(); close(); }}>Xem lại hướng dẫn</button>
        </div>
        {a && <article><h3>{a.title}</h3><p>{a.body}</p></article>}
      </div>
    </Panel>
  );
}

// ---------------- Sleep chooser (F22) ----------------
export function SleepPanel() {
  const params = useUI((s) => s.overlayParams);
  const s = controller.s!;
  const day = dayOf(s.minute);
  const m = minuteOfDay(s.minute);
  const options = [6 * 60, 7 * 60, 13 * 60 + 30, 22 * 60].map((t) => (t > m + 30 ? absMinuteAt(day, Math.floor(t / 60) * 100 + (t % 60)) : absMinuteAt(day + 1, Math.floor(t / 60) * 100 + (t % 60)))).filter((t) => t - s.minute <= 14 * 60).sort((a, b) => a - b);
  const [wake, setWake] = useState(options.find((t) => minuteOfDay(t) === 360) ?? options[0]);
  const preview = controller.session!.previewSleep(wake);
  const bed = params.bed ?? currentBed(s) ?? '';
  return (
    <Panel title="Ngủ" onClose={close} width="narrow">
      <p>Chọn giờ thức dậy. Thời gian sẽ trôi nhanh; năng lượng hồi khoảng 8/giờ.</p>
      <div className="row">{options.map((t) => <button key={t} className={`btn sm ${wake === t ? 'primary' : ''}`} aria-pressed={wake === t} onClick={() => setWake(t)}>{fmtDayClock(t)}</button>)}</div>
      <p className="small muted">Ngủ {((wake - s.minute) / 60).toFixed(1)} giờ.</p>
      {preview.length > 0 && <div className="notice small"><b>Sẽ bỏ qua:</b><ul>{preview.map((p, i) => <li key={i}>{p}</li>)}</ul>Điểm danh khi đang ngủ trên giường tại khu phòng ở được tính là có mặt.</div>}
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn primary" onClick={() => { const r = controller.session!.sleep(bed, wake); if (!r.ok) useUI.getState().toast({ id: 'sl', text: r.message!, severity: 'warning' }); controller.bump(); close(); }}>Ngủ</button>
        <button className="btn" onClick={close}>Hủy</button>
      </div>
    </Panel>
  );
}

// ---------------- Scene (call/visit/appointments captions) ----------------
export function ScenePanel() {
  const p = useUI((s) => s.overlayParams);
  const lines = (p.lines ?? '').split('\n');
  const [i, setI] = useState(0);
  return (
    <Panel title={p.title ?? 'Cảnh'} onClose={close} width="mid" footer="Phụ đề toàn bộ — không cần micro, camera hay âm thanh. Nội dung riêng tư không hiển thị cho người khác.">
      <div aria-live="polite">{lines.slice(0, i + 1).map((l, k) => <p key={k} style={{ fontSize: 18 }}>{l}</p>)}</div>
      <div className="row">
        {i < lines.length - 1 ? <button className="btn primary" onClick={() => setI(i + 1)} data-autofocus>Tiếp tục</button> : <button className="btn primary" onClick={close} data-autofocus>Kết thúc</button>}
        <button className="btn ghost" onClick={close}>Bỏ qua (giữ kết quả)</button>
      </div>
    </Panel>
  );
}

// ---------------- Library self-service ----------------
export function LibraryPanel() {
  useRev();
  const s = controller.s!;
  const onDuty = controller.session!.ctx.s.life.staff.roleOnDuty.librarian;
  const borrow = (id: string) => controller.exec(() => {
    const ctx = controller.session!.ctx;
    if (countItem(s, id, ['bag', 'locker'])) return;
    if (addItem(ctx, id, 1, { overflow: 'fail', provenance: 'library' }).ok) { s.flags[`borrowed:${id}`] = dayOf(s.minute); notify(ctx, `Đã mượn ${ITEM_BY_ID[id].name}. Hạn trả 7 ngày.`, 'info'); }
    else notify(ctx, 'Túi đầy — không thể mượn thêm.', 'warning');
  });
  const ret = (id: string) => controller.exec(() => { const ctx = controller.session!.ctx; const c = countItem(s, id, ['bag', 'locker']); if (c) { removeItem(ctx, id, c, ['bag', 'locker']); delete s.flags[`borrowed:${id}`]; notify(ctx, `Đã trả ${ITEM_BY_ID[id].name}.`); } });
  return (
    <Panel title="Mượn / trả sách" onClose={close} width="mid" footer={onDuty ? `Thủ thư đang trực: ${NPC_BY_ID[onDuty]?.name}.` : 'Thủ thư ngoài giờ — dùng sổ mượn tự phục vụ.'}>
      <table className="tbl"><thead><tr><th>Sách</th><th>Trạng thái</th><th /></tr></thead><tbody>
        {LIBRARY_BOOKS.map((id) => { const have = countItem(s, id, ['bag', 'locker']) > 0; const since = s.flags[`borrowed:${id}`] as number | undefined; return (
          <tr key={id}><td>{ITEM_BY_ID[id].icon} {ITEM_BY_ID[id].name}</td><td className="small">{have ? `Bạn đang mượn${since ? ` (ngày ${since}, hạn ngày ${since + 7})` : ''}` : 'Có sẵn'}</td>
            <td>{have ? <button className="btn sm" onClick={() => ret(id)}>Trả</button> : <button className="btn sm" onClick={() => borrow(id)}>Mượn</button>}</td></tr>); })}
      </tbody></table>
    </Panel>
  );
}

// ---------------- News / menu boards / notification history ----------------
export function NewsPanel() {
  const s = controller.s!;
  const ev = s.world.activeEvent;
  const closures = Object.entries(s.world.doors).filter(([, d]) => d.state !== 'open');
  const outages = s.life.facility.filter((f) => f.state !== 'resolved');
  return (
    <Panel title="Bảng tin cộng đồng" onClose={close} width="mid">
      <ul>
        <li>Thời tiết: {s.world.weather === 'rain' ? 'mưa nhẹ — sân tạm đóng' : s.world.weather === 'overcast' ? 'âm u' : 'trời quang'}.</li>
        {ev && <li>Đang diễn ra: {ev.id.startsWith('reading') ? 'Nhóm đọc sách tại Thư viện' : ev.id.startsWith('group_ex') ? 'Buổi tập nhóm ngoài sân' : `Tạm đóng ${ZONE_BY_ID[ev.zone].name} để bảo trì`} (đến {fmtClock(ev.endMinute)}).</li>}
        {closures.map(([id, d]) => <li key={id}>{ZONE_BY_ID[id.replace('door_', '') as ZoneId].name}: {d.reason}</li>)}
        {outages.map((f) => <li key={f.id}>Thiết bị tạm ngưng: {f.affected.join(', ')} — {f.fallback}.</li>)}
        <li>Nhóm đọc sách: tối Thứ Ba, Thứ Năm, Thứ Bảy 19:00 tại Thư viện.</li>
        <li>Cửa hàng nội bộ nhận đơn Thứ Hai, Thứ Tư, Thứ Sáu. Nhận hàng sáng hôm sau.</li>
        <li>Lớp Nấu ăn tập thể sáng Thứ Bảy tại Nhà bếp.</li>
        <li>Vật dụng thiết yếu luôn có thể nhận miễn phí tại Quầy dịch vụ hoặc quầy giặt.</li>
      </ul>
    </Panel>
  );
}
export function MenuBoardPanel() {
  const s = controller.s!;
  return (
    <Panel title="Thực đơn hôm nay" onClose={close} width="narrow">
      {MEALS.map((m) => <p key={m.id}><b>{m.label} ({fmtClock(m.from)}–{fmtClock(m.to)}):</b> {MENU[m.id][s.life.diet]}</p>)}
      <p className="small muted">Theo chế độ ăn bạn đã chọn. Món hết sẽ có món thay thế tương đương. Đổi chế độ ăn ở Đời sống › Chăm sóc.</p>
    </Panel>
  );
}
export function NotificationsPanel() {
  const s = controller.s!;
  return (
    <Panel title="Lịch sử thông báo" onClose={close} width="mid">
      {s.notifications.length === 0 && <Empty>Chưa có thông báo.</Empty>}
      <div className="col">{[...s.notifications].reverse().map((n) => <div key={n.id} className="small"><span className="muted">{fmtDayClock(n.minute)}</span> · {n.text}</div>)}</div>
    </Panel>
  );
}

export const _unused = { CELL_ROOMS };
