import { useMemo, useState } from 'react';
import * as api from '../api';
import { fmt, Stat } from '../charts';
import { ago } from '../format';
import type { LiveState } from '../live';
import { act, Badge, Drawer, ErrorBox, Loading, NavIcon, PageHead, Toggle, useLoad } from '../ui';
import { applyBotOverrides, defaultPersona, PERSONAS, type BotOverride, type Persona } from '../../bots/personas';
import { ROOMS } from '../../online/protocol';

const roomName = (id: string) => ROOMS.find((r) => r.id === id)?.name ?? id;

export function BotsPage({ live }: { live: LiveState }) {
  const cfg = useLoad(() => api.configRows(), []);
  const ov = useLoad(async () => { const rows = await api.botOverrides(); applyBotOverrides(rows); return rows; }, []);
  const stats = useLoad(() => api.overview(7), []);
  const ai = useLoad(() => api.aiStatus(), []);
  const [edit, setEdit] = useState<string | null>(null);
  const bots = (cfg.data?.find((r) => r.key === 'bots')?.value ?? { enabled: true, llm: true }) as { enabled: boolean; llm: boolean };
  const saveGlobal = (v: { enabled: boolean; llm: boolean }) => void act(() => api.saveConfig('bots', v), 'Đã lưu').then((ok) => ok && cfg.reload());
  const byBot = useMemo(() => new Map((stats.data?.bots ?? []).map((b) => [b.key, b])), [stats.data]);
  const series = stats.data?.series ?? [];
  const liveById = useMemo(() => new Map(Object.values(live.bots).map((b) => [b.id, b])), [live.bots]);
  const overridden = new Set((ov.data ?? []).map((o) => o.id));
  // dựa trên dữ liệu ghi đè đã tải (PERSONAS đã được áp)
  const list: Persona[] = ov.data ? PERSONAS.map((p) => ({ ...p })) : [];
  const t = stats.data?.totals;
  const week = series.reduce((a, d) => ({ ai: a.ai + d.bot_ai, fb: a.fb + d.bot_fallback, g: a.g + d.bot_guard }), { ai: 0, fb: 0, g: 0 });
  const totalWeek = week.ai + week.fb + week.g;
  return (
    <>
      <PageHead title="Bạn tù AI" sub="10 nhân vật trò chuyện bằng AI trong chế độ trực tuyến">
        <button className="ad-icon-btn" onClick={() => { cfg.reload(); ov.reload(); stats.reload(); ai.reload(); }} aria-label="Làm mới" title="Làm mới"><NavIcon name="refresh" /></button>
      </PageHead>
      {(cfg.error || ov.error) && <ErrorBox error={(cfg.error || ov.error)!} onRetry={() => { cfg.reload(); ov.reload(); }} />}
      <div className="ad-stats">
        <Stat label="Đang hoạt động" value={`${Object.keys(live.bots).length}/${PERSONAS.filter((p) => p.enabled).length}`} hint="Chỉ chạy khi phòng có người chơi thật" />
        <Stat label="Câu trả lời hôm nay" value={t ? fmt(t.bot_replies_today) : '—'} />
        <Stat label="Tỉ lệ AI (7 ngày)" value={totalWeek ? `${Math.round((week.ai / totalWeek) * 100)}%` : '—'} hint={totalWeek ? `${fmt(week.fb)} dự phòng · ${fmt(week.g)} bị chặn` : 'Chưa có dữ liệu'} />
        <Stat label="AI phía máy chủ" value={ai.data ? (ai.data.ok ? 'Sẵn sàng' : 'Chưa cấu hình') : '—'} tone={ai.data && !ai.data.ok ? 'bad' : 'good'} hint={ai.data?.error} />
      </div>
      <section className="ad-card">
        <header className="ad-card-head"><div><h3>Điều khiển chung</h3><p>Có hiệu lực trong khoảng 1 phút với mọi phòng.</p></div></header>
        {cfg.loading && !cfg.data ? <Loading rows={2} /> : (
          <div className="ad-form-row">
            <label className="ad-inline"><Toggle label="Bật bạn tù" checked={bots.enabled} onChange={(v) => saveGlobal({ ...bots, enabled: v })} /><span><b>Bạn tù trong phòng trực tuyến</b><small>Tắt: bạn tù rời khỏi mọi phòng và không tính vào số người trực tuyến.</small></span></label>
            <label className="ad-inline"><Toggle label="Dùng AI" checked={bots.llm} disabled={!bots.enabled} onChange={(v) => saveGlobal({ ...bots, llm: v })} /><span><b>Trả lời bằng AI</b><small>Tắt: bạn tù chỉ dùng câu trả lời soạn sẵn (không tốn hạn mức AI).</small></span></label>
          </div>
        )}
      </section>
      <section className="ad-card flush">
        <header className="ad-card-head pad"><div><h3>Danh sách bạn tù</h3><p>Bấm vào một dòng để sửa tên, phân khu, tính cách.</p></div></header>
        {ov.loading && !ov.data ? <Loading rows={6} /> : (
          <div className="ad-table-wrap">
            <table className="ad-table hover">
              <thead><tr><th>Nhân vật</th><th>Phân khu</th><th>Chủ động</th><th className="num">Trả lời (7 ngày)</th><th>Trạng thái</th></tr></thead>
              <tbody>
                {list.map((p) => {
                  const st = byBot.get(p.id);
                  const lv = liveById.get(`p_${p.id}x7q`);
                  return (
                    <tr key={p.id} onClick={() => setEdit(p.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setEdit(p.id)}>
                      <td><div className="ad-who"><span className="ad-avatar bot">{p.name.slice(0, 1)}</span><div><b>{p.name}{overridden.has(p.id) && <small className="ad-muted"> · đã chỉnh</small>}</b><small>{p.age} tuổi · {p.hometown} · {p.personality}</small></div></div></td>
                      <td>{roomName(p.room)}</td>
                      <td><span className="ad-meter"><i style={{ width: `${p.sociable * 100}%` }} /></span></td>
                      <td className="num">{st ? fmt(st.n) : 0}{st?.avg_ms ? <small className="ad-muted"> · {(st.avg_ms / 1000).toFixed(1)} s</small> : null}</td>
                      <td>{!p.enabled || !bots.enabled ? <Badge>Đã tắt</Badge> : lv ? <Badge tone="ok">Trong phòng · {lv.zone || '—'}</Badge> : <Badge tone="muted">Chờ người chơi</Badge>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="ad-card">
        <header className="ad-card-head"><div><h3>Mô hình AI (Groq)</h3><p>Tự chuyển sang mô hình khác khi một mô hình lỗi hoặc hết hạn mức. Số liệu của phiên máy chủ hiện tại.</p></div></header>
        {ai.loading && !ai.data ? <Loading rows={3} /> : ai.data?.models ? (
          <div className="ad-table-wrap small">
            <table className="ad-table">
              <thead><tr><th>Mô hình</th><th>Dùng cho</th><th>Mạch</th><th className="num">Thành công</th><th className="num">Lỗi</th><th className="num">Trung bình</th></tr></thead>
              <tbody>{ai.data.models.map((m) => (
                <tr key={m.id}><td className="ad-mono">{m.id}</td><td>{m.capabilities.join(', ')}</td>
                  <td>{m.breaker.state === 'closed' ? <Badge tone="ok">Bình thường</Badge> : m.breaker.state === 'half_open' ? <Badge tone="warn">Thử lại</Badge> : <Badge tone="bad">Tạm ngắt{m.breaker.openUntil ? ` · ${ago(new Date(m.breaker.openUntil).toISOString()).replace(' trước', '')}` : ''}</Badge>}</td>
                  <td className="num">{m.ok}</td><td className="num">{m.fail}</td><td className="num">{m.avgMs ? `${(m.avgMs / 1000).toFixed(1)} s` : '—'}</td></tr>
              ))}</tbody>
            </table>
          </div>
        ) : <ErrorBox error={ai.data?.error ?? 'Không lấy được trạng thái AI.'} onRetry={ai.reload} />}
      </section>
      {edit && <BotEditor id={edit} overridden={overridden.has(edit)} onClose={() => setEdit(null)} onSaved={() => { ov.reload(); }} />}
    </>
  );
}

function BotEditor({ id, overridden, onClose, onSaved }: { id: string; overridden: boolean; onClose: () => void; onSaved: () => void }) {
  const cur = PERSONAS.find((p) => p.id === id)!;
  const def = defaultPersona(id)!;
  const [f, setF] = useState({ enabled: cur.enabled, name: cur.name, room: cur.room, sociable: cur.sociable, personality: cur.personality, style: cur.style, background: cur.background });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const valid = f.name.trim().length >= 2 && f.name.trim().length <= 24;
  const save = async () => {
    setBusy(true);
    // chỉ lưu trường khác mặc định (mặc định trong code vẫn là nguồn gốc)
    const o: BotOverride = { id };
    for (const k of Object.keys(f) as (keyof typeof f)[]) {
      const v = typeof f[k] === 'string' ? (f[k] as string).trim() : f[k];
      (o as unknown as Record<string, unknown>)[k] = v === def[k] ? null : v;
    }
    if (await act(() => api.saveBot(o), 'Đã lưu bạn tù — áp dụng trong khoảng 1 phút')) { onSaved(); onClose(); }
    setBusy(false);
  };
  const reset = async () => { setBusy(true); if (await act(() => api.resetBot(id), 'Đã khôi phục mặc định')) { onSaved(); onClose(); } setBusy(false); };
  return (
    <Drawer title={cur.name} sub={`${cur.age} tuổi · ${cur.hometown} · sở thích: ${cur.interests.join(', ')}`} onClose={onClose}
      actions={<>
        <button className="ad-btn primary" disabled={busy || !valid} onClick={() => void save()}>Lưu thay đổi</button>
        {overridden && <button className="ad-btn" disabled={busy} onClick={() => void reset()}>Khôi phục mặc định</button>}
      </>}>
      <label className="ad-inline"><Toggle label="Bật" checked={f.enabled} onChange={(v) => set('enabled', v)} /><span><b>{f.enabled ? 'Đang bật' : 'Đã tắt'}</b><small>Tắt: nhân vật này không xuất hiện trong phòng.</small></span></label>
      <label className="ad-field"><span>Tên hiển thị</span><input value={f.name} maxLength={24} onChange={(e) => set('name', e.target.value)} />{!valid && <small className="ad-err-text">2–24 ký tự</small>}</label>
      <label className="ad-field"><span>Phân khu</span>
        <select value={f.room} onChange={(e) => set('room', e.target.value)}>{ROOMS.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
      </label>
      <label className="ad-field"><span>Mức chủ động bắt chuyện · {Math.round(f.sociable * 100)}%</span><input type="range" min={0} max={1} step={0.05} value={f.sociable} onChange={(e) => set('sociable', Number(e.target.value))} /></label>
      <label className="ad-field"><span>Tính cách</span><textarea rows={2} maxLength={200} value={f.personality} onChange={(e) => set('personality', e.target.value)} /></label>
      <label className="ad-field"><span>Cách nói chuyện</span><textarea rows={2} maxLength={200} value={f.style} onChange={(e) => set('style', e.target.value)} /></label>
      <label className="ad-field"><span>Câu chuyện trong game</span><textarea rows={3} maxLength={300} value={f.background} onChange={(e) => set('background', e.target.value)} /></label>
      <p className="ad-muted small">Luật an toàn (không nội dung xấu, không xin thông tin cá nhân, trả lời thật khi được hỏi có phải AI) luôn áp dụng và không chỉnh được ở đây.</p>
    </Drawer>
  );
}
