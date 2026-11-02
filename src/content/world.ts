// World content: 18 khu L01–L18 (blockout hư cấu, 1 unit = 1 m). Không mô phỏng bản vẽ cơ sở thật.
// Dữ liệu này là nguồn chung cho PhysicsPort (colliders), NavGraph (NPC), presentation và map U13.
import type { Vec3, ZoneId } from '../domain/types';

export interface ZoneDef {
  id: ZoneId;
  name: string;
  side: 'north' | 'south' | 'corridor' | 'yard';
  x0: number; x1: number; z0: number; z1: number;
  height: number;
  floor: string; wall: string; accent: string;
  outdoor?: boolean;
  door: { x: number; z: number; axis: 'x' | 'z'; width: number } | null;
  tier: 'slice' | 'mvp' | 'full' | 'life';
  purpose: string;
  hours?: [number, number]; // giờ mở cửa (phút trong ngày), null = luôn mở
}

export type PropKind =
  | 'bed' | 'locker' | 'desk' | 'chair' | 'table' | 'counter' | 'sink' | 'shower' | 'toilet' | 'water'
  | 'shelf' | 'board' | 'bar' | 'mat' | 'workbench' | 'laundry' | 'barber' | 'phone' | 'visit_table'
  | 'medbed' | 'plant' | 'tree' | 'bench' | 'track' | 'stove' | 'prep' | 'boxes' | 'whiteboard'
  | 'tray_return' | 'cabinet' | 'hoop' | 'staff_post' | 'mail_desk' | 'quiet_mat' | 'muster' | 'window';

export interface PropDef {
  id: string;
  kind: PropKind;
  zone: ZoneId;
  x: number; z: number; yaw: number;
  w: number; d: number; h: number; // footprint (local width along yaw-right, depth along yaw-forward)
  collider: boolean;
  label: string;
  meta?: Record<string, string | number>;
}

export type SlotKind = 'sleep' | 'eat' | 'sit' | 'read' | 'class' | 'exercise' | 'work' | 'wash' | 'staff' | 'walk' | 'visit' | 'quiet' | 'queue' | 'stand' | 'care';
export interface SlotDef { id: string; zone: ZoneId; kind: SlotKind; pos: Vec3; yaw: number; pose: 'sit' | 'stand' | 'lie' | 'exercise' | 'work' | 'read'; propId?: string; owner?: string }

export interface WallSeg { x0: number; z0: number; x1: number; z1: number; h: number; zone: ZoneId; color: string; doorId?: string }

const CORR = 2; // corridor half-width

export const ZONES: ZoneDef[] = [];
const north: [ZoneId, string, number, number, string, ZoneDef['tier'], string][] = [
  ['L01', 'Tiếp nhận', 16, 12, '#8a8f8c', 'full', 'Tiếp nhận người mới, hồ sơ hành trình, định hướng'],
  ['L18', 'Hướng nghiệp & chuẩn bị ra', 14, 10, '#9b8d78', 'life', 'Kế hoạch tái hòa nhập, nhận lại tài sản, rời cơ sở'],
  ['L02', 'Khu phòng ở', 26, 14, '#7f8a86', 'slice', 'Phòng ở, giường, tủ cá nhân, sinh hoạt chung, điểm danh'],
  ['L05', 'Nhà ăn', 22, 16, '#8c8478', 'slice', 'Nhận suất ăn, chọn chỗ ngồi, gặp gỡ'],
  ['L06', 'Nhà bếp', 14, 12, '#a3a7a5', 'full', 'Ca bếp, chuẩn bị và dọn rửa'],
  ['L07', 'Thư viện', 16, 12, '#8b7660', 'mvp', 'Mượn sách, đọc, sắp xếp sách, nhóm đọc'],
  ['L14', 'Phòng học', 18, 12, '#8f8070', 'full', 'Lớp học, khóa kỹ năng, giấy ghi nhận'],
  ['L17', 'Phòng yên tĩnh', 12, 10, '#7d8a7a', 'life', 'Nghỉ yên tĩnh, hỗ trợ đồng đẳng, sinh hoạt văn hóa tự chọn'],
];
const south: [ZoneId, string, number, number, string, ZoneDef['tier'], string][] = [
  ['L11', 'Hồ sơ & tư vấn', 16, 10, '#8a8578', 'full', 'Đơn yêu cầu, xem xét lại, cố vấn hồ sơ hư cấu'],
  ['L16', 'Góc liên lạc', 14, 10, '#7f8590', 'life', 'Thư từ, cuộc gọi giả lập, tư vấn riêng'],
  ['L15', 'Quầy dịch vụ', 12, 10, '#8e8a80', 'life', 'Cấp phát thiết yếu, đặt hàng nội bộ, nhận hàng'],
  ['L13', 'Vệ sinh & giặt', 16, 10, '#9aa3a6', 'mvp', 'Rửa, tắm kín đáo, đổi đồ giặt, cắt tóc'],
  ['L08', 'Phòng y tế', 14, 10, '#a9b1ae', 'full', 'Hẹn chăm sóc, nghỉ phục hồi, kế hoạch hỗ trợ'],
  ['L12', 'Phòng thăm gặp', 20, 12, '#957f6a', 'full', 'Thăm gặp người thân hư cấu'],
  ['L09', 'Phòng tập', 20, 12, '#6f7a80', 'full', 'Tập luyện trong nhà, thay thế khi mưa'],
  ['L10', 'Xưởng lao động', 26, 14, '#857a6a', 'full', 'Ca làm việc, phân loại, kiểm kê'],
];

const HOURS: Partial<Record<ZoneId, [number, number]>> = {
  L04: [6 * 60, 19 * 60],
  L06: [5 * 60 + 30, 19 * 60 + 30],
  L07: [8 * 60, 20 * 60 + 30],
  L09: [7 * 60, 20 * 60],
  L10: [7 * 60 + 30, 17 * 60],
  L14: [8 * 60, 18 * 60],
  L12: [9 * 60, 17 * 60],
  L16: [7 * 60, 21 * 60],
  L15: [8 * 60, 18 * 60],
  L11: [8 * 60, 17 * 60 + 30],
  L18: [8 * 60, 17 * 60 + 30],
  L01: [7 * 60, 19 * 60],
};

function layoutSide(list: typeof north, side: 'north' | 'south') {
  let x = -69;
  for (const [id, name, w, d, wall, tier, purpose] of list) {
    const z0 = side === 'north' ? CORR : -CORR - d;
    const z1 = side === 'north' ? CORR + d : -CORR;
    ZONES.push({
      id, name, side, x0: x, x1: x + w, z0, z1, height: 3.4,
      floor: side === 'north' ? '#5d605c' : '#5a5d60', wall, accent: '#e8b77a',
      door: { x: x + w / 2, z: side === 'north' ? CORR : -CORR, axis: 'x', width: 1.8 },
      tier, purpose, hours: HOURS[id],
    });
    x += w;
  }
}
layoutSide(north, 'north');
layoutSide(south, 'south');
ZONES.push({ id: 'L03', name: 'Hành lang chính', side: 'corridor', x0: -69, x1: 69, z0: -CORR, z1: CORR, height: 3.6, floor: '#4f5452', wall: '#6d7774', accent: '#e8b77a', door: null, tier: 'slice', purpose: 'Kết nối các khu, bảng lịch, biển chỉ dẫn' });
ZONES.push({ id: 'L04', name: 'Sân sinh hoạt', side: 'yard', x0: 69, x1: 109, z0: -16, z1: 12, height: 5, floor: '#5b5b55', wall: '#7b7468', accent: '#8fd1aa', outdoor: true, door: { x: 69, z: 0, axis: 'z', width: 1.8 }, tier: 'slice', purpose: 'Đi bộ, tập luyện, kết bạn, quan sát ngày đêm', hours: HOURS.L04 });

export const ZONE_BY_ID: Record<ZoneId, ZoneDef> = Object.fromEntries(ZONES.map((z) => [z.id, z])) as Record<ZoneId, ZoneDef>;

export function zoneAt(x: number, z: number): ZoneId | null {
  for (const zd of ZONES) {
    if (x >= zd.x0 && x <= zd.x1 && z >= zd.z0 && z <= zd.z1) return zd.id;
  }
  return null;
}

/** Local→world for rooms: u along x from x0, v depth from door wall inward. */
function L(zone: ZoneDef, u: number, v: number): { x: number; z: number } {
  if (zone.side === 'north') return { x: zone.x0 + u, z: zone.z0 + v };
  if (zone.side === 'south') return { x: zone.x0 + u, z: zone.z1 - v };
  return { x: zone.x0 + u, z: zone.z0 + v };
}
function Y(zone: ZoneDef, yawLocal: number): number {
  return zone.side === 'south' ? Math.PI - yawLocal : yawLocal;
}

export const PROPS: PropDef[] = [];
export const SLOTS: SlotDef[] = [];
export const WALLS: WallSeg[] = [];

const DIMS: Record<PropKind, [number, number, number, boolean]> = {
  bed: [0.95, 2.0, 0.55, true], locker: [0.6, 0.5, 1.8, true], desk: [1.2, 0.6, 0.75, true], chair: [0.5, 0.5, 0.9, false],
  table: [2.4, 1.0, 0.75, true], counter: [4, 0.8, 1.05, true], sink: [0.7, 0.5, 0.9, true], shower: [1.4, 1.4, 2.1, false],
  toilet: [1.2, 1.4, 2.0, false], water: [0.45, 0.45, 1.0, true], shelf: [3.6, 0.5, 2.0, true], board: [1.6, 0.08, 1.1, false],
  bar: [1.6, 0.3, 2.3, false], mat: [1.2, 2.0, 0.05, false], workbench: [2.2, 1.0, 0.9, true], laundry: [2.4, 0.8, 1.05, true],
  barber: [0.7, 0.7, 1.0, false], phone: [0.9, 0.4, 1.6, true], visit_table: [1.2, 0.8, 0.75, true], medbed: [1.0, 2.0, 0.7, true],
  plant: [0.5, 0.5, 1.1, false], tree: [0.5, 0.5, 5, true], bench: [1.8, 0.5, 0.45, true], track: [0.6, 0.6, 0.1, false],
  stove: [1.8, 0.8, 0.95, true], prep: [2.2, 1.0, 0.92, true], boxes: [1.2, 1.0, 1.2, true], whiteboard: [3, 0.08, 1.3, false],
  tray_return: [1.4, 0.6, 1.0, true], cabinet: [0.9, 0.5, 1.3, true], hoop: [0.3, 0.3, 3.2, true], staff_post: [0.6, 0.6, 0.01, false],
  mail_desk: [1.6, 0.7, 0.95, true], quiet_mat: [1.0, 1.8, 0.04, false], muster: [0.8, 0.8, 0.02, false], window: [1.8, 0.05, 1.0, false],
};

const LABEL: Record<PropKind, string> = {
  bed: 'Giường', locker: 'Tủ cá nhân', desk: 'Bàn', chair: 'Ghế', table: 'Bàn ăn', counter: 'Quầy', sink: 'Bồn rửa', shower: 'Buồng tắm',
  toilet: 'Buồng vệ sinh', water: 'Vòi nước uống', shelf: 'Kệ sách', board: 'Bảng thông báo', bar: 'Xà tập', mat: 'Thảm tập',
  workbench: 'Bàn làm việc', laundry: 'Quầy đổi đồ giặt', barber: 'Ghế cắt tóc', phone: 'Trạm liên lạc', visit_table: 'Bàn gặp',
  medbed: 'Giường nghỉ', plant: 'Cây cảnh', tree: 'Cây', bench: 'Ghế dài', track: 'Mốc đường đi bộ', stove: 'Bếp', prep: 'Bàn sơ chế',
  boxes: 'Thùng hàng', whiteboard: 'Bảng lớp', tray_return: 'Chỗ trả khay', cabinet: 'Tủ hồ sơ', hoop: 'Rổ bóng', staff_post: 'Vị trí nhân viên',
  mail_desk: 'Bàn thư từ', quiet_mat: 'Thảm yên tĩnh', muster: 'Điểm tập trung', window: 'Cửa sổ',
};

let autoId = 0;
function prop(zoneId: ZoneId, kind: PropKind, u: number, v: number, yawLocal = 0, opts: Partial<PropDef> & { id?: string } = {}): PropDef {
  const zone = ZONE_BY_ID[zoneId];
  const p = L(zone, u, v);
  const [w, d, h, col] = DIMS[kind];
  const def: PropDef = {
    id: opts.id ?? `${zoneId}_${kind}_${autoId++}`,
    kind, zone: zoneId, x: p.x, z: p.z, yaw: Y(zone, yawLocal),
    w: opts.w ?? w, d: opts.d ?? d, h: opts.h ?? h, collider: opts.collider ?? col,
    label: opts.label ?? LABEL[kind], meta: opts.meta,
  };
  PROPS.push(def);
  return def;
}
function absProp(zoneId: ZoneId, kind: PropKind, x: number, z: number, yaw = 0, opts: Partial<PropDef> & { id?: string } = {}): PropDef {
  const [w, d, h, col] = DIMS[kind];
  const def: PropDef = { id: opts.id ?? `${zoneId}_${kind}_${autoId++}`, kind, zone: zoneId, x, z, yaw, w: opts.w ?? w, d: opts.d ?? d, h: opts.h ?? h, collider: opts.collider ?? col, label: opts.label ?? LABEL[kind], meta: opts.meta };
  PROPS.push(def);
  return def;
}
function slot(zoneId: ZoneId, kind: SlotKind, u: number, v: number, yawLocal: number, pose: SlotDef['pose'], propId?: string, id?: string, owner?: string): SlotDef {
  const zone = ZONE_BY_ID[zoneId];
  const p = L(zone, u, v);
  const s: SlotDef = { id: id ?? `${zoneId}_${kind}_${SLOTS.length}`, zone: zoneId, kind, pos: { x: p.x, y: 0, z: p.z }, yaw: Y(zone, yawLocal), pose, propId, owner };
  SLOTS.push(s);
  return s;
}
function absSlot(zoneId: ZoneId, kind: SlotKind, x: number, z: number, yaw: number, pose: SlotDef['pose'], propId?: string, id?: string): SlotDef {
  const s: SlotDef = { id: id ?? `${zoneId}_${kind}_${SLOTS.length}`, zone: zoneId, kind, pos: { x, y: 0, z }, yaw, pose, propId };
  SLOTS.push(s);
  return s;
}
/** Wall segment in local coords. */
function wallL(zoneId: ZoneId, u0: number, v0: number, u1: number, v1: number, h?: number) {
  const zone = ZONE_BY_ID[zoneId];
  const a = L(zone, u0, v0);
  const b = L(zone, u1, v1);
  WALLS.push({ x0: a.x, z0: a.z, x1: b.x, z1: b.z, h: h ?? zone.height, zone: zoneId, color: zone.wall });
}
function wallWithGaps(zoneId: ZoneId, u0: number, v: number, u1: number, gaps: number[], gapW: number, h?: number) {
  let cur = u0;
  for (const g of gaps) {
    if (g - gapW / 2 > cur) wallL(zoneId, cur, v, g - gapW / 2, v, h);
    cur = g + gapW / 2;
  }
  if (cur < u1) wallL(zoneId, cur, v, u1, v, h);
}

// ---------- Outer walls ----------
function roomShell(zone: ZoneDef, first: boolean) {
  const W = zone.x1 - zone.x0;
  const D = zone.z1 - zone.z0;
  // door wall (v=0) with door gap
  const doorU = W / 2;
  wallL(zone.id, 0, 0, doorU - 0.9, 0);
  wallL(zone.id, doorU + 0.9, 0, W, 0);
  WALLS.push({ ...lineToWorld(zone, doorU - 0.9, 0, doorU + 0.9, 0), h: zone.height, zone: zone.id, color: zone.wall, doorId: `door_${zone.id}` });
  wallL(zone.id, 0, D, W, D); // back wall
  wallL(zone.id, W, 0, W, D); // east wall
  if (first) wallL(zone.id, 0, 0, 0, D);
}
function lineToWorld(zone: ZoneDef, u0: number, v0: number, u1: number, v1: number) {
  const a = L(zone, u0, v0);
  const b = L(zone, u1, v1);
  return { x0: a.x, z0: a.z, x1: b.x, z1: b.z };
}
ZONES.filter((z) => z.side === 'north').forEach((z, i) => roomShell(z, i === 0));
ZONES.filter((z) => z.side === 'south').forEach((z, i) => roomShell(z, i === 0));
// Corridor west end, yard
WALLS.push({ x0: -69, z0: -CORR, x1: -69, z1: CORR, h: 3.6, zone: 'L03', color: '#6d7774' });
WALLS.push({ x0: 69, z0: -CORR, x1: 69, z1: -0.9, h: 3.6, zone: 'L03', color: '#6d7774' });
WALLS.push({ x0: 69, z0: 0.9, x1: 69, z1: CORR, h: 3.6, zone: 'L03', color: '#6d7774' });
WALLS.push({ x0: 69, z0: -0.9, x1: 69, z1: 0.9, h: 3.6, zone: 'L04', color: '#7b7468', doorId: 'door_L04' });
WALLS.push({ x0: 69, z0: 12, x1: 109, z1: 12, h: 5, zone: 'L04', color: '#7b7468' });
WALLS.push({ x0: 109, z0: -16, x1: 109, z1: 12, h: 5, zone: 'L04', color: '#7b7468' });
WALLS.push({ x0: 69, z0: -16, x1: 109, z1: -16, h: 5, zone: 'L04', color: '#7b7468' });

// ---------- Zone furnishing ----------
// L01 Intake
prop('L01', 'counter', 8, 7.5, 0, { id: 'intake_desk', label: 'Bàn tiếp nhận', w: 6 });
slot('L01', 'staff', 8, 8.8, Math.PI, 'stand', 'intake_desk', 'L01_staff_0');
for (let i = 0; i < 4; i++) { prop('L01', 'chair', 1.5 + i * 0.8, 3.2, 0); slot('L01', 'sit', 1.5 + i * 0.8, 3.2, 0, 'sit'); }
for (let i = 0; i < 3; i++) { prop('L01', 'chair', 12 + i * 0.8, 3.2, 0); slot('L01', 'sit', 12 + i * 0.8, 3.2, 0, 'sit'); }
prop('L01', 'cabinet', 1.2, 11.5, Math.PI); prop('L01', 'cabinet', 2.3, 11.5, Math.PI);
prop('L01', 'board', 12, 11.9, Math.PI, { id: 'board_handbook', label: 'Bảng nội quy & quyền (hư cấu)' });
prop('L01', 'plant', 0.6, 0.8); prop('L01', 'plant', 15.4, 0.8); prop('L01', 'window', 5, 11.95, Math.PI); prop('L01', 'window', 15.95, 6, -Math.PI / 2);

// L18 Reintegration
prop('L18', 'desk', 4, 6, 0, { id: 'reintegration_desk', label: 'Bàn kế hoạch tái hòa nhập' });
slot('L18', 'staff', 4, 7.2, Math.PI, 'sit', 'reintegration_desk', 'L18_staff_0');
prop('L18', 'chair', 4, 4.8, 0); prop('L18', 'chair', 4, 7.2, Math.PI);
prop('L18', 'desk', 10, 6, 0, { id: 'property_return_desk', label: 'Quầy hoàn trả tài sản' });
slot('L18', 'staff', 10, 7.2, Math.PI, 'sit', 'property_return_desk', 'L18_staff_1');
prop('L18', 'chair', 10, 4.8, 0); prop('L18', 'chair', 10, 7.2, Math.PI);
for (let i = 0; i < 3; i++) { prop('L18', 'chair', 1 + i * 0.8, 2, 0); slot('L18', 'sit', 1 + i * 0.8, 2, 0, 'sit'); }
prop('L18', 'boxes', 12.5, 9, 0, { label: 'Khu đóng gói' }); prop('L18', 'board', 7, 9.9, Math.PI, { label: 'Bảng bước tiếp theo' });
prop('L18', 'window', 13.95, 4, -Math.PI / 2);

// L02 Cells — 8 phòng ở quanh khu sinh hoạt chung
export const CELL_ROOMS: { id: string; label: string; beds: string[]; locker: string; door: { x: number; z: number }; inward: 1 | -1 }[] = [];
{
  const z = ZONE_BY_ID.L02;
  const cw = 26 / 6;
  const doors: number[] = [];
  for (let c = 0; c < 6; c++) {
    const u0 = c * cw;
    const cu = u0 + cw / 2;
    doors.push(cu);
    if (c > 0) wallL('L02', u0, 8, u0, 14);
    const roomId = `cell_${c + 1}`;
    const b1 = prop('L02', 'bed', u0 + 0.6, 11.3, 0, { id: `${roomId}_bed_a`, label: `Giường ${c + 1}A` });
    const b2 = prop('L02', 'bed', u0 + cw - 0.6, 11.3, 0, { id: `${roomId}_bed_b`, label: `Giường ${c + 1}B` });
    const lk = prop('L02', 'locker', cu, 13.6, Math.PI, { id: `${roomId}_locker`, label: `Tủ cá nhân phòng ${c + 1}` });
    prop('L02', 'desk', cu, 12.8, Math.PI, { w: 0.9, d: 0.5, collider: false });
    slot('L02', 'sleep', u0 + 0.6, 11.3, 0, 'lie', b1.id, `${b1.id}`);
    slot('L02', 'sleep', u0 + cw - 0.6, 11.3, 0, 'lie', b2.id, `${b2.id}`);
    CELL_ROOMS.push({ id: roomId, label: `Phòng ${c + 1}`, beds: [b1.id, b2.id], locker: lk.id, door: L(z, cu, 8), inward: 1 });
  }
  wallWithGaps('L02', 0, 8, 26, doors, 1.2);
  // two south cells (7, 8)
  for (const [idx, u0] of [[7, 0], [8, 20]] as [number, number][]) {
    const roomId = `cell_${idx}`;
    wallWithGaps('L02', u0, 5, u0 + 6, [u0 + 3], 1.2);
    if (idx === 7) wallL('L02', 6, 0, 6, 5); else wallL('L02', 20, 0, 20, 5);
    const b1 = prop('L02', 'bed', u0 + 0.6, 2.5, 0, { id: `${roomId}_bed_a`, label: `Giường ${idx}A` });
    const b2 = prop('L02', 'bed', u0 + 5.4, 2.5, 0, { id: `${roomId}_bed_b`, label: `Giường ${idx}B` });
    const lk = prop('L02', 'locker', u0 + 3, 0.5, 0, { id: `${roomId}_locker`, label: `Tủ cá nhân phòng ${idx}` });
    slot('L02', 'sleep', u0 + 0.6, 2.5, 0, 'lie', b1.id, b1.id);
    slot('L02', 'sleep', u0 + 5.4, 2.5, 0, 'lie', b2.id, b2.id);
    CELL_ROOMS.push({ id: roomId, label: `Phòng ${idx}`, beds: [b1.id, b2.id], locker: lk.id, door: L(z, u0 + 3, 5), inward: -1 });
  }
  // common area
  for (const tu of [10.5, 15.5]) {
    const t = prop('L02', 'table', tu, 5.4, 0, { w: 2.0, d: 0.9, label: 'Bàn sinh hoạt chung' });
    for (let s = 0; s < 2; s++) {
      slot('L02', 'sit', tu - 0.5 + s, 4.65, 0, 'sit', t.id);
      slot('L02', 'sit', tu - 0.5 + s, 6.15, Math.PI, 'sit', t.id);
    }
  }
  prop('L02', 'board', 9.2, 0.1, 0, { id: 'board_schedule_L02', label: 'Bảng lịch sinh hoạt' });
  prop('L02', 'water', 7.2, 0.5, 0, { id: 'water_L02' });
  prop('L02', 'muster', 13, 2.2, 0, { id: 'muster_L02', label: 'Điểm tập trung điểm danh' });
  for (let i = 0; i < 6; i++) slot('L02', 'stand', 10.5 + i, 2.4, 0, 'stand');
}

// L05 Canteen
prop('L05', 'counter', 11, 14.2, Math.PI, { id: 'meal_counter', label: 'Quầy phát suất ăn', w: 12 });
for (let i = 0; i < 3; i++) slot('L05', 'staff', 7 + i * 4, 15.3, Math.PI, 'stand', 'meal_counter', `L05_staff_${i}`);
for (let i = 0; i < 5; i++) slot('L05', 'queue', 5 + i * 1.0, 12.6, 0, 'stand', undefined, `L05_queue_${i}`);
for (const tu of [6, 16]) for (const tv of [4, 7.5, 11]) {
  const t = prop('L05', 'table', tu, tv, Math.PI / 2 * 0, { w: 2.6, d: 1.8, label: 'Bàn ăn' });
  for (let s = 0; s < 3; s++) {
    slot('L05', 'eat', tu - 0.85 + s * 0.85, tv - 0.7, 0, 'sit', t.id);
    slot('L05', 'eat', tu - 0.85 + s * 0.85, tv + 0.7, Math.PI, 'sit', t.id);
  }
}
prop('L05', 'tray_return', 20.6, 2.5, -Math.PI / 2, { id: 'tray_return' });
prop('L05', 'water', 1, 2, Math.PI / 2, { id: 'water_L05' });
prop('L05', 'board', 11, 15.9, Math.PI, { id: 'board_menu', label: 'Thực đơn hôm nay' });
prop('L05', 'window', 21.95, 9, -Math.PI / 2); prop('L05', 'window', 0.05, 9, Math.PI / 2);

// L06 Kitchen
prop('L06', 'prep', 4, 5.5, 0, { id: 'kitchen_prep_a', label: 'Bàn sơ chế A' });
prop('L06', 'prep', 10, 5.5, 0, { id: 'kitchen_prep_b', label: 'Bàn sơ chế B' });
for (const pu of [4, 10]) { slot('L06', 'work', pu - 0.6, 4.6, 0, 'work'); slot('L06', 'work', pu + 0.6, 6.4, Math.PI, 'work'); }
prop('L06', 'sink', 1.5, 11.5, Math.PI, { id: 'kitchen_sink', w: 1.6 });
prop('L06', 'stove', 7, 11.4, Math.PI); prop('L06', 'shelf', 12, 11.5, Math.PI, { w: 3, label: 'Kệ nguyên liệu' });
prop('L06', 'boxes', 1.2, 7.5); slot('L06', 'staff', 7, 2.5, 0, 'stand', undefined, 'L06_staff_0');
prop('L06', 'board', 12.5, 0.1, 0, { id: 'board_kitchen', label: 'Bảng ca bếp' });

// L07 Library
prop('L07', 'counter', 3, 3.2, 0, { id: 'library_desk', label: 'Quầy thủ thư', w: 3.4 });
slot('L07', 'staff', 3, 4.3, Math.PI, 'stand', 'library_desk', 'L07_staff_0');
for (const sv of [5, 7.5, 10]) {
  const sh = prop('L07', 'shelf', 12.5, sv, 0, { id: `shelf_${sv}`, label: 'Kệ sách' });
  slot('L07', 'work', 12.5, sv - 0.75, 0, 'stand', sh.id);
}
for (const tv of [7, 10]) {
  const t = prop('L07', 'table', 4.5, tv, 0, { w: 2.2, d: 1.0, collider: true, label: 'Bàn đọc' });
  for (let s = 0; s < 2; s++) { slot('L07', 'read', 4 + s, tv - 0.8, 0, 'read', t.id); slot('L07', 'read', 4 + s, tv + 0.8, Math.PI, 'read', t.id); }
}
prop('L07', 'board', 8, 11.9, Math.PI, { id: 'board_study', label: 'Bảng học tập & nhóm đọc' });
prop('L07', 'window', 15.95, 3, -Math.PI / 2);

// L14 Classroom
prop('L14', 'whiteboard', 9, 11.9, Math.PI, { id: 'class_board', label: 'Bảng lớp' });
prop('L14', 'desk', 9, 10, Math.PI, { id: 'teacher_desk', label: 'Bàn giáo viên' });
slot('L14', 'staff', 9, 10.9, Math.PI, 'stand', 'teacher_desk', 'L14_staff_0');
for (const du of [3.5, 7, 11, 14.5]) for (const dv of [3.5, 5.6, 7.7]) {
  const d = prop('L14', 'desk', du, dv, 0, { w: 1.1, d: 0.55, label: 'Bàn học' });
  slot('L14', 'class', du, dv - 0.6, 0, 'sit', d.id);
}
prop('L14', 'board', 0.1, 6, Math.PI / 2, { id: 'board_achievements', label: 'Bảng ghi nhận cộng đồng' });
prop('L14', 'window', 17.95, 6, -Math.PI / 2);

// L17 Quiet room
for (let i = 0; i < 4; i++) { const m = prop('L17', 'quiet_mat', 2.5 + i * 2.3, 6.5, 0); slot('L17', 'quiet', 2.5 + i * 2.3, 6.5, 0, 'sit', m.id); }
prop('L17', 'chair', 2, 3, Math.PI / 4, { id: 'peer_chair_a', label: 'Góc trò chuyện' }); prop('L17', 'chair', 3.2, 3.6, -Math.PI * 0.75);
slot('L17', 'staff', 3.2, 3.6, -Math.PI * 0.75, 'sit', undefined, 'L17_staff_0');
prop('L17', 'shelf', 9.5, 9.5, Math.PI, { w: 2.5, h: 1.4, label: 'Kệ sách yên tĩnh' }); prop('L17', 'plant', 11.4, 0.7);
prop('L17', 'board', 6, 9.9, Math.PI, { id: 'board_quiet', label: 'Lịch sinh hoạt tự chọn' });

// L11 Admin / casework
prop('L11', 'desk', 4, 6, 0, { id: 'case_desk', label: 'Bàn tiếp nhận đơn yêu cầu' });
slot('L11', 'staff', 4, 7.2, Math.PI, 'sit', 'case_desk', 'L11_staff_0');
prop('L11', 'chair', 4, 4.8, 0); prop('L11', 'chair', 4, 7.2, Math.PI);
prop('L11', 'desk', 12, 6, 0, { id: 'advisor_desk', label: 'Bàn cố vấn hồ sơ' });
slot('L11', 'staff', 12, 7.2, Math.PI, 'sit', 'advisor_desk', 'L11_staff_1');
prop('L11', 'chair', 12, 4.8, 0); prop('L11', 'chair', 12, 7.2, Math.PI);
for (let i = 0; i < 3; i++) { prop('L11', 'chair', 1 + i * 0.8, 2, 0); slot('L11', 'sit', 1 + i * 0.8, 2, 0, 'sit'); }
prop('L11', 'cabinet', 15.4, 9.5, Math.PI); prop('L11', 'plant', 8, 9.4);
prop('L11', 'board', 8, 9.9, Math.PI, { id: 'board_cases', label: 'Quy trình yêu cầu & xem xét lại' });

// L16 Contact
for (let i = 0; i < 2; i++) { const ph = prop('L16', 'phone', 2 + i * 2.6, 9.6, Math.PI, { id: `phone_${i}`, label: `Trạm liên lạc ${i + 1}` }); prop('L16', 'chair', 2 + i * 2.6, 8.7, Math.PI); slot('L16', 'sit', 2 + i * 2.6, 8.8, Math.PI, 'sit', ph.id); }
prop('L16', 'mail_desk', 11, 6, 0, { id: 'mail_desk', label: 'Bàn thư từ' });
slot('L16', 'staff', 11, 7.2, Math.PI, 'stand', 'mail_desk', 'L16_staff_0');
for (let i = 0; i < 3; i++) { prop('L16', 'chair', 1 + i * 0.8, 2, 0); slot('L16', 'sit', 1 + i * 0.8, 2, 0, 'sit'); }
prop('L16', 'board', 7, 9.9, Math.PI, { id: 'board_contact', label: 'Hướng dẫn liên lạc (hư cấu)' });

// L15 Service counter
prop('L15', 'counter', 6, 6, 0, { id: 'service_counter', label: 'Quầy dịch vụ & cửa hàng nội bộ', w: 7 });
slot('L15', 'staff', 6, 7.2, Math.PI, 'stand', 'service_counter', 'L15_staff_0');
prop('L15', 'shelf', 6, 9.5, Math.PI, { w: 6, h: 1.8, label: 'Kệ nhận hàng' });
for (let i = 0; i < 4; i++) slot('L15', 'queue', 4.5 + i, 3.5, 0, 'stand');
prop('L15', 'board', 0.1, 5, Math.PI / 2, { id: 'board_catalog', label: 'Danh mục hàng (hư cấu)' });

// L13 Hygiene & laundry
for (let i = 0; i < 4; i++) { const s = prop('L13', 'sink', 0.45, 3 + i * 1.2, Math.PI / 2, { id: `sink_${i}`, label: `Bồn rửa ${i + 1}` }); slot('L13', 'wash', 1.1, 3 + i * 1.2, -Math.PI / 2, 'stand', s.id); }
for (let i = 0; i < 3; i++) {
  const s = prop('L13', 'shower', 5.5 + i * 1.8, 9.2, Math.PI, { id: `shower_${i}`, label: `Buồng tắm ${i + 1}` });
  slot('L13', 'wash', 5.5 + i * 1.8, 9.2, Math.PI, 'stand', s.id);
  wallL('L13', 4.6 + i * 1.8, 8.4, 4.6 + i * 1.8, 10, 2.1);
}
wallL('L13', 4.6 + 3 * 1.8, 8.4, 4.6 + 3 * 1.8, 10, 2.1);
for (let i = 0; i < 2; i++) { prop('L13', 'toilet', 12.6 + i * 1.6, 9.2, Math.PI, { id: `toilet_${i}`, label: `Buồng vệ sinh ${i + 1}` }); wallL('L13', 11.8 + i * 1.6, 8.4, 11.8 + i * 1.6, 10, 2.1); }
wallL('L13', 15.0, 8.4, 15.0, 10, 2.1);
prop('L13', 'laundry', 13, 4, 0, { id: 'laundry_counter' });
slot('L13', 'staff', 13, 5.2, Math.PI, 'stand', 'laundry_counter', 'L13_staff_0');
prop('L13', 'barber', 6, 4, 0, { id: 'barber_chair' }); prop('L13', 'water', 15.5, 1.2, -Math.PI / 2, { id: 'water_L13' });

// L08 Medical
prop('L08', 'desk', 3, 4, 0, { id: 'care_desk', label: 'Bàn tiếp nhận chăm sóc' });
slot('L08', 'staff', 3, 5.2, Math.PI, 'sit', 'care_desk', 'L08_staff_0');
for (let i = 0; i < 3; i++) { const b = prop('L08', 'medbed', 6 + i * 3, 8.2, 0, { id: `medbed_${i}`, label: `Giường nghỉ ${i + 1}` }); slot('L08', 'care', 6 + i * 3, 8.2, 0, 'lie', b.id); }
for (let i = 0; i < 3; i++) { prop('L08', 'chair', 0.8 + i * 0.8, 1.5, 0); slot('L08', 'sit', 0.8 + i * 0.8, 1.5, 0, 'sit'); }
prop('L08', 'cabinet', 13.3, 4, -Math.PI / 2); prop('L08', 'plant', 13.3, 0.8);

// L12 Visits
for (const vu of [4, 10, 16]) for (const vv of [5, 8.5]) {
  const t = prop('L12', 'visit_table', vu, vv, 0, { id: `visit_table_${vu}_${vv}`, label: 'Bàn thăm gặp' });
  prop('L12', 'chair', vu, vv - 0.75, 0); prop('L12', 'chair', vu, vv + 0.75, Math.PI);
  slot('L12', 'visit', vu, vv - 0.75, 0, 'sit', t.id);
  slot('L12', 'visit', vu, vv + 0.75, Math.PI, 'sit', t.id);
}
slot('L12', 'staff', 10, 11, Math.PI, 'stand', undefined, 'L12_staff_0');
for (let i = 0; i < 4; i++) { prop('L12', 'chair', 1 + i * 0.8, 1.5, 0); slot('L12', 'sit', 1 + i * 0.8, 1.5, 0, 'sit'); }
prop('L12', 'board', 19.9, 6, -Math.PI / 2, { id: 'board_visits', label: 'Lịch thăm gặp' });
prop('L12', 'window', 0.05, 7, Math.PI / 2);

// L09 Gym
for (let i = 0; i < 4; i++) { const m = prop('L09', 'mat', 3 + i * 4, 4.5, 0, { id: `gym_mat_${i}` }); slot('L09', 'exercise', 3 + i * 4, 4.5, 0, 'exercise', m.id); }
for (let i = 0; i < 2; i++) { const b = prop('L09', 'bar', 4 + i * 4, 10, Math.PI, { id: `gym_bar_${i}`, label: 'Xà tập' }); slot('L09', 'exercise', 4 + i * 4, 9.5, Math.PI, 'exercise', b.id); }
prop('L09', 'bench', 14, 9.5, Math.PI); prop('L09', 'bench', 17, 9.5, Math.PI);
slot('L09', 'sit', 14, 9.5, Math.PI, 'sit'); slot('L09', 'sit', 17, 9.5, Math.PI, 'sit');
prop('L09', 'water', 19.5, 2, -Math.PI / 2, { id: 'water_L09' });
slot('L09', 'staff', 10, 11, Math.PI, 'stand', undefined, 'L09_staff_0');

// L10 Workshop
for (const wu of [5, 13, 21]) for (const wv of [5, 9]) {
  const b = prop('L10', 'workbench', wu, wv, 0, { id: `workbench_${wu}_${wv}`, label: 'Bàn làm việc' });
  slot('L10', 'work', wu - 0.5, wv - 0.8, 0, 'work', b.id);
  slot('L10', 'work', wu + 0.5, wv + 0.8, Math.PI, 'work', b.id);
}
for (let i = 0; i < 5; i++) prop('L10', 'shelf', 4 + i * 4.2, 13.5, Math.PI, { label: 'Kệ kho nhẹ' });
prop('L10', 'boxes', 1.2, 11); prop('L10', 'boxes', 1.2, 12.3); prop('L10', 'boxes', 24.6, 3);
prop('L10', 'board', 0.1, 6, Math.PI / 2, { id: 'board_shift', label: 'Bảng phân ca' });
slot('L10', 'staff', 13, 2.5, 0, 'stand', undefined, 'L10_staff_0');

// L03 Corridor
for (const bx of [-60, -45, -20, 0, 22, 45, 60]) {
  absProp('L03', 'bench', bx, 1.7, Math.PI, { id: `corr_bench_${bx}` });
  absSlot('L03', 'sit', bx - 0.4, 1.65, Math.PI, 'sit'); absSlot('L03', 'sit', bx + 0.4, 1.65, Math.PI, 'sit');
}
absProp('L03', 'board', -30, -1.95, 0, { id: 'board_schedule_L03', label: 'Bảng lịch sinh hoạt (hành lang)' });
absProp('L03', 'board', 30, -1.95, 0, { id: 'board_news', label: 'Bảng tin cộng đồng' });
absProp('L03', 'water', 10, -1.6, 0, { id: 'water_L03' });
for (let x = -64; x <= 64; x += 16) absSlot('L03', 'stand', x, -1.2, 0, 'stand');

// L04 Yard
{
  const anchors: [number, number][] = [[75, -10], [103, -10], [103, 6], [75, 6]];
  anchors.forEach(([x, z], i) => { absProp('L04', 'track', x, z, 0, { id: `track_${i}`, label: `Mốc đi bộ ${i + 1}` }); absSlot('L04', 'walk', x, z, 0, 'stand', `track_${i}`, `track_slot_${i}`); });
  for (const [x, z] of [[80, 10.5], [88, 10.5], [96, 10.5], [80, -14.5], [92, -14.5]] as [number, number][]) {
    absProp('L04', 'bench', x, z, z > 0 ? Math.PI : 0); absSlot('L04', 'sit', x - 0.4, z, z > 0 ? Math.PI : 0, 'sit'); absSlot('L04', 'sit', x + 0.4, z, z > 0 ? Math.PI : 0, 'sit');
  }
  for (const [x, z] of [[72, 10], [72, -14], [107, 10], [107, -14], [89, -2]] as [number, number][]) absProp('L04', 'tree', x, z);
  for (let i = 0; i < 2; i++) { absProp('L04', 'bar', 98 + i * 3, -14.6, 0, { id: `yard_bar_${i}`, label: 'Xà tập ngoài trời' }); absSlot('L04', 'exercise', 98 + i * 3, -14, 0, 'exercise', `yard_bar_${i}`); }
  for (let i = 0; i < 3; i++) absSlot('L04', 'exercise', 82 + i * 2.5, -4, Math.PI / 2, 'exercise');
  absProp('L04', 'hoop', 108.5, -2, -Math.PI / 2, { label: 'Rổ bóng (cảnh quan)' });
  absProp('L04', 'water', 70, 8, Math.PI / 2, { id: 'water_L04' });
  absProp('L04', 'board', 69.1, -4, Math.PI / 2, { id: 'board_yard', label: 'Bảng giờ sân' });
  for (let i = 0; i < 6; i++) absSlot('L04', 'stand', 84 + (i % 3) * 3, 1 + Math.floor(i / 3) * 3, Math.PI * (i % 2), 'stand');
}

// ---------- Derived nav graph ----------
/** Point inside the room just past the door; and corridor point outside the door. */
export function doorNodes(zoneId: ZoneId): { inside: Vec3; outside: Vec3 } | null {
  const z = ZONE_BY_ID[zoneId];
  if (!z.door) return null;
  if (z.side === 'yard') return { inside: { x: 71, y: 0, z: 0 }, outside: { x: 67.5, y: 0, z: 0 } };
  const dir = z.side === 'north' ? 1 : -1;
  return { inside: { x: z.door.x, y: 0, z: z.door.z + dir * 1.5 }, outside: { x: z.door.x, y: 0, z: z.door.z - dir * 1.2 } };
}

export function zoneCenter(zoneId: ZoneId): Vec3 {
  const z = ZONE_BY_ID[zoneId];
  if (z.side === 'corridor') return { x: 0, y: 0, z: 0 };
  if (z.side === 'yard') return { x: 89, y: 0, z: -2 };
  const dir = z.side === 'north' ? 1 : -1;
  return { x: (z.x0 + z.x1) / 2, y: 0, z: z.door!.z + dir * Math.min(3.2, (z.z1 - z.z0) / 2) };
}

/** Logical route between zones (graph: rooms ↔ corridor ↔ yard). Used by NPC paths and map U13. */
export function zoneRoute(from: ZoneId, to: ZoneId): ZoneId[] {
  if (from === to) return [from];
  const r: ZoneId[] = [from];
  if (from !== 'L03') r.push('L03');
  if (to !== 'L03') r.push(to);
  return r;
}

export const SLOT_BY_ID: Record<string, SlotDef> = Object.fromEntries(SLOTS.map((s) => [s.id, s]));
export const PROP_BY_ID: Record<string, PropDef> = Object.fromEntries(PROPS.map((p) => [p.id, p]));
export const SPAWN: Vec3 = { x: -26, y: 0, z: 5 };
export const SAFE_ANCHORS: Partial<Record<ZoneId, Vec3>> = Object.fromEntries(ZONES.map((z) => [z.id, zoneCenter(z.id)]));
