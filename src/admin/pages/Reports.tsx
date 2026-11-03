import { useState } from 'react';
import * as api from '../api';
import { ago, dateTime } from '../format';
import { act, Badge, BanDialog, ErrorBox, Loading, notify, PageHead, Segmented, useLoad } from '../ui';
import type { OpenUser } from '../AdminApp';
import { ROOMS } from '../../online/protocol';

const STATUS: Record<api.Report['status'], { label: string; tone: 'warn' | 'ok' | 'muted' }> = {
  open: { label: 'Chờ xử lý', tone: 'warn' }, resolved: { label: 'Đã xử lý', tone: 'ok' }, dismissed: { label: 'Bỏ qua', tone: 'muted' },
};

export function ReportsPage({ showUser }: { showUser: (u: OpenUser) => void }) {
  const [status, setStatus] = useState('open');
  const { data, error, loading, reload } = useLoad(() => api.reports(status), [status]);
  const [ban, setBan] = useState<{ report: api.Report; visitor: api.Visitor } | null>(null);
  const findUser = async (r: api.Report) => {
    const v = await api.visitorByPeer(r.reported_peer).catch(() => null);
    if (!v) notify('Chưa liên kết được người chơi này với thiết bị (họ cần mở game sau khi bật thống kê).', 'bad');
    return v;
  };
  const setSt = async (r: api.Report, s: api.Report['status']) => { if (await act(() => api.setReport(r.id, s), s === 'open' ? 'Đã mở lại' : 'Đã cập nhật')) reload(); };
  return (
    <>
      <PageHead title="Báo cáo trò chuyện" sub="Người chơi báo cáo nhau trong chế độ trực tuyến" />
      <div className="ad-toolbar">
        <Segmented label="Trạng thái" value={status} onChange={setStatus} options={[{ value: 'open', label: 'Chờ xử lý' }, { value: 'resolved', label: 'Đã xử lý' }, { value: 'dismissed', label: 'Bỏ qua' }, { value: 'all', label: 'Tất cả' }]} />
      </div>
      {error && <ErrorBox error={error} onRetry={reload} />}
      {loading && !data ? <Loading rows={5} /> : data && (
        <div className="ad-reports">
          {data.map((r) => (
            <article key={r.id} className="ad-card report">
              <header className="ad-card-head">
                <div><h3>{r.reported_name || 'Không rõ tên'} <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge></h3>
                  <p>{ROOMS.find((x) => x.id === r.room)?.name ?? r.room} · <span title={dateTime(r.created_at)}>{ago(r.created_at)}</span></p></div>
              </header>
              <p className="ad-reason"><b>Lý do:</b> {r.reason}</p>
              {r.excerpt && <blockquote className="ad-quote">{r.excerpt.split(' | ').map((l, i) => <span key={i}>{l}</span>)}</blockquote>}
              <footer className="ad-row">
                <button className="ad-btn" onClick={() => void findUser(r).then((v) => v && showUser({ userId: v.user_id, visitorId: v.user_id ? null : v.id, label: r.reported_name }))}>Xem người chơi</button>
                <button className="ad-btn danger" onClick={() => void findUser(r).then((v) => v && setBan({ report: r, visitor: v }))}>Khóa trực tuyến</button>
                {r.status === 'open' ? <>
                  <button className="ad-btn primary" onClick={() => void setSt(r, 'resolved')}>Đã xử lý</button>
                  <button className="ad-btn" onClick={() => void setSt(r, 'dismissed')}>Bỏ qua</button>
                </> : <button className="ad-btn" onClick={() => void setSt(r, 'open')}>Mở lại</button>}
              </footer>
            </article>
          ))}
          {!data.length && <p className="ad-empty card">Không có báo cáo nào.</p>}
        </div>
      )}
      {ban && <BanDialog name={ban.report.reported_name} onClose={() => setBan(null)} onConfirm={async (reason, hours) => {
        if (await act(() => api.ban({ userId: ban.visitor.user_id, visitorId: ban.visitor.id }, reason, hours), 'Đã khóa trực tuyến')) {
          await api.setReport(ban.report.id, 'resolved').catch(() => undefined);
          setBan(null); reload();
        }
      }} />}
    </>
  );
}
