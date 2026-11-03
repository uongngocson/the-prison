// Chế độ Trực tuyến — UI: sảnh chọn phòng, khung trò chuyện (desktop dock / mobile sheet), danh sách người chơi, chip trạng thái.
import { useEffect, useRef, useState } from 'react';
import { useUI } from '../store';
import { Icon } from '../icons';
import { controller } from '../../app/controller';
import { useDevice } from '../device';
import { online, useOnline, type PeerView } from '../../online/client';
import { MSG_MAX, NEAR_RADIUS, QUICK_PHRASES, ROOMS, SCOPE_LABEL, type ChatScope } from '../../online/protocol';
import { hasAnySave, slotOfLatest } from '../../persistence/localStore';
import type { SaveEnvelope } from '../../persistence/saveCodec';
import { GateScene } from './GateScene';
import { gate, useGate } from '../../online/queue';
import { BOT_COUNT } from '../../bots/personas';

// ======================= Sảnh trực tuyến =======================
/** Hành động sau khi được vào (tiếp tục save / tạo nhân vật) — dùng chung cho sảnh và màn hàng đợi. */
let afterAdmit: (() => Promise<void>) | null = null;

function CapacityMeter() {
  // hiển thị gồm cả bạn tù luôn trực tuyến; giới hạn 50 vẫn chỉ áp cho người chơi thật
  const playing = useGate((s) => s.playing) + BOT_COUNT;
  const cap = useGate((s) => s.cap) + BOT_COUNT;
  const waiting = useGate((s) => s.waiting);
  const full = playing >= cap;
  const pct = Math.min(100, Math.round((playing / cap) * 100));
  return (
    <div className={`ol-cap ${full ? 'full' : pct >= 80 ? 'busy' : ''}`} aria-live="polite">
      <div className="ol-cap-top"><span><i aria-hidden />{full ? 'Máy chủ đang đầy' : 'Đang trực tuyến'}</span><b>{playing}/{cap}</b></div>
      <div className="ol-cap-bar"><i style={{ width: `${pct}%` }} /></div>
      {waiting > 0 && <span className="ol-cap-wait">{waiting} người đang xếp hàng</span>}
    </div>
  );
}

export function OnlineLobby() {
  const set = useUI((s) => s.set);
  const portrait = useDevice((d) => d.portrait && d.width < 700);
  const [latest, setLatest] = useState<SaveEnvelope | null | undefined>(undefined);
  const [room, setRoom] = useState(ROOMS[0].id);
  const [useSave, setUseSave] = useState(true);
  const [busy, setBusy] = useState(false);
  const status = useOnline((s) => s.status);
  const error = useOnline((s) => s.error);
  const gateErr = useGate((s) => s.error);
  const full = useGate((s) => s.playing >= s.cap);
  useEffect(() => { hasAnySave().then(setLatest).catch(() => setLatest(null)); void gate.watch(); }, []);
  const configured = online.configured();
  const go = async () => {
    if (busy) return;
    setBusy(true);
    const name = latest && useSave ? latest.meta.name : 'Người chơi';
    afterAdmit = async () => {
      controller.pendingOnline = room;
      if (latest && useSave) { const slot = await slotOfLatest(); if (slot) { await controller.continueFrom(slot); return; } }
      set({ screen: 'create' }); // tạo nhân vật → chọn chế độ → vào phòng sau khi tải xong
    };
    if (full) { set({ screen: 'queue' }); void gate.request(room, name, online.id).then((ok) => { if (ok && useUI.getState().screen === 'queue') void afterAdmit?.(); }); return; }
    const ok = await gate.request(room, name, online.id);
    if (ok) await afterAdmit(); else setBusy(false);
  };
  return (
    <main className={`gm ${portrait ? 'gm-portrait' : ''}`} id="main">
      <div className="gm-bg" aria-hidden><GateScene portrait={portrait} cover /></div>
      <div className="gm-shade" aria-hidden />
      <section className="gm-panel ol-lobby" aria-labelledby="ol-title">
        <button className="gm-back" onClick={() => { controller.pendingOnline = null; void gate.close(); set({ screen: 'menu' }); }} aria-label="Quay lại"><Icon name="back" size={20} /></button>
        <div className="gm-avatar" aria-hidden><Icon name="globe" size={32} /></div>
        <h2 id="ol-title">Chơi trực tuyến</h2>
        <p className="gm-sub">Gặp và trò chuyện real-time với người chơi khác. NPC và lịch sinh hoạt vẫn giả lập như chế độ ngoại tuyến.</p>
        {!configured ? <p className="gm-note err">Bản cài đặt này chưa bật dịch vụ trực tuyến.</p> : <>
          <CapacityMeter />
          <div className="ol-label">Phân khu</div>
          <div className="ol-rooms" role="radiogroup" aria-label="Chọn phân khu">
            {ROOMS.map((r) => (
              <button key={r.id} role="radio" aria-checked={room === r.id} className={`ol-room ${room === r.id ? 'on' : ''}`} onClick={() => setRoom(r.id)}>
                <b>{r.name}</b><span>{r.desc}</span>
              </button>
            ))}
          </div>
          <div className="ol-label">Nhân vật</div>
          <div className="ol-rooms two" role="radiogroup" aria-label="Chọn nhân vật">
            {latest && <button role="radio" aria-checked={useSave} className={`ol-room ${useSave ? 'on' : ''}`} onClick={() => setUseSave(true)}><b>{latest.meta.name}</b><span>Tiếp tục · Ngày {latest.meta.day}</span></button>}
            <button role="radio" aria-checked={!latest || !useSave} className={`ol-room ${!latest || !useSave ? 'on' : ''}`} onClick={() => setUseSave(false)}><b>Nhân vật mới</b><span>Tạo rồi vào phòng</span></button>
          </div>
          {(status === 'error' || status === 'full') && error && <p className="gm-note err" role="alert">{error}</p>}
          {gateErr && <p className="gm-note err" role="alert">{gateErr}</p>}
          <button className="gm-btn primary" disabled={busy || latest === undefined} onClick={go} data-autofocus>{busy ? 'Đang vào…' : full ? 'Vào hàng đợi' : 'Vào phòng'}</button>
          <p className="ol-rules">Lịch sự · Không chia sẻ số điện thoại, địa chỉ, liên kết · Có thể chặn và báo cáo người chơi.</p>
          <p className="ol-rules">Phòng có thể có nhân vật do AI điều khiển cùng trò chuyện.</p>
        </>}
      </section>
    </main>
  );
}

// ======================= Hàng đợi =======================
function fmtWait(sec: number) {
  if (sec < 60) return `${Math.max(1, Math.round(sec))} giây`;
  const m = Math.round(sec / 60);
  return m < 60 ? `${m} phút` : `${Math.floor(m / 60)} giờ ${m % 60} phút`;
}
function useTicker(ms: number) { const [, f] = useState(0); useEffect(() => { const t = setInterval(() => f((x) => x + 1), ms); return () => clearInterval(t); }, [ms]); }

export function QueueScreen() {
  const set = useUI((s) => s.set);
  const portrait = useDevice((d) => d.portrait && d.width < 700);
  const g = useGate();
  useTicker(1000);
  const waited = g.joinedQueueAt ? (Date.now() - g.joinedQueueAt) / 1000 : 0;
  const total = Math.max(1, g.waiting);
  const ring = g.position > 0 ? 1 - (g.position - 1) / Math.max(total, g.position) : 1;
  const C = 2 * Math.PI * 54;
  const admitted = g.status === 'admitted';
  const leave = async () => { await gate.close(); afterAdmit = null; set({ screen: 'lobby' }); };
  const playOffline = async () => { useGate.getState().set({ background: true }); const go = afterAdmit; afterAdmit = null; await go?.(); };
  return (
    <main className={`gm ${portrait ? 'gm-portrait' : ''}`} id="main">
      <div className="gm-bg" aria-hidden><GateScene portrait={portrait} cover /></div>
      <div className="gm-shade" aria-hidden />
      <section className="gm-panel ol-queue" aria-labelledby="q-title" aria-live="polite">
        <span className={`gm-status ${admitted ? 'ok' : ''}`}>{admitted ? 'Đã đến lượt' : g.status === 'error' ? 'Mất kết nối' : 'Đang xếp hàng'}</span>
        <div className="q-ring" role="img" aria-label={`Vị trí ${g.position || '—'} trong hàng đợi`}>
          <svg viewBox="0 0 120 120" aria-hidden>
            <circle cx="60" cy="60" r="54" className="q-track" />
            <circle cx="60" cy="60" r="54" className="q-fill" strokeDasharray={C} strokeDashoffset={C * (1 - ring)} />
          </svg>
          <div className="q-num"><span>Vị trí</span><b>{admitted ? '✓' : g.position || '—'}</b>{!admitted && <em>/ {total}</em>}</div>
        </div>
        <h2 id="q-title">{admitted ? 'Đang vào phòng…' : 'Máy chủ đang đủ người'}</h2>
        <p className="gm-sub">{admitted ? 'Chuẩn bị nhân vật của bạn.' : `Tối đa ${g.cap + BOT_COUNT} người chơi trực tuyến cùng lúc để giữ trò chuyện mượt. Bạn sẽ tự động vào khi có chỗ trống.`}</p>
        <div className="q-stats">
          <div><span>Phía trước bạn</span><b>{g.ahead}</b></div>
          <div><span>Đang chơi</span><b>{g.playing + BOT_COUNT}/{g.cap + BOT_COUNT}</b></div>
          <div><span>Ước tính</span><b>{g.etaSec ? `~${fmtWait(g.etaSec)}` : 'Đang tính…'}</b></div>
        </div>
        <p className="q-waited">Đã chờ {fmtWait(waited)}</p>
        <button className="gm-btn primary" onClick={playOffline} disabled={admitted}>Chơi ngoại tuyến trong lúc chờ</button>
        <button className="gm-btn" onClick={leave}>Rời hàng đợi</button>
        <p className="ol-rules">Giữ nguyên chỗ trong hàng nếu bạn tải lại trang (trong 30 phút). Khi đến lượt, game tự vào phòng — không cần làm gì thêm.</p>
      </section>
    </main>
  );
}

/** Chip hàng đợi trong game (đang chơi ngoại tuyến chờ lượt). */
export function QueueChip({ compact }: { compact?: boolean }) {
  const g = useGate();
  if (g.status !== 'queued' && g.status !== 'checking') return null;
  if (!g.background) return null;
  return (
    <button className={`ol-chip queue ${compact ? 'compact' : ''}`} onClick={() => useUI.getState().toast({ id: 'queue', text: `Hàng đợi trực tuyến: vị trí ${g.position || '—'}/${g.waiting} · ${g.playing + BOT_COUNT}/${g.cap + BOT_COUNT} đang chơi${g.etaSec ? ` · ~${fmtWait(g.etaSec)}` : ''}. Rời hàng đợi trong menu Tạm dừng.`, severity: 'info' })} aria-label={`Đang xếp hàng trực tuyến, vị trí ${g.position}`}>
      <i aria-hidden />{compact ? `Hàng đợi #${g.position || '…'}` : `Hàng đợi trực tuyến · #${g.position || '…'} / ${g.waiting}`}
    </button>
  );
}

// ======================= Chip trạng thái =======================
export function OnlineChip({ compact }: { compact?: boolean }) {
  const status = useOnline((s) => s.status);
  const room = useOnline((s) => s.room);
  const n = useOnline((s) => s.peers.length);
  if (status === 'off' || status === 'error' || status === 'full') return null;
  const label = status === 'online' ? `${n + 1} người` : status === 'connecting' ? 'Đang kết nối…' : 'Đang kết nối lại…';
  return (
    <button className={`ol-chip ${status} ${compact ? 'compact' : ''}`} onClick={() => controller.openChat()} aria-label={`Trực tuyến: ${label}. Mở trò chuyện`}>
      <i aria-hidden />{compact ? label : `${ROOMS.find((r) => r.id === room)?.name ?? 'Trực tuyến'} · ${label}`}
    </button>
  );
}

// ======================= Khung trò chuyện =======================
export function ChatDock() {
  const status = useOnline((s) => s.status);
  const open = useOnline((s) => s.chatOpen);
  const lines = useOnline((s) => s.lines);
  const unread = useOnline((s) => s.unread);
  const touch = useDevice((d) => d.touch);
  const overlay = useUI((s) => s.overlay);
  if (status === 'off' || status === 'error' || status === 'full') return null;
  if (overlay && !open) return null;
  // desktop thu gọn: 3 dòng gần nhất mờ dần + gợi ý phím
  if (!open) {
    if (touch) return (
      <button className="ol-fab" onClick={() => controller.openChat()} aria-label={`Trò chuyện${unread ? `, ${unread} tin mới` : ''}`}>
        <Icon name="talk" size={24} />{unread > 0 && <span className="m-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
    );
    const recent = lines.slice(-3);
    return (
      <div className="ol-peek" aria-live="polite">
        {recent.map((l) => <p key={l.mid} className={l.system ? 'sys' : ''}>{l.system ? l.text : <><b>{l.mine ? 'Bạn' : l.name}{l.scope !== 'room' ? ` · ${SCOPE_LABEL[l.scope]}` : ''}:</b> {l.text}</>}</p>)}
        <button className="ol-hint" onClick={() => controller.openChat()}><span className="kbd">T</span> Trò chuyện{unread ? ` · ${unread} tin mới` : ''}</button>
      </div>
    );
  }
  return <ChatPanel touch={touch} />;
}

function ChatPanel({ touch }: { touch: boolean }) {
  const lines = useOnline((s) => s.lines);
  const scope = useOnline((s) => s.scope);
  const whisperTo = useOnline((s) => s.whisperTo);
  const peers = useOnline((s) => s.peers);
  const set = useOnline((s) => s.set);
  const [tab, setTab] = useState<'chat' | 'people'>('chat');
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const target = peers.find((p) => p.id === whisperTo) ?? null;
  useEffect(() => { if (!touch) inputRef.current?.focus(); }, [touch, tab]);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [lines.length, tab]);
  const close = () => { set({ chatOpen: false, typing: false }); inputRef.current?.blur(); };
  const send = (raw = text) => {
    const r = online.send(raw, scope, whisperTo);
    if (r.ok) { setText(''); setErr(''); } else if (r.message) setErr(r.message);
  };
  const setScope = (sc: ChatScope) => set({ scope: sc, whisperTo: sc === 'whisper' ? whisperTo : null });
  const visible = lines.filter((l) => scope !== 'whisper' || l.scope === 'whisper' || l.system);
  return (
    <section className={`ol-panel ${touch ? 'sheet' : ''}`} aria-label="Trò chuyện trực tuyến" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }}>
      <header className="ol-head">
        <div className="ol-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'chat'} className={tab === 'chat' ? 'on' : ''} onClick={() => setTab('chat')}>Trò chuyện</button>
          <button role="tab" aria-selected={tab === 'people'} className={tab === 'people' ? 'on' : ''} onClick={() => setTab('people')}>Người chơi <span className="ol-count">{peers.length + 1}</span></button>
        </div>
        <button className="ol-x" onClick={close} aria-label="Đóng trò chuyện"><Icon name="close" size={18} /></button>
      </header>
      {tab === 'chat' ? <>
        <div className="ol-scopes" role="radiogroup" aria-label="Phạm vi">
          {(['room', 'near', 'whisper'] as ChatScope[]).map((sc) => (
            <button key={sc} role="radio" aria-checked={scope === sc} className={scope === sc ? 'on' : ''} onClick={() => setScope(sc)} disabled={sc === 'whisper' && !peers.length}>
              {sc === 'whisper' && target ? `Riêng: ${target.name}` : SCOPE_LABEL[sc]}
            </button>
          ))}
        </div>
        <div className="ol-log" ref={logRef} role="log" aria-live="polite">
          {!visible.length && <p className="ol-empty">{scope === 'near' ? `Tin “Gần đây” chỉ tới người trong bán kính ${NEAR_RADIUS} m.` : 'Chưa có tin nhắn. Hãy chào mọi người!'}</p>}
          {visible.map((l) => l.system ? <p key={l.mid} className="ol-sys">{l.text}</p> : (
            <div key={l.mid} className={`ol-msg ${l.mine ? 'mine' : ''} ${l.scope}`}>
              <span className="ol-meta">{l.mine ? 'Bạn' : l.name}{l.scope !== 'room' ? ` · ${l.scope === 'whisper' ? (l.mine ? `riêng → ${peers.find((p) => p.id === l.to)?.name ?? '…'}` : 'nhắn riêng') : 'gần đây'}` : ''}</span>
              <span className="ol-text">{l.text}</span>
            </div>
          ))}
        </div>
        {scope === 'whisper' && !target && <p className="ol-warn">Chọn người nhận ở tab Người chơi.</p>}
        {touch && <div className="ol-quick">{QUICK_PHRASES.map((q) => <button key={q} onClick={() => send(q)}>{q}</button>)}</div>}
        <form className="ol-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input ref={inputRef} value={text} maxLength={MSG_MAX} onChange={(e) => setText(e.target.value)} placeholder={scope === 'near' ? 'Nói với người gần bạn…' : scope === 'whisper' ? 'Nhắn riêng…' : 'Nhắn cả phòng…'}
            onFocus={() => set({ typing: true })} onBlur={() => set({ typing: false })} aria-label="Nội dung tin nhắn" enterKeyHint="send" />
          <button type="submit" disabled={!text.trim() || (scope === 'whisper' && !target)} aria-label="Gửi"><Icon name="send" size={20} /></button>
        </form>
        {err && <p className="ol-warn" role="alert">{err}</p>}
      </> : <People peers={peers} onWhisper={(id) => { set({ scope: 'whisper', whisperTo: id }); setTab('chat'); }} />}
    </section>
  );
}

function People({ peers, onWhisper }: { peers: PeerView[]; onWhisper: (id: string) => void }) {
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  return (
    <div className="ol-people">
      <div className="ol-person me"><span className="ol-dot" /><b>Bạn</b><em>đang trực tuyến</em></div>
      {!peers.length && <p className="ol-empty">Chưa có ai khác trong phòng. Mời bạn bè cùng vào phân khu này.</p>}
      {peers.map((p) => (
        <div key={p.id} className={`ol-person ${p.blocked ? 'blocked' : ''}`}>
          <span className="ol-dot" />
          <div className="ol-pinfo"><b>{p.name}</b><em>{p.blocked ? 'Đã chặn' : p.elsewhere ? 'Ở khu vực khác' : p.dist === null ? 'Đang tải vị trí…' : p.dist <= NEAR_RADIUS ? `Gần bạn · ${p.dist} m` : `Cách ${p.dist} m`}</em></div>
          <div className="ol-pact">
            {!p.blocked && <button onClick={() => onWhisper(p.id)} aria-label={`Nhắn riêng ${p.name}`}><Icon name="talk" size={16} /></button>}
            <button onClick={() => online.block(p.id, !p.blocked)} aria-label={p.blocked ? `Bỏ chặn ${p.name}` : `Chặn ${p.name}`}>{p.blocked ? 'Bỏ chặn' : 'Chặn'}</button>
            <button onClick={() => setReportFor(reportFor === p.id ? null : p.id)} aria-label={`Báo cáo ${p.name}`}><Icon name="flag" size={16} /></button>
          </div>
          {reportFor === p.id && (
            <div className="ol-report">
              {['Lời lẽ xúc phạm', 'Quấy rối', 'Chia sẻ thông tin cá nhân', 'Spam'].map((r) => (
                <button key={r} onClick={async () => { const res = await online.report(p.id, r); setMsg(res.message); setReportFor(null); if (res.ok) online.block(p.id, true); }}>{r}</button>
              ))}
            </div>
          )}
        </div>
      ))}
      {msg && <p className="ol-warn" role="status">{msg}</p>}
    </div>
  );
}
