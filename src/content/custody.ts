// CR-VN-01 content (13–15): scenario/policy registry, sentence presets, custody schedule, reason texts.
// Mọi giờ giấc, thời hạn lệnh, phân khu là THIẾT KẾ GAME hư cấu.
import type { CustodyPhase, StartSegment, ZoneId } from '../domain/types';
import { hm } from '../domain/util';

export const VN_LABEL = 'Chế độ Thụ án — cơ sở và nhân vật hư cấu';

/** DB45 — published, immutable per version. Save pins id+version+hash. */
export const VN_PROFILE = {
  id: 'vn_custody_reference',
  version: '1.2.0-draft',
  hash: 'vn12-0d5a7c3e9b14f2a6',
  mode: 'vn_custody' as const,
  status: 'published' as const, // published cho trải nghiệm hư cấu; reviewStatus ghi rõ chưa review
  reviewStatus: 'hư cấu, chưa review',
  effectiveFrom: '2026-07-01',
  reviewedAsOf: '2026-11-02',
  supportedPopulation: 'Nhân vật trưởng thành hư cấu',
  disciplineMaxDays: 10,
  calendarStart: '2026-07-01',
};

export interface SentencePreset { id: string; label: string; kind: 'term' | 'life'; months: number | null; basis: 'single' | 'aggregate'; creditedDays: number; note: string; segments: StartSegment[] }
export const SENTENCE_PRESETS: SentencePreset[] = [
  { id: 'VN-T03M', label: '3 tháng', kind: 'term', months: 3, basis: 'single', creditedDays: 30, note: 'Án ngắn vẫn theo cùng lịch ở buồng của nhóm A.', segments: ['intake', 'discipline_demo', 'shu'] },
  { id: 'VN-T06M', label: '6 tháng', kind: 'term', months: 6, basis: 'single', creditedDays: 45, note: 'Không tự do ra khỏi khu vì án ngắn.', segments: ['intake', 'shu'] },
  { id: 'VN-T01Y', label: '1 năm', kind: 'term', months: 12, basis: 'single', creditedDays: 60, note: 'Có giờ ra/về buồng và hoạt động được phân công.', segments: ['intake', 'shu'] },
  { id: 'VN-T03Y', label: '3 năm', kind: 'term', months: 36, basis: 'single', creditedDays: 90, note: '', segments: ['intake', 'separation_demo', 'shu'] },
  { id: 'VN-T05Y', label: '5 năm', kind: 'term', months: 60, basis: 'single', creditedDays: 90, note: 'Không tự chuyển cơ sở chỉ vì mốc 5 năm.', segments: ['intake', 'discipline_demo', 'shu'] },
  { id: 'VN-T10Y', label: '10 năm', kind: 'term', months: 120, basis: 'single', creditedDays: 90, note: 'Học tập, công việc và gặp theo điều kiện riêng.', segments: ['intake', 'shu'] },
  { id: 'VN-T15Y', label: '15 năm', kind: 'term', months: 180, basis: 'single', creditedDays: 90, note: 'Mốc biên: đúng 15 năm không phải "trên 15 năm".', segments: ['intake', 'shu'] },
  { id: 'VN-T20Y', label: '20 năm', kind: 'term', months: 240, basis: 'single', creditedDays: 90, note: 'Nhóm B, không mặc định biệt giam.', segments: ['intake', 'midway', 'shu'] },
  { id: 'VN-T30Y', label: '30 năm · án tổng hợp', kind: 'term', months: 360, basis: 'aggregate', creditedDays: 120, note: 'Ghi rõ án tổng hợp; không phải mức của một tội.', segments: ['intake', 'shu'] },
  { id: 'VN-LIFE', label: 'Chung thân', kind: 'life', months: null, basis: 'single', creditedDays: 0, note: 'Không có ngày hết án · hết chương vẫn chơi tiếp.', segments: ['intake', 'separation_demo', 'shu'] },
];
export const PRESET_BY_ID: Record<string, SentencePreset> = Object.fromEntries(SENTENCE_PRESETS.map((p) => [p.id, p]));

export const SEGMENT_INFO: Record<StartSegment, { label: string; desc: string; illustration: boolean }> = {
  intake: { label: 'Tiếp nhận mới', desc: 'Bắt đầu ở khu tiếp nhận · xếp nhóm và buồng sau thủ tục.', illustration: false },
  midway: { label: 'Một đoạn giữa hành trình', desc: 'Đã chấp hành 6 năm · sớm có quyết định giảm án và phân loại lại.', illustration: true },
  discipline_demo: { label: 'Minh họa kỷ luật', desc: 'Mở đầu bằng 2 ngày buồng kỷ luật · xem quyết định và xin xét lại được.', illustration: true },
  separation_demo: { label: 'Minh họa bố trí riêng', desc: 'Bố trí riêng vì an toàn (không phải kỷ luật) · có hạn xét lại.', illustration: true },
  shu: { label: 'Biệt giam SHU (khắc nghiệt)', desc: 'Ở buồng 23 giờ/ngày · lên 3 cấp để về khu thường', illustration: true },
};

// ---------- Custody schedule (24h, [from,to), không có khoảng trống) ----------
export type WindowKind = 'night' | 'cell' | 'activity';
export interface CustodyWindow { from: number; to: number; kind: WindowKind; label: string; zones: ZoneId[] }
const W = (from: number, to: number, kind: WindowKind, label: string, zones: ZoneId[] = []): CustodyWindow => ({ from, to, kind, label, zones });
const MEAL: ZoneId[] = ['L05'];
const WORK_STUDY: ZoneId[] = ['L10', 'L06', 'L14', 'L07', 'L13'];
const SERVICES: ZoneId[] = ['L07', 'L14', 'L10', 'L06', 'L15', 'L16', 'L11', 'L13', 'L18', 'L01'];

function scheduleFor(group: 'A' | 'B'): CustodyWindow[] {
  // Nhóm B lệch giờ sân/nhà ăn để tách cohort, không bớt tiện ích.
  const yard = group === 'A' ? [hm(16, 30), hm(17, 30)] : [hm(15, 30), hm(16, 30)];
  const svcEnd = group === 'A' ? hm(16, 30) : hm(15, 30);
  const afterYard = group === 'A' ? hm(17, 30) : hm(16, 30);
  return [
    W(0, hm(6), 'night', 'Ngủ tại buồng'),
    W(hm(6), hm(7), 'cell', 'Dậy · điểm danh tại buồng'),
    W(hm(7), hm(8), 'activity', 'Bữa sáng', MEAL),
    W(hm(8), hm(11), 'activity', 'Lao động / học', WORK_STUDY),
    W(hm(11), hm(12), 'activity', 'Bữa trưa', MEAL),
    W(hm(12), hm(13, 30), 'cell', 'Nghỉ trưa'),
    W(hm(13, 30), svcEnd, 'activity', 'Học · dịch vụ · liên lạc', SERVICES),
    W(yard[0], yard[1], 'activity', 'Sân / phòng tập', ['L04', 'L09']),
    ...(group === 'A' ? [] : [W(afterYard, hm(17, 30), 'activity', 'Dịch vụ · liên lạc', SERVICES)]),
    W(hm(17, 30), hm(18, 30), 'activity', 'Bữa tối', MEAL),
    W(hm(18, 30), hm(19, 30), 'activity', 'Vệ sinh · giặt · liên lạc', ['L13', 'L16', 'L17']),
    W(hm(19, 30), hm(22), 'cell', 'Tại buồng · điểm danh 21:30'),
    W(hm(22), hm(24), 'night', 'Ngủ tại buồng'),
  ].filter((w) => w.to > w.from).sort((a, b) => a.from - b.from);
}
export const CUSTODY_SCHEDULE: Record<'A' | 'B', CustodyWindow[]> = { A: scheduleFor('A'), B: scheduleFor('B') };

export const PHASE_LABEL: Record<CustodyPhase, string> = {
  intake: 'Đang tiếp nhận',
  in_cell: 'Giờ ở buồng',
  scheduled_movement: 'Đang di chuyển',
  authorized_activity: 'Giờ hoạt động',
  returning: 'Về buồng',
  night_confinement: 'Ban đêm',
  separate_housing: 'Bố trí riêng',
  disciplinary_confinement: 'Kỷ luật',
  restrictive_housing: 'Biệt giam SHU',
  care_transfer: 'Đang chuyển chăm sóc',
  transfer_pending: 'Đang chuẩn bị chuyển nơi',
  released: 'Đã rời cơ sở',
};

/** Microcopy 15 §6 — không giả trích quyết định của cơ quan nhà nước. */
/** Lý do phân nhóm (14 §3) — nhãn đọc được, không hiển thị mã thô. */
export const CLASS_REASON_TEXT: Record<string, string> = {
  NOT_OVER_15_YEARS: 'Án không quá 15 năm',
  OVER_15_YEARS: 'Án trên 15 năm',
  LIFE_SENTENCE: 'Án chung thân',
  DANGEROUS_RECIDIVISM: 'Tái phạm nguy hiểm',
  REDUCED_UNDER_15_DECISION: 'Đã giảm án, chuyển nhóm',
  RECIDIVISM_HALF_REDUCED_DECISION: 'Đã giảm án, chuyển nhóm',
  POLICY_REVIEW_REQUIRED: 'Đang xem xét',
};
export const REASON_TEXT: Record<string, string> = {
  ROOM_CONFINEMENT: 'Đang là giờ ở buồng.',
  AUTHORIZATION_REQUIRED: 'Bạn chưa có phép di chuyển tới khu này.',
  DIFFERENT_COHORT: 'Khu này không dành cho nhóm của bạn.',
  DISCIPLINE_ORDER_ACTIVE: 'Đang chịu kỷ luật — chưa được ra khỏi buồng.',
  SEPARATION_ACTIVE: 'Đang ở buồng riêng — dịch vụ phục vụ tại buồng.',
  FAMILY_VISIT_RESTRICTED: 'Tạm thời chưa được gặp người thân.',
  CARE_SERVICE_AT_ROOM: 'Bạn có thể gửi yêu cầu chăm sóc tại đây.',
  TRANSITION_PENDING: 'Đang chuẩn bị nơi đến · giữ chỗ hiện tại.',
  POLICY_REVIEW_REQUIRED: 'Chế độ này chưa sẵn sàng.',
  CHAPTER_ONLY: 'Hoàn thành chương 1 — tiếp tục thụ án.',
  INTAKE_ONLY: 'Hãy hoàn tất tiếp nhận trước khi tới khu khác.',
  OTHER_ROOM: 'Đây là buồng của người khác.',
  RELEASED: 'Bạn đã rời cơ sở.',
  SHU_ACTIVE: 'Đang biệt giam · chỉ ra buồng khi được áp giải.',
  SHU_LEVEL: 'Chưa đủ cấp step-down cho đặc quyền này.',
};
export const SERVICE_ZONES: ZoneId[] = ['L08', 'L11', 'L12', 'L16', 'L17', 'L13'];

// ======================= Biệt giam kiểu Mỹ — Security Housing Unit (thiết kế game hư cấu) =======================
// Tham chiếu hình thức phổ biến của SHU/supermax: ở buồng ~23 giờ/ngày, suất ăn qua khe cửa, áp giải bằng còng,
// thể dục 1 giờ một mình trong cũi, tắm cách ngày, sinh hoạt nhóm trong cũi cá nhân, gặp người thân không tiếp xúc.
export type ShuActivity = 'rec' | 'shower' | 'group';
export interface ShuWindow { from: number; to: number; kind: ShuActivity | 'cell' | 'night'; label: string; minLevel: 1 | 2 | 3; days: 'all' | 'odd' | 'even' }
const SW = (from: number, to: number, kind: ShuWindow['kind'], label: string, minLevel: 1 | 2 | 3 = 1, days: ShuWindow['days'] = 'all'): ShuWindow => ({ from, to, kind, label, minLevel, days });
export const SHU_SCHEDULE: ShuWindow[] = [
  SW(0, hm(6), 'night', 'Đêm · kiểm tra 30 phút/lần'),
  SW(hm(6), hm(9), 'cell', 'Kiểm đếm · bữa sáng qua khe cửa'),
  SW(hm(9), hm(10), 'rec', 'Thể dục trong cũi'),
  SW(hm(10), hm(14), 'cell', 'Tại buồng · bữa trưa'),
  SW(hm(14), hm(14, 30), 'shower', 'Tắm (ngày lẻ)', 1, 'odd'),
  SW(hm(14, 30), hm(15), 'cell', 'Tại buồng'),
  SW(hm(15), hm(16), 'group', 'Sinh hoạt nhóm (cũi)', 2, 'even'),
  SW(hm(16), hm(22), 'cell', 'Tại buồng · bữa tối · kiểm đếm 21:00'),
  SW(hm(22), hm(24), 'night', 'Đêm · kiểm tra 30 phút/lần'),
];
export interface ShuLevel { level: 1 | 2 | 3; title: string; days: number; privileges: string[] }
/** Chương trình step-down: giữ kỷ luật đủ số ngày để lên cấp; vi phạm → về cấp 1. */
export const SHU_LEVELS: ShuLevel[] = [
  { level: 1, title: 'Cấp 1 · Hạn chế tối đa', days: 3, privileges: ['Thể dục 1 giờ/ngày trong cũi', 'Tắm cách ngày', 'Viết thư', 'Yêu cầu y tế tại buồng'] },
  { level: 2, title: 'Cấp 2 · Chương trình', days: 3, privileges: ['Thêm: sinh hoạt nhóm trong cũi trị liệu', 'Mượn sách (xe sách)', '1 cuộc gọi có giám sát'] },
  { level: 3, title: 'Cấp 3 · Chuẩn bị chuyển khu', days: 4, privileges: ['Thêm: mua căng-tin hạn chế', 'Đủ ngày → xét chuyển về khu thường'] },
];
/** Chung thân: không có ngày ra SHU cố định — xét lại định kỳ (ngày game). */
export const SHU_LIFE_REVIEW_DAYS = 5;
export const shuTotalDays = () => SHU_LEVELS.reduce((t, l) => t + l.days, 0);
export const SHU_ROOM_COHORT: Record<ShuActivity, 'shu_rec' | 'shu_shower' | 'shu_module'> = { rec: 'shu_rec', shower: 'shu_shower', group: 'shu_module' };