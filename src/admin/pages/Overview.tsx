import { useState } from 'react';
import * as api from '../api';
import { BarChart, ChartCard, fmt, HBars, LineChart, Stat, type Row, type Series } from '../charts';
import { dayLabel, minutes, PLATFORM } from '../format';
import type { LiveState } from '../live';
import { ErrorBox, Loading, NavIcon, PageHead, Segmented, useLoad } from '../ui';
import type { Page } from '../AdminApp';
import { PERSONA_BY_ID } from '../../bots/personas';

const S = {
  accounts: { key: 'dau_accounts', label: 'Có tài khoản', color: 'var(--s1)' },
  guests: { key: 'dau_guests', label: 'Khách vãng lai', color: 'var(--s2)' },
};
const ACTIVE: Series[] = [S.accounts, S.guests];
const NEW: Series[] = [{ ...S.accounts, key: 'new_accounts' }, { ...S.guests, key: 'new_guests' }];
const PLAY: Series[] = [{ key: 'offline_h', label: 'Ngoại tuyến', color: 'var(--s1)' }, { key: 'online_h', label: 'Trực tuyến', color: 'var(--s3)' }];
const ERRORS: Series[] = [{ key: 'errors', label: 'Lỗi', color: 'var(--s1)' }];
const BOTS: Series[] = [{ key: 'bot_ai', label: 'AI trả lời', color: 'var(--s1)' }, { key: 'bot_fallback', label: 'Câu dự phòng', color: 'var(--s2)' }, { key: 'bot_guard', label: 'Bị chặn', color: 'var(--s3)' }];

export function OverviewPage({ live, go }: { live: LiveState; go: (p: Page) => void }) {
  const [days, setDays] = useState(30);
  const { data, error, loading, reload } = useLoad(() => api.overview(days), [days]);
  const rows: Row[] = (data?.series ?? []).map((d) => ({ ...d, label: dayLabel(d.day), offline_h: (d.minutes - d.online_minutes) / 60, online_h: d.online_minutes / 60 }));
  const t = data?.totals;
  const playing = live.players.filter((p) => p.state === 'playing').length;
  const queued = live.players.length - playing;
  const liveBots = Object.keys(live.bots).length;
  const hours = (n: number) => `${fmt(n)} giờ`;
  return (
    <>
      <PageHead title="Tổng quan" sub="Hoạt động người chơi, chất lượng và bạn tù AI">
        <Segmented label="Khoảng thời gian" value={days} onChange={setDays} options={[{ value: 7, label: '7 ngày' }, { value: 30, label: '30 ngày' }, { value: 90, label: '90 ngày' }]} />
        <button className="ad-icon-btn" onClick={reload} aria-label="Làm mới" title="Làm mới"><NavIcon name="refresh" /></button>
      </PageHead>
      {error && <ErrorBox error={error} onRetry={reload} />}
      <div className="ad-stats">
        <Stat label="Đang trực tuyến" value={<>{playing}<small className="ad-live-badge">LIVE</small></>} hint={`${queued ? `${queued} đang xếp hàng · ` : ''}${liveBots} bạn tù hoạt động`} onClick={() => go('online')} />
        <Stat label="Hoạt động hôm nay" value={t ? fmt(t.active_today) : '—'} hint={t ? `${minutes(t.minutes_today)} chơi` : ''} />
        <Stat label="Hoạt động 7 ngày" value={t ? fmt(t.active_7d) : '—'} hint={t ? `30 ngày: ${fmt(t.active_30d)}` : ''} />
        <Stat label="Tài khoản" value={t ? fmt(t.accounts) : '—'} hint={t ? `${fmt(t.guests)} khách vãng lai` : ''} onClick={() => go('users')} />
        <Stat label="Lỗi chưa xử lý" value={t ? fmt(t.errors_open) : '—'} hint={t ? `${fmt(t.errors_24h)} lần trong 24 giờ` : ''} tone={t && t.errors_open > 0 ? 'warn' : undefined} onClick={() => go('errors')} />
        <Stat label="Báo cáo chờ xử lý" value={t ? fmt(t.reports_open) : '—'} hint={t ? `${fmt(t.bans_active)} đang bị khóa` : ''} tone={t && t.reports_open > 0 ? 'warn' : undefined} onClick={() => go('reports')} />
      </div>
      {loading && !data ? <Loading rows={4} /> : data && (
        <div className="ad-grid">
          <ChartCard wide title="Người chơi hoạt động mỗi ngày" sub="Số người có mở game trong ngày (giờ Việt Nam)" series={ACTIVE} data={rows}>
            <LineChart data={rows} series={ACTIVE} height={240} />
          </ChartCard>
          <ChartCard title="Người chơi mới" sub="Tài khoản đăng ký và khách lần đầu vào" series={NEW} data={rows}>
            <BarChart data={rows} series={NEW} />
          </ChartCard>
          <ChartCard title="Thời gian chơi" sub="Tổng số giờ mỗi ngày" series={PLAY} data={rows} format={hours}>
            <BarChart data={rows} series={PLAY} format={(n) => fmt(n)} />
          </ChartCard>
          <ChartCard title="Lỗi mỗi ngày" sub="Số lần lỗi ghi nhận từ máy người chơi" series={ERRORS} data={rows}>
            <BarChart data={rows} series={ERRORS} />
          </ChartCard>
          <ChartCard title="Bạn tù AI trả lời" sub="Theo nguồn câu trả lời" series={BOTS} data={rows}>
            <BarChart data={rows} series={BOTS} />
          </ChartCard>
          <ChartCard title="Thiết bị" sub={`Người chơi trong ${days} ngày`}>
            <HBars items={data.platforms.map((p) => ({ label: PLATFORM[p.key] ?? p.key, value: p.n }))} />
          </ChartCard>
          <ChartCard title="Trình duyệt" sub={`Người chơi trong ${days} ngày`}>
            <HBars items={data.browsers.map((p) => ({ label: p.key, value: p.n }))} />
          </ChartCard>
          <ChartCard title="Bạn tù được trò chuyện nhiều nhất" sub={`Số câu trả lời trong ${days} ngày`}>
            <HBars items={data.bots.slice(0, 6).map((b) => ({ label: PERSONA_BY_ID[b.key]?.name ?? b.key, value: b.n, sub: b.avg_ms ? `AI ${Math.round((b.ai / Math.max(1, b.n)) * 100)}% · trung bình ${(b.avg_ms / 1000).toFixed(1)} s` : undefined }))} empty="Chưa có cuộc trò chuyện nào" />
          </ChartCard>
        </div>
      )}
    </>
  );
}
