import { useState } from 'react';
import * as api from '../api';
import { BarChart, ChartCard, fmt, type Row } from '../charts';
import { ago, dateTime, dayLabel, ERROR_KIND, PLATFORM, shortId } from '../format';
import { act, Badge, Confirm, Drawer, ErrorBox, Loading, PageHead, Search, Segmented, useLoad } from '../ui';
import type { OpenUser } from '../AdminApp';

const KINDS = ['all', 'error', 'promise', 'ui', 'fatal', 'loop', 'online', 'ai', 'save'];

export function ErrorsPage({ showUser }: { showUser: (u: OpenUser) => void }) {
  const [days, setDays] = useState(7);
  const [status, setStatus] = useState('open');
  const [kind, setKind] = useState('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<api.ErrorGroup | null>(null);
  const groups = useLoad(() => api.errorGroups(days, status, kind, search), [days, status, kind, search]);
  const ov = useLoad(() => api.overview(Math.max(days, 7)), [days]);
  const rows: Row[] = (ov.data?.series ?? []).slice(-days).map((d) => ({ label: dayLabel(d.day), errors: d.errors, error_users: d.error_users }));
  const series = [{ key: 'errors', label: 'Số lần lỗi', color: 'var(--s1)' }];
  return (
    <>
      <PageHead title="Nhật ký lỗi" sub="Lỗi ghi nhận tự động từ máy người chơi, gộp theo loại lỗi">
        <Search value={search} onChange={setSearch} placeholder="Tìm trong thông điệp, stack…" />
      </PageHead>
      <div className="ad-toolbar">
        <Segmented label="Trạng thái" value={status} onChange={setStatus} options={[{ value: 'open', label: 'Chưa xử lý' }, { value: 'resolved', label: 'Đã xử lý' }, { value: 'all', label: 'Tất cả' }]} />
        <Segmented label="Khoảng thời gian" value={days} onChange={setDays} options={[{ value: 1, label: '24 giờ' }, { value: 7, label: '7 ngày' }, { value: 30, label: '30 ngày' }, { value: 90, label: '90 ngày' }]} />
        <select className="ad-select" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Loại lỗi">
          {KINDS.map((k) => <option key={k} value={k}>{k === 'all' ? 'Mọi loại' : ERROR_KIND[k]}</option>)}
        </select>
      </div>
      {days > 1 && rows.length > 0 && (
        <ChartCard wide title="Lỗi theo ngày" series={series} data={rows}>
          <BarChart data={rows} series={series} height={170} />
        </ChartCard>
      )}
      {groups.error && <ErrorBox error={groups.error} onRetry={groups.reload} />}
      {groups.loading && !groups.data ? <Loading rows={6} /> : groups.data && (
        <section className="ad-card flush">
          <div className="ad-table-wrap">
            <table className="ad-table hover">
              <thead><tr><th>Lỗi</th><th>Loại</th><th className="num">Số lần</th><th className="num">Người gặp</th><th>Thiết bị</th><th>Gần nhất</th><th /></tr></thead>
              <tbody>
                {groups.data.map((g) => (
                  <tr key={g.fingerprint} onClick={() => setOpen(g)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(g)}>
                    <td className="ad-msg"><b className="ad-mono">{g.message}</b><small>Lần đầu {ago(g.first_at)} · bản {g.build || '—'}</small></td>
                    <td><Badge tone={g.kind === 'fatal' ? 'bad' : g.kind === 'ui' || g.kind === 'loop' ? 'warn' : 'muted'}>{ERROR_KIND[g.kind] ?? g.kind}</Badge></td>
                    <td className="num">{fmt(g.total)}</td>
                    <td className="num">{fmt(g.users)}</td>
                    <td>{(g.platforms ?? []).map((p) => PLATFORM[p] ?? p).join(', ') || '—'}</td>
                    <td title={dateTime(g.last_at)}>{ago(g.last_at)}</td>
                    <td>{g.resolved ? <Badge tone="ok">Đã xử lý</Badge> : null}</td>
                  </tr>
                ))}
                {!groups.data.length && <tr><td colSpan={7} className="ad-empty">{status === 'open' ? 'Không có lỗi nào chưa xử lý.' : 'Không có lỗi phù hợp.'}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {open && <ErrorDrawer group={open} onClose={() => setOpen(null)} onChanged={() => { groups.reload(); ov.reload(); }} showUser={showUser} />}
    </>
  );
}

function ErrorDrawer({ group, onClose, onChanged, showUser }: { group: api.ErrorGroup; onClose: () => void; onChanged: () => void; showUser: (u: OpenUser) => void }) {
  const { data, error, loading, reload } = useLoad(() => api.errorsOf(group.fingerprint), [group.fingerprint]);
  const [sel, setSel] = useState(0);
  const [del, setDel] = useState(false);
  const e = data?.[sel];
  const toggle = async () => { if (await act(() => api.setResolved(group.fingerprint, !group.resolved), group.resolved ? 'Đã mở lại' : 'Đã đánh dấu đã xử lý')) { onChanged(); onClose(); } };
  return (
    <Drawer title={ERROR_KIND[group.kind] ?? 'Lỗi'} sub={<span className="ad-mono">{group.message}</span>} onClose={onClose}
      actions={<>
        <button className={`ad-btn ${group.resolved ? '' : 'primary'}`} onClick={() => void toggle()}>{group.resolved ? 'Mở lại' : 'Đánh dấu đã xử lý'}</button>
        <button className="ad-btn" onClick={() => void navigator.clipboard?.writeText(`${group.message}\n\n${e?.stack ?? ''}`)}>Sao chép</button>
        <button className="ad-btn danger" onClick={() => setDel(true)}>Xóa</button>
      </>}>
      <div className="ad-kv">
        <div><span>Tổng số lần</span><b>{fmt(group.total)}</b></div>
        <div><span>Người gặp</span><b>{fmt(group.users)}</b></div>
        <div><span>Lần đầu</span><b>{dateTime(group.first_at)}</b></div>
        <div><span>Gần nhất</span><b>{dateTime(group.last_at)}</b></div>
      </div>
      {error && <ErrorBox error={error} onRetry={reload} />}
      {loading && !data ? <Loading rows={4} /> : data && (
        <>
          <h3 className="ad-h3">Các lần xảy ra ({data.length})</h3>
          <div className="ad-chips">
            {data.map((x, i) => <button key={x.id} className={`ad-chip ${i === sel ? 'on' : ''}`} onClick={() => setSel(i)}>{ago(x.last_at)} · {PLATFORM[x.platform] ?? x.platform}{x.count > 1 ? ` ×${x.count}` : ''}</button>)}
          </div>
          {e && (
            <>
              <div className="ad-kv">
                <div><span>Người chơi</span><b><button className="ad-link" onClick={() => showUser({ userId: e.user_id, visitorId: e.user_id ? null : e.visitor_id })}>{e.user_id ? 'Tài khoản' : 'Khách'} · {shortId(e.user_id ?? e.visitor_id)}</button></b></div>
                <div><span>Phiên bản</span><b>{e.build || '—'}</b></div>
                <div><span>Trang</span><b className="ad-mono">{e.url || '/'}</b></div>
                <div><span>Màn hình</span><b>{String(e.context.screen ?? '—')}{e.context.overlay ? ` / ${String(e.context.overlay)}` : ''} · {String(e.context.mode ?? '')}</b></div>
              </div>
              <h3 className="ad-h3">Stack</h3>
              <pre className="ad-code">{e.stack || '(không có stack)'}</pre>
              <h3 className="ad-h3">Ngữ cảnh</h3>
              <pre className="ad-code">{JSON.stringify(e.context, null, 2)}</pre>
              <p className="ad-muted small ad-mono">{e.ua}</p>
            </>
          )}
        </>
      )}
      {del && <Confirm title="Xóa lỗi này?" text="Xóa mọi lần ghi nhận của lỗi này. Nếu lỗi xảy ra lại, nó sẽ được ghi mới." okLabel="Xóa" onClose={() => setDel(false)} onConfirm={async () => { if (await act(() => api.deleteErrors(group.fingerprint), 'Đã xóa')) { onChanged(); onClose(); } }} />}
    </Drawer>
  );
}
