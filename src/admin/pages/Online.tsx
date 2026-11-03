import { useEffect, useState } from 'react';
import * as api from '../api';
import { Stat } from '../charts';
import { ago } from '../format';
import type { LiveState } from '../live';
import { act, notify, Badge, ErrorBox, Loading, PageHead, Toggle, useLoad } from '../ui';
import type { OpenUser } from '../AdminApp';
import { ROOMS } from '../../online/protocol';
import { ONLINE_CAP } from '../../online/queue';
import { ClockCard } from '../ClockCard';

export function OnlinePage({ live, showUser }: { live: LiveState; showUser: (u: OpenUser) => void }) {
  const playing = live.players.filter((p) => p.state === 'playing');
  const queued = live.players.filter((p) => p.state === 'queued');
  const bots = Object.values(live.bots);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 10_000); return () => clearInterval(t); }, []);
  const open = async (peer: string, name: string) => {
    try {
      const v = await api.visitorByPeer(peer);
      if (v) showUser({ userId: v.user_id, visitorId: v.user_id ? null : v.id, label: name });
      else throw new Error('Chưa liên kết được người chơi này (họ cần mở game sau khi bật thống kê).');
    } catch (e) { notify((e as Error).message, 'bad'); }
  };
  const cfg = useLoad(() => api.configRows(), []);
  const online = (cfg.data?.find((r) => r.key === 'online')?.value ?? { open: true, cap: ONLINE_CAP }) as { open: boolean; cap: number };
  const [cap, setCap] = useState<number | null>(null);
  const capValue = cap ?? online.cap ?? ONLINE_CAP;
  const save = (v: { open: boolean; cap: number }) => void act(() => api.saveConfig('online', v), 'Đã lưu cấu hình trực tuyến').then((ok) => { if (ok) { setCap(null); cfg.reload(); } });
  return (
    <>
      <PageHead title="Trực tuyến" sub="Cập nhật thời gian thực từ Supabase Realtime">
        <Badge tone={live.connected ? 'ok' : 'warn'}>{live.connected ? 'Đang kết nối' : 'Đang kết nối lại…'}</Badge>
      </PageHead>
      <div className="ad-stats">
        <Stat label="Người chơi thật" value={`${playing.length}/${online.cap ?? ONLINE_CAP}`} hint="Giới hạn chỉ áp cho người chơi thật" />
        <Stat label="Đang xếp hàng" value={queued.length} tone={queued.length ? 'warn' : undefined} />
        <Stat label="Bạn tù AI hoạt động" value={bots.length} hint="Chạy trên máy của một người chơi trong phòng" />
        <Stat label="Hiển thị cho người chơi" value={playing.length + bots.length} hint="Người thật + bạn tù" />
      </div>
      <section className="ad-card">
        <header className="ad-card-head"><div><h3>Cấu hình phòng trực tuyến</h3><p>Áp dụng cho lượt vào phòng tiếp theo (người đang chơi không bị ảnh hưởng).</p></div></header>
        {cfg.error && <ErrorBox error={cfg.error} onRetry={cfg.reload} />}
        {cfg.loading && !cfg.data ? <Loading rows={2} /> : (
          <div className="ad-form-row">
            <label className="ad-inline"><Toggle label="Mở phòng trực tuyến" checked={online.open !== false} onChange={(v) => save({ ...online, open: v })} /><span><b>{online.open !== false ? 'Đang mở' : 'Đang đóng'}</b><small>Khi đóng, người chơi chỉ chơi được ngoại tuyến.</small></span></label>
            <label className="ad-inline"><span><b>Giới hạn người chơi</b><small>1–{ONLINE_CAP} (đã kiểm thử tải tối đa {ONLINE_CAP})</small></span>
              <input type="number" min={1} max={ONLINE_CAP} value={capValue} onChange={(e) => setCap(Math.max(1, Math.min(ONLINE_CAP, Number(e.target.value) || 1)))} className="ad-num" />
              <button className="ad-btn primary" disabled={cap === null || cap === online.cap} onClick={() => save({ ...online, cap: capValue })}>Lưu</button>
            </label>
          </div>
        )}
      </section>
      <ClockCard />
      <div className="ad-grid">
        {ROOMS.map((r) => {
          const ps = live.players.filter((p) => p.room === r.id);
          const bs = bots.filter((b) => b.room === r.id);
          return (
            <section key={r.id} className="ad-card">
              <header className="ad-card-head"><div><h3>{r.name}</h3><p>{ps.filter((p) => p.state === 'playing').length} người chơi · {bs.length} bạn tù</p></div></header>
              <ul className="ad-list">
                {ps.map((p) => (
                  <li key={p.id} className="click" onClick={() => void open(p.id, p.name)}>
                    <div><b>{p.name}</b><small>{p.state === 'playing' ? 'Đang chơi' : 'Đang xếp hàng'} · từ {ago(new Date(p.since).toISOString(), now)}</small></div>
                    {p.state === 'playing' ? <Badge tone="ok">Trực tuyến</Badge> : <Badge tone="warn">Chờ</Badge>}
                  </li>
                ))}
                {bs.map((b) => (
                  <li key={b.id}><div><b>{b.name}</b><small>Bạn tù AI · {b.zone || '—'} · {b.pose === 'walk' ? 'đang đi' : 'đứng'}</small></div><Badge tone="accent">AI</Badge></li>
                ))}
                {!ps.length && !bs.length && <li className="ad-empty">Phòng đang trống.</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
