// Procedural blockout world from content (03). Static meshes merged per zone with vertex colors (ít draw call);
// emissive lights/windows separate; boards/signs use DynamicTexture text (localization không bake vào asset).
import { Color3, Color4, DynamicTexture, Mesh, MeshBuilder, Scene, StandardMaterial, TransformNode, Vector3, VertexBuffer, type AbstractMesh } from '@babylonjs/core';
import { CELL_DOORS, PROPS, WALLS, WALL_BANNERS, ZONES, ZONE_BY_ID, type PropDef, type WallBanner } from '../content/world';
import type { ZoneId } from '../domain/types';
import { hash32 } from '../domain/util';
import { boxPiece, color4, cylPiece, mergePieces, meshPiece, sphPiece, torusPiece, yieldFrame, type Piece } from './geo';

export interface WorldHandles {
  zoneMeshes: Map<ZoneId, Mesh[]>;
  doors: Map<string, { mesh: Mesh; closedPos: Vector3; openPos: Vector3; t: number }>;
  windowMat: StandardMaterial;
  lightMat: StandardMaterial;
  yardFloor: Mesh | null;
  brokenMarkers: Map<string, Mesh>;
  boards: Mesh[];
  focusRing: Mesh;
  /** CR-VN-01: cửa buồng động — hình ảnh tách khỏi quyền (evaluator quyết định). */
  cellDoors: Map<string, { mesh: Mesh; closedPos: Vector3; openPos: Vector3; t: number }>;
}

const SAFETY_YELLOW = '#e3b21f';
/** v (độ sâu từ tường hành lang) của dãy song sắt buồng giam — để vẽ vạch vàng phía trước. */
const BARS_V: Partial<Record<ZoneId, number>> = { L02: 8, L19: 8, L20: 8, L21: 4, L22: 4 };
/** Màu sơn chân tường (wainscot) kiểu cơ sở cải huấn Mỹ: tường gạch block sơn sáng, nửa dưới sơn màu đậm. */
const WAINSCOT: Partial<Record<ZoneId, string>> = {
  L02: '#4f6f82', L19: '#4f6f82', L20: '#4f6f82', L21: '#6c6458', L22: '#7a4b45', L03: '#33506b', L01: '#4a5b6c',
  L05: '#7a5238', L06: '#5f7f80', L07: '#5d4c3a', L14: '#45627a', L17: '#5f7464', L11: '#4a5b6c', L16: '#4a5b6c',
  L15: '#4a5b6c', L13: '#5f8a88', L08: '#5f8a88', L12: '#6b5843', L09: '#3c4c5c', L10: '#5a5e62', L18: '#4a5b6c', L27: '#5a5e62', L28: '#4b5259',
};
/** Tên khu tiếng Anh trên biển chỉ dẫn (chỉ trình bày; tên trong UI giữ nguyên). */
const SIGN_EN: Partial<Record<ZoneId, string>> = {
  L01: 'INTAKE & PROCESSING', L02: 'HOUSING UNIT', L03: 'MAIN CORRIDOR', L04: 'RECREATION YARD', L05: 'DINING HALL', L06: 'KITCHEN',
  L07: 'LIBRARY', L08: 'MEDICAL', L09: 'GYMNASIUM', L10: 'INDUSTRIES SHOP', L11: 'CASE MANAGEMENT', L12: 'VISITATION',
  L13: 'SHOWERS & LAUNDRY', L14: 'EDUCATION · GED', L15: 'COMMISSARY', L16: 'MAIL & PHONES', L17: 'CHAPEL · QUIET ROOM', L18: 'REENTRY CENTER',
  L19: 'CELL BLOCK A', L20: 'CELL BLOCK B', L21: 'ADMIN SEGREGATION', L22: 'RESTRICTED HOUSING', L23: 'GARDEN', L24: 'AQUACULTURE', L25: 'NURSERY', L27: 'WAREHOUSE',
  L28: 'SECURITY HOUSING UNIT',
};
const SIGN_FONT = '"Bahnschrift", "Barlow Condensed", "Arial Narrow", "Noto Sans", "Segoe UI", sans-serif';

function hexToColor4(hex: string, mul = 1): Color4 {
  const c = Color3.FromHexString(hex);
  return new Color4(Math.min(1, c.r * mul), Math.min(1, c.g * mul), Math.min(1, c.b * mul), 1);
}

class Batch {
  meshes = new Map<string, Piece[]>();
  add(key: string, m: Mesh | Piece) {
    let arr = this.meshes.get(key);
    if (!arr) this.meshes.set(key, (arr = []));
    arr.push(m instanceof Mesh ? meshPiece(m) : m);
  }
}

export function colorize(m: Mesh, hex: string, mul = 1, jitterSeed?: number) {
  const n = m.getTotalVertices();
  const c = hexToColor4(hex, mul * (jitterSeed !== undefined ? 0.94 + ((jitterSeed % 13) / 13) * 0.12 : 1));
  const arr = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { arr[i * 4] = c.r; arr[i * 4 + 1] = c.g; arr[i * 4 + 2] = c.b; arr[i * 4 + 3] = 1; }
  m.setVerticesData(VertexBuffer.ColorKind, arr);
  return m;
}

/** Dựng thế giới theo từng đợt, nhường luồng chính giữa các đợt (loading không treo). */
export async function buildWorld(scene: Scene, onProgress: (f: number) => void = () => {}): Promise<WorldHandles> {
  const batch = new Batch();
  const baseMat = new StandardMaterial('mat_world_vc', scene);
  baseMat.diffuseColor = new Color3(1, 1, 1);
  baseMat.specularColor = new Color3(0.06, 0.06, 0.06);
  const lightMat = new StandardMaterial('mat_light_emissive', scene);
  lightMat.diffuseColor = new Color3(0, 0, 0);
  lightMat.emissiveColor = new Color3(0.95, 0.92, 0.82);
  lightMat.disableLighting = true;
  const windowMat = new StandardMaterial('mat_window', scene);
  windowMat.diffuseColor = new Color3(0, 0, 0);
  windowMat.emissiveColor = new Color3(0.7, 0.8, 0.9);
  windowMat.disableLighting = true;

  let uid = 0;
  const tint = (mul: number, seed?: number) => mul * (seed !== undefined ? 0.94 + ((seed % 13) / 13) * 0.12 : 1);
  const box = (zone: ZoneId, w: number, h: number, d: number, x: number, y: number, z: number, color: string, yaw = 0, mul = 1, seed?: number) => {
    const m = boxPiece(w, h, d, color4(color, tint(mul, seed)));
    m.position.set(x, y, z);
    m.rotation.y = yaw;
    batch.add(zone, m);
    return m;
  };
  const cyl = (zone: ZoneId, dia: number, h: number, x: number, y: number, z: number, color: string, tess = 10, diaTop?: number) => {
    const m = cylPiece(dia, h, tess, color4(color), diaTop);
    m.position.set(x, y, z);
    batch.add(zone, m);
    return m;
  };
  const sph = (zone: ZoneId, dia: number, x: number, y: number, z: number, color: string, sy = 1) => {
    const m = sphPiece(dia, color4(color));
    m.position.set(x, y, z);
    m.scaling.y = sy;
    batch.add(zone, m);
    return m;
  };
  const emissive: Piece[] = [];
  const windows: Mesh[] = [];

  // ---------- floors & ceilings ----------
  let yardFloor: Mesh | null = null;
  for (const z of ZONES) {
    const w = z.x1 - z.x0;
    const d = z.z1 - z.z0;
    const cx = (z.x0 + z.x1) / 2;
    const cz = (z.z0 + z.z1) / 2;
    if (z.outdoor && z.id !== 'L04') {
      box(z.id, w, 0.1, d, cx, -0.05, cz, z.floor, 0, 1, hash32(z.id));
      if (z.id === 'L23') {
        // lối công tác lát gạch giữa các luống + viền đường đi
        for (let i = 0; i < 5; i++) box(z.id, 0.9, 0.03, 15, 70.8 + i * 4.5, 0.02, 23, '#9a9284');
        box(z.id, w - 1, 0.03, 2.2, cx, 0.02, 14.2, '#9a9284');
      }
      if (z.id === 'L25') { box(z.id, 1.6, 0.03, d - 2, 100, 0.02, cz, '#a59c8a'); box(z.id, w - 1, 0.03, 1.6, cx, 0.02, 17.4, '#a59c8a'); }
      if (z.id === 'L24') { box(z.id, w - 1, 0.03, 2.4, cx, 0.02, -18.4, '#a59c8a'); box(z.id, 18, 0.06, 14, 80, 0.03, -28, '#8d8a6e'); }
      continue;
    }
    if (z.outdoor) {
      const f = MeshBuilder.CreateGround('yard_floor', { width: w, height: d, subdivisions: 1 }, scene);
      f.position.set(cx, 0, cz);
      colorize(f, z.floor);
      yardFloor = f;
      // track ring paint & grass strips
      box('L04', w - 8, 0.02, 0.5, cx, 0.01, -10, '#d8c27a'); box('L04', w - 8, 0.02, 0.5, cx, 0.01, 6, '#d8c27a');
      box('L04', 0.5, 0.02, 16, 75, 0.01, -2, '#d8c27a'); box('L04', 0.5, 0.02, 16, 103, 0.01, -2, '#d8c27a');
      box('L04', w, 0.05, 2.2, cx, 0.02, 11, '#5f7a4a'); box('L04', w, 0.05, 1.8, cx, 0.02, -15.1, '#5f7a4a');
      // nửa sân bóng rổ sơn xanh (rổ ở x=108.5): biên, vùng cấm, vòng ném phạt
      const LINE = '#eceae2';
      box('L04', 5.6, 0.02, 12, 106.2, 0.012, -2, '#3d5f80');
      box('L04', 4.2, 0.022, 3.6, 106.7, 0.013, -2, '#8c3b32');
      for (const [w2, d2, x2, z2] of [[5.6, 0.08, 106.2, 4], [5.6, 0.08, 106.2, -8], [0.08, 12, 103.4, -2], [0.08, 3.6, 104.6, -2], [4.2, 0.08, 106.7, -0.2], [4.2, 0.08, 106.7, -3.8]] as [number, number, number, number][]) box('L04', w2, 0.024, d2, x2, 0.014, z2, LINE);
      { const ft = torusPiece(3.2, 0.06, 32, color4(LINE)); ft.position.set(104.6, 0.014, -2); ft.scaling.y = 0.15; batch.add('L04', ft); }
      // khu tạ ngoài trời: thảm cao su + băng ghế tạ
      box('L04', 6, 0.03, 3, 99.5, 0.015, -13.6, '#26282b');
      for (const bx of [97.5, 101.5]) { box('L04', 0.35, 0.45, 1.3, bx, 0.25, -13.2, '#202226'); box('L04', 0.05, 1.1, 0.05, bx - 0.5, 0.55, -13.9, '#8b949b'); box('L04', 0.05, 1.1, 0.05, bx + 0.5, 0.55, -13.9, '#8b949b'); { const bar = cylPiece(0.035, 1.7, 6, color4('#c3c9ce')); bar.position.set(bx, 1.1, -13.9); bar.rotation.z = Math.PI / 2; batch.add('L04', bar); } for (const sd of [-0.7, 0.7]) { const pl = cylPiece(0.42, 0.06, 14, color4('#141518')); pl.position.set(bx + sd, 1.1, -13.9); pl.rotation.z = Math.PI / 2; batch.add('L04', pl); } }
      // cột đèn pha cao 4 góc sân
      for (const [lx, lz] of [[70.6, -14.6], [107.4, -14.6], [70.6, 10.6], [107.4, 10.6]] as [number, number][]) {
        cyl('L04', 0.22, 9, lx, 4.5, lz, '#5a6168', 8, 0.14);
        box('L04', 1.6, 0.12, 0.16, lx, 9.0, lz, '#3a3f45');
        for (const o of [-0.5, 0, 0.5]) { box('L04', 0.36, 0.3, 0.3, lx + o, 8.8, lz, '#2b2f34'); const lm = boxPiece(0.3, 0.04, 0.24, color4('#ffffff')); lm.position.set(lx + o, 8.64, lz); emissive.push(lm); }
      }
      // chòi canh bên ngoài tường sân (nhìn thấy qua đỉnh tường)
      for (const [tx, tz] of [[113.5, -20], [64.5, 36]] as [number, number][]) {
        cyl('L04', 2.2, 10, tx, 5, tz, '#9a958a', 12, 1.8);
        box('L04', 3.6, 0.25, 3.6, tx, 10.1, tz, '#4a4f56');
        box('L04', 3.2, 1.6, 3.2, tx, 11.0, tz, '#3b4048');
        const glass = boxPiece(3.25, 1.0, 3.25, color4('#ffffff')); glass.position.set(tx, 11.1, tz); emissive.push(glass);
        box('L04', 4.2, 0.22, 4.2, tx, 11.95, tz, '#2a2e34');
        for (const [ox, oz] of [[-1.7, 0], [1.7, 0], [0, -1.7], [0, 1.7]] as [number, number][]) box('L04', ox ? 0.06 : 3.4, 0.9, oz ? 0.06 : 3.4, tx + ox, 10.6, tz + oz, '#5a6168');
      }
      // dãy nhà xa & hàng rào ngoài (cảnh quan, không phải bản vẽ thật)
      box('L04', 70, 6, 1, 89, 8, 40, '#7d7a72', 0, 0.9); box('L04', 1, 6, 50, 118, 8, -2, '#7d7a72', 0, 0.85);
      for (let i = 0; i < 16; i++) box('L04', 0.12, 4.2, 0.12, 70 + i * 4.4, 2.1, 37, '#6b737a');
      box('L04', 66, 0.08, 0.08, 103, 4.1, 37, '#8a9298'); box('L04', 66, 0.08, 0.08, 103, 2.0, 37, '#8a9298');
      razorWire('L04', 70, 37, 136, 37, 4.2);
      continue;
    }
    const floorColor = z.id === 'L13' ? '#9ea7a9' : z.id === 'L08' ? '#c3c9c6' : z.id === 'L07' ? '#6d6253' : z.id === 'L09' ? '#38434f' : z.id === 'L05' ? '#8e8b83' : z.floor;
    box(z.id, w, 0.1, d, cx, -0.05, cz, floorColor, 0, 1, hash32(z.id));
    // ceiling (faces down)
    const c = MeshBuilder.CreateGround(`ceil_${z.id}`, { width: w, height: d }, scene);
    c.rotation.x = Math.PI;
    c.position.set(cx, z.height, cz);
    colorize(c, '#c9c6bd', 0.85);
    batch.add(z.id, c);
    // light panels
    const nx = Math.max(1, Math.round(w / 6));
    const nz = Math.max(1, Math.round(d / 6));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const lm = boxPiece(1.2, 0.04, 0.5, color4('#ffffff'));
      lm.position.set(z.x0 + (i + 0.5) * (w / nx), z.height - 0.03, z.z0 + (j + 0.5) * (d / nz));
      emissive.push(lm);
    }
    // hành lang: vạch vàng an toàn hai bên ("Stay behind the yellow line") + vạch dẫn hướng xanh ở giữa
    if (z.id === 'L03') {
      for (const sz of [-1.55, 1.55]) box('L03', w, 0.012, 0.1, cx, 0.007, sz, SAFETY_YELLOW);
      box('L03', w, 0.01, 0.06, cx, 0.006, 0, '#3e6c9a', 0, 0.9);
    }
    // vạch vàng trước dãy song sắt buồng giam
    const barsV = BARS_V[z.id];
    if (barsV !== undefined) box(z.id, w - 0.4, 0.012, 0.1, cx, 0.007, z.side === 'north' ? z.z0 + barsV - 0.9 : z.z1 - barsV + 0.9, SAFETY_YELLOW);
  }

  // ---------- iron bar grille (song sắt) ----------
  // song sắt sơn tĩnh điện xám xanh như dãy buồng giam Mỹ
  const STEEL = '#8b9ba6';
  const STEEL_DARK = '#56656f';
  /** Vertical bars + horizontal flat straps + frame along a segment (local x = along, centred at origin). */
  const grille = (len: number, h: number, add: (w: number, hh: number, d: number, lx: number, y: number, color: string, mul?: number) => void) => {
    const n = Math.max(2, Math.round(len / 0.13));
    for (let i = 0; i <= n; i++) add(0.032, h, 0.032, -len / 2 + (i * len) / n, h / 2, STEEL);
    for (const y of [0.06, h * 0.33, h * 0.62, h - 0.05]) add(len, 0.05, 0.07, 0, y, STEEL_DARK);
    add(0.07, h, 0.09, -len / 2, h / 2, STEEL_DARK);
    add(0.07, h, 0.09, len / 2, h / 2, STEEL_DARK);
  };

  onProgress(0.08);
  await yieldFrame();
  // ---------- walls (two-tone, or bars for cell fronts) ----------
  for (const w of WALLS) {
    if (w.doorId) continue;
    if (w.style === 'bars') {
      const len = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
      if (len < 0.01) continue;
      const cx = (w.x0 + w.x1) / 2, cz = (w.z0 + w.z1) / 2;
      const yaw = Math.atan2(w.x1 - w.x0, w.z1 - w.z0) + Math.PI / 2;
      const c = Math.cos(yaw), sn = Math.sin(yaw);
      const barH = Math.min(2.5, w.h);
      grille(len, barH, (bw, bh, bd, lx, y, color, mul) => box(w.zone, bw, bh, bd, cx + lx * c, y, cz - lx * sn, color, yaw, mul ?? 1));
      // painted header beam above the bars (như ảnh: dầm sáng phía trên song)
      if (w.h > barH) box(w.zone, len + 0.2, w.h - barH, 0.24, cx, barH + (w.h - barH) / 2, cz, '#a7aeb1', yaw);
      continue;
    }
    const len = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
    if (len < 0.01) continue;
    const cx = (w.x0 + w.x1) / 2;
    const cz = (w.z0 + w.z1) / 2;
    const yaw = Math.atan2(w.x1 - w.x0, w.z1 - w.z0) + Math.PI / 2;
    const outdoor = !!ZONE_BY_ID[w.zone].outdoor;
    if (outdoor) {
      // tường bê tông đúc ngoài trời: chân đậm, đỉnh có gờ + hàng cuộn dây thép gai
      box(w.zone, len + 0.2, 0.5, 0.28, cx, 0.25, cz, w.color, yaw, 0.78);
      box(w.zone, len + 0.2, w.h - 0.5, 0.2, cx, 0.5 + (w.h - 0.5) / 2, cz, w.color, yaw, 1.0);
      box(w.zone, len + 0.3, 0.12, 0.34, cx, w.h + 0.06, cz, w.color, yaw, 0.86);
      razorWire(w.zone, w.x0, w.z0, w.x1, w.z1, w.h + 0.12);
      continue;
    }
    // gạch block sơn: nửa dưới màu đậm (wainscot) + nẹp phân cách + nửa trên màu sáng + chân tường
    const lower = Math.min(1.2, w.h);
    // tường cửa giáp hành lang (z = ±2) dùng màu hành lang để dãy hành lang đồng nhất
    const onCorridor = Math.abs(Math.abs(w.z0) - 2) < 0.01 && Math.abs(Math.abs(w.z1) - 2) < 0.01;
    const wain = onCorridor ? WAINSCOT.L03 : WAINSCOT[w.zone];
    const upper = onCorridor ? ZONE_BY_ID.L03.wall : w.color;
    box(w.zone, len + 0.2, lower, 0.2, cx, lower / 2, cz, wain ?? w.color, yaw, wain ? 1 : 0.72);
    box(w.zone, len + 0.21, 0.06, 0.21, cx, lower, cz, '#2b3440', yaw);
    box(w.zone, len + 0.21, 0.1, 0.21, cx, 0.05, cz, '#2b3440', yaw);
    if (w.h > lower) box(w.zone, len + 0.2, w.h - lower, 0.2, cx, lower + (w.h - lower) / 2, cz, upper, yaw, 1.04);
  }

  /** Cuộn dây thép gai (concertina) dọc đỉnh tường ngoài trời — vòng xuyến nghiêng theo hướng tường. */
  function razorWire(zone: ZoneId, x0: number, z0: number, x1: number, z1: number, y: number) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / 0.42));
    const yaw = Math.atan2(x1 - x0, z1 - z0);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const m = torusPiece(0.62, 0.018, 8, color4(i % 2 ? '#c2c9ce' : '#a9b1b7'));
      m.position.set(x0 + (x1 - x0) * t, y + 0.3, z0 + (z1 - z0) * t);
      m.rotation.set(Math.PI / 2, yaw, 0.35 * (i % 2 ? 1 : -1));
      batch.add(zone, m);
    }
  }

  // ---------- doors: cửa trượt song sắt ----------
  const doors = new Map<string, { mesh: Mesh; closedPos: Vector3; openPos: Vector3; t: number }>();
  const doorMat = new StandardMaterial('mat_door_iron', scene);
  doorMat.diffuseColor = new Color3(1, 1, 1);
  doorMat.specularColor = new Color3(0.35, 0.35, 0.35);
  doorMat.specularPower = 24;
  /** Builds one merged barred door leaf centred at origin (local x along opening). */
  const barDoor = (name: string, len: number, h: number, alongX: boolean, withLock: boolean): Mesh => {
    const parts: Piece[] = [];
    const add = (bw: number, bh: number, bd: number, lx: number, y: number, color: string) => {
      const m = boxPiece(alongX ? bw : bd, bh, alongX ? bd : bw, color4(color));
      m.position.set(alongX ? lx : 0, y - h / 2, alongX ? 0 : lx);
      parts.push(m);
    };
    grille(len, h, add);
    // diagonal-free cross plate + lock box like real cell doors
    if (withLock) { add(0.16, 0.28, 0.12, len / 2 - 0.14, h * 0.48, '#4a5156'); add(0.05, 0.05, 0.16, len / 2 - 0.14, h * 0.44, '#c9b25a'); }
    const merged = mergePieces(scene, name, parts)[0];
    merged.material = doorMat;
    merged.isPickable = false;
    return merged;
  };
  /** Cửa thép đặc của buồng biệt giam SHU: ô kính hẹp dọc, khe đưa cơm/còng tay (cuff port), hộp khóa. */
  const solidDoor = (name: string, len: number, h: number, alongX: boolean): Mesh => {
    const parts: Piece[] = [];
    const add = (bw: number, bh: number, bd: number, lx: number, y: number, color: string, lz = 0) => {
      const m = boxPiece(alongX ? bw : bd, bh, alongX ? bd : bw, color4(color));
      m.position.set(alongX ? lx : lz, y - h / 2, alongX ? lz : lx);
      parts.push(m);
    };
    add(len, h, 0.06, 0, h / 2, '#7b858c');
    add(len - 0.08, h - 0.08, 0.07, 0, h / 2, '#8a949b');
    add(0.13, 0.62, 0.075, -len * 0.18, 1.62, '#1f2a33');
    for (const sd of [-1, 1]) add(0.42, 0.13, 0.05, 0, 1.04, '#4a5258', sd * 0.055);
    for (const sd of [-1, 1]) add(0.3, 0.025, 0.06, 0, 1.12, '#2b3136', sd * 0.06);
    add(0.12, 0.26, 0.1, len / 2 - 0.12, 1.2, '#3f464c');
    add(0.04, 0.05, 0.13, len / 2 - 0.12, 1.15, '#c9b25a');
    add(len, 0.04, 0.08, 0, 0.03, '#4a5258');
    const merged = mergePieces(scene, name, parts)[0];
    merged.material = doorMat;
    merged.isPickable = false;
    return merged;
  };
  for (const w of WALLS) {
    if (!w.doorId) continue;
    const len = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
    const cx = (w.x0 + w.x1) / 2;
    const cz = (w.z0 + w.z1) / 2;
    const alongX = Math.abs(w.x1 - w.x0) > Math.abs(w.z1 - w.z0);
    const m = barDoor(w.doorId, len, 2.2, alongX, true);
    const closedPos = new Vector3(cx, 1.1, cz);
    const openPos = alongX ? new Vector3(cx + len * 0.95, 1.1, cz + 0.15 * Math.sign(cz || 1)) : new Vector3(cx + 0.15, 1.1, cz + len * 0.95);
    m.position.copyFrom(openPos);
    doors.set(w.doorId, { mesh: m, closedPos, openPos, t: 0 });
    // header above door + door frame
    const zone = w.zone;
    box(zone, alongX ? len + 0.2 : 0.22, 0.25 + (ZONE_BY_ID[zone].height - 2.45), alongX ? 0.22 : len + 0.2, cx, 2.3 + (ZONE_BY_ID[zone].height - 2.45) / 2 + 0.05, cz, '#3f4a4c');
    // fixed steel jambs + sliding track on the door frame
    for (const sd of [-1, 1]) box(zone, alongX ? 0.1 : 0.14, 2.3, alongX ? 0.14 : 0.1, cx + (alongX ? sd * len / 2 : 0), 1.15, cz + (alongX ? 0 : sd * len / 2), STEEL_DARK);
    box(zone, alongX ? len * 2.1 : 0.08, 0.08, alongX ? 0.08 : len * 2.1, cx + (alongX ? len * 0.5 : 0), 2.26, cz + (alongX ? 0 : len * 0.5), STEEL_DARK);
  }

  // ---------- cell doors: barred sliding doors (slid open) + room number plate ----------
  const cellDoors: WorldHandles['cellDoors'] = new Map();
  for (const d of CELL_DOORS) {
    const leaf = d.style === 'solid' ? solidDoor(`celldoor_${d.roomId}`, d.width, 2.3, d.alongX) : barDoor(`celldoor_${d.roomId}`, d.width, 2.4, d.alongX, true);
    // slid open behind the adjacent bar wall, offset toward the cell interior
    leaf.position.set(d.x + d.slideDir * d.width * 0.95, 1.2, d.z + d.inward * 0.12);
    if (d.dynamic) cellDoors.set(d.roomId, { mesh: leaf, openPos: leaf.position.clone(), closedPos: new Vector3(d.x, 1.2, d.z + d.inward * 0.12), t: 0 });
    else leaf.freezeWorldMatrix();
    for (const sd of [-1, 1]) box('L02', 0.1, 2.5, 0.12, d.x + sd * d.width / 2, 1.25, d.z, STEEL_DARK);
    // biển số buồng: tấm nhựa khắc đen chữ trắng, vạch vàng phía trên
    const tex = new DynamicTexture(`tx_no_${d.roomId}`, { width: 128, height: 64 }, scene, true);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    ctx.fillStyle = '#161b22'; ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = SAFETY_YELLOW; ctx.fillRect(0, 0, 128, 7);
    ctx.strokeStyle = '#8b96a0'; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, 125, 61);
    ctx.fillStyle = '#f4f4f0'; ctx.font = `700 36px ${SIGN_FONT}`; ctx.textAlign = 'center';
    ctx.fillText(d.number, 64, 48);
    tex.update();
    const mat = new StandardMaterial(`m_no_${d.roomId}`, scene);
    mat.diffuseTexture = tex; mat.emissiveColor = new Color3(0.25, 0.25, 0.25); mat.specularColor = new Color3(0, 0, 0);
    for (const face of [-1, 1]) {
      const pl = MeshBuilder.CreatePlane(`no_${d.roomId}_${face}`, { width: 0.42, height: 0.21 }, scene);
      pl.material = mat;
      pl.position.set(d.x, 2.85, d.z - d.inward * face * 0.13);
      pl.rotation.y = face * d.inward > 0 ? 0 : Math.PI;
      pl.isPickable = false;
      pl.freezeWorldMatrix();
    }
  }

  // ---------- biển treo tường kiểu cơ sở cải huấn Mỹ ----------
  // long: biển kim loại xanh navy chữ trắng, viền bạc + vạch vàng; short: bảng nội quy giấy trắng có dải "NOTICE" đỏ.
  const bannerMats = new Map<string, StandardMaterial>();
  const bannerMat = (b: WallBanner) => {
    const key = `${b.size}|${b.w}|${b.h}|${b.text}`;
    const hit = bannerMats.get(key);
    if (hit) return hit;
    const W = b.size === 'short' ? 512 : 1024;
    const H = Math.max(64, Math.round((W * b.h) / b.w));
    const tex = new DynamicTexture(`tx_banner_${bannerMats.size}`, { width: W, height: H }, scene, true);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    const notice = b.size === 'short';
    let top = 0;
    if (notice) {
      ctx.fillStyle = '#f2f0ea'; ctx.fillRect(0, 0, W, H);
      top = Math.round(H * 0.3);
      ctx.fillStyle = '#b8231c'; ctx.fillRect(0, 0, W, top);
      ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `800 ${Math.round(top * 0.72)}px ${SIGN_FONT}`; ctx.fillText('NOTICE', W / 2, top / 2 + 1);
      ctx.strokeStyle = '#1d2128'; ctx.lineWidth = Math.max(3, H * 0.035); ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);
      ctx.fillStyle = '#16191e';
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#20396a'); g.addColorStop(1, '#142a50');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const lw = Math.max(3, H * 0.045);
      ctx.strokeStyle = '#dfe5ec'; ctx.lineWidth = lw; ctx.strokeRect(lw * 1.5, lw * 1.5, W - lw * 3, H - lw * 3);
      ctx.fillStyle = SAFETY_YELLOW; ctx.fillRect(lw * 3, H - lw * 3.6, W - lw * 6, lw * 0.7);
      // bu lông 4 góc
      ctx.fillStyle = '#b9c2cc';
      for (const [bx, by] of [[lw * 0.8, lw * 0.8], [W - lw * 0.8, lw * 0.8], [lw * 0.8, H - lw * 0.8], [W - lw * 0.8, H - lw * 0.8]]) { ctx.beginPath(); ctx.arc(bx, by, lw * 0.45, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#ffffff';
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const pad = W * 0.06;
    const text = b.text.toUpperCase();
    const avail = H - top;
    // một dòng nếu vừa, nếu không chia hai dòng ở khoảng trắng gần giữa
    let size = avail * 0.5;
    // đo một lần ở cỡ chuẩn rồi tính tỉ lệ (trước đây giảm 1px mỗi lần + đo lại → ~2 giây khi tải)
    const fit = (lines: string[]) => { ctx.font = `700 100px ${SIGN_FONT}`; const wmax = Math.max(...lines.map((l) => ctx.measureText(l).width)); return Math.max(10, Math.min(size, (100 * (W - pad * 2)) / wmax, (avail * 0.72) / (lines.length * 1.12))); };
    let lines = [text];
    let fs = fit(lines);
    if (fs < avail * 0.3) {
      const mid = text.length / 2;
      let cut = text.indexOf(' ', Math.floor(mid));
      const back = text.lastIndexOf(' ', Math.floor(mid));
      if (back > 0 && (cut < 0 || mid - back < cut - mid)) cut = back;
      if (cut > 0) { const two = [text.slice(0, cut), text.slice(cut + 1)]; const fs2 = fit(two); if (fs2 > fs) { lines = two; fs = fs2; } }
    }
    size = fs;
    ctx.font = `700 ${size}px ${SIGN_FONT}`;
    const midY = notice ? top + avail / 2 : H / 2 - H * 0.03;
    lines.forEach((l, i) => ctx.fillText(l, W / 2, midY + (i - (lines.length - 1) / 2) * size * 1.12));
    tex.update();
    const mat = new StandardMaterial(`m_banner_${bannerMats.size}`, scene);
    mat.diffuseTexture = tex; mat.emissiveColor = new Color3(0.4, 0.4, 0.4); mat.specularColor = notice ? new Color3(0, 0, 0) : new Color3(0.18, 0.18, 0.2);
    bannerMats.set(key, mat);
    return mat;
  };
  for (const b of WALL_BANNERS) {
    const plane = MeshBuilder.CreatePlane(`banner_${b.id}`, { width: b.w, height: b.h, sideOrientation: Mesh.FRONTSIDE }, scene);
    plane.material = bannerMat(b);
    plane.position.set(b.x, b.y, b.z);
    plane.rotation.y = b.yaw + Math.PI;
    plane.isPickable = false;
    plane.freezeWorldMatrix();
  }

  // ---------- props ----------
  const brokenMarkers = new Map<string, Mesh>();
  const boards: Mesh[] = [];
  onProgress(0.25);
  await yieldFrame();
  for (let i = 0; i < PROPS.length; i++) {
    buildProp(PROPS[i]);
    if (i % 120 === 119) { onProgress(0.25 + 0.35 * (i / PROPS.length)); await yieldFrame(); }
  }


  /** Bồn cầu sứ chi tiết: chân bệ, lòng bồn + nước, bệ ngồi, nắp bật, két nước, nút xả, ống cấp, giá giấy.
   *  Biến thể buồng giam (meta.cell): thêm vách che thấp phía song sắt. Biến thể khu vệ sinh: sàn gạch + cửa buồng mở. */
  function buildToilet(p: PropDef) {
    const cell = !!p.meta?.cell;
    // buồng giam: bồn cầu thép không gỉ (kiểu combo inox của nhà tù Mỹ); khu vệ sinh chung: sứ trắng
    const PORC = cell ? '#b4bcc2' : '#f2f2ee', CHROME = cell ? '#dde2e6' : '#c3c9cc';
    const yawM = <T extends { rotation: Vector3 }>(m: T) => { m.rotation.y = p.yaw; return m; };
    // chân bệ (thon dần lên trên)
    { const [x, z] = local(p, 0, -0.16); const m = cyl(p.zone, 0.26, 0.3, x, 0.15, z, PORC, 14, 0.34); m.scaling.z = 1.35; yawM(m); }
    // lòng bồn (oval)
    { const [x, z] = local(p, 0, -0.12); const m = cyl(p.zone, 0.42, 0.13, x, 0.355, z, PORC, 20, 0.44); m.scaling.z = 1.3; yawM(m); }
    // nước trong lòng bồn
    { const [x, z] = local(p, 0, -0.1); const m = cyl(p.zone, 0.27, 0.01, x, 0.4, z, cell ? '#8fb3bd' : '#9cc4cf', 16); m.scaling.z = 1.3; yawM(m); }
    // bệ ngồi (vòng oval)
    { const [x, z] = local(p, 0, -0.12); const t = MeshBuilder.CreateTorus(`tseat${uid++}`, { diameter: 0.36, thickness: 0.055, tessellation: 24 }, scene); t.position.set(x, 0.44, z); t.scaling.z = 1.3; t.scaling.y = 0.6; yawM(t); colorize(t, cell ? '#c6cdd2' : '#fafaf7'); batch.add(p.zone, t); }
    // nắp bật dựng tựa vào két
    pbox(p, 0.38, 0.46, 0.03, 0, 0.68, -0.39, cell ? '#a9b1b7' : '#f7f7f3');
    // két nước + nắp két + nút xả
    pbox(p, 0.44, 0.36, 0.17, 0, 0.66, -0.5, PORC);
    pbox(p, 0.47, 0.035, 0.2, 0, 0.86, -0.5, cell ? '#c6cdd2' : '#fbfbf8');
    { const [x, z] = local(p, 0.08, -0.5); cyl(p.zone, 0.055, 0.02, x, 0.885, z, CHROME, 12); }
    // ống cấp nước + van chặn
    pbox(p, 0.025, 0.42, 0.025, -0.18, 0.21, -0.58, CHROME);
    { const [x, z] = local(p, -0.18, -0.55); cyl(p.zone, 0.05, 0.04, x, 0.16, z, CHROME, 8); }
    // giá + cuộn giấy vệ sinh (ngang)
    const side = cell ? (Number(p.meta?.panel) || 1) : -1; // giấy gắn lên vách che / vách buồng
    const gx = side * (cell ? 0.42 : p.w / 2 - 0.06);
    pbox(p, 0.04, 0.03, 0.16, gx, 0.72, 0.05, CHROME);
    { const [x, z] = local(p, gx - side * 0.07, 0.05); const r = cyl(p.zone, 0.11, 0.1, x, 0.66, z, '#f4f1e8', 12); r.rotation.z = Math.PI / 2; r.rotation.y = p.yaw; }
    if (cell) {
      // vách che thấp phía song sắt (riêng tư tối thiểu trong buồng)
      const px = (Number(p.meta?.panel) || 1) * 0.48;
      pbox(p, 0.05, 1.15, 0.95, px, 0.575, -0.05, '#9aa39f');
      pbox(p, 0.07, 0.04, 0.97, px, 1.17, -0.05, '#7d8682');
    } else {
      // sàn gạch men trong buồng + chân tường ốp gạch
      pbox(p, p.w - 0.08, 0.015, p.d - 0.08, 0, 0.008, 0, '#d5dcda');
      pbox(p, p.w - 0.08, 1.2, 0.02, 0, 0.6, -p.d / 2 + 0.05, '#dfe6e4');
      // cửa buồng mở ra ngoài (bản lề trái) + then cài
      const dw = p.w - 0.25, hx = -(p.w / 2 - 0.1);
      pbox(p, 0.04, 1.75, dw, hx, 1.0, p.d / 2 + dw / 2, '#7f9a94');
      pbox(p, 0.06, 0.05, 0.08, hx, 1.0, p.d / 2 + dw - 0.12, CHROME);
      // vạch chân cửa
      pbox(p, p.w - 0.1, 0.03, 0.06, 0, 0.015, p.d / 2, '#6f7a77');
    }
  }

  function local(p: PropDef, lx: number, lz: number): [number, number] {
    const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
    return [p.x + lx * c + lz * s, p.z - lx * s + lz * c];
  }
  function pbox(p: PropDef, w: number, h: number, d: number, lx: number, y: number, lz: number, color: string, mul = 1) {
    const [x, z] = local(p, lx, lz);
    return box(p.zone, w, h, d, x, y, z, color, p.yaw, mul, hash32(p.id));
  }

  function buildProp(p: PropDef) {
    const seed = hash32(p.id);
    switch (p.kind) {
      case 'bed': {
        if (p.zone === 'L28') {
          // SHU: bệ nằm bê tông đúc liền tường, đệm mỏng, chăn len xám
          pbox(p, p.w, 0.45, p.d, 0, 0.225, 0, '#a19e96');
          pbox(p, p.w - 0.08, 0.06, p.d - 0.1, 0, 0.48, 0, '#55705e');
          pbox(p, p.w - 0.1, 0.04, p.d * 0.5, 0, 0.53, p.d * 0.2, '#6c6f72');
          break;
        }
        // giường thép hàn tường kiểu buồng giam Mỹ: khung thép sơn, đệm vinyl xanh, chăn len xám, ngăn chứa đồ dưới gầm
        const FR = '#6e7b84';
        pbox(p, p.w, 0.06, p.d, 0, 0.4, 0, FR);
        pbox(p, p.w, 0.3, 0.05, 0, 0.22, -p.d / 2 + 0.03, FR); pbox(p, p.w, 0.3, 0.05, 0, 0.22, p.d / 2 - 0.03, FR);
        pbox(p, 0.05, 0.38, p.d, -p.w / 2 + 0.03, 0.2, 0, '#56636c'); pbox(p, 0.05, 0.38, p.d, p.w / 2 - 0.03, 0.2, 0, '#56636c');
        pbox(p, p.w - 0.1, 0.1, p.d - 0.1, 0, 0.48, 0, '#3f6a8c');
        pbox(p, p.w - 0.3, 0.09, 0.34, 0, 0.57, -p.d / 2 + 0.28, '#ecebe4');
        pbox(p, p.w - 0.06, 0.05, p.d * 0.58, 0, 0.55, p.d * 0.17, ['#6f7377', '#7b7466', '#626c74', '#6d6a62'][seed % 4]);
        pbox(p, p.w - 0.06, 0.012, 0.08, 0, 0.58, p.d * 0.17 - p.d * 0.29 + 0.04, '#e3e1d8');
        pbox(p, p.w * 0.38, 0.18, 0.4, -p.w * 0.2, 0.1, p.d * 0.2, '#b9a888');
        break;
      }
      case 'locker': {
        // tủ thép cá nhân: thân xám, lỗ thông gió, tay khóa, nhãn số
        pbox(p, p.w, p.h, p.d, 0, p.h / 2, 0, '#7d8891');
        pbox(p, p.w - 0.06, p.h - 0.08, 0.01, 0, p.h / 2, p.d / 2 + 0.005, '#8994a0');
        for (let i = 0; i < 4; i++) pbox(p, p.w * 0.5, 0.012, 0.012, 0, p.h - 0.2 - i * 0.04, p.d / 2 + 0.012, '#4a525a');
        pbox(p, 0.04, 0.14, 0.03, 0.2, 1.0, p.d / 2 + 0.02, '#c9ced2');
        pbox(p, 0.14, 0.06, 0.01, 0, p.h - 0.38, p.d / 2 + 0.012, '#e8e6de');
        break;
      }
      case 'desk': if (p.zone === 'L28') { pbox(p, p.w, 0.04, p.d, 0, 0.76, 0, '#9aa2a8'); pbox(p, p.w, 0.3, 0.03, 0, 0.6, -p.d / 2, '#7f878d'); { const [x, z] = local(p, 0, 0.45); cyl(p.zone, 0.32, 0.05, x, 0.46, z, '#9aa2a8', 12); cyl(p.zone, 0.07, 0.44, x, 0.22, z, '#7f878d', 6); } break; } pbox(p, p.w, 0.05, p.d, 0, 0.74, 0, '#8b6f52'); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pbox(p, 0.05, 0.72, 0.05, a * (p.w / 2 - 0.05), 0.36, b * (p.d / 2 - 0.05), '#3a3a3a'); break;
      case 'chair': pbox(p, 0.45, 0.05, 0.45, 0, 0.46, 0, '#566b75'); pbox(p, 0.45, 0.45, 0.05, 0, 0.7, -0.2, '#566b75'); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pbox(p, 0.04, 0.45, 0.04, a * 0.19, 0.22, b * 0.19, '#2f2f2f'); break;
      case 'table': {
        const benchOff = p.d / 2 - 0.2;
        pbox(p, p.w, 0.06, p.d > 1.2 ? Math.min(1.0, p.d - 0.6) : p.d, 0, 0.75, 0, p.zone === 'L07' ? '#8b6f52' : '#9aa5a8');
        if (p.d <= 1.2) for (const sd of [-1, 1]) { pbox(p, p.w * 0.9, 0.05, 0.32, 0, 0.45, sd * (p.d / 2 + 0.3), '#6b5a48'); pbox(p, 0.05, 0.42, 0.28, -p.w * 0.4, 0.22, sd * (p.d / 2 + 0.3), '#3a3a3a'); pbox(p, 0.05, 0.42, 0.28, p.w * 0.4, 0.22, sd * (p.d / 2 + 0.3), '#3a3a3a'); }
        pbox(p, 0.1, 0.72, 0.1, -p.w / 2 + 0.2, 0.36, 0, '#3a3f42'); pbox(p, 0.1, 0.72, 0.1, p.w / 2 - 0.2, 0.36, 0, '#3a3f42');
        if (p.d > 1.2) { pbox(p, p.w, 0.06, 0.32, 0, 0.45, -benchOff, '#7c878a'); pbox(p, p.w, 0.06, 0.32, 0, 0.45, benchOff, '#7c878a'); pbox(p, p.w - 0.2, 0.42, 0.06, 0, 0.21, -benchOff, '#3a3f42'); pbox(p, p.w - 0.2, 0.42, 0.06, 0, 0.21, benchOff, '#3a3f42'); }
        break;
      }
      case 'counter': pbox(p, p.w, p.h - 0.05, p.d, 0, (p.h - 0.05) / 2, 0, '#7a7f80'); pbox(p, p.w + 0.05, 0.05, p.d + 0.1, 0, p.h, 0, '#b8b8b0'); if (p.id === 'meal_counter') for (let i = 0; i < 5; i++) pbox(p, 0.5, 0.08, 0.35, -p.w / 2 + 1 + i * 2.4, p.h + 0.05, 0, '#d9d4c7'); break;
      case 'sink': pbox(p, p.w, 0.2, p.d, 0, 0.85, 0, '#e7e7e2'); pbox(p, 0.1, 0.85, 0.1, 0, 0.42, -0.1, '#9aa0a3'); pbox(p, 0.04, 0.2, 0.04, 0, 1.0, -p.d / 2 + 0.06, '#b5b9bc'); pbox(p, 0.5, 0.6, 0.02, 0, 1.55, -p.d / 2 + 0.01, '#a7bfc7', 1.2); break;
      case 'shower': pbox(p, p.w - 0.1, 0.03, p.d - 0.1, 0, 0.02, 0, '#6f8f9a'); { const [x, z] = local(p, 0, -p.d / 2 + 0.15); cyl(p.zone, 0.15, 0.05, x, 2.05, z, '#b5b9bc'); } pbox(p, p.w - 0.2, 1.7, 0.03, 0, 1.05, p.d / 2, '#cfd8d6', 1.0); break;
      case 'toilet': { buildToilet(p); break; }
      case 'water': pbox(p, p.w, 0.9, p.d, 0, 0.45, 0, '#8c9599'); pbox(p, p.w, 0.08, p.d, 0, 0.94, 0, '#c9d2d5'); pbox(p, 0.04, 0.12, 0.04, 0, 1.02, 0, '#7a8a90'); break;
      case 'shelf': {
        // double-sided open shelf: thin back board + side boards + shelves, books visible on both faces
        const rows = Math.max(2, Math.floor(p.h / 0.42));
        pbox(p, p.w, p.h, 0.06, 0, p.h / 2, 0, '#4a392c');
        pbox(p, 0.05, p.h, p.d, -p.w / 2, p.h / 2, 0, '#5a4636'); pbox(p, 0.05, p.h, p.d, p.w / 2, p.h / 2, 0, '#5a4636');
        const pal = ['#8c3b3b', '#3b5c8c', '#4f7a43', '#b58a3a', '#6b4f8c', '#2f6b6b', '#a65f3a', '#d9cfb8'];
        const sides = p.zone === 'L07' ? [-1, 1] : [1];
        for (let r = 0; r < rows; r++) {
          const y0 = 0.05 + r * (p.h / rows);
          pbox(p, p.w, 0.03, p.d, 0, y0, 0, '#5a4636');
          for (const sd of sides) {
            let lx = -p.w / 2 + 0.06;
            let i = 0;
            while (lx < p.w / 2 - 0.2) {
              const bw = 0.05 + ((seed + r * 7 + i * 3 + (sd > 0 ? 0 : 5)) % 4) * 0.025;
              const bh = 0.22 + ((seed + i) % 3) * 0.04;
              pbox(p, bw, bh, p.d * 0.38, lx + bw / 2, y0 + 0.02 + bh / 2, sd * p.d * 0.24, pal[(seed + r * 3 + i) % pal.length], 0.9);
              lx += bw + 0.008; i++;
              if (i % 9 === 8) lx += 0.12;
            }
          }
        }
        pbox(p, p.w, 0.03, p.d, 0, p.h, 0, '#5a4636');
        break;
      }
      case 'board': case 'whiteboard': {
        const wb = p.kind === 'whiteboard';
        const TH = wb ? 220 : 340;
        const tex = new DynamicTexture(`tx_${p.id}`, { width: 512, height: TH }, scene, true);
        const ctx = tex.getContext() as CanvasRenderingContext2D;
        if (wb) {
          ctx.fillStyle = '#f4f4ef'; ctx.fillRect(0, 0, 512, TH);
          ctx.strokeStyle = '#9aa3ab'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, 502, TH - 10);
          ctx.fillStyle = '#1f3d75';
        } else {
          // bảng tin kiểu Mỹ: khung nhôm, nền bần (cork), tờ thông báo trắng ghim đỏ
          ctx.fillStyle = '#a27a4c'; ctx.fillRect(0, 0, 512, TH);
          for (let i = 0; i < 260; i++) { ctx.fillStyle = i % 2 ? 'rgba(80,50,20,.18)' : 'rgba(255,230,190,.12)'; ctx.fillRect((i * 97) % 512, (i * 53) % TH, 3, 2); }
          ctx.strokeStyle = '#aeb5bb'; ctx.lineWidth = 14; ctx.strokeRect(7, 7, 498, TH - 14);
          ctx.fillStyle = '#f6f5f0'; ctx.fillRect(32, 30, 448, TH - 60);
          ctx.fillStyle = '#1c3561'; ctx.fillRect(32, 30, 448, 12);
          ctx.fillStyle = '#c62f26'; for (const px of [52, 460]) { ctx.beginPath(); ctx.arc(px, 50, 7, 0, Math.PI * 2); ctx.fill(); }
          ctx.fillStyle = '#16191e';
        }
        ctx.font = `700 40px ${SIGN_FONT}`;
        wrapText(ctx, p.label, wb ? 24 : 48, wb ? 64 : 96, wb ? 464 : 416, 46);
        ctx.fillStyle = wb ? '#7a7a7a' : '#1c3561';
        ctx.font = `600 28px ${SIGN_FONT}`;
        ctx.fillText('[E] để xem', wb ? 24 : 48, wb ? 200 : 290);
        tex.update();
        const mat = new StandardMaterial(`m_${p.id}`, scene);
        mat.diffuseTexture = tex;
        mat.emissiveColor = new Color3(0.35, 0.35, 0.35);
        mat.specularColor = new Color3(0, 0, 0);
        const plane = MeshBuilder.CreatePlane(`board_${p.id}`, { width: p.w, height: p.h, sideOrientation: Mesh.FRONTSIDE }, scene);
        plane.material = mat;
        plane.position.set(p.x, 1.55, p.z);
        plane.rotation.y = p.yaw + Math.PI;
        const fwd = new Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
        plane.position.addInPlace(fwd.scale(0.06));
        plane.isPickable = false;
        plane.freezeWorldMatrix();
        boards.push(plane);
        break;
      }
      case 'bar': pbox(p, 0.08, p.h, 0.08, -p.w / 2, p.h / 2, 0, '#555c60'); pbox(p, 0.08, p.h, 0.08, p.w / 2, p.h / 2, 0, '#555c60'); pbox(p, p.w, 0.05, 0.05, 0, p.h - 0.05, 0, '#9aa0a3'); break;
      case 'mat': pbox(p, p.w, 0.04, p.d, 0, 0.02, 0, ['#3a6b8c', '#8c3a3a', '#3a8c5a', '#6b5a8c'][seed % 4]); break;
      case 'quiet_mat': pbox(p, p.w, 0.04, p.d, 0, 0.02, 0, ['#8c7a5a', '#6b7a5a', '#7a6b8c'][seed % 3]); pbox(p, 0.45, 0.12, 0.45, 0, 0.08, -p.d / 2 + 0.35, '#c9b48a'); break;
      case 'workbench': pbox(p, p.w, 0.08, p.d, 0, 0.88, 0, '#9b7a52'); pbox(p, p.w - 0.1, 0.84, p.d - 0.1, 0, 0.42, 0, '#5d4a36', 0.8); pbox(p, 0.4, 0.25, 0.3, -0.5, 1.05, 0, '#b8956a'); pbox(p, 0.3, 0.2, 0.3, 0.4, 1.02, 0.1, '#c8a878'); break;
      case 'laundry': pbox(p, p.w, p.h, p.d, 0, p.h / 2, 0, '#8a9396'); for (let i = 0; i < 3; i++) pbox(p, 0.5, 0.4, 0.3, -0.8 + i * 0.8, p.h + 0.2, 0, ['#d6d2c4', '#a8b8c8', '#c8b8a8'][i]); break;
      case 'barber': pbox(p, 0.55, 0.1, 0.55, 0, 0.5, 0, '#3b2f2a'); pbox(p, 0.55, 0.7, 0.08, 0, 0.9, -0.25, '#3b2f2a'); { const [x, z] = local(p, 0, 0); cyl(p.zone, 0.4, 0.45, x, 0.22, z, '#8a8a8a'); } pbox(p, 0.8, 1.0, 0.03, 0, 1.6, -1.0, '#a7bfc7', 1.2); break;
      case 'phone': pbox(p, p.w, 1.2, p.d, 0, 0.9, 0, '#3e4f5e'); pbox(p, 0.5, 0.35, 0.03, 0, 1.3, p.d / 2 + 0.01, '#7fa0b8', 1.2); pbox(p, 0.08, 0.22, 0.08, 0.32, 1.1, p.d / 2 + 0.05, '#1e1e1e'); break;
      case 'visit_table': pbox(p, p.w, 0.05, p.d, 0, 0.74, 0, '#9b7f62'); pbox(p, 0.1, 0.72, 0.1, 0, 0.36, 0, '#3a3a3a'); pbox(p, p.w, 0.25, 0.03, 0, 0.88, 0, '#c9d6d6', 1.2); break;
      case 'medbed': pbox(p, p.w, 0.5, p.d, 0, 0.35, 0, '#d9dedc'); pbox(p, p.w - 0.1, 0.12, p.d - 0.1, 0, 0.66, 0, '#f2f4f3'); pbox(p, 0.04, 1.8, p.d + 0.4, p.w / 2 + 0.4, 1.0, 0, '#b8d0cc'); break;
      case 'plant': { cyl(p.zone, 0.4, 0.4, p.x, 0.2, p.z, '#7a5a42'); sph(p.zone, 0.7, p.x, 0.75, p.z, '#4f7a43', 1.1); break; }

      // ---------- CR-LAB-01 station props (phần tĩnh; trạng thái động ở labourView) ----------
      case 'garden_bed': {
        // khung luống gạch thấp + đất (đất/cây theo giai đoạn do labourView vẽ)
        pbox(p, p.w, 0.28, 0.12, 0, 0.14, p.d / 2 - 0.06, '#8a5a44'); pbox(p, p.w, 0.28, 0.12, 0, 0.14, -p.d / 2 + 0.06, '#8a5a44');
        pbox(p, 0.12, 0.28, p.d, p.w / 2 - 0.06, 0.14, 0, '#8a5a44'); pbox(p, 0.12, 0.28, p.d, -p.w / 2 + 0.06, 0.14, 0, '#8a5a44');
        // biển số luống
        pbox(p, 0.05, 0.5, 0.05, p.w / 2 + 0.15, 0.25, -p.d / 2 + 0.3, '#6b5a44'); pbox(p, 0.36, 0.2, 0.03, p.w / 2 + 0.15, 0.55, -p.d / 2 + 0.3, '#e9e2cf');
        break;
      }
      case 'garden_tap': pbox(p, 0.12, 0.9, 0.12, 0, 0.45, 0, '#7d8a8f'); pbox(p, 0.25, 0.06, 0.08, 0, 0.82, 0.08, '#b5b9bc'); pbox(p, 0.5, 0.12, 0.4, 0, 0.06, 0.2, '#6f7f86'); { const [x, z] = local(p, 0.32, 0.25); const t = MeshBuilder.CreateTorus(`hose${uid++}`, { diameter: 0.45, thickness: 0.05, tessellation: 18 }, scene); t.position.set(x, 0.08, z); colorize(t, '#3f7a4a'); batch.add(p.zone, t); } break;
      case 'flower_patch': pbox(p, p.w, 0.2, 0.1, 0, 0.1, p.d / 2 - 0.05, '#b6ad98'); pbox(p, p.w, 0.2, 0.1, 0, 0.1, -p.d / 2 + 0.05, '#b6ad98'); pbox(p, 0.1, 0.2, p.d, p.w / 2 - 0.05, 0.1, 0, '#b6ad98'); pbox(p, 0.1, 0.2, p.d, -p.w / 2 + 0.05, 0.1, 0, '#b6ad98'); pbox(p, p.w - 0.2, 0.12, p.d - 0.2, 0, 0.06, 0, '#5a4635'); break;
      case 'nursery_bench': pbox(p, p.w, 0.06, p.d, 0, 0.82, 0, '#9b7f5c'); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pbox(p, 0.07, 0.8, 0.07, a * (p.w / 2 - 0.08), 0.4, b * (p.d / 2 - 0.08), '#5d4a36'); pbox(p, p.w - 0.2, 0.04, p.d - 0.2, 0, 0.3, 0, '#7d6648'); pbox(p, p.w, 0.05, 0.05, 0, 1.9, -p.d / 2, '#6b5a44'); for (const a of [-1, 1]) pbox(p, 0.06, 1.9, 0.06, a * (p.w / 2), 0.95, -p.d / 2, '#6b5a44'); break;
      case 'waste_bin': pbox(p, p.w, p.h, p.d, 0, p.h / 2, 0, '#3f6b4f'); pbox(p, p.w + 0.06, 0.06, p.d + 0.06, 0, p.h + 0.03, 0, '#2f5440'); pbox(p, 0.4, 0.18, 0.02, 0, p.h * 0.65, p.d / 2 + 0.01, '#e9e2cf'); break;
      case 'pond': {
        // bờ ao đá + nền đáy (mặt nước & cá động ở labourView)
        const hw = p.w / 2, hd = p.d / 2;
        pbox(p, p.w + 0.8, 0.35, 0.4, 0, 0.17, hd + 0.2, '#9a9688'); pbox(p, p.w + 0.8, 0.35, 0.4, 0, 0.17, -hd - 0.2, '#9a9688');
        pbox(p, 0.4, 0.35, p.d, hw + 0.2, 0.17, 0, '#9a9688'); pbox(p, 0.4, 0.35, p.d, -hw - 0.2, 0.17, 0, '#9a9688');
        pbox(p, p.w, 0.05, p.d, 0, -0.35, 0, '#3d4a3a');
        for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; const [x, z] = local(p, Math.cos(a) * (hw + 0.6), Math.sin(a) * (hd + 0.6)); if (Math.abs(Math.sin(a)) > 0.85 && Math.sin(a) > 0) continue; sph(p.zone, 0.5 + (i % 3) * 0.15, x, 0.35, z, ['#4f7a3f', '#5f8a48', '#6b8f4a'][i % 3], 0.7); }
        break;
      }
      case 'pond_dock': pbox(p, p.w, 0.08, p.d, 0, 0.04, 0, '#8b6b4a'); for (let i = 0; i < 6; i++) pbox(p, p.w, 0.005, 0.02, 0, 0.085, -p.d / 2 + 0.2 + i * 0.44, '#5d4632'); for (const [a, b] of [[-1, 1], [1, 1]]) { pbox(p, 0.07, 0.95, 0.07, a * (p.w / 2 - 0.05), 0.55, b * (p.d / 2 - 0.05), '#6b5338'); } pbox(p, p.w, 0.06, 0.06, 0, 0.98, p.d / 2 - 0.05, '#6b5338'); break;
      case 'feed_station': pbox(p, p.w, 0.05, p.d, 0, 0.9, 0, '#9b7f62'); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pbox(p, 0.05, 0.88, 0.05, a * (p.w / 2 - 0.06), 0.44, b * (p.d / 2 - 0.06), '#5a4a3a'); pbox(p, 0.35, 0.3, 0.3, -0.3, 1.07, 0, '#c9b07a'); pbox(p, 0.3, 0.04, 0.22, 0.25, 0.94, 0, '#e9e2cf'); pbox(p, 0.6, 0.04, 0.3, 0, 0.45, 0, '#7d6648'); break;
      case 'tool_counter': pbox(p, p.w, p.h - 0.05, p.d, 0, (p.h - 0.05) / 2, 0, '#6f7b72'); pbox(p, p.w + 0.1, 0.05, p.d + 0.1, 0, p.h, 0, '#c9c4b4'); pbox(p, p.w, 0.5, 0.04, 0, p.h + 0.9, -p.d / 2 - 0.6, '#2f3f40'); pbox(p, 1.2, 0.18, 0.02, 0, p.h + 1.3, -p.d / 2 - 0.58, '#e5bc79'); break;
      case 'scale_station': {
        pbox(p, p.w, 0.9, p.d, 0, 0.45, 0, '#7a807e'); pbox(p, p.w + 0.05, 0.05, p.d + 0.05, 0, 0.92, 0, '#c9c4b4');
        pbox(p, 0.7, 0.06, 0.6, -0.5, 0.98, 0, '#b5b9bc'); pbox(p, 0.6, 0.02, 0.5, -0.5, 1.02, 0, '#d6dadc');
        pbox(p, 0.3, 0.22, 0.06, -0.5, 1.16, -0.3, '#2f3a3d'); pbox(p, 0.22, 0.08, 0.01, -0.5, 1.2, -0.265, '#7fd18a', 1.4);
        pbox(p, 0.5, 0.03, 0.35, 0.55, 0.95, 0, '#e9e2cf'); break;
      }
      case 'sort_table': pbox(p, p.w, 0.05, p.d, 0, 0.78, 0, '#9b7f62'); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pbox(p, 0.05, 0.76, 0.05, a * (p.w / 2 - 0.06), 0.38, b * (p.d / 2 - 0.06), '#5a4a3a'); for (let i = 0; i < 4; i++) pbox(p, 0.45, 0.06, 0.32, -0.75 + i * 0.5, 0.84, 0, '#3f3a34'); break;
      case 'stock_shelf': { for (let i = 0; i < 4; i++) pbox(p, p.w, 0.04, p.d, 0, 0.1 + i * 0.6, 0, '#8a8f8c'); for (const a of [-1, 1]) for (const b of [-1, 1]) pbox(p, 0.05, 2.0, 0.05, a * (p.w / 2 - 0.03), 1.0, b * (p.d / 2 - 0.03), '#5f676c'); break; }
      case 'tool_rack': { pbox(p, 0.05, 1.6, p.d, 0, 1.0, 0, '#6b5a44'); for (let i = 0; i < 6; i++) { pbox(p, 0.06, 0.06, 0.3, 0.06, 1.5, -1.0 + i * 0.4, '#b5b9bc'); pbox(p, 0.03, 0.9 - (i % 3) * 0.15, 0.03, 0.12, 1.05 - (i % 3) * 0.07, -1.0 + i * 0.4, ['#8b6b4a', '#7d8a8f', '#8b6b4a'][i % 3]); } break; }
      case 'wood_bench': { pbox(p, p.w, 0.08, p.d, 0, 0.86, 0, '#b08a5a'); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pbox(p, 0.09, 0.82, 0.09, a * (p.w / 2 - 0.08), 0.41, b * (p.d / 2 - 0.08), '#6b5338'); pbox(p, p.w - 0.2, 0.04, p.d - 0.2, 0, 0.28, 0, '#8b6b4a'); pbox(p, 0.18, 0.12, 0.3, p.w / 2 - 0.2, 0.96, -0.3, '#5f676c'); pbox(p, 0.6, 0.02, 0.4, -p.w / 2 + 0.45, 0.91, 0.25, '#e9e2cf'); pbox(p, 0.02, 0.01, 0.38, -p.w / 2 + 0.45, 0.925, 0.25, '#2b3f6b'); break; }
      case 'wood_rack': { pbox(p, 0.06, 1.5, p.d, -0.3, 0.75, 0, '#6b5338'); pbox(p, 0.06, 1.5, p.d, 0.3, 0.75, 0, '#6b5338'); for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) pbox(p, 0.55, 0.05, p.d - 0.2, 0, 0.3 + i * 0.35 + j * 0.06, 0, ['#d2b27c', '#c9a86f', '#dcbd88'][j]); break; }
      case 'clean_spot': break; // bẩn/sạch do labourView vẽ
      case 'crate': pbox(p, p.w, p.h, p.d, 0, p.h / 2, 0, '#9b7f5c'); pbox(p, p.w - 0.1, 0.06, p.d - 0.1, 0, p.h + 0.02, 0, '#5f8a48'); break;
      case 'tree': { cyl(p.zone, 0.35, 2.4, p.x, 1.2, p.z, '#5d4632'); sph(p.zone, 2.6, p.x, 3.2, p.z, '#4a7040', 0.9); sph(p.zone, 1.8, p.x + 0.6, 4.0, p.z - 0.3, '#567d47'); break; }
      case 'bench': pbox(p, p.w, 0.06, p.d, 0, 0.45, 0, '#8b6f52'); pbox(p, 0.06, 0.43, p.d - 0.1, -p.w / 2 + 0.15, 0.21, 0, '#3a3a3a'); pbox(p, 0.06, 0.43, p.d - 0.1, p.w / 2 - 0.15, 0.21, 0, '#3a3a3a'); break;
      case 'track': { const [x, z] = local(p, 0, 0); cyl(p.zone, 0.9, 0.03, x, 0.02, z, '#e8c54a', 16); cyl(p.zone, 0.12, 1.0, x, 0.5, z, '#e8c54a', 8); break; }
      case 'stove': pbox(p, p.w, p.h, p.d, 0, p.h / 2, 0, '#5f6466'); for (let i = 0; i < 2; i++) pbox(p, 0.4, 0.04, 0.4, -0.45 + i * 0.9, p.h + 0.02, 0, '#2a2a2a'); break;
      case 'prep': pbox(p, p.w, 0.06, p.d, 0, 0.9, 0, '#c6cacc'); pbox(p, p.w - 0.1, 0.4, p.d - 0.1, 0, 0.25, 0, '#9aa0a3', 0.8); pbox(p, 0.5, 0.15, 0.35, 0.4, 0.98, 0, '#6b8f4a'); break;
      case 'boxes': pbox(p, 0.6, 0.45, 0.5, -0.25, 0.22, 0, '#b08a5a'); pbox(p, 0.55, 0.4, 0.45, 0.3, 0.2, 0.1, '#a07a4a'); pbox(p, 0.5, 0.38, 0.45, 0, 0.64, 0.05, '#b8925f'); break;
      case 'tray_return': pbox(p, p.w, p.h, p.d, 0, p.h / 2, 0, '#7a8486'); for (let i = 0; i < 4; i++) pbox(p, 0.45, 0.03, 0.32, 0, p.h + 0.02 + i * 0.03, 0, '#d0cbbd'); break;
      case 'cabinet': pbox(p, p.w, p.h, p.d, 0, p.h / 2, 0, '#7c8478'); pbox(p, p.w - 0.1, 0.02, 0.01, 0, p.h * 0.66, p.d / 2 + 0.005, '#4a4a4a'); pbox(p, p.w - 0.1, 0.02, 0.01, 0, p.h * 0.33, p.d / 2 + 0.005, '#4a4a4a'); break;
      case 'hoop': { cyl(p.zone, 0.12, 3.2, p.x, 1.6, p.z, '#6b6b6b'); pbox(p, 1.2, 0.8, 0.05, 0, 3.0, 0.3, '#e8e8e8'); const t = MeshBuilder.CreateTorus(`hoop${uid++}`, { diameter: 0.46, thickness: 0.03, tessellation: 16 }, scene); const [x, z] = local(p, 0, 0.6); t.position.set(x, 2.75, z); colorize(t, '#d9622b'); batch.add(p.zone, t); break; }
      case 'muster': pbox(p, p.w, 0.012, p.d, 0, 0.007, 0, '#e8c54a'); break;
      case 'mail_desk': pbox(p, p.w, p.h, p.d, 0, p.h / 2, 0, '#7f6a52'); pbox(p, 0.5, 0.12, 0.35, -0.4, p.h + 0.06, 0, '#d9d4c7'); pbox(p, 0.5, 0.12, 0.35, 0.3, p.h + 0.06, 0, '#c9b48a'); break;
      case 'window': {
        const m = MeshBuilder.CreatePlane(`win${uid++}`, { width: p.w, height: p.h }, scene);
        m.position.set(p.x, 1.8, p.z);
        m.rotation.y = p.yaw + Math.PI;
        windows.push(m);
        pbox(p, p.w + 0.12, 0.08, 0.06, 0, 1.28, 0, '#3a4446'); pbox(p, p.w + 0.12, 0.08, 0.06, 0, 2.32, 0, '#3a4446');
        // song chắn cửa sổ an ninh
        for (let i = 1; i < 6; i++) pbox(p, 0.035, p.h + 0.04, 0.035, -p.w / 2 + (i * p.w) / 6, 1.8, -0.04, STEEL_DARK);
        pbox(p, p.w, 0.035, 0.035, 0, 1.8, -0.04, STEEL_DARK);
        break;
      }
      case 'staff_post': break;

      // ---------- SHU (biệt giam kiểu Mỹ) ----------
      case 'cage_module': {
        // cũi trị liệu cá nhân: khung thép xám, tấm kín phía dưới, lưới mắt cáo giữa, song ô vuông phía trên, khe khay có khóa
        const S = '#aab0b5', SD = '#7f878d', WIRE = '#8e969c';
        const W = p.w, D = p.d, H = p.h;
        for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pbox(p, 0.05, H, 0.05, a * (W / 2 - 0.025), H / 2, b * (D / 2 - 0.025), SD);
        pbox(p, W, 0.05, D, 0, 0.025, 0, SD);
        for (const [fx, fz, alongX] of [[0, D / 2, true], [0, -D / 2, true], [W / 2, 0, false], [-W / 2, 0, false]] as [number, number, boolean][]) {
          const len = alongX ? W : D;
          const seg = (sw: number, sh: number, y: number, off: number, c: string) => (alongX ? pbox(p, sw, sh, 0.015, fx + off, y, fz, c) : pbox(p, 0.015, sh, sw, fx, y, fz + off, c));
          seg(len, 0.55, 0.32, 0, S);
          for (let i = 0; i <= 14; i++) seg(0.006, 0.8, 1.0, -len / 2 + (i * len) / 14, WIRE);
          for (let j = 0; j <= 11; j++) seg(len, 0.006, 0.62 + j * 0.07, 0, WIRE);
          for (let i = 0; i <= 5; i++) seg(0.03, 0.88, 1.84, -len / 2 + (i * len) / 5, S);
          for (let j = 0; j <= 4; j++) seg(len, 0.03, 1.42 + j * 0.22, 0, S);
        }
        for (let i = 0; i <= 5; i++) { pbox(p, 0.03, 0.03, D, -W / 2 + (i * W) / 5, H, 0, S); pbox(p, W, 0.03, 0.03, 0, H, -D / 2 + (i * D) / 5, S); }
        pbox(p, 0.48, 0.05, 0.22, 0, 1.02, D / 2 + 0.1, S); pbox(p, 0.48, 0.17, 0.02, 0, 1.13, D / 2 + 0.012, SD); pbox(p, 0.06, 0.08, 0.035, 0.15, 1.08, D / 2 + 0.035, '#c9a646');
        { const [x, z] = local(p, 0, -0.15); cyl(p.zone, 0.34, 0.05, x, 0.5, z, '#2e3237', 12); cyl(p.zone, 0.05, 0.48, x, 0.25, z, '#5d646a', 6); }
        break;
      }
      case 'rec_cage': {
        // cũi thể dục ("dog run"): cột thép, lưới mắt cáo bốn mặt + mái lưới, cửa có ổ khóa, nền bê tông, thanh xà
        const POST = '#6d757c', WIRE = '#9aa2a8';
        const W = p.w, D = p.d, H = p.h;
        pbox(p, W, 0.04, D, 0, 0.02, 0, '#8d8b85');
        for (const a of [-1, 0, 1]) for (const b of [-1, 1]) pbox(p, 0.07, H, 0.07, a * (W / 2), H / 2, b * (D / 2), POST);
        for (const a of [-1, 1]) pbox(p, 0.07, H, 0.07, a * (W / 2), H / 2, 0, POST);
        for (const [fx, fz, alongX] of [[0, D / 2, true], [0, -D / 2, true], [W / 2, 0, false], [-W / 2, 0, false]] as [number, number, boolean][]) {
          const len = alongX ? W : D;
          const n = Math.round(len / 0.16);
          for (let i = 0; i <= n; i++) alongX ? pbox(p, 0.008, H, 0.01, fx - len / 2 + (i * len) / n, H / 2, fz, WIRE) : pbox(p, 0.01, H, 0.008, fx, H / 2, fz - len / 2 + (i * len) / n, WIRE);
          for (let j = 0; j <= 14; j++) alongX ? pbox(p, len, 0.008, 0.01, fx, 0.1 + j * (H - 0.1) / 14, fz, WIRE) : pbox(p, 0.01, 0.008, len, fx, 0.1 + j * (H - 0.1) / 14, fz, WIRE);
          alongX ? pbox(p, len, 0.05, 0.05, fx, H, fz, POST) : pbox(p, 0.05, 0.05, len, fx, H, fz, POST);
        }
        for (let i = 0; i <= Math.round(W / 0.3); i++) pbox(p, 0.01, 0.01, D, -W / 2 + i * 0.3, H, 0, WIRE);
        for (let j = 0; j <= Math.round(D / 0.3); j++) pbox(p, W, 0.01, 0.01, 0, H, -D / 2 + j * 0.3, WIRE);
        pbox(p, 0.06, 2.1, 0.06, -0.5, 1.05, D / 2 + 0.02, POST); pbox(p, 0.06, 2.1, 0.06, 0.5, 1.05, D / 2 + 0.02, POST); pbox(p, 1.0, 0.06, 0.06, 0, 2.1, D / 2 + 0.02, POST);
        pbox(p, 0.08, 0.12, 0.06, 0.4, 1.1, D / 2 + 0.06, '#c9a646');
        pbox(p, 0.05, 2.3, 0.05, -W / 2 + 0.35, 1.15, -D / 2 + 0.35, POST); pbox(p, 0.05, 2.3, 0.05, -W / 2 + 1.35, 1.15, -D / 2 + 0.35, POST);
        { const bar = cylPiece(0.035, 1.0, 6, color4('#c3c9ce')); const [x, z] = local(p, -W / 2 + 0.85, -D / 2 + 0.35); bar.position.set(x, 2.25, z); bar.rotation.z = Math.PI / 2; bar.rotation.y = p.yaw; batch.add(p.zone, bar); }
        // giếng trời phía trên cũi
        { const [x, z] = local(p, 0, 0); const sky = boxPiece(W - 0.6, 0.04, D - 0.8, color4('#ffffff')); sky.position.set(x, ZONE_BY_ID[p.zone].height - 0.04, z); sky.rotation.y = p.yaw; emissive.push(sky); }
        break;
      }
      case 'shower_cage': {
        // buồng tắm SHU: ba mặt ốp gạch, mặt trước cửa song ô vuông có khe khay, vòi sen inox
        const W = p.w, D = p.d, H = p.h;
        pbox(p, W, 0.03, D, 0, 0.015, 0, '#b9c1c1');
        pbox(p, W, H, 0.06, 0, H / 2, -D / 2, '#cdd3d2'); pbox(p, 0.06, H, D, -W / 2, H / 2, 0, '#cdd3d2'); pbox(p, 0.06, H, D, W / 2, H / 2, 0, '#cdd3d2');
        for (let j = 1; j < 8; j++) pbox(p, W - 0.02, 0.008, 0.065, 0, j * 0.3, -D / 2 + 0.003, '#aeb6b6');
        for (let i = 0; i <= 7; i++) pbox(p, 0.03, H, 0.03, -W / 2 + (i * W) / 7, H / 2, D / 2, STEEL_DARK);
        for (let j = 0; j <= 6; j++) pbox(p, W, 0.03, 0.03, 0, 0.05 + (j * (H - 0.1)) / 6, D / 2, STEEL_DARK);
        pbox(p, 0.4, 0.12, 0.05, 0, 1.05, D / 2 + 0.02, '#4a5258');
        pbox(p, 0.04, 0.3, 0.04, 0, 1.95, -D / 2 + 0.1, '#c3c9cc'); pbox(p, 0.16, 0.04, 0.12, 0, 2.08, -D / 2 + 0.16, '#d0d5d8');
        pbox(p, 0.18, 0.18, 0.01, 0, 0.02, 0, '#5d666b');
        break;
      }
      case 'control_desk': {
        // bàn trực an ninh: quầy thép, 3 màn hình camera, bảng điều khiển cửa
        pbox(p, p.w, p.h - 0.05, p.d, 0, (p.h - 0.05) / 2, 0, '#4f585f');
        pbox(p, p.w + 0.06, 0.05, p.d + 0.1, 0, p.h, 0, '#9aa2a8');
        for (const ox of [-0.8, 0, 0.8]) { pbox(p, 0.6, 0.38, 0.05, ox, p.h + 0.3, -0.15, '#1a1f24'); pbox(p, 0.54, 0.32, 0.01, ox, p.h + 0.3, -0.12, '#4f86a8', 1.3); pbox(p, 0.06, 0.12, 0.06, ox, p.h + 0.08, -0.17, '#1a1f24'); }
        pbox(p, 0.7, 0.04, 0.26, 0, p.h + 0.04, 0.16, '#2b3136');
        for (let i = 0; i < 6; i++) pbox(p, 0.05, 0.02, 0.05, -0.25 + i * 0.1, p.h + 0.07, 0.16, i % 2 ? '#3fae5c' : '#d4473a');
        break;
      }
    }
    if (p.kind === 'sink' || p.kind === 'water') {
      const mk = MeshBuilder.CreateCylinder(`broken_${p.id}`, { diameter: 0.3, height: 0.3, tessellation: 3 }, scene);
      mk.position.set(p.x, 1.4, p.z);
      const mm = new StandardMaterial(`m_broken_${p.id}`, scene);
      mm.emissiveColor = Color3.FromHexString('#f3c76c');
      mm.disableLighting = true;
      mk.material = mm;
      mk.setEnabled(false);
      brokenMarkers.set(p.id, mk);
    }
  }

  // ---------- zone signs above doors (corridor side) ----------
  for (const z of ZONES) {
    if (!z.door) continue;
    const tex = new DynamicTexture(`sign_${z.id}`, { width: 512, height: 128 }, scene, true);
    const c = tex.getContext() as CanvasRenderingContext2D;
    // biển chỉ dẫn khu: nền navy, mã khu trong ô vàng, tên tiếng Anh + tên Việt nhỏ
    c.fillStyle = '#13284b'; c.fillRect(0, 0, 512, 128);
    c.strokeStyle = '#dfe5ec'; c.lineWidth = 5; c.strokeRect(4, 4, 504, 120);
    c.fillStyle = SAFETY_YELLOW; c.fillRect(14, 14, 92, 100);
    c.fillStyle = '#111418'; c.font = `800 38px ${SIGN_FONT}`; c.textAlign = 'center';
    c.fillText(z.id, 60, 78);
    c.textAlign = 'left';
    const en = SIGN_EN[z.id] ?? z.name.toUpperCase();
    c.fillStyle = '#ffffff'; c.font = `700 ${en.length > 16 ? 34 : 40}px ${SIGN_FONT}`;
    c.fillText(en, 122, 62, 376);
    c.fillStyle = '#b9c6d6'; c.font = `500 26px ${SIGN_FONT}`;
    c.fillText(`${z.name}${z.hours ? ' · có giờ mở cửa' : ''}`, 122, 102, 376);
    tex.update();
    const mat = new StandardMaterial(`msign_${z.id}`, scene);
    mat.diffuseTexture = tex; mat.emissiveColor = new Color3(0.6, 0.6, 0.6); mat.specularColor = new Color3(0, 0, 0);
    const pl = MeshBuilder.CreatePlane(`signp_${z.id}`, { width: 2.6, height: 0.65 }, scene);
    pl.material = mat;
    if (z.side === 'yard') { pl.position.set(68.85, 3.0, 0); pl.rotation.y = Math.PI / 2; }
    else if (z.id === 'L28') { pl.position.set(-100.87, 3.0, 0); pl.rotation.y = -Math.PI / 2; }
    else { const dir = z.side === 'north' ? -1 : 1; pl.position.set(z.door.x, 2.95, z.door.z + dir * 0.13); pl.rotation.y = z.side === 'north' ? 0 : Math.PI; }
    pl.isPickable = false;
    pl.freezeWorldMatrix();
  }

  // ---------- merge per zone ----------
  const zoneMeshes = new Map<ZoneId, Mesh[]>();
  onProgress(0.6);
  await yieldFrame();
  let zi = 0;
  for (const [zone, list] of batch.meshes) {
    const chunks: Mesh[] = [];
    if (++zi % 4 === 0) { onProgress(0.6 + 0.35 * (zi / batch.meshes.size)); await yieldFrame(); }
    for (const merged of mergePieces(scene, `zone_${zone}`, list)) {
      merged.material = baseMat;
      merged.isPickable = false;
      merged.freezeWorldMatrix();
      merged.receiveShadows = zone === 'L04';
      chunks.push(merged);
    }
    zoneMeshes.set(zone as ZoneId, chunks);
  }
  if (yardFloor) { yardFloor.material = baseMat; yardFloor.receiveShadows = true; yardFloor.freezeWorldMatrix(); }
  const lightsMerged = emissive.length ? mergePieces(scene, 'lights', emissive)[0] : null;
  if (lightsMerged) { lightsMerged.material = lightMat; lightsMerged.isPickable = false; lightsMerged.freezeWorldMatrix(); }
  const winMerged = windows.length ? Mesh.MergeMeshes(windows, true, true) : null;
  if (winMerged) { winMerged.material = windowMat; winMerged.isPickable = false; winMerged.freezeWorldMatrix(); }

  // focus ring marker
  const focusRing = MeshBuilder.CreateTorus('focus_ring', { diameter: 0.9, thickness: 0.04, tessellation: 32 }, scene);
  const fm = new StandardMaterial('m_focus', scene);
  fm.emissiveColor = Color3.FromHexString('#e8b77a');
  fm.disableLighting = true;
  fm.alpha = 0.85;
  focusRing.material = fm;
  focusRing.isPickable = false;
  focusRing.setEnabled(false);

  return { zoneMeshes, doors, windowMat, lightMat, yardFloor, brokenMarkers, boards, focusRing, cellDoors };
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, y); line = w; y += lh; }
    else line = t;
  }
  if (line) ctx.fillText(line, x, y);
}

export function disposeAll(nodes: (AbstractMesh | TransformNode)[]) { for (const n of nodes) n.dispose(); }
