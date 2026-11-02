// Procedural blockout world from content (03). Static meshes merged per zone with vertex colors (ít draw call);
// emissive lights/windows separate; boards/signs use DynamicTexture text (localization không bake vào asset).
import { Color3, Color4, DynamicTexture, Mesh, MeshBuilder, Scene, StandardMaterial, TransformNode, Vector3, VertexBuffer, type AbstractMesh } from '@babylonjs/core';
import { CELL_DOORS, PROPS, WALLS, ZONES, ZONE_BY_ID, type PropDef } from '../content/world';
import type { ZoneId } from '../domain/types';
import { hash32 } from '../domain/util';

export interface WorldHandles {
  zoneMeshes: Map<ZoneId, Mesh[]>;
  doors: Map<string, { mesh: Mesh; closedPos: Vector3; openPos: Vector3; t: number }>;
  windowMat: StandardMaterial;
  lightMat: StandardMaterial;
  yardFloor: Mesh | null;
  brokenMarkers: Map<string, Mesh>;
  boards: Mesh[];
  focusRing: Mesh;
}

function hexToColor4(hex: string, mul = 1): Color4 {
  const c = Color3.FromHexString(hex);
  return new Color4(Math.min(1, c.r * mul), Math.min(1, c.g * mul), Math.min(1, c.b * mul), 1);
}

class Batch {
  meshes = new Map<string, Mesh[]>();
  add(key: string, m: Mesh) {
    let arr = this.meshes.get(key);
    if (!arr) this.meshes.set(key, (arr = []));
    arr.push(m);
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

export function buildWorld(scene: Scene): WorldHandles {
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
  const box = (zone: ZoneId, w: number, h: number, d: number, x: number, y: number, z: number, color: string, yaw = 0, mul = 1, seed?: number) => {
    const m = MeshBuilder.CreateBox(`b${uid++}`, { width: w, height: h, depth: d }, scene);
    m.position.set(x, y, z);
    m.rotation.y = yaw;
    colorize(m, color, mul, seed);
    batch.add(zone, m);
    return m;
  };
  const cyl = (zone: ZoneId, dia: number, h: number, x: number, y: number, z: number, color: string, tess = 10, diaTop?: number) => {
    const m = MeshBuilder.CreateCylinder(`c${uid++}`, { diameter: dia, diameterTop: diaTop ?? dia, height: h, tessellation: tess }, scene);
    m.position.set(x, y, z);
    colorize(m, color);
    batch.add(zone, m);
    return m;
  };
  const sph = (zone: ZoneId, dia: number, x: number, y: number, z: number, color: string, sy = 1) => {
    const m = MeshBuilder.CreateSphere(`s${uid++}`, { diameter: dia, segments: 6 }, scene);
    m.position.set(x, y, z);
    m.scaling.y = sy;
    colorize(m, color);
    batch.add(zone, m);
    return m;
  };
  const emissive: Mesh[] = [];
  const windows: Mesh[] = [];

  // ---------- floors & ceilings ----------
  let yardFloor: Mesh | null = null;
  for (const z of ZONES) {
    const w = z.x1 - z.x0;
    const d = z.z1 - z.z0;
    const cx = (z.x0 + z.x1) / 2;
    const cz = (z.z0 + z.z1) / 2;
    if (z.outdoor) {
      const f = MeshBuilder.CreateGround('yard_floor', { width: w, height: d, subdivisions: 1 }, scene);
      f.position.set(cx, 0, cz);
      colorize(f, z.floor);
      yardFloor = f;
      // track ring paint & grass strips
      box('L04', w - 8, 0.02, 0.5, cx, 0.01, -10, '#d8c27a'); box('L04', w - 8, 0.02, 0.5, cx, 0.01, 6, '#d8c27a');
      box('L04', 0.5, 0.02, 16, 75, 0.01, -2, '#d8c27a'); box('L04', 0.5, 0.02, 16, 103, 0.01, -2, '#d8c27a');
      box('L04', w, 0.05, 2.2, cx, 0.02, 11, '#5f7a4a'); box('L04', w, 0.05, 1.8, cx, 0.02, -15.1, '#5f7a4a');
      box('L04', 14, 0.02, 8, 95, 0.012, -2, '#6c6f74');
      // distant skyline (cảnh quan, không phải bản vẽ thật)
      box('L04', 60, 6, 1, 89, 8, 22, '#8d958f', 0, 0.9); box('L04', 1, 6, 50, 118, 8, -2, '#8d958f', 0, 0.85);
      continue;
    }
    const floorColor = z.id === 'L13' ? '#7f8c90' : z.id === 'L08' ? '#9aa3a0' : z.id === 'L07' ? '#6b5a48' : z.id === 'L09' ? '#4a5560' : z.floor;
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
      const lm = MeshBuilder.CreateBox(`lp${uid++}`, { width: 1.2, height: 0.04, depth: 0.5 }, scene);
      lm.position.set(z.x0 + (i + 0.5) * (w / nx), z.height - 0.03, z.z0 + (j + 0.5) * (d / nz));
      emissive.push(lm);
    }
    // skirting accent stripe on floor edges for wayfinding in corridor
    if (z.id === 'L03') {
      box('L03', w, 0.01, 0.35, cx, 0.006, 0, '#c9a56a', 0, 0.9);
    }
  }

  // ---------- iron bar grille (song sắt) ----------
  const STEEL = '#8a9196';
  const STEEL_DARK = '#5f676c';
  /** Vertical bars + horizontal flat straps + frame along a segment (local x = along, centred at origin). */
  const grille = (len: number, h: number, add: (w: number, hh: number, d: number, lx: number, y: number, color: string, mul?: number) => void) => {
    const n = Math.max(2, Math.round(len / 0.13));
    for (let i = 0; i <= n; i++) add(0.032, h, 0.032, -len / 2 + (i * len) / n, h / 2, STEEL);
    for (const y of [0.06, h * 0.33, h * 0.62, h - 0.05]) add(len, 0.05, 0.07, 0, y, STEEL_DARK);
    add(0.07, h, 0.09, -len / 2, h / 2, STEEL_DARK);
    add(0.07, h, 0.09, len / 2, h / 2, STEEL_DARK);
  };

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
      if (w.h > barH) box(w.zone, len + 0.2, w.h - barH, 0.24, cx, barH + (w.h - barH) / 2, cz, '#c9c4b4', yaw);
      continue;
    }
    const len = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
    if (len < 0.01) continue;
    const cx = (w.x0 + w.x1) / 2;
    const cz = (w.z0 + w.z1) / 2;
    const yaw = Math.atan2(w.x1 - w.x0, w.z1 - w.z0) + Math.PI / 2;
    const lower = Math.min(1.1, w.h);
    box(w.zone, len + 0.2, lower, 0.2, cx, lower / 2, cz, w.color, yaw, 0.72);
    if (w.h > lower) box(w.zone, len + 0.2, w.h - lower, 0.2, cx, lower + (w.h - lower) / 2, cz, w.color, yaw, 1.08);
  }

  // ---------- doors: cửa trượt song sắt ----------
  const doors = new Map<string, { mesh: Mesh; closedPos: Vector3; openPos: Vector3; t: number }>();
  const doorMat = new StandardMaterial('mat_door_iron', scene);
  doorMat.diffuseColor = new Color3(1, 1, 1);
  doorMat.specularColor = new Color3(0.35, 0.35, 0.35);
  doorMat.specularPower = 24;
  /** Builds one merged barred door leaf centred at origin (local x along opening). */
  const barDoor = (name: string, len: number, h: number, alongX: boolean, withLock: boolean): Mesh => {
    const parts: Mesh[] = [];
    const add = (bw: number, bh: number, bd: number, lx: number, y: number, color: string) => {
      const m = MeshBuilder.CreateBox(`${name}_p${parts.length}`, { width: alongX ? bw : bd, height: bh, depth: alongX ? bd : bw }, scene);
      m.position.set(alongX ? lx : 0, y - h / 2, alongX ? 0 : lx);
      colorize(m, color);
      parts.push(m);
    };
    grille(len, h, add);
    // diagonal-free cross plate + lock box like real cell doors
    if (withLock) { add(0.16, 0.28, 0.12, len / 2 - 0.14, h * 0.48, '#4a5156'); add(0.05, 0.05, 0.16, len / 2 - 0.14, h * 0.44, '#c9b25a'); }
    const merged = Mesh.MergeMeshes(parts, true, true)!;
    merged.name = name;
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
  for (const d of CELL_DOORS) {
    const leaf = barDoor(`celldoor_${d.roomId}`, d.width, 2.4, d.alongX, true);
    // slid open behind the adjacent bar wall, offset toward the cell interior
    leaf.position.set(d.x + d.slideDir * d.width * 0.95, 1.2, d.z + d.inward * 0.12);
    leaf.freezeWorldMatrix();
    for (const sd of [-1, 1]) box('L02', 0.1, 2.5, 0.12, d.x + sd * d.width / 2, 1.25, d.z, STEEL_DARK);
    const tex = new DynamicTexture(`tx_no_${d.roomId}`, { width: 128, height: 64 }, scene, true);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    ctx.fillStyle = '#e9e5d8'; ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = '#2b2b2b'; ctx.font = 'bold 40px "Noto Sans", "Segoe UI", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(d.number, 64, 46);
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

  // ---------- props ----------
  const brokenMarkers = new Map<string, Mesh>();
  const boards: Mesh[] = [];
  for (const p of PROPS) buildProp(p);

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
        pbox(p, p.w, 0.3, p.d, 0, 0.25, 0, '#3e4a50');
        pbox(p, p.w - 0.08, 0.14, p.d - 0.08, 0, 0.47, 0, '#7d8fa0');
        pbox(p, p.w - 0.25, 0.1, 0.35, 0, 0.58, -p.d / 2 + 0.3, '#e6e2d6');
        pbox(p, p.w - 0.04, 0.06, p.d * 0.55, 0, 0.56, p.d * 0.18, ['#55707e', '#7a6a58', '#5b6b52', '#6c5a6e'][seed % 4]);
        pbox(p, 0.05, 0.5, 0.05, -p.w / 2 + 0.03, 0.55, -p.d / 2 + 0.03, '#2e373b'); pbox(p, 0.05, 0.5, 0.05, p.w / 2 - 0.03, 0.55, -p.d / 2 + 0.03, '#2e373b');
        break;
      }
      case 'locker': pbox(p, p.w, p.h, p.d, 0, p.h / 2, 0, '#6b7f74'); pbox(p, 0.04, 0.12, 0.03, 0.18, 1.0, p.d / 2 + 0.01, '#c9c9c9'); break;
      case 'desk': pbox(p, p.w, 0.05, p.d, 0, 0.74, 0, '#8b6f52'); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pbox(p, 0.05, 0.72, 0.05, a * (p.w / 2 - 0.05), 0.36, b * (p.d / 2 - 0.05), '#3a3a3a'); break;
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
      case 'toilet': { const [x, z] = local(p, 0, -0.2); cyl(p.zone, 0.42, 0.4, x, 0.2, z, '#ececec'); pbox(p, 0.4, 0.35, 0.15, 0, 0.55, -0.55, '#ececec'); pbox(p, p.w - 0.15, 1.7, 0.04, 0, 1.0, p.d / 2, '#a9b6b3'); break; }
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
        const tex = new DynamicTexture(`tx_${p.id}`, { width: 512, height: p.kind === 'whiteboard' ? 220 : 340 }, scene, true);
        const ctx = tex.getContext() as CanvasRenderingContext2D;
        ctx.fillStyle = p.kind === 'whiteboard' ? '#f4f4ef' : '#2a3b3e';
        ctx.fillRect(0, 0, 512, 512);
        ctx.fillStyle = p.kind === 'whiteboard' ? '#2b3f6b' : '#f2f0e8';
        ctx.font = 'bold 40px "Noto Sans", "Segoe UI", sans-serif';
        wrapText(ctx, p.label, 24, 64, 464, 46);
        ctx.fillStyle = p.kind === 'whiteboard' ? '#7a7a7a' : '#e8b77a';
        ctx.font = '28px "Noto Sans", "Segoe UI", sans-serif';
        ctx.fillText('[E] để xem', 24, p.kind === 'whiteboard' ? 200 : 310);
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
        break;
      }
      case 'staff_post': break;
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
    c.fillStyle = '#1b2629'; c.fillRect(0, 0, 512, 128);
    c.fillStyle = '#e8b77a'; c.fillRect(0, 118, 512, 10);
    c.fillStyle = '#f2f0e8'; c.font = 'bold 44px "Noto Sans", "Segoe UI", sans-serif';
    c.fillText(z.name, 20, 62);
    c.fillStyle = '#c2cdca'; c.font = '30px "Noto Sans", "Segoe UI", sans-serif';
    c.fillText(`${z.id}${z.hours ? ' · có giờ mở cửa' : ''}`, 20, 104);
    tex.update();
    const mat = new StandardMaterial(`msign_${z.id}`, scene);
    mat.diffuseTexture = tex; mat.emissiveColor = new Color3(0.6, 0.6, 0.6); mat.specularColor = new Color3(0, 0, 0);
    const pl = MeshBuilder.CreatePlane(`signp_${z.id}`, { width: 2.6, height: 0.65 }, scene);
    pl.material = mat;
    if (z.side === 'yard') { pl.position.set(68.85, 3.0, 0); pl.rotation.y = Math.PI / 2; }
    else { const dir = z.side === 'north' ? -1 : 1; pl.position.set(z.door.x, 2.95, z.door.z + dir * 0.13); pl.rotation.y = z.side === 'north' ? 0 : Math.PI; }
    pl.isPickable = false;
    pl.freezeWorldMatrix();
  }

  // ---------- merge per zone ----------
  const zoneMeshes = new Map<ZoneId, Mesh[]>();
  for (const [zone, list] of batch.meshes) {
    const chunks: Mesh[] = [];
    for (let i = 0; i < list.length; i += 400) {
      const merged = Mesh.MergeMeshes(list.slice(i, i + 400), true, true, undefined, false, false);
      if (!merged) continue;
      merged.name = `zone_${zone}_${i}`;
      merged.material = baseMat;
      merged.isPickable = false;
      merged.freezeWorldMatrix();
      merged.receiveShadows = zone === 'L04';
      chunks.push(merged);
    }
    zoneMeshes.set(zone as ZoneId, chunks);
  }
  if (yardFloor) { yardFloor.material = baseMat; yardFloor.receiveShadows = true; yardFloor.freezeWorldMatrix(); }
  const lightsMerged = Mesh.MergeMeshes(emissive, true, true);
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

  return { zoneMeshes, doors, windowMat, lightMat, yardFloor, brokenMarkers, boards, focusRing };
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
