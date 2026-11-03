// CR-TIME-01: thẻ “Đồng hồ chung” trong trang admin — xem giờ trại, đổi độ dài ngày, đẩy tới mốc 06:00 (chỉ tiến).
import { useEffect, useState } from 'react';
import * as api from './api';
import { act, Badge, ErrorBox, Loading, useLoad } from './ui';
import { DAY_LEN_RANGE, sharedDayOf, sharedMinuteAt, sharedMinuteOfDay, sharedWeekday, validClock, weatherAt, type ClockConfig } from '../online/sharedClock';
import { serverNow, syncServerTime } from '../online/timeSync';
import { WEEKDAY_LABEL } from '../domain/util';
import { ROOMS } from '../online/protocol';

const hhmm = (m: number) => { const x = Math.floor(m); return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };
const WEATHER = { clear: 'Trời quang', overcast: 'Âm u', rain: 'Mưa nhẹ' } as const;
/** epoch mới giữ nguyên phút chung `sharedMin` tại thời điểm `now` với độ dài ngày `len`. */
const epochFor = (now: number, sharedMin: number, len: number) => Math.round(now - (sharedMin * len * 60 * 1000) / 1440);

export function ClockCard() {
  const rows = useLoad(() => api.configRows(), []);
  const raw = rows.data?.find((r) => r.key === 'clock');
  const clock: ClockConfig = validClock(raw?.value as Partial<ClockConfig> | undefined);
  const [now, setNow] = useState(Date.now());
  const [len, setLen] = useState<number | null>(null);
  useEffect(() => { void syncServerTime(); const t = setInterval(() => setNow(serverNow()), 1000); return () => clearInterval(t); }, []);
  const sm = sharedMinuteAt(now, clock);
  const save = (v: ClockConfig, ok: string) => void act(() => api.saveConfig('clock', { ...v }), ok).then((done) => { if (done) { setLen(null); rows.reload(); } });
  const changeLen = () => { if (len === null) return; const t = serverNow(); save({ ...clock, dayLengthMin: len, epochMs: epochFor(t, sharedMinuteAt(t, clock), len) }, 'Đã đổi độ dài ngày — giờ hiện tại giữ nguyên'); };
  const toMorning = () => {
    const t = serverNow(), cur = sharedMinuteAt(t, clock);
    const target = Math.floor(cur / 1440) * 1440 + 360 + (sharedMinuteOfDay(cur) >= 360 ? 1440 : 0);
    save({ ...clock, epochMs: epochFor(t, target, clock.dayLengthMin) }, 'Đã đẩy giờ trại tới 06:00');
  };
  return (
    <section className="ad-card">
      <header className="ad-card-head"><div><h3>Đồng hồ chung</h3><p>Mọi người chơi trực tuyến cùng một giờ trại. “Ngày” trên màn hình người chơi là số ngày riêng của họ.</p></div>{!raw && rows.data && <Badge tone="warn">Đang dùng mặc định</Badge>}</header>
      {rows.error && <ErrorBox error={rows.error} onRetry={rows.reload} />}
      {rows.loading && !rows.data ? <Loading rows={2} /> : (
        <>
          <div className="ad-kv">
            <div><span>Giờ trại</span><b style={{ fontSize: 22 }}>{hhmm(sharedMinuteOfDay(sm))}</b></div>
            <div><span>Thứ</span><b>{WEEKDAY_LABEL[sharedWeekday(sm)]}</b></div>
            <div><span>Ngày chung</span><b>#{sharedDayOf(sm)}</b></div>
            <div><span>Một ngày game</span><b>{clock.dayLengthMin} phút thực</b></div>
            {ROOMS.map((r) => <div key={r.id}><span>Thời tiết · {r.name}</span><b>{WEATHER[weatherAt(r.id, sm)]}</b></div>)}
          </div>
          <div className="ad-form-row" style={{ marginTop: 12 }}>
            <label className="ad-inline"><span><b>Độ dài một ngày game</b><small>{DAY_LEN_RANGE[0]}–{DAY_LEN_RANGE[1]} phút thực. Giờ hiện tại được giữ nguyên khi đổi.</small></span>
              <input type="number" className="ad-num" min={DAY_LEN_RANGE[0]} max={DAY_LEN_RANGE[1]} value={len ?? clock.dayLengthMin} onChange={(e) => setLen(Math.max(DAY_LEN_RANGE[0], Math.min(DAY_LEN_RANGE[1], Number(e.target.value) || DAY_LEN_RANGE[0])))} />
              <button className="ad-btn primary" disabled={len === null || len === clock.dayLengthMin} onClick={changeLen}>Lưu</button>
            </label>
            <label className="ad-inline"><span><b>Đẩy giờ tới 06:00 kế tiếp</b><small>Dùng cho sự kiện đặc biệt. Chỉ tiến, không lùi; người chơi tự khớp trong khoảng 30 giây.</small></span>
              <button className="ad-btn" onClick={toMorning}>Tới 06:00</button>
            </label>
          </div>
        </>
      )}
    </section>
  );
}
