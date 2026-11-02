// CR-LAB-01 content (18/19): danh mục nghề, ca, bộ dụng cụ, cây trồng, ao, mẫu mộc.
// Mọi định lượng, giờ ca, tốc độ tăng trưởng, điểm ghi nhận là THIẾT KẾ GAME hư cấu [D].
import type { SkillId, ZoneId } from '../domain/types';
import { hm } from '../domain/util';

export type WorkId = 'W01' | 'W05' | 'W06' | 'W08' | 'W15';
export type WorkKind = 'production' | 'vocational' | 'service';

export interface WorkDef {
  id: WorkId; version: number; title: string; short: string; kind: WorkKind; zone: ZoneId;
  outdoor: boolean; kit: string[]; material?: { id: string; label: string; qty: number; unit: string };
  xp: SkillId; credit: number; icon: string; support: string; orientation?: string;
  /** Nhãn bước chính của ca (hiển thị ở thẻ “Việc trong ca”). */
  stepLabels: string[];
}

export const WORKS: WorkDef[] = [
  { id: 'W01', version: 1, title: 'Vườn rau', short: 'Chăm luống rau ăn lá', kind: 'production', zone: 'L23', outdoor: true, kit: ['watering_can', 'hand_hoe', 'harvest_tray'], material: { id: 'seed_pack', label: 'Gói hạt giống', qty: 1, unit: 'gói' }, xp: 'fitness', credit: 300, icon: 'leaf', support: 'Có thể làm tại bàn phân khay giống (ngồi) — kết quả ghi nhận như nhau.', stepLabels: ['Nhận dụng cụ tại kho', 'Đến luống được giao', 'Chăm luống theo giai đoạn', 'Bàn giao & trả dụng cụ'] },
  { id: 'W05', version: 1, title: 'Ao cá', short: 'Quan sát và chăm ao theo kế hoạch', kind: 'production', zone: 'L24', outdoor: true, kit: ['feed_scoop', 'pond_log'], material: { id: 'feed_portion', label: 'Phần thức ăn đã cấp', qty: 2, unit: 'phần' }, xp: 'fitness', credit: 300, icon: 'fish', support: 'Có ghế tại sàn chăm; không cần xuống nước.', stepLabels: ['Nhận dụng cụ & thức ăn', 'Đến sàn chăm ao', 'Quan sát · cho ăn · ghi nhật ký', 'Bàn giao & trả dụng cụ'] },
  { id: 'W06', version: 1, title: 'Cảnh quan & vườn ươm', short: 'Làm cỏ, trồng hoa theo mẫu', kind: 'service', zone: 'L25', outdoor: true, kit: ['garden_gloves', 'pruner_safe', 'waste_bag'], material: { id: 'seedling_tray', label: 'Khay cây giống', qty: 1, unit: 'khay' }, xp: 'fitness', credit: 300, icon: 'flower', support: 'Có việc ngồi tại bàn ươm khay; không trèo cao.', stepLabels: ['Nhận dụng cụ tại kho', 'Đến khu cảnh quan', 'Làm cỏ · trồng · gom phế liệu', 'Bàn giao & trả dụng cụ'] },
  { id: 'W08', version: 1, title: 'Xưởng mộc', short: 'Làm khay cây dùng chung', kind: 'vocational', zone: 'L10', outdoor: false, kit: ['tape_measure', 'pencil_square', 'sanding_block'], material: { id: 'wood_blank', label: 'Bộ phôi gỗ khay', qty: 1, unit: 'bộ' }, xp: 'focus', credit: 300, icon: 'saw', support: 'Bàn thấp, lựa chọn bằng nút; chế độ hỗ trợ cho kết quả như nhau.', orientation: 'An toàn xưởng: đi giày, gọn tóc, dùng dụng cụ cầm tay đúng chỗ, báo ngay khi dụng cụ hỏng. Máy cắt chỉ do cán bộ vận hành.', stepLabels: ['Nhận dụng cụ & phôi', 'Đến bàn mộc M-03', 'Đo · ghép · hoàn thiện', 'Gửi kiểm nhận & trả dụng cụ'] },
  { id: 'W15', version: 1, title: 'Vệ sinh khu chung', short: 'Quét dọn sân sinh hoạt theo tổ', kind: 'service', zone: 'L04', outdoor: true, kit: ['broom', 'dustpan', 'waste_bag'], xp: 'fitness', credit: 200, icon: 'broom', support: 'Chia phạm vi nhỏ hơn khi cần nghỉ.', stepLabels: ['Nhận dụng cụ tại kho', 'Đến sân sinh hoạt', 'Quét 3 điểm · gom rác', 'Bàn giao & trả dụng cụ'] },
];
export const WORK_BY_ID: Record<WorkId, WorkDef> = Object.fromEntries(WORKS.map((w) => [w.id, w])) as Record<WorkId, WorkDef>;

/** Nghề có trong danh mục nhưng chưa mở (P2) — hiển thị có lý do, không nút giả. */
export const UNAVAILABLE_WORKS: { id: string; title: string; reason: string }[] = [
  { id: 'W02', title: 'Rau giàn thấp', reason: 'Đang chuẩn bị giàn và giống' },
  { id: 'W07', title: 'Chăm cây lâu năm', reason: 'Chờ phân khu cây bóng mát' },
  { id: 'W09', title: 'Sửa đồ dùng', reason: 'Chưa có phiếu sửa' },
  { id: 'W10', title: 'Đan lát thủ công', reason: 'Chưa có vật liệu mẫu' },
  { id: 'W11', title: 'May & sửa đồ vải', reason: 'Chưa mở tổ may' },
  { id: 'W12', title: 'Sơ chế tại bếp', reason: 'Dùng ca bếp hiện có' },
  { id: 'W16', title: 'Phân loại rác tái sử dụng', reason: 'Chưa có điểm phân loại' },
  { id: 'W19', title: 'Chăm vật nuôi nhỏ', reason: 'Chưa mở khu chăn nuôi' },
];

/** Hai ca mỗi ngày (pacing game, không phải lịch thật). */
export interface ShiftWindow { id: 'am' | 'pm'; label: string; from: number; to: number }
export const SHIFT_WINDOWS: ShiftWindow[] = [
  { id: 'am', label: 'Ca sáng', from: hm(8, 30), to: hm(10) },
  { id: 'pm', label: 'Ca chiều', from: hm(14), to: hm(15, 30) },
];

export interface ToolDef { type: string; label: string; icon: string }
export const TOOL_TYPES: Record<string, ToolDef> = {
  watering_can: { type: 'watering_can', label: 'Bình tưới', icon: '🪣' },
  hand_hoe: { type: 'hand_hoe', label: 'Cuốc tay chăm luống', icon: '⛏️' },
  harvest_tray: { type: 'harvest_tray', label: 'Khay nhận rau', icon: '🧺' },
  feed_scoop: { type: 'feed_scoop', label: 'Muỗng định lượng thức ăn', icon: '🥄' },
  pond_log: { type: 'pond_log', label: 'Sổ nhật ký ao', icon: '📒' },
  garden_gloves: { type: 'garden_gloves', label: 'Găng tay làm vườn', icon: '🧤' },
  pruner_safe: { type: 'pruner_safe', label: 'Kéo tỉa đầu tròn', icon: '✂️' },
  waste_bag: { type: 'waste_bag', label: 'Bao gom phế liệu', icon: '🛍️' },
  tape_measure: { type: 'tape_measure', label: 'Thước dây', icon: '📏' },
  pencil_square: { type: 'pencil_square', label: 'Bút chì & ê ke', icon: '📐' },
  sanding_block: { type: 'sanding_block', label: 'Bàn chà nhám', icon: '🧱' },
  broom: { type: 'broom', label: 'Chổi quét', icon: '🧹' },
  dustpan: { type: 'dustpan', label: 'Ki hốt rác', icon: '🗑️' },
};

// ---------- Vườn rau ----------
export type PlotStage = 'empty' | 'prepared' | 'sown' | 'seedling' | 'growing' | 'ready' | 'harvested';
export const PLOT_STAGE_LABEL: Record<PlotStage, string> = {
  empty: 'Đất trống', prepared: 'Đã làm đất', sown: 'Đã gieo', seedling: 'Cây con', growing: 'Đang lớn', ready: 'Sẵn sàng thu', harvested: 'Đã thu · cần dọn',
};
/** Thời gian (phút game) để chuyển giai đoạn khi được tưới đủ. */
export const PLOT_GROWTH: Partial<Record<PlotStage, { next: PlotStage; minutes: number }>> = {
  sown: { next: 'seedling', minutes: 18 * 60 },
  seedling: { next: 'growing', minutes: 24 * 60 },
  growing: { next: 'ready', minutes: 30 * 60 },
};
/** Cây cần tưới lại sau mỗi khoảng này; quá hạn thì tạm ngừng lớn (không chết). */
export const WATER_INTERVAL = 26 * 60;
export const PLOT_IDS = ['R-01', 'R-02', 'R-03', 'R-04'];
export const CROP = { id: 'cai_xanh', label: 'Cải xanh', yieldMin: 6000, yieldMax: 9000 }; // gram

// ---------- Ao cá ----------
export type PondStage = 'growing' | 'harvest_ready' | 'harvest_pending_check' | 'restock_ready';
export const POND_STAGE_LABEL: Record<PondStage, string> = { growing: 'Đang nuôi', harvest_ready: 'Đến kỳ thu', harvest_pending_check: 'Chờ kiểm nhận lô', restock_ready: 'Chuẩn bị thả giống' };
export const POND_FEEDS_PER_DAY = 2;
export const POND_HARVEST_DAY = 5;
export const FISH = { label: 'Cá rô phi', yieldMin: 18000, yieldMax: 24000 };

// ---------- Cảnh quan ----------
export type PatchState = 'need_care' | 'weeded' | 'planted' | 'awaiting_check' | 'accepted';
export const PATCH_STATE_LABEL: Record<PatchState, string> = { need_care: 'Cần chăm', weeded: 'Đã làm cỏ', planted: 'Đã trồng', awaiting_check: 'Chờ nghiệm thu', accepted: 'Đã nghiệm thu' };
export const PATCH_IDS = ['P-01', 'P-02', 'P-03', 'P-04', 'P-05', 'P-06'];
export const PATCH_DECAY_DAYS = 3;

// ---------- Mộc ----------
export type WoodStage = 'brief' | 'blank' | 'marked' | 'assembled' | 'finished' | 'awaiting_check' | 'rework' | 'accepted';
export const WOOD_STAGE_LABEL: Record<WoodStage, string> = { brief: 'Đọc mẫu', blank: 'Đã nhận phôi', marked: 'Đã đo & đánh dấu', assembled: 'Đã ghép', finished: 'Đã hoàn thiện', awaiting_check: 'Chờ kiểm nhận', rework: 'Cần làm lại', accepted: 'Đã nghiệm thu' };
/** Mẫu khay cây: lựa chọn đúng/sai minh bạch, không đòi phản xạ. */
export const TRAY_PATTERN = {
  label: 'Khay cây 40 × 30 cm',
  measure: [
    { id: 'a', text: 'Đáy 40 × 30 · thành cao 8 cm', ok: true },
    { id: 'b', text: 'Đáy 30 × 30 · thành cao 8 cm', ok: false },
    { id: 'c', text: 'Đáy 40 × 30 · thành cao 15 cm', ok: false },
  ],
  assemble: [
    { id: 'a', text: 'Ghép 2 thành dài → 2 thành ngắn → bắt đáy', ok: true },
    { id: 'b', text: 'Bắt đáy trước rồi ghép thành từng bên', ok: false },
  ],
};
export const QC_CRITERIA = ['Đúng mẫu', 'Đủ chi tiết', 'Hoàn thiện'];

// ---------- Vệ sinh khu chung ----------
export const CLEAN_SPOTS = ['S-01', 'S-02', 'S-03'];
export const CLEAN_DIRTY_AFTER = 24 * 60;

/** Nơi nhận theo loại lô. */
export const DESTINATION: Record<string, string> = { veg: 'Bếp · theo lô phân bổ', fish: 'Bếp · theo lô phân bổ', tray: 'Vườn ươm · khay dùng chung', waste: 'Điểm thu gom' };
