// U09 Profile, U10 Relationships/Reputation, U11 Skills, U19 Achievements.
import { useState } from 'react';
import { useUI } from '../store';
import { Panel, Tabs, Bar, Empty, Status } from '../components';
import { controller } from '../../app/controller';
import { NPC_BY_ID, GROUP_LABEL } from '../../content/npcs';
import { ACHIEVEMENTS } from '../../content/quests';
import { NEED_LABEL, SKILL_LABEL, SKILL_THRESHOLDS, levelOf, relTier, repTier } from '../../domain/core';
import { dayOf, fmtDayClock } from '../../domain/util';
import type { SkillId } from '../../domain/types';

const close = () => useUI.getState().open(null);
const SKILL_UNLOCK: Record<SkillId, string[]> = {
  focus: ['Cấp 2: bài đọc dài hơn ở thư viện', 'Cấp 3: được mời hỗ trợ lớp học', 'Cấp 4: phụ trách sắp xếp kệ chuyên đề', 'Cấp 5: trợ giảng nhóm đọc'],
  fitness: ['Cấp 2: buổi tập nhóm nâng cao', 'Cấp 3: hướng dẫn khởi động cho người mới', 'Cấp 4: chạy vòng dài', 'Cấp 5: điều phối buổi tập'],
  communication: ['Cấp 2: lựa chọn hòa giải trong hội thoại', 'Cấp 3: hướng dẫn người mới', 'Cấp 4: đại diện nhóm góp ý', 'Cấp 5: người lắng nghe đồng đẳng'],
};
const SUGGEST: Record<SkillId, string> = { focus: 'Đọc sách, học lớp, ca xưởng', fitness: 'Tập ở sân hoặc phòng tập', communication: 'Trò chuyện, phụ bếp, giúp người mới' };

export function ProfilePanel() {
  useUI((s) => s.rev);
  const tab = useUI((s) => s.profileTab);
  const set = useUI((s) => s.set);
  const s = controller.s!;
  return (
    <Panel title="Hồ sơ" onClose={close} tabs={<Tabs label="Hồ sơ" value={tab} onChange={(t) => set({ profileTab: t })} tabs={[{ id: 'profile', label: 'Nhân vật' }, { id: 'relations', label: 'Quan hệ' }, { id: 'skills', label: 'Kỹ năng' }, { id: 'achievements', label: 'Thành tựu' }]} />}>
      {tab === 'profile' && <ProfileTab />}
      {tab === 'relations' && <Relations />}
      {tab === 'skills' && <Skills />}
      {tab === 'achievements' && <Achievements />}
      <span className="sr">{s.character.name}</span>
    </Panel>
  );
}

function ProfileTab() {
  const s = controller.s!;
  const done = Object.values(s.quests).filter((q) => q.state === 'completed').length;
  return (
    <div className="grid2">
      <div className="card">
        <h3>{s.character.name}</h3>
        <dl className="kv small">
          <dt>Chương</dt><dd>{s.chapter} / 3</dd>
          <dt>Ngày thứ</dt><dd>{dayOf(s.minute)} (đã qua {s.stats.daysCompleted} ngày)</dd>
          <dt>Nhiệm vụ hoàn thành</dt><dd>{done}</dd>
          <dt>Quãng đường đi bộ</dt><dd>{(s.stats.distanceWalked / 1000).toFixed(2)} km</dd>
          <dt>Bữa đã ăn</dt><dd>{s.stats.mealsEaten}</dd>
          <dt>Lần giúp đỡ</dt><dd>{s.stats.helps}</dd>
          <dt>Chế độ lưu</dt><dd>Đơn người chơi (không tin cậy cho chế độ nhiều người)</dd>
        </dl>
        <p className="muted small">Ngoại hình chỉ mang tính thẩm mỹ; đổi trang phục trong Túi đồ.</p>
      </div>
      <div className="card">
        <h3>Nhu cầu hiện tại</h3>
        {(['energy', 'hunger', 'hygiene', 'mood'] as const).map((k) => (
          <div key={k} style={{ marginBottom: 8 }}>
            <div className="row small"><b>{NEED_LABEL[k]}</b><span className="spacer" />{Math.round(s.needs[k])}/100</div>
            <Bar value={s.needs[k]} label={NEED_LABEL[k]} />
            <div className="small muted">Nguyên nhân gần nhất: {s.needCauses[k]}</div>
          </div>
        ))}
        <p className="small muted">Chỉ số thấp chỉ gợi ý nhẹ — không khóa tiến trình chính.</p>
      </div>
    </div>
  );
}

function Relations() {
  const s = controller.s!;
  const [q, setQ] = useState('');
  const known = Object.entries(s.relationships).filter(([id, r]) => r.known && NPC_BY_ID[id]).filter(([id]) => !q || NPC_BY_ID[id].name.toLowerCase().includes(q.toLowerCase()));
  const [sel, setSel] = useState<string | null>(known[0]?.[0] ?? null);
  const r = sel ? s.relationships[sel] : null;
  const def = sel ? NPC_BY_ID[sel] : null;
  return (
    <div className="split">
      <div className="col">
        <label className="field">Tìm người quen<input type="text" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        {known.length === 0 && <Empty>Chưa quen ai. Đến gần một người và nhấn tương tác để trò chuyện.</Empty>}
        {known.map(([id, rel]) => <button key={id} className="item-row" aria-selected={sel === id} onClick={() => setSel(id)}>{NPC_BY_ID[id].name} <span className="spacer" /><span className="small muted">{relTier(rel)}</span></button>)}
        <h3 style={{ marginTop: 12 }}>Uy tín nhóm</h3>
        {Object.entries(s.reputation).map(([g, v]) => <div key={g} className="small">{GROUP_LABEL[g] ?? g}: <b>{repTier(v.value)}</b>{v.lastCause ? <span className="muted"> · gần nhất: {v.lastCause}</span> : null}</div>)}
        <p className="small muted">Uy tín nhóm khác với tình bạn từng người, và không ảnh hưởng quyền tối thiểu.</p>
      </div>
      {def && r && (
        <div className="card">
          <h3>{def.name}</h3>
          <p className="small muted">{def.title}</p>
          <p className="small">{def.bio}</p>
          <dl className="kv small">
            <dt>Mức quan hệ</dt><dd><b>{relTier(r)}</b></dd>
            <dt>Tin cậy</dt><dd>{r.trust}</dd>
            <dt>Tôn trọng</dt><dd>{r.respect}</dd>
            <dt>Thân quen</dt><dd>{r.familiarity}</dd>
          </dl>
          <h3 style={{ marginTop: 8 }}>Những điều họ biết về bạn</h3>
          {r.recent.length === 0 && <Empty>Chưa có kỷ niệm đáng nhớ.</Empty>}
          {[...r.recent].reverse().map((c, i) => <div key={i} className="small">{fmtDayClock(c.minute)} · {c.text} ({c.delta > 0 ? '+' : ''}{c.delta})</div>)}
          <p className="small muted">Chỉ hiển thị những việc người này tận mắt chứng kiến hoặc trực tiếp trò chuyện.</p>
        </div>
      )}
    </div>
  );
}

function Skills() {
  const s = controller.s!;
  return (
    <div className="grid3">
      {(['focus', 'fitness', 'communication'] as SkillId[]).map((k) => {
        const xp = s.skills[k];
        const lv = levelOf(xp);
        const next = SKILL_THRESHOLDS[lv];
        return (
          <div key={k} className="card">
            <h3>{SKILL_LABEL[k]}</h3>
            <p>Cấp {lv}{lv >= 5 ? ' (tối đa)' : ''}</p>
            <Bar value={next ? xp - SKILL_THRESHOLDS[lv - 1] : 1} max={next ? next - SKILL_THRESHOLDS[lv - 1] : 1} label={SKILL_LABEL[k]} />
            <p className="small">{next ? `${xp}/${next} XP` : `${xp} XP`}</p>
            <p className="small muted">Mở khóa tiếp: {SKILL_UNLOCK[k][lv - 1] ?? 'Đã mở hết'}</p>
            <p className="small">Gợi ý: {SUGGEST[k]}</p>
          </div>
        );
      })}
      <p className="small muted" style={{ gridColumn: '1 / -1' }}>Kỹ năng không cần tối đa để xem kết thúc chính. Hoạt động lặp nhiều lần trong ngày nhận ít XP hơn (giới hạn mềm).</p>
    </div>
  );
}

function Achievements() {
  const s = controller.s!;
  const [f, setF] = useState<'all' | 'done' | 'todo'>('all');
  const list = ACHIEVEMENTS.filter((a) => { const u = s.achievements[a.id]?.unlockedAtMinute !== undefined; return f === 'all' || (f === 'done' ? u : !u); });
  const n = ACHIEVEMENTS.filter((a) => s.achievements[a.id]?.unlockedAtMinute !== undefined).length;
  return (
    <div>
      <div className="row"><b>{n}/{ACHIEVEMENTS.length} đã mở</b><span className="spacer" />
        {(['all', 'done', 'todo'] as const).map((x) => <button key={x} className={`btn sm ${f === x ? 'primary' : ''}`} onClick={() => setF(x)}>{x === 'all' ? 'Tất cả' : x === 'done' ? 'Đã mở' : 'Chưa mở'}</button>)}
      </div>
      <table className="tbl" style={{ marginTop: 8 }}><tbody>
        {list.map((a) => { const st = s.achievements[a.id]; const u = st?.unlockedAtMinute !== undefined; const hidden = a.hidden && !u; return (
          <tr key={a.id}><td>{u ? '🏅' : '○'}</td><td><b>{hidden ? 'Thành tựu ẩn' : a.title}</b><div className="small muted">{hidden ? 'Tiếp tục câu chuyện chính để khám phá.' : a.desc}</div></td>
            <td className="small">{u ? <>Mở {fmtDayClock(st!.unlockedAtMinute!)} <Status>cục bộ</Status></> : `${Math.min(st?.counter ?? 0, a.target)}/${a.target}`}</td></tr>); })}
      </tbody></table>
      <p className="small muted">Thành tựu đơn người chơi được đánh dấu “cục bộ”. Dùng chế độ hỗ trợ/trợ năng không làm mất hiệu lực thành tựu.</p>
    </div>
  );
}
