// U20 Save management (local + optional cloud CAS), U21 Graphics, U22 Audio, U23 Controls & Accessibility.
import { useEffect, useState } from 'react';
import { useUI } from '../store';
import { Panel, Tabs, Empty, Status } from '../components';
import { controller } from '../../app/controller';
import { listSlots, deleteSlot, exportEnvelope, importFile, type SlotId } from '../../persistence/localStore';
import { encodeSave, type SaveEnvelope } from '../../persistence/saveCodec';
import { cloud, type CloudSaveMeta } from '../../persistence/cloud';
import { useSettings, ACTION_LABEL, DEFAULT_BINDINGS, keyLabel, type ActionName } from '../settings';
import { fmtClock } from '../../domain/util';
import { audio } from '../../audio/audio';
import { useDevice } from '../device';

const close = () => { const ui = useUI.getState(); ui.open(ui.screen === 'game' ? 'pause' : null); };

export function SavesPanel() {
  const inGame = useUI((s) => s.screen === 'game');
  const [slots, setSlots] = useState<Awaited<ReturnType<typeof listSlots>>>([]);
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState<SlotId | null>(null);
  const [cloudList, setCloudList] = useState<CloudSaveMeta[] | null>(null);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const refresh = () => listSlots().then(setSlots).catch((e) => setMsg((e as Error).message));
  useEffect(() => { void refresh(); if (cloud.configured()) cloud.user().then(setUser).catch(() => setUser(null)); }, []);
  const meta = (e?: SaveEnvelope) => e ? `${e.meta.name} · Ngày ${e.meta.day} ${fmtClock(e.meta.minute)} · ${e.meta.zone} · thế hệ ${e.meta.generation} · ${new Date(e.savedAt).toLocaleString('vi-VN')}${e.meta.ended ? ' · đã kết thúc' : ''}` : 'Trống';
  return (
    <Panel title="Quản lý save" onClose={close} footer="Mỗi ô giữ 2 bản gần nhất · bản mới lỗi thì dùng bản trước.">
      <h3>Trên thiết bị này</h3>
      <table className="tbl"><tbody>
        {slots.map((s) => (
          <tr key={s.id}>
            <td><b>{s.label}</b><div className="small muted">{meta(s.latest)}</div>{s.previous && <div className="small muted">Bản trước: {meta(s.previous)}</div>}</td>
            <td><div className="row">
              {inGame && s.id !== 'auto' && <button className="btn sm" onClick={async () => { controller.slot = s.id; const ok = await controller.save(s.id); setMsg(ok ? `Đã lưu vào ${s.label}.` : 'Lưu thất bại.'); void refresh(); }}>Lưu vào đây</button>}
              {s.latest && <button className="btn sm" onClick={() => controller.continueFrom(s.id)}>Tải</button>}
              {s.previous && <button className="btn sm" onClick={() => controller.continueFrom(s.id, 1)}>Tải bản trước</button>}
              {s.latest && (confirm === s.id
                ? <><button className="btn sm danger" onClick={async () => { await deleteSlot(s.id); setConfirm(null); setMsg(`Đã xóa ${s.label}.`); void refresh(); }}>Xác nhận xóa {s.label}</button><button className="btn sm" onClick={() => setConfirm(null)}>Hủy</button></>
                : <button className="btn sm danger" onClick={() => setConfirm(s.id)}>Xóa</button>)}
            </div></td>
          </tr>
        ))}
      </tbody></table>
      <div className="row" style={{ marginTop: 12 }}>
        {inGame && <button className="btn" onClick={async () => { const b = await exportEnvelope(controller.s!); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `mot-ngay-moi-${controller.s!.character.name}-ngay${Math.floor(controller.s!.minute / 1440) + 1}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); setMsg('Đã xuất file save.'); }}>Xuất file save</button>}
        <label className="btn">Nhập file save<input type="file" accept="application/json,.json" className="sr" onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return;
          const r = await importFile(f);
          if (r.error) setMsg(`Không nhập được: ${r.error}`);
          else { setMsg('File hợp lệ — đang tải (chế độ đơn người chơi, không tin cậy).'); await controller.loadState(r.state!); }
        }} /></label>
      </div>
      <h3 style={{ marginTop: 16 }}>Đám mây (tùy chọn)</h3>
      {!cloud.configured() && <Empty>Chưa cấu hình dịch vụ đám mây trong bản cài đặt này.</Empty>}
      {cloud.configured() && !user && <p className="small">Chưa đăng nhập. <button className="btn sm" onClick={() => useUI.getState().set({ screen: 'auth', overlay: null })}>Đăng nhập</button></p>}
      {cloud.configured() && user && <CloudSection onMsg={setMsg} list={cloudList} setList={setCloudList} />}
      <p role="status" className="small" style={{ color: 'var(--accent)' }}>{msg}</p>
    </Panel>
  );
}

function CloudSection({ onMsg, list, setList }: { onMsg: (m: string) => void; list: CloudSaveMeta[] | null; setList: (l: CloudSaveMeta[]) => void }) {
  const inGame = useUI((s) => s.screen === 'game');
  const [busy, setBusy] = useState(false);
  useEffect(() => { cloud.list().then(setList).catch((e) => onMsg((e as Error).message)); }, []);
  const upload = async () => {
    setBusy(true);
    try {
      const s = controller.s!;
      const env = await encodeSave(structuredClone(s), { name: s.character.name, day: Math.floor(s.minute / 1440) + 1, minute: s.minute, zone: s.player.zone, chapter: s.chapter, lineageId: s.lineageId, generation: s.generation, ended: s.ended });
      const head = (list ?? []).find((x) => x.lineage_id === s.lineageId && x.slot === 1);
      const r = await cloud.upload(env, 1, head ? head.revision : null, crypto.randomUUID());
      if (r.ok) onMsg(`Đã đồng bộ (bản ${r.revision}).`);
      else onMsg(r.conflict ? `Lệch bản lưu: ${r.message} · tải bản đám mây để so, hoặc lưu sang ô khác.` : `Lỗi: ${r.message}`);
      setList(await cloud.list());
    } catch (e) { onMsg((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div>
      {inGame && <button className="btn" disabled={busy} onClick={upload}>{busy ? 'Đang đồng bộ...' : 'Đồng bộ hành trình này lên đám mây'}</button>}
      {list === null ? <p className="small muted">Đang tải danh sách...</p> : list.length === 0 ? <Empty>Chưa có save trên đám mây.</Empty> : (
        <table className="tbl"><tbody>{list.map((c) => <tr key={c.id}><td className="small">{c.name} · Ngày {c.day} · {c.zone} · rev {c.revision} · {new Date(c.updated_at).toLocaleString('vi-VN')}</td>
          <td><button className="btn sm" onClick={async () => { const env = await cloud.download(c.id); const { decodeSave } = await import('../../persistence/saveCodec'); const d = await decodeSave(env); if (d.state) await controller.loadState(d.state); else onMsg(d.error ?? 'Lỗi'); }}>Tải</button></td></tr>)}</tbody></table>
      )}
      <button className="btn sm ghost" onClick={async () => { await cloud.signOut(); onMsg('Đã đăng xuất. Save cục bộ vẫn giữ nguyên.'); }}>Đăng xuất</button>
    </div>
  );
}

function GamepadStatus() {
  const gp = useDevice((d) => d.gamepad);
  return <p className="small muted">{gp ? `Đã kết nối: ${gp}` : 'Chưa thấy tay cầm · cắm hoặc kết nối Bluetooth rồi bấm một nút.'} Sơ đồ nút có trong Sổ tay › Cảm ứng & tay cầm.</p>;
}

export function SettingsPanel() {
  const tab = useUI((s) => s.settingsTab);
  const setUI = useUI((s) => s.set);
  const st = useSettings((x) => x.s);
  const set = useSettings((x) => x.set);
  const reset = useSettings((x) => x.reset);
  const [listening, setListening] = useState<ActionName | null>(null);
  const [conflict, setConflict] = useState('');
  useEffect(() => {
    if (!listening) return;
    const kd = (e: KeyboardEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (e.code === 'Escape' && listening !== 'pause') { setListening(null); return; }
      const other = (Object.keys(st.controls.bindings) as ActionName[]).find((k) => k !== listening && st.controls.bindings[k] === e.code);
      if (other) { setConflict(`Đã đổi chỗ với “${ACTION_LABEL[other]}” (phím ${keyLabel(e.code)}).`); set((x) => { x.controls.bindings[other] = x.controls.bindings[listening]; x.controls.bindings[listening] = e.code; }); }
      else { setConflict(''); set((x) => { x.controls.bindings[listening] = e.code; }); }
      setListening(null);
    };
    window.addEventListener('keydown', kd, true);
    return () => window.removeEventListener('keydown', kd, true);
  }, [listening, st, set]);
  const slider = (label: string, value: number, onChange: (v: number) => void, min = 0, max = 1, step = 0.05) => (
    <label className="row" style={{ justifyContent: 'space-between' }}>{label}
      <span className="row"><input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
        <input type="number" min={min} max={max} step={step} value={Math.round(value * 100) / 100} onChange={(e) => onChange(Number(e.target.value))} style={{ width: 80 }} aria-label={`${label} (số)`} /></span></label>
  );
  const toggle = (label: string, value: boolean, onChange: (v: boolean) => void, hint?: string) => (
    <label className="row" style={{ justifyContent: 'space-between' }}><span>{label}{hint && <div className="small muted">{hint}</div>}</span><input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} style={{ width: 22, height: 22 }} /></label>
  );
  return (
    <Panel title="Cài đặt" onClose={() => { if (!listening) close(); }} tabs={<Tabs label="Nhóm cài đặt" value={tab} onChange={(t) => setUI({ settingsTab: t })} tabs={[{ id: 'graphics', label: 'Đồ họa' }, { id: 'audio', label: 'Âm thanh' }, { id: 'controls', label: 'Điều khiển' }, { id: 'access', label: 'Trợ năng & lối chơi' }]} />}>
      {tab === 'graphics' && <div className="col" style={{ maxWidth: 620 }}>
        <div className="row">{(['auto', 'low', 'medium', 'high'] as const).map((p) => <button key={p} className={`btn sm ${st.graphics.preset === p ? 'primary' : ''}`} aria-pressed={st.graphics.preset === p} onClick={() => set((x) => { x.graphics.preset = p; })}>{{ auto: 'Tự động', low: 'Thấp', medium: 'Trung bình', high: 'Cao' }[p]}</button>)}</div>
        <p className="small muted">Thấp: tắt bóng, giảm độ nét · Cao: bóng mềm, độ nét cao.</p>
        {slider('Tỉ lệ độ phân giải', st.graphics.resolutionScale, (v) => set((x) => { x.graphics.resolutionScale = v; }), 0.5, 1, 0.05)}
        {toggle('Bóng đổ ngoài trời', st.graphics.shadows, (v) => set((x) => { x.graphics.shadows = v; }), 'Bóng nhân vật dưới nắng ở sân sinh hoạt')}
        <p className="small muted">WebGPU chưa bật trong bản này (mặc định WebGL2). FPS hiện tại: {controller.view ? Math.round(controller.view.fps()) : '—'}</p>
        <button className="btn sm" onClick={() => reset('graphics')}>Khôi phục mặc định nhóm này</button>
      </div>}
      {tab === 'audio' && <div className="col" style={{ maxWidth: 620 }}>
        {(['master', 'music', 'sfx', 'dialogue', 'ambience', 'ui'] as const).map((k) => slider({ master: 'Tổng', music: 'Nhạc nền', sfx: 'Hiệu ứng', dialogue: 'Lời thoại', ambience: 'Môi trường', ui: 'Giao diện' }[k], st.audio[k], (v) => set((x) => { x.audio[k] = v; })))}
        <p className="small muted">Trạng thái âm thanh: {audio.state === 'active' ? 'đang hoạt động' : audio.state === 'unavailable' ? 'không khả dụng — mọi tín hiệu quan trọng có phụ đề' : 'chờ tương tác'}{st.audio.master === 0 ? ' · Đang tắt tiếng hoàn toàn' : ''}</p>
        <button className="btn sm" onClick={() => { audio.resume(); audio.cue('chime'); }}>Nghe thử</button>
        <button className="btn sm" onClick={() => reset('audio')}>Khôi phục mặc định</button>
      </div>}
      {tab === 'controls' && <div>
        <table className="tbl"><thead><tr><th>Hành động</th><th>Phím</th><th /></tr></thead><tbody>
          {(Object.keys(DEFAULT_BINDINGS) as ActionName[]).map((a) => <tr key={a}><td>{ACTION_LABEL[a]}</td><td><span className="kbd">{keyLabel(st.controls.bindings[a])}</span></td>
            <td><button className="btn sm" onClick={() => setListening(a)}>{listening === a ? 'Nhấn phím mới... (Esc hủy)' : 'Đổi'}</button></td></tr>)}
        </tbody></table>
        <p role="status" className="small" style={{ color: 'var(--warning)' }}>{conflict}</p>
        <div className="col" style={{ maxWidth: 620, marginTop: 8 }}>
          {slider('Độ nhạy chuột', st.controls.sensitivity, (v) => set((x) => { x.controls.sensitivity = v; }), 0.2, 3, 0.1)}
          {toggle('Đảo trục dọc', st.controls.invertY, (v) => set((x) => { x.controls.invertY = v; }))}
          {toggle('Chạy: bật/tắt thay vì giữ', st.controls.runToggle, (v) => set((x) => { x.controls.runToggle = v; }))}
          {toggle('Cúi: bật/tắt thay vì giữ', st.controls.crouchToggle, (v) => set((x) => { x.controls.crouchToggle = v; }))}
          <button className="btn sm" onClick={() => reset('controls')}>Khôi phục phím mặc định</button>
          <h3 style={{ marginTop: 12 }}>Cảm ứng</h3>
          <div className="row" style={{ justifyContent: 'space-between' }}>Điều khiển cảm ứng<span className="row">{(['auto', 'on', 'off'] as const).map((m) => <button key={m} className={`btn sm ${st.controls.touchMode === m ? 'primary' : ''}`} aria-pressed={st.controls.touchMode === m} onClick={() => set((x) => { x.controls.touchMode = m; })}>{{ auto: 'Tự động', on: 'Luôn bật', off: 'Tắt' }[m]}</button>)}</span></div>
          {slider('Độ nhạy vuốt camera', st.controls.touchSensitivity, (v) => set((x) => { x.controls.touchSensitivity = v; }), 0.3, 3, 0.1)}
          {slider('Cỡ cần điều khiển', st.controls.joystickSize, (v) => set((x) => { x.controls.joystickSize = v; }), 0.7, 1.5, 0.05)}
          {toggle('Thuận tay trái (đổi bên cần điều khiển và nút)', st.controls.leftHanded, (v) => set((x) => { x.controls.leftHanded = v; }))}
          <h3 style={{ marginTop: 12 }}>Tay cầm</h3>
          <GamepadStatus />
          {slider('Độ nhạy cần phải', st.controls.gamepadSensitivity, (v) => set((x) => { x.controls.gamepadSensitivity = v; }), 0.3, 3, 0.1)}
        </div>
      </div>}
      {tab === 'access' && <div className="col" style={{ maxWidth: 680 }}>
        {toggle('Phụ đề', st.access.subtitles, (v) => set((x) => { x.access.subtitles = v; }), 'Thông báo quan trọng luôn hiển thị dạng thông báo kể cả khi tắt')}
        {slider('Cỡ chữ phụ đề', st.access.subtitleScale, (v) => set((x) => { x.access.subtitleScale = v; }), 0.8, 1.8, 0.1)}
        {slider('Cỡ chữ giao diện', st.access.textScale, (v) => set((x) => { x.access.textScale = v; }), 1, 2, 0.1)}
        {toggle('Giảm chuyển động', st.access.reducedMotion, (v) => set((x) => { x.access.reducedMotion = v; }), 'Bỏ hiệu ứng trượt; động tác tập chậm hơn')}
        {toggle('Tương phản cao', st.access.highContrast, (v) => set((x) => { x.access.highContrast = v; }))}
        {toggle('HUD tối giản', st.access.hudMinimal, (v) => set((x) => { x.access.hudMinimal = v; }), 'Vẫn hiển thị lỗi lưu và nhiệm vụ chính')}
        {toggle('Gợi ý hướng dẫn', st.access.tutorialHints, (v) => set((x) => { x.access.tutorialHints = v; }))}
        {toggle('Nội dung xung đột (ẩu đả)', st.access.conflicts, (v) => set((x) => { x.access.conflicts = v; }), 'Gây sự, ẩu đả, vào SHU · không máu, không vũ khí')}
        {toggle('Nhu cầu nhẹ', st.access.lightNeeds, (v) => set((x) => { x.access.lightNeeds = v; }), 'Nhu cầu giảm chậm 50%, không ảnh hưởng thành tựu')}
        {toggle('Hoàn tất tự động hoạt động', st.access.autoComplete, (v) => set((x) => { x.access.autoComplete = v; }), 'Rút ngắn ăn, tắm, tập; không cần thao tác lặp')}
        <div className="row" style={{ justifyContent: 'space-between' }}>Độ dài một ngày game<span className="row">{([48, 72] as const).map((d) => <button key={d} className={`btn sm ${st.access.dayLength === d ? 'primary' : ''}`} aria-pressed={st.access.dayLength === d} onClick={() => set((x) => { x.access.dayLength = d; })}>{d} phút thực</button>)}</span></div>
        <p className="small muted" style={{ marginTop: 2 }}>Chỉ khi chơi ngoại tuyến · trực tuyến dùng giờ chung.</p>
        <button className="btn sm" onClick={() => reset('access')}>Khôi phục mặc định nhóm này</button>
        <Status>Thay đổi được áp dụng ngay và lưu trên thiết bị này.</Status>
      </div>}
    </Panel>
  );
}
