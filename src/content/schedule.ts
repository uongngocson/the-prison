// Lịch sinh hoạt hư cấu (F15/F37). Không phải lịch của cơ sở thật.
import type { ZoneId } from '../domain/types';
import type { SlotKind } from './world';
import type { NpcDef, ResidentGroup } from './npcs';
import { hm } from '../domain/util';

export interface ScheduleRow { id: string; from: number; to: number; label: string; zones: ZoneId[]; kind: 'routine' | 'meal' | 'activity' | 'rest' | 'rollcall' | 'sleep'; optional: boolean; hint: string }

export const DAILY: ScheduleRow[] = [
  { id: 'wake', from: hm(6), to: hm(6, 30), label: 'Thức dậy & vệ sinh', zones: ['L02', 'L13'], kind: 'routine', optional: true, hint: 'Rửa mặt, tắm nhanh.' },
  { id: 'roll_am', from: hm(6, 30), to: hm(6, 45), label: 'Điểm danh sáng', zones: ['L02'], kind: 'rollcall', optional: false, hint: 'Có mặt ở khu ở · có lịch hẹn thì được miễn.' },
  { id: 'breakfast', from: hm(7), to: hm(8, 30), label: 'Bữa sáng', zones: ['L05'], kind: 'meal', optional: true, hint: 'Nhận suất ở quầy.' },
  { id: 'morning_work', from: hm(8, 30), to: hm(11, 30), label: 'Lao động / Học tập', zones: ['L10', 'L06', 'L14', 'L07'], kind: 'activity', optional: true, hint: 'Theo phân công/khóa học · chưa nhận thì không bắt buộc.' },
  { id: 'lunch', from: hm(11, 30), to: hm(13), label: 'Bữa trưa', zones: ['L05'], kind: 'meal', optional: true, hint: 'Đến muộn vẫn có suất dự phòng.' },
  { id: 'siesta', from: hm(13), to: hm(14), label: 'Nghỉ trưa', zones: ['L02'], kind: 'rest', optional: true, hint: 'Nghỉ ngơi hoặc đọc sách.' },
  { id: 'afternoon', from: hm(14), to: hm(15, 30), label: 'Thư viện / Lớp / Dịch vụ', zones: ['L07', 'L14', 'L15', 'L11', 'L16'], kind: 'activity', optional: true, hint: 'Sách, lớp, đặt hàng, thư, nộp đơn.' },
  { id: 'yard', from: hm(15, 30), to: hm(17, 30), label: 'Sân sinh hoạt / Phòng tập', zones: ['L04', 'L09'], kind: 'activity', optional: true, hint: 'Đi bộ, tập, trò chuyện · mưa thì vào phòng tập.' },
  { id: 'dinner', from: hm(17, 30), to: hm(19), label: 'Bữa tối', zones: ['L05'], kind: 'meal', optional: true, hint: 'Bữa ăn cuối ngày.' },
  { id: 'evening', from: hm(19), to: hm(21, 30), label: 'Sinh hoạt nhẹ & liên lạc', zones: ['L02', 'L07', 'L17', 'L16', 'L13'], kind: 'activity', optional: true, hint: 'Nhóm đọc, yên tĩnh, gọi điện, giặt đồ.' },
  { id: 'roll_pm', from: hm(21, 30), to: hm(21, 45), label: 'Điểm danh tối', zones: ['L02'], kind: 'rollcall', optional: false, hint: 'Có mặt ở khu ở.' },
  { id: 'night', from: hm(22), to: hm(24), label: 'Giờ ngủ', zones: ['L02'], kind: 'sleep', optional: true, hint: 'Ngủ để hồi năng lượng · hoạt động yên tĩnh vẫn được.' },
];

export const MEALS: { id: 'breakfast' | 'lunch' | 'dinner'; from: number; to: number; label: string }[] = [
  { id: 'breakfast', from: hm(7), to: hm(8, 30), label: 'Bữa sáng' },
  { id: 'lunch', from: hm(11, 30), to: hm(13), label: 'Bữa trưa' },
  { id: 'dinner', from: hm(17, 30), to: hm(19), label: 'Bữa tối' },
];

export const ROLL_CALLS = [
  { id: 'roll_am', at: hm(6, 30), end: hm(6, 45), label: 'Điểm danh sáng' },
  { id: 'roll_pm', at: hm(21, 30), end: hm(21, 45), label: 'Điểm danh tối' },
];

// ---------- NPC schedules ----------
export interface NpcBlock { from: number; to: number; zone: ZoneId; slot: SlotKind | 'absent' | 'follow' | 'post'; alt?: { zone: ZoneId; slot: SlotKind } }

const groupDay: Record<ResidentGroup, NpcBlock[]> = {
  readers: [
    { from: hm(8, 30), to: hm(11, 30), zone: 'L14', slot: 'class', alt: { zone: 'L07', slot: 'read' } },
    { from: hm(14), to: hm(15, 30), zone: 'L07', slot: 'read' },
    { from: hm(15, 30), to: hm(17, 30), zone: 'L04', slot: 'sit', alt: { zone: 'L07', slot: 'read' } },
    { from: hm(19), to: hm(21, 30), zone: 'L07', slot: 'read', alt: { zone: 'L02', slot: 'sit' } },
  ],
  sports: [
    { from: hm(8, 30), to: hm(11, 30), zone: 'L10', slot: 'work' },
    { from: hm(14), to: hm(15, 30), zone: 'L09', slot: 'exercise' },
    { from: hm(15, 30), to: hm(17, 30), zone: 'L04', slot: 'walk', alt: { zone: 'L09', slot: 'exercise' } },
    { from: hm(19), to: hm(21, 30), zone: 'L02', slot: 'sit', alt: { zone: 'L09', slot: 'exercise' } },
  ],
  kitchen: [
    { from: hm(8, 30), to: hm(11, 30), zone: 'L06', slot: 'work' },
    { from: hm(14), to: hm(15, 30), zone: 'L06', slot: 'work' },
    { from: hm(15, 30), to: hm(17, 30), zone: 'L04', slot: 'stand', alt: { zone: 'L02', slot: 'sit' } },
    { from: hm(19), to: hm(21, 30), zone: 'L02', slot: 'sit' },
  ],
  workshop: [
    { from: hm(8, 30), to: hm(11, 30), zone: 'L10', slot: 'work' },
    { from: hm(14), to: hm(15, 30), zone: 'L10', slot: 'work' },
    { from: hm(15, 30), to: hm(17, 30), zone: 'L04', slot: 'exercise', alt: { zone: 'L09', slot: 'exercise' } },
    { from: hm(19), to: hm(21, 30), zone: 'L03', slot: 'sit', alt: { zone: 'L02', slot: 'sit' } },
  ],
  quiet: [
    { from: hm(8, 30), to: hm(11, 30), zone: 'L14', slot: 'class', alt: { zone: 'L17', slot: 'quiet' } },
    { from: hm(14), to: hm(15, 30), zone: 'L17', slot: 'quiet' },
    { from: hm(15, 30), to: hm(17, 30), zone: 'L04', slot: 'sit', alt: { zone: 'L17', slot: 'quiet' } },
    { from: hm(19), to: hm(21, 30), zone: 'L17', slot: 'quiet', alt: { zone: 'L02', slot: 'sit' } },
  ],
  newcomers: [
    { from: hm(8, 30), to: hm(11, 30), zone: 'L01', slot: 'sit' },
    { from: hm(14), to: hm(15, 30), zone: 'L03', slot: 'sit' },
    { from: hm(15, 30), to: hm(17, 30), zone: 'L04', slot: 'stand' },
    { from: hm(19), to: hm(21, 30), zone: 'L02', slot: 'sit' },
  ],
};

const common: NpcBlock[] = [
  { from: hm(6), to: hm(6, 30), zone: 'L13', slot: 'wash', alt: { zone: 'L02', slot: 'stand' } },
  { from: hm(6, 30), to: hm(7), zone: 'L02', slot: 'stand' },
  { from: hm(7), to: hm(8, 20), zone: 'L05', slot: 'eat' },
  { from: hm(11, 30), to: hm(12, 40), zone: 'L05', slot: 'eat' },
  { from: hm(12, 40), to: hm(14), zone: 'L02', slot: 'sit', alt: { zone: 'L03', slot: 'sit' } },
  { from: hm(17, 30), to: hm(18, 40), zone: 'L05', slot: 'eat' },
  { from: hm(18, 40), to: hm(19), zone: 'L13', slot: 'wash', alt: { zone: 'L02', slot: 'sit' } },
  { from: hm(21, 30), to: hm(22), zone: 'L02', slot: 'stand' },
];

export function npcBlockAt(npc: NpcDef, minuteOfDay: number): NpcBlock {
  if (npc.role === 'staff') {
    const [s, e] = npc.shift === 'night' ? [hm(19), hm(7)] : npc.shift === 'late' ? [hm(12), hm(22)] : npc.staffRole === 'server' ? [hm(6, 30), hm(19, 30)] : [hm(7), hm(19)];
    const on = s < e ? minuteOfDay >= s && minuteOfDay < e : minuteOfDay >= s || minuteOfDay < e;
    if (!on) return { from: 0, to: 0, zone: 'L01', slot: 'absent' };
    if (npc.staffRole === 'residential') return { from: s, to: e, zone: 'L02', slot: 'stand', alt: { zone: 'L03', slot: 'stand' } };
    if (npc.staffRole === 'maintenance') return { from: s, to: e, zone: 'L03', slot: 'stand' };
    if (npc.staffRole === 'coach' && minuteOfDay >= hm(15, 30) && minuteOfDay < hm(17, 30)) return { from: hm(15, 30), to: hm(17, 30), zone: 'L04', slot: 'stand' };
    return { from: s, to: e, zone: 'L01', slot: 'post' };
  }
  const m = minuteOfDay;
  if (m >= hm(22) || m < hm(6)) return npc.bed ? { from: hm(22), to: hm(6), zone: 'L02', slot: 'sleep' } : { from: hm(22), to: hm(6), zone: 'L02', slot: 'absent' };
  for (const b of common) if (m >= b.from && m < b.to) return b;
  for (const b of groupDay[npc.group ?? 'workshop']) if (m >= b.from && m < b.to) return b;
  return { from: m, to: m + 30, zone: 'L02', slot: 'sit', alt: { zone: 'L03', slot: 'sit' } };
}
