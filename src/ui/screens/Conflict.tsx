// CR-CONFLICT-01 — HUD xung đột kiểu game đối kháng: thanh đối đầu (BẠN ⟷ ĐỐI THỦ) + vòng đếm ngược ở trên,
// nút hành động tròn theo vùng ngón cái (cảm ứng) hoặc thanh ô phím tắt (máy tính), hiệu ứng trúng đòn, lệnh khống chế giữa màn.
// Mọi quyết định đi qua domain (conflictChoose); UI chỉ hiển thị trạng thái. HUD thường được ẩn trong lúc xung đột.
import { useEffect, useRef, useState } from 'react';
import { controller } from '../../app/controller';
import { audio } from '../../audio/audio';
import { useUI } from '../store';
import { Icon } from '../icons';
import { useTouchUI } from './TouchControls';
import { NPC_BY_ID } from '../../content/npcs';
import { ZONE_BY_ID } from '../../content/world';
import { CONFLICT_TIMING, SELF_DEFENSE_MAX_STRIKES, TICKS_PER_SEC, calmChance, conflictChoose, oppName } from '../../domain/conflict';
import { useSpectator } from '../../online/fightBridge';
import type { ConflictChoice, ConflictState } from '../../domain/types';

/** Hành động: `side` = cụm trái (lùi/hòa) hay phải (thể chất); `big` = nút chính. */
interface Act { choice: ConflictChoice; key: string; label: string; icon: string; tone: 'calm' | 'staff' | 'hit' | 'guard' | 'order'; side: 'l' | 'r'; big?: boolean; disabled?: boolean; note?: string }

function useFrame(): ConflictState | null {
  const [, setN] = useState(0);
  useEffect(() => { let raf = 0; const loop = () => { setN((n) => (n + 1) % 1e6); raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf); }, []);
  return controller.s?.conflict ?? null;
}
const choose = (c: ConflictChoice) => { audio.resume(); return controller.exec((ctx) => conflictChoose(ctx, c)); };
const zoneName = (z: string) => ZONE_BY_ID[z as keyof typeof ZONE_BY_ID]?.name ?? '';

function actionsFor(c: ConflictState, calm: number): Act[] {
  if (c.phase === 'tension') {
    const human = c.opp === 'peer';
    return [
      { choice: 'leave', key: '1', label: 'Rời đi', icon: 'exit', tone: 'calm', side: 'l' },
      { choice: 'calm', key: '2', label: 'Hạ nhiệt', icon: 'peace', tone: 'calm', side: 'l', disabled: !!c.calmMine, note: human ? (c.calmMine ? 'Chờ' : c.calmTheirs ? '✓' : '') : `${Math.round(calm * 100)}%` },
      { choice: 'call_staff', key: '3', label: 'Cán bộ', icon: 'siren', tone: 'staff', side: 'l' },
      { choice: 'shove', key: '4', label: 'Xô', icon: 'shove', tone: 'hit', side: 'r' },
      { choice: 'strike', key: '5', label: 'Đánh', icon: 'fist', tone: 'hit', side: 'r', big: true },
    ];
  }
  if (c.phase === 'brawl') {
    const capped = c.initiator === 'npc' ? `${c.playerStrikes}/${SELF_DEFENSE_MAX_STRIKES}` : `${c.playerStrikes}`;
    return [
      { choice: 'break_away', key: '2', label: 'Thoát', icon: 'exit', tone: 'calm', side: 'l', disabled: c.escaped },
      { choice: 'block', key: '1', label: 'Đỡ', icon: 'shield', tone: 'guard', side: 'r' },
      { choice: 'strike', key: '3', label: 'Đánh', icon: 'fist', tone: 'hit', side: 'r', big: true, disabled: c.escaped, note: capped },
    ];
  }
  if (c.phase === 'restrain' && !c.complied) return [{ choice: 'comply', key: 'E', label: 'Nằm xuống', icon: 'down', tone: 'order', side: 'r', big: true }];
  return [];
}

/** Vòng đếm ngược (SVG). */
function Countdown({ left, size = 46, label }: { left: number; size?: number; label?: string }) {
  const r = 18, C = 2 * Math.PI * r;
  return (
    <span className={`cf-cd ${left < 0.3 ? 'urgent' : ''}`} style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 44 44" width={size} height={size}><circle cx="22" cy="22" r={r} className="bg" /><circle cx="22" cy="22" r={r} className="fg" strokeDasharray={C} strokeDashoffset={C * (1 - left)} transform="rotate(-90 22 22)" /></svg>
      {label && <b>{label}</b>}
    </span>
  );
}

export function ConflictOverlay() {
  const c = useFrame();
  const s = controller.s;
  const touch = useTouchUI();
  const prev = useRef<{ phase?: string; alarm?: boolean; hits: number; strikes: number; blocks: number; complied?: boolean }>({ hits: 0, strikes: 0, blocks: 0 });
  const [pop, setPop] = useState<{ id: number; text: string; tone: 'hit' | 'land' | 'guard' } | null>(null);
  const [shake, setShake] = useState(0);
  // âm thanh + hiệu ứng theo thay đổi trạng thái; xung đột bắt đầu → đóng panel, thả cần điều khiển ảo
  useEffect(() => {
    const p = prev.current;
    if (c && !p.phase) {
      if (useUI.getState().overlay) useUI.getState().set({ overlay: null });
      const v = controller.view; if (v) { v.virtual.x = 0; v.virtual.y = 0; v.virtual.run = false; }
    }
    if (!c) { prev.current = { hits: 0, strikes: 0, blocks: 0 }; return; }
    if (c.alarm && !p.alarm && c.phase !== 'tension') { audio.conflictCue('alarm'); setTimeout(() => audio.conflictCue('radio'), 600); }
    const now = performance.now();
    if (c.npcStrikes > p.hits) {
      const guarded = c.blocks > p.blocks || (c.lastBlockTick !== undefined && s && s.tick - c.lastBlockTick < 27);
      audio.conflictCue('impact');
      setPop({ id: now, text: guarded ? 'ĐỠ!' : 'TRÚNG ĐÒN', tone: guarded ? 'guard' : 'hit' });
      if (!guarded) setShake(now);
    } else if (c.playerStrikes > p.strikes) { audio.conflictCue('impact'); setPop({ id: now, text: 'TRÚNG!', tone: 'land' }); }
    if (c.complied && !p.complied) audio.conflictCue('cuffs');
    prev.current = { phase: c.phase, alarm: c.alarm, hits: c.npcStrikes, strikes: c.playerStrikes, blocks: c.blocks, complied: c.complied };
  });
  const acts = c && s ? actionsFor(c, calmChance(s, c.npcId)) : [];
  const actsRef = useRef(acts);
  actsRef.current = acts;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!controller.s?.conflict) return;
      const key = e.code.startsWith('Digit') ? e.code.slice(5) : e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter' ? 'E' : null;
      const a = key && actsRef.current.find((x) => x.key === key || (key === 'E' && actsRef.current.length === 1));
      if (a && !a.disabled) { e.preventDefault(); e.stopImmediatePropagation(); choose(a.choice); }
      else if (key) e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, []);
  if (!s) return null;
  if (!c) return <SpectatorAlarmOverlay touch={touch} />;
  const name = oppName(c);
  const elapsed = (s.tick - c.phaseTick) / TICKS_PER_SEC;
  const total = c.phase === 'tension' ? CONFLICT_TIMING.tension : c.phase === 'brawl' ? CONFLICT_TIMING.brawlMax : c.phase === 'restrain' ? CONFLICT_TIMING.restrain : CONFLICT_TIMING.escort;
  const left = Math.max(0, 1 - elapsed / total);
  const secs = Math.ceil(total * left);
  const alarmOn = c.alarm && c.phase !== 'tension';
  const fade = c.phase === 'escort' ? Math.max(0, Math.min(1, (elapsed - (CONFLICT_TIMING.escort - 1.2)) / 1.0)) : 0;
  const onScene = c.responders.filter((id) => { const r = s.npcs[id]; return r && !r.absent && r.path.length === 0; }).length;
  const myHp = Math.max(4, s.needs.energy);
  const opHp = Math.max(8, 100 - c.playerStrikes * 13);
  const phaseLabel = c.phase === 'tension' ? 'CĂNG THẲNG' : c.phase === 'brawl' ? 'ẨU ĐẢ' : c.phase === 'restrain' ? 'KHỐNG CHẾ' : 'ÁP GIẢI';
  const reduced = document.body.classList.contains('rm');
  const left_ = acts.filter((a) => a.side === 'l');
  const right_ = acts.filter((a) => a.side === 'r');
  const btn = (a: Act) => (
    <button key={a.choice} className={`cf2-btn t-${a.tone} ${a.big ? 'big' : ''}`} disabled={a.disabled} onClick={() => choose(a.choice)} aria-label={`${a.label}${touch ? '' : ` (phím ${a.key})`}`}>
      <Icon name={a.icon} size={a.big ? (touch ? 38 : 26) : touch ? 26 : 22} />
      <span className="lb">{a.label}</span>
      {!touch && <kbd>{a.key}</kbd>}
      {a.note && <em>{a.note}</em>}
    </button>
  );
  return (
    <div className={`cf2 ph-${c.phase} ${touch ? 'touch' : 'desk'} ${shake && !reduced && performance.now() - shake < 260 ? 'shake' : ''}`} role="region" aria-label={`Xung đột với ${name}: ${phaseLabel}`}>
      {alarmOn && <div className="cf2-vignette" aria-hidden />}
      {pop && performance.now() - pop.id < 650 && <div key={pop.id} className={`cf2-pop ${pop.tone}`} aria-hidden>{pop.text}</div>}
      {pop?.tone === 'hit' && performance.now() - pop.id < 220 && <div key={`f${pop.id}`} className="cf2-flash" aria-hidden />}

      {c.phase !== 'escort' && (
        <header className="cf2-top">
          <div className="cf2-vs">
            <div className="side me"><b>BẠN</b><div className="hp"><i style={{ width: `${myHp}%` }} /></div></div>
            <div className="mid">
              <Countdown left={left} label={c.phase === 'restrain' && c.complied ? undefined : String(secs)} />
              <span className={`tag ${c.phase}`}>{phaseLabel}</span>
            </div>
            <div className="side op"><b title={name}>{name}</b><div className="hp"><i style={{ width: `${opHp}%` }} /></div></div>
          </div>
          <div className="cf2-chips">
            {alarmOn && <span className="chip alarm"><i className="beacon" />GET DOWN · {zoneName(c.zone)}</span>}
            {c.initiator && <span className={`chip ${c.initiator === 'player' ? 'bad' : ''}`}>{c.initiator === 'player' ? 'Bạn ra tay trước' : `${name} ra tay trước`}</span>}
            {c.phase === 'tension' && c.initiator === null && <span className="chip warn">Ra tay trước = khởi xướng</span>}
            {c.responders.length > 0 && c.phase !== 'tension' && <span className="chip staff"><Icon name="user" size={13} />{onScene}/{c.responders.length} cán bộ</span>}
          </div>
          {c.phase === 'tension' && <p className="cf2-say">“{c.line}”</p>}
        </header>
      )}

      {c.phase === 'restrain' && (
        <div className="cf2-order" role="alert">
          <b>{c.complied ? (c.sprayed ? 'BỊ XỊT HƠI CAY' : 'ĐANG CÒNG TAY') : 'NẰM XUỐNG!'}</b>
          {!c.complied && <span>Tay ra sau lưng</span>}
        </div>
      )}

      {acts.length > 0 && (touch ? (
        <>
          {left_.length > 0 && <div className="cf2-pad l">{left_.map(btn)}</div>}
          {right_.length > 0 && <div className={`cf2-pad r n${right_.length}`}>{right_.map(btn)}</div>}
        </>
      ) : <div className="cf2-bar">{acts.map(btn)}</div>)}

      {c.phase === 'escort' && <><div className="cf-bars top" /><div className="cf-bars bottom" /><div className="cf-escort"><Icon name="cuffs" size={18} /> Áp giải tới <b>Khu biệt giam (SHU)</b></div><div className="cf-fade" style={{ opacity: fade }} /></>}
    </div>
  );
}

/** Báo động của người chơi khác cùng khu: viền đỏ + thẻ nhỏ + một nút lớn Nằm xuống / Đứng dậy. */
function SpectatorAlarmOverlay({ touch }: { touch: boolean }) {
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
    <div className={`cf2 spectator ${touch ? 'touch' : 'desk'}`} role="region" aria-label="Báo động">
      <div className="cf2-vignette" aria-hidden />
      <header className="cf2-top">
        <div className="cf2-chips"><span className="chip alarm big"><i className="beacon" />GET DOWN · {zoneName(alarm.zone)}</span></div>
        <p className="cf2-say small">{prone ? 'Đang nằm sấp · chờ cán bộ' : `${alarm.name} đang ẩu đả · tất cả nằm xuống!`}</p>
      </header>
      <div className={touch ? 'cf2-pad r n1' : 'cf2-bar'}>
        <button className={`cf2-btn t-order big ${prone ? 'on' : ''}`} onClick={() => useSpectator.getState().set({ prone: !prone })} aria-label={prone ? 'Đứng dậy' : 'Nằm xuống'}>
          <Icon name={prone ? 'stand' : 'down'} size={touch ? 36 : 26} /><span className="lb">{prone ? 'Đứng dậy' : 'Nằm xuống'}</span>{!touch && <kbd>E</kbd>}
        </button>
      </div>
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
