// CR-CONFLICT-01 — UI xung đột: căng thẳng (lựa chọn), ẩu đả (đỡ/thoát/đánh trả), báo động GET DOWN, khống chế, áp giải.
// Mọi quyết định đi qua domain (conflictChoose); UI chỉ hiển thị trạng thái và thời gian còn lại của pha.
import { useEffect, useRef, useState } from 'react';
import { controller } from '../../app/controller';
import { audio } from '../../audio/audio';
import { useUI } from '../store';
import { NPC_BY_ID } from '../../content/npcs';
import { ZONE_BY_ID } from '../../content/world';
import { CONFLICT_TIMING, SELF_DEFENSE_MAX_STRIKES, TICKS_PER_SEC, calmChance, conflictChoose, oppName } from '../../domain/conflict';
import { useSpectator } from '../../online/fightBridge';
import type { ConflictChoice, ConflictState } from '../../domain/types';

interface Btn { choice: ConflictChoice; key: string; label: string; sub?: string; tone?: 'danger' | 'primary' | 'calm'; disabled?: boolean }

function useConflictFrame(): ConflictState | null {
  const [, setN] = useState(0);
  useEffect(() => { let raf = 0; const loop = () => { setN((n) => (n + 1) % 1e6); raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf); }, []);
  return controller.s?.conflict ?? null;
}
const choose = (c: ConflictChoice) => controller.exec((ctx) => conflictChoose(ctx, c));

export function ConflictOverlay() {
  const c = useConflictFrame();
  const s = controller.s;
  const prev = useRef<{ phase?: string; alarm?: boolean; hits: number; strikes: number; complied?: boolean }>({ hits: 0, strikes: 0 });
  // âm thanh theo thay đổi trạng thái; xung đột bắt đầu → đóng panel đang mở để thấy lựa chọn
  useEffect(() => {
    const p = prev.current;
    if (c && !p.phase && useUI.getState().overlay) useUI.getState().set({ overlay: null });
    if (!c) { prev.current = { hits: 0, strikes: 0 }; return; }
    if (c.alarm && !p.alarm && c.phase !== 'tension') { audio.conflictCue('alarm'); setTimeout(() => audio.conflictCue('radio'), 600); }
    if (c.npcStrikes > p.hits || c.playerStrikes > p.strikes) audio.conflictCue('impact');
    if (c.complied && !p.complied) audio.conflictCue('cuffs');
    prev.current = { phase: c.phase, alarm: c.alarm, hits: c.npcStrikes, strikes: c.playerStrikes, complied: c.complied };
  });
  const btns: Btn[] = !c || !s ? [] : c.phase === 'tension' ? [
    { choice: 'leave', key: '1', label: 'Rời đi', sub: c.provokedBy === 'npc' && c.opp !== 'peer' ? 'Có thể bị chặn lại' : 'Kết thúc', tone: 'calm' },
    { choice: 'calm', key: '2', label: 'Nói hạ nhiệt', sub: c.opp === 'peer' ? (c.calmMine ? 'Chờ đối phương đồng ý' : c.calmTheirs ? 'Đối phương muốn bỏ qua' : 'Cần cả hai đồng ý') : `~${Math.round(calmChance(s, c.npcId) * 100)}% thành công`, tone: 'calm', disabled: !!c.calmMine },
    { choice: 'call_staff', key: '3', label: 'Gọi cán bộ', sub: c.provokedBy === 'npc' ? 'Bạn không bị ghi lỗi' : 'Cả hai bị nhắc nhở', tone: 'primary' },
    { choice: 'shove', key: '4', label: 'Xô ra', sub: 'Ra tay', tone: 'danger' },
    { choice: 'strike', key: '5', label: 'Đánh', sub: 'Ra tay', tone: 'danger' },
  ] : c.phase === 'brawl' ? [
    { choice: 'block', key: '1', label: 'Đỡ đòn', sub: `Đã đỡ ${c.blocks}`, tone: 'calm' },
    { choice: 'break_away', key: '2', label: 'Thoát ra', sub: c.escaped ? 'Đã lùi lại' : 'Ngừng đánh, lùi lại', tone: 'primary', disabled: c.escaped },
    { choice: 'strike', key: '3', label: 'Đánh trả', sub: c.initiator === 'npc' ? `Tự vệ tối đa ${SELF_DEFENSE_MAX_STRIKES} đòn (${c.playerStrikes})` : `${c.playerStrikes} đòn`, tone: 'danger', disabled: c.escaped },
  ] : c.phase === 'restrain' && !c.complied ? [
    { choice: 'comply', key: 'E', label: 'Chấp hành: nằm xuống, tay ra sau lưng', tone: 'primary' },
  ] : [];
  // phím tắt (bắt ở pha capture để không lọt sang điều khiển game)
  const btnsRef = useRef(btns);
  btnsRef.current = btns;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!controller.s?.conflict) return;
      const key = e.code.startsWith('Digit') ? e.code.slice(5) : e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter' ? 'E' : null;
      const b = key && btnsRef.current.find((x) => x.key === key || (key === 'E' && btnsRef.current.length === 1));
      if (b && !b.disabled) { e.preventDefault(); e.stopImmediatePropagation(); choose(b.choice); }
      else if (key) { e.stopImmediatePropagation(); }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, []);
  if (!s) return null;
  if (!c) return <SpectatorAlarmOverlay />;
  const name = oppName(c);
  const elapsed = (s.tick - c.phaseTick) / TICKS_PER_SEC;
  const total = c.phase === 'tension' ? CONFLICT_TIMING.tension : c.phase === 'brawl' ? CONFLICT_TIMING.brawlMax : c.phase === 'restrain' ? CONFLICT_TIMING.restrain : CONFLICT_TIMING.escort;
  const left = Math.max(0, 1 - elapsed / total);
  const alarmOn = c.alarm && c.phase !== 'tension';
  const fade = c.phase === 'escort' ? Math.max(0, Math.min(1, (elapsed - (CONFLICT_TIMING.escort - 1.2)) / 1.0)) : 0;
  const respondersOnScene = c.responders.filter((id) => { const r = s.npcs[id]; return r && !r.absent && r.path.length === 0; }).length;
  return (
    <div className="cf-root" role="region" aria-label="Xung đột">
      {alarmOn && <div className="cf-alarm" aria-hidden />}
      {alarmOn && <div className="cf-alarm-banner" role="alert"><span className="cf-beacon" aria-hidden />ALARM · {ZONE_BY_ID[c.zone].name.toUpperCase()} · ALL INMATES — GET DOWN!</div>}
      {c.phase === 'escort' && <><div className="cf-bars top" /><div className="cf-bars bottom" /><div className="cf-escort">Còng tay · áp giải tới <b>Khu biệt giam (SHU)</b></div><div className="cf-fade" style={{ opacity: fade }} /></>}
      {c.phase !== 'escort' && (
        <section className={`cf-card cf-${c.phase}`} aria-live="assertive">
          <header className="cf-head">
            <span className={`cf-tag ${c.phase}`}>{c.phase === 'tension' ? 'CĂNG THẲNG' : c.phase === 'brawl' ? 'ẨU ĐẢ' : 'KHỐNG CHẾ'}</span>
            <b className="cf-name">{name}</b>
            {c.phase === 'brawl' && <span className="cf-resp">{c.responders.length ? `Đội phản ứng: ${respondersOnScene}/${c.responders.length} đã tới` : 'Đang báo động…'}</span>}
          </header>
          {c.phase === 'tension' && <p className="cf-line">“{c.line}”</p>}
          {c.phase === 'tension' && c.provokedBy === 'npc' && c.initiator === null && <p className="cf-warn">Ra tay trước = khởi xướng · rời đi, nói chuyện, gọi cán bộ không bị ghi lỗi.</p>}
          {c.phase === 'brawl' && (
            <div className="cf-meters">
              <div><span>Năng lượng</span><i style={{ width: `${s.needs.energy}%` }} /></div>
              <p className="small">{c.initiator === 'npc' ? `${name} ra tay trước` : 'Bạn ra tay trước'} · trúng {Math.max(0, c.npcStrikes - c.blocks)} · đỡ {c.blocks} · đánh {c.playerStrikes}</p>
            </div>
          )}
          {c.phase === 'restrain' && <p className="cf-order">“Nằm xuống! Tay ra sau lưng!”</p>}
          {c.phase === 'restrain' && c.complied && <p className="cf-line">{c.sprayed ? 'Bị xịt hơi cay và khống chế…' : 'Đang còng tay…'}</p>}
          <div className="cf-timer" aria-hidden><i style={{ width: `${left * 100}%` }} /></div>
          {btns.length > 0 && (
            <div className={`cf-btns n${btns.length}`}>
              {btns.map((b) => (
                <button key={b.choice} className={`cf-btn ${b.tone ?? ''}`} disabled={b.disabled} onClick={() => choose(b.choice)}>
                  <kbd>{b.key}</kbd><span><b>{b.label}</b>{b.sub && <small>{b.sub}</small>}</span>
                </button>
              ))}
            </div>
          )}
          {c.log.length > 0 && <ul className="cf-log small">{c.log.slice(-3).map((l, i) => <li key={i}>{l}</li>)}</ul>}
        </section>
      )}
    </div>
  );
}

/** Biên bản vi phạm (RVR) — dùng trong tab Sự việc và bảng Chế độ. */
export function ConflictReports() {
  const s = controller.s;
  const list = (s?.conflicts ?? []).filter((r) => r.incidentId).slice().reverse();
  if (!s || !list.length) return null;
  const VERDICT: Record<string, [string, string]> = {
    pending: ['Chờ điều trần', 'warn'], initiator: ['Khởi xướng', 'err'], mutual: ['Ẩu đả qua lại', 'err'], self_defense: ['Tự vệ — không vi phạm', 'ok'],
    deescalated: ['Đã hạ nhiệt', 'ok'], reported: ['Đã báo cán bộ', 'ok'],
  };
  return (
    <div className="rvr-list">
      {list.map((r) => {
        const inc = s.life.incidents.find((i) => i.id === r.incidentId);
        const [label, tone] = VERDICT[r.verdict];
        return (
          <article key={r.id} className="rvr">
            <header><span className="rvr-no">{r.reportNo}</span><b>RULES VIOLATION REPORT · Ẩu đả</b><span className={`status ${tone}`}>{label}</span></header>
            <dl className="kv small">
              <dt>Đối tượng liên quan</dt><dd>{r.peerName ?? NPC_BY_ID[r.npcId]?.name ?? r.npcId}{r.peerName ? ' (người chơi)' : ''}</dd>
              <dt>Địa điểm</dt><dd>{ZONE_BY_ID[r.zone].name}</dd>
              <dt>Người ra tay trước</dt><dd>{r.initiator === 'player' ? 'Bạn' : r.initiator === 'npc' ? r.peerName ?? NPC_BY_ID[r.npcId]?.name : '—'}</dd>
              <dt>Đòn của bạn</dt><dd>{r.playerStrikes}{r.sprayed ? ' · không chấp hành lệnh (hơi cay)' : ''}</dd>
              {r.hearingAt !== undefined && r.verdict === 'pending' && <><dt>Điều trần</dt><dd>Sau khi tách riêng 1 ngày</dd></>}
            </dl>
            {inc && <ul className="rvr-facts small">{inc.facts.map((f, i) => <li key={i}>{f.text} <em>— {f.provenance}</em></li>)}</ul>}
            {inc?.decision && <p className="small notice">{inc.decision}</p>}
          </article>
        );
      })}
    </div>
  );
}

/** Báo động của người chơi khác cùng khu: banner GET DOWN + nút nằm xuống (E / chạm). */
function SpectatorAlarmOverlay() {
  const alarm = useSpectator((x) => x.alarm);
  const prone = useSpectator((x) => x.prone);
  const played = useRef<string | null>(null);
  useEffect(() => {
    if (alarm && played.current !== alarm.from) { played.current = alarm.from; audio.conflictCue('alarm'); }
    if (!alarm) played.current = null;
  }, [alarm]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const st = useSpectator.getState();
      if (!st.alarm || controller.s?.conflict) return;
      if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); st.set({ prone: !st.prone }); }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, []);
  if (!alarm) return null;
  return (
    <div className="cf-root" role="region" aria-label="Báo động">
      <div className="cf-alarm" aria-hidden />
      <div className="cf-alarm-banner" role="alert"><span className="cf-beacon" aria-hidden />ALARM · {ZONE_BY_ID[alarm.zone as keyof typeof ZONE_BY_ID]?.name.toUpperCase()} · ALL INMATES — GET DOWN!</div>
      <section className="cf-card cf-restrain" aria-live="assertive">
        <header className="cf-head"><span className="cf-tag restrain">BÁO ĐỘNG</span><b className="cf-name">{alarm.name} đang ẩu đả</b></header>
        <p className="cf-order">{prone ? 'Đang nằm sấp · chờ cán bộ' : '“Tất cả nằm xuống!”'}</p>
        <div className="cf-btns n1">
          <button className="cf-btn primary" onClick={() => useSpectator.getState().set({ prone: !prone })}>
            <kbd>E</kbd><span><b>{prone ? 'Đứng dậy' : 'Nằm xuống'}</b><small>{prone ? 'Chỉ đứng dậy khi hết báo động' : 'Không nằm xuống sẽ bị nhắc nhở'}</small></span>
          </button>
        </div>
      </section>
    </div>
  );
}