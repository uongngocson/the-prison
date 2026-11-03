import { useMemo, useState } from 'react';
import * as api from '../api';
import { BarChart, fmt, Stat, type Row } from '../charts';
import { ago, dateTime, dayLabel, ERROR_KIND, minutes, PLATFORM, shortId } from '../format';
import type { LiveState } from '../live';
import { act, Badge, BanDialog, Confirm, Drawer, ErrorBox, Loading, PageHead, Search, Segmented, useLoad } from '../ui';
import type { OpenUser } from '../AdminApp';

const PAGE = 50;

export function UsersPage({ live, open, setOpen }: { live: LiveState; open: OpenUser | null; setOpen: (u: OpenUser | null) => void }) {
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('all');
  const [page, setPage] = useState(0);
  const { data, error, loading, reload } = useLoad(() => api.users(search, kind, PAGE, page * PAGE), [search, kind, page]);
  const onlinePeers = useMemo(() => new Set(live.players.map((p) => p.id)), [live.players]);
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE));
  return (
    <>
      <PageHead title="Người chơi" sub="Tài khoản đã đăng nhập và khách vãng lai (mỗi trình duyệt là một khách)">
        <Search value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="Tìm tên, email, mã…" />
      </PageHead>
      <div className="ad-toolbar">
        <Segmented label="Lọc" value={kind} onChange={(v) => { setKind(v); setPage(0); }} options={[{ value: 'all', label: 'Tất cả' }, { value: 'accounts', label: 'Tài khoản' }, { value: 'guests', label: 'Khách vãng lai' }, { value: 'banned', label: 'Đang bị khóa' }]} />
        <span className="ad-muted">{data ? `${fmt(data.total)} người` : ''}</span>
      </div>
      {error && <ErrorBox error={error} onRetry={reload} />}
      {loading && !data ? <Loading rows={8} /> : data && (
        <section className="ad-card flush">
          <div className="ad-table-wrap">
            <table className="ad-table hover">
              <thead><tr><th>Người chơi</th><th>Loại</th><th>Thiết bị</th><th className="num">Số ngày chơi</th><th className="num">Thời gian chơi</th><th className="num">Lỗi</th><th>Hoạt động gần nhất</th><th>Trạng thái</th></tr></thead>
              <tbody>
                {data.rows.map((u) => {
                  const isOnline = u.peers.some((p) => onlinePeers.has(p));
                  return (
                    <tr key={u.key} onClick={() => setOpen({ userId: u.user_id, visitorId: u.visitor_id, label: u.name || u.email || shortId(u.key) })} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen({ userId: u.user_id, visitorId: u.visitor_id })}>
                      <td><div className="ad-who"><span className={`ad-avatar ${u.kind}`}>{(u.name || u.email || '?').slice(0, 1).toUpperCase()}</span><div><b>{u.name || <i className="ad-muted">Chưa đặt tên</i>}</b><small>{u.email ?? `Khách · ${shortId(u.visitor_id)}`}</small></div></div></td>
                      <td>{u.kind === 'account' ? <Badge tone="info">Tài khoản</Badge> : <Badge>Khách</Badge>}{u.is_admin && <Badge tone="accent">Admin</Badge>}</td>
                      <td>{PLATFORM[u.platform] ?? (u.platform || '—')}{u.devices > 1 && <small className="ad-muted"> · {u.devices} máy</small>}</td>
                      <td className="num">{fmt(u.days)}</td>
                      <td className="num">{minutes(u.minutes)}</td>
                      <td className="num">{u.errors ? <Badge tone="warn">{u.errors}</Badge> : <span className="ad-muted">0</span>}</td>
                      <td title={dateTime(u.last_seen)}>{ago(u.last_seen)}</td>
                      <td>{u.banned ? <Badge tone="bad">Bị khóa</Badge> : isOnline ? <Badge tone="ok">Đang trực tuyến</Badge> : <span className="ad-muted">—</span>}</td>
                    </tr>
                  );
                })}
                {!data.rows.length && <tr><td colSpan={8} className="ad-empty">Không có người chơi phù hợp.</td></tr>}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <footer className="ad-pager">
              <button className="ad-btn" disabled={page === 0} onClick={() => setPage(page - 1)}>Trước</button>
              <span>Trang {page + 1}/{pages}</span>
              <button className="ad-btn" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Sau</button>
            </footer>
          )}
        </section>
      )}
      {open && <UserDrawer target={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </>
  );
}

function UserDrawer({ target, onClose, onChanged }: { target: OpenUser; onClose: () => void; onChanged: () => void }) {
  const { data, error, loading, reload } = useLoad(() => api.userDetail(target.userId, target.visitorId), [target.userId, target.visitorId]);
  const [banOpen, setBanOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const dev = data?.devices[0];
  const name = dev?.name || data?.account?.email || target.label || 'Người chơi';
  const activeBan = data?.bans.find((b) => !b.lifted_at && (!b.expires_at || new Date(b.expires_at) > new Date()));
  const days: Row[] = useMemo(() => {
    const by = new Map((data?.days ?? []).map((d) => [d.day, d]));
    const out: Row[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() + 7 * 3600_000 - i * 86400_000).toISOString().slice(0, 10);
      const v = by.get(d);
      out.push({ label: dayLabel(d), offline: (v?.minutes ?? 0) - (v?.online_minutes ?? 0), online: v?.online_minutes ?? 0 });
    }
    return out;
  }, [data]);
  const changed = () => { reload(); onChanged(); };
  const total = data?.devices.reduce((a, d) => a + d.minutes, 0) ?? 0;
  return (
    <Drawer title={name} sub={data?.account ? <>Tài khoản · {data.account.email}</> : <>Khách vãng lai · {shortId(target.visitorId)}</>} onClose={onClose}
      actions={data && <>
        {activeBan ? <button className="ad-btn" onClick={() => void act(() => api.liftBan(activeBan.id), 'Đã mở khóa').then(changed)}>Mở khóa trực tuyến</button>
          : <button className="ad-btn danger" onClick={() => setBanOpen(true)}>Khóa trực tuyến</button>}
        {!data.account && target.visitorId && <button className="ad-btn" onClick={() => setDelOpen(true)}>Xóa dữ liệu khách</button>}
      </>}>
      {error && <ErrorBox error={error} onRetry={reload} />}
      {loading && !data ? <Loading rows={6} /> : data && (
        <>
          {activeBan && <div className="ad-banner bad"><b>Đang bị khóa trực tuyến</b> — {activeBan.reason} · {activeBan.expires_at ? `đến ${dateTime(activeBan.expires_at)}` : 'vĩnh viễn'}</div>}
          <div className="ad-stats compact">
            <Stat label="Tổng thời gian chơi" value={minutes(total)} />
            <Stat label="Số phiên" value={fmt(data.devices.reduce((a, d) => a + d.sessions, 0))} />
            <Stat label="Lần đầu" value={dateTime(data.account?.created_at ?? data.devices.at(-1)?.first_seen)} />
            <Stat label="Gần nhất" value={ago(dev?.last_seen ?? data.account?.last_sign_in_at)} />
          </div>
          <h3 className="ad-h3">Thời gian chơi 30 ngày (phút)</h3>
          <BarChart data={days} series={[{ key: 'offline', label: 'Ngoại tuyến', color: 'var(--s1)' }, { key: 'online', label: 'Trực tuyến', color: 'var(--s3)' }]} height={150} />
          <h3 className="ad-h3">Thiết bị ({data.devices.length})</h3>
          {data.devices.length ? (
            <ul className="ad-list">
              {data.devices.map((d) => (
                <li key={d.id}><div><b>{PLATFORM[d.platform] ?? (d.platform || 'Không rõ')} · {d.os || '—'} · {d.browser || '—'}</b><small>Mã {shortId(d.id)} · bản {d.build || '—'} · {d.sessions} phiên · {minutes(d.minutes)}</small></div><span title={dateTime(d.last_seen)}>{ago(d.last_seen)}</span></li>
              ))}
            </ul>
          ) : <p className="ad-empty">Chưa ghi nhận thiết bị (người chơi chưa mở game sau khi bật thống kê).</p>}
          {data.account && (<>
            <h3 className="ad-h3">Bản lưu trên đám mây ({data.saves.length})</h3>
            {data.saves.length ? <ul className="ad-list">{data.saves.map((s) => <li key={s.id}><div><b>{s.name ?? 'Nhân vật'} · Ngày {s.day ?? '—'}</b><small>Ô {s.slot} · phiên bản {s.revision} · {s.zone ?? ''}</small></div><span>{ago(s.updated_at)}</span></li>)}</ul> : <p className="ad-empty">Không có bản lưu đám mây.</p>}
          </>)}
          <h3 className="ad-h3">Lỗi gần đây ({data.errors.length})</h3>
          {data.errors.length ? <ul className="ad-list">{data.errors.map((e) => <li key={e.id}><div><b className="ad-mono">{e.message}</b><small>{ERROR_KIND[e.kind] ?? e.kind} · {e.count} lần · bản {e.build || '—'}{e.resolved ? ' · đã xử lý' : ''}</small></div><span>{ago(e.last_at)}</span></li>)}</ul> : <p className="ad-empty">Không có lỗi.</p>}
          <h3 className="ad-h3">Bị báo cáo ({data.reports.length})</h3>
          {data.reports.length ? <ul className="ad-list">{data.reports.map((r) => <li key={r.id}><div><b>{r.reason}</b><small>{r.excerpt || '—'}</small></div><span>{ago(r.created_at)}</span></li>)}</ul> : <p className="ad-empty">Không có báo cáo.</p>}
          <h3 className="ad-h3">Lịch sử khóa ({data.bans.length})</h3>
          {data.bans.length ? <ul className="ad-list">{data.bans.map((b) => <li key={b.id}><div><b>{b.reason}</b><small>{dateTime(b.created_at)} → {b.expires_at ? dateTime(b.expires_at) : 'vĩnh viễn'}{b.lifted_at ? ` · mở khóa ${dateTime(b.lifted_at)}` : ''}</small></div></li>)}</ul> : <p className="ad-empty">Chưa từng bị khóa.</p>}
        </>
      )}
      {banOpen && <BanDialog name={name} onClose={() => setBanOpen(false)} onConfirm={async (reason, hours) => { if (await act(() => api.ban({ userId: target.userId, visitorId: target.visitorId ?? data?.devices[0]?.id }, reason, hours), 'Đã khóa trực tuyến')) { setBanOpen(false); changed(); } }} />}
      {delOpen && target.visitorId && <Confirm title="Xóa dữ liệu khách?" text="Xóa toàn bộ thống kê, lịch sử khóa của khách này. Lỗi đã ghi vẫn được giữ. Không thể hoàn tác." okLabel="Xóa" onClose={() => setDelOpen(false)} onConfirm={async () => { if (await act(() => api.deleteGuest(target.visitorId!), 'Đã xóa')) { setDelOpen(false); onClose(); onChanged(); } }} />}
    </Drawer>
  );
}
