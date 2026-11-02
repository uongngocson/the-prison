// CR-LAB-01 presentation: trạng thái khu lao động dựng lại theo domain (không suy stage từ mesh).
// Hiệu năng: mỗi station gộp thành 1 mesh vertex-color; chỉ dựng lại station có chữ ký trạng thái thay đổi.
import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial } from '@babylonjs/core';
import type { GameState, LabourPatch, LabourPlot } from '../domain/types';
import { PROPS, type PropDef } from '../content/world';
import { hash32 } from '../domain/util';
import { boxPiece, color4, cylPiece, mergePieces, sphPiece, type Piece } from './geo';

export class LabourView {
  private meshes = new Map<string, Mesh[]>();
  private sigs = new Map<string, string>();
  private lastRev = -1;
  private fish: { m: Mesh; r: number; a: number; sp: number; cx: number; cz: number; y: number }[] = [];
  private fishSig = '';
  private ripple: { m: Mesh; t: number } | null = null;
  private water: Mesh | null = null;
  private lastCare = -1;
  private t = 0;
  private vcMat: StandardMaterial;
  private fishMat: StandardMaterial;
  private rippleMat: StandardMaterial;
  private pieces: Piece[] = [];

  constructor(private scene: Scene) {
    this.vcMat = new StandardMaterial('lab_vc', scene);
    this.vcMat.diffuseColor = new Color3(1, 1, 1);
    this.vcMat.specularColor = new Color3(0.04, 0.04, 0.04);
    this.fishMat = new StandardMaterial('lab_fish', scene);
    this.fishMat.diffuseColor = Color3.FromHexString('#5d6b6b'); this.fishMat.emissiveColor = new Color3(0.08, 0.09, 0.09);
    this.rippleMat = new StandardMaterial('lab_ripple', scene);
    this.rippleMat.diffuseColor = new Color3(0.85, 0.92, 0.95);
  }

  /** Gọi mỗi frame; chỉ kiểm chữ ký khi revision domain đổi. */
  update(s: GameState, dt: number) {
    this.t += dt;
    const l = s.labour;
    if (!l) return;
    if (l.revision !== this.lastRev) { this.rebuild(s); this.lastRev = l.revision; }
    for (const f of this.fish) {
      f.a += dt * f.sp;
      f.m.position.set(f.cx + Math.cos(f.a) * f.r, f.y + Math.sin(this.t * 1.3 + f.r) * 0.02, f.cz + Math.sin(f.a) * f.r * 0.7);
      f.m.rotation.y = -f.a + (f.sp > 0 ? 0 : Math.PI);
    }
    if (this.water) this.water.position.y = 0.16 + Math.sin(this.t * 0.8) * 0.006;
    if (this.ripple) {
      this.ripple.t += dt;
      const k = 1 + this.ripple.t * 2.2;
      this.ripple.m.scaling.set(k, 1, k);
      this.rippleMat.alpha = Math.max(0, 0.7 - this.ripple.t * 0.35);
      if (this.ripple.t > 2) { this.ripple.m.dispose(); this.ripple = null; }
    }
  }

  // ---------- tích lũy mảnh cho station hiện tại ----------
  private box(w: number, h: number, d: number, x: number, y: number, z: number, hex: string, yaw = 0) { const p = boxPiece(w, h, d, color4(hex)); p.position.set(x, y, z); p.rotation.y = yaw; this.pieces.push(p); }
  private sph(dia: number, x: number, y: number, z: number, hex: string, sy = 1) { const p = sphPiece(dia, color4(hex), 5); p.position.set(x, y, z); p.scaling.y = sy; this.pieces.push(p); }
  private cyl(dia: number, h: number, x: number, y: number, z: number, hex: string, top?: number) { const p = cylPiece(dia, h, 6, color4(hex), top); p.position.set(x, y, z); this.pieces.push(p); }
  /** Dựng lại một station nếu chữ ký đổi. */
  private station(id: string, sig: string, draw: () => void) {
    if (this.sigs.get(id) === sig) return;
    this.sigs.set(id, sig);
    for (const m of this.meshes.get(id) ?? []) m.dispose();
    this.pieces = [];
    draw();
    const out = this.pieces.length ? mergePieces(this.scene, `lab_${id}`, this.pieces) : [];
    for (const m of out) { m.material = this.vcMat; m.freezeWorldMatrix(); }
    this.meshes.set(id, out);
    this.pieces = [];
  }

  private rebuild(s: GameState) {
    const l = s.labour!;
    for (const p of PROPS) {
      if (p.kind === 'garden_bed') { const plot = l.plots.find((x) => x.id === p.meta?.plot)!; this.station(p.id, `${plot.stage}|${plot.cycleId}`, () => this.plot(p, plot)); }
      else if (p.kind === 'flower_patch') { const patch = l.patches.find((x) => x.id === p.meta?.patch)!; this.station(p.id, patch.state, () => this.patch(p, patch)); }
      else if (p.kind === 'clean_spot') { const dirty = s.minute - (l.cleanSpots[String(p.meta?.spot)] ?? 0) >= 24 * 60; this.station(p.id, String(dirty), () => this.dirt(p, dirty)); }
      else if (p.kind === 'nursery_bench') { const n = Math.min(6, l.nurseryTrays); this.station(p.id, String(n), () => this.nursery(p, n)); }
      else if (p.kind === 'wood_bench') { const st = this.woodStage(s); this.station(p.id, st, () => this.wip(p, st)); }
      else if (p.kind === 'stock_shelf') { const n = this.shelfCount(p, s); this.station(p.id, String(n), () => this.shelf(p, n)); }
      else if (p.kind === 'pond') this.pond(p, s);
    }
  }

  // ---------- luống rau theo giai đoạn ----------
  private plot(p: PropDef, plot: LabourPlot) {
    const soil = plot.stage === 'empty' ? '#7a6248' : plot.stage === 'harvested' ? '#6e5a44' : '#4f3b2a';
    this.box(p.w - 0.24, 0.22, p.d - 0.24, p.x, 0.12, p.z, soil);
    if (plot.stage === 'prepared' || plot.stage === 'sown') for (const dx of [-0.32, 0, 0.32]) this.box(0.08, 0.03, p.d - 0.5, p.x + dx, 0.245, p.z, '#3a2a1e');
    const n = 9;
    for (const dx of [-0.32, 0.32]) for (let i = 0; i < n; i++) {
      const z = p.z - p.d / 2 + 0.55 + i * ((p.d - 1.1) / (n - 1));
      const x = p.x + dx + ((hash32(`${plot.cycleId}${i}${dx}`) % 7) - 3) * 0.012;
      switch (plot.stage) {
        case 'sown': this.box(0.05, 0.02, 0.05, x, 0.25, z, '#c9b07a'); break;
        case 'seedling': this.cyl(0.02, 0.1, x, 0.29, z, '#6f9a4a'); this.sph(0.08, x, 0.35, z, '#7fb35a', 0.5); break;
        case 'growing': this.cyl(0.03, 0.12, x, 0.29, z, '#5f8a40'); this.sph(0.22, x, 0.36, z, i % 2 ? '#5f9a48' : '#6aa652', 0.7); break;
        case 'ready': this.cyl(0.04, 0.12, x, 0.29, z, '#5f8a40'); this.sph(0.34, x, 0.42, z, i % 3 ? '#4f8f3e' : '#5fa04a', 0.75); this.sph(0.2, x, 0.55, z, '#7fbf5f', 0.6); break;
        case 'harvested': this.cyl(0.03, 0.05, x, 0.26, z, '#9a8a5a'); break;
      }
    }
  }

  // ---------- ô cảnh quan: trước (cỏ dại) / sau (hoa theo mẫu) ----------
  private patch(p: PropDef, patch: LabourPatch) {
    const seed = hash32(p.id);
    if (patch.state === 'need_care') {
      for (let i = 0; i < 16; i++) {
        const x = p.x + (((seed >> i) % 19) / 19 - 0.5) * (p.w - 0.5), z = p.z + (((seed >> (i + 3)) % 17) / 17 - 0.5) * (p.d - 0.5);
        this.cyl(0.12, 0.35 + (i % 4) * 0.08, x, 0.28, z, i % 3 ? '#6b7a3a' : '#8a8a4a', 0.01);
      }
      for (let i = 0; i < 4; i++) this.box(0.25, 0.04, 0.12, p.x - 0.6 + i * 0.4, 0.15, p.z + 0.7 - (i % 2) * 1.2, '#8a6a3a', i);
      return;
    }
    if (patch.state === 'weeded') { for (let i = 0; i < 3; i++) this.box(0.4, 0.1, 0.4, p.x - 0.6 + i * 0.6, 0.17, p.z, '#4a3626'); return; }
    const colors = ['#d9534f', '#f0c04a', '#9b6bd1', '#f08a5a'];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const x = p.x - 0.7 + i * 0.7, z = p.z - 0.7 + j * 0.7;
      this.cyl(0.03, 0.32, x, 0.3, z, '#4f7a3a');
      this.sph(0.3, x, 0.42, z, '#5f8a48', 0.5);
      this.sph(0.16, x, 0.5, z, colors[(i + j + (seed % 4)) % 4], 0.8);
    }
    if (patch.state === 'awaiting_check') this.box(0.05, 0.6, 0.05, p.x + p.w / 2 - 0.1, 0.3, p.z - p.d / 2 + 0.1, '#e5bc79');
  }

  private dirt(p: PropDef, dirty: boolean) {
    if (!dirty) return;
    const c = cylPiece(1.5, 0.006, 14, color4('#4a4436')); c.position.set(p.x, 0.012, p.z); this.pieces.push(c);
    for (let i = 0; i < 7; i++) this.box(0.12, 0.01, 0.06, p.x + Math.cos(i * 2.1) * 0.5, 0.02, p.z + Math.sin(i * 2.1) * 0.45, i % 2 ? '#8a6a3a' : '#a07a3a', i);
    this.box(0.14, 0.08, 0.1, p.x + 0.3, 0.04, p.z - 0.2, '#d6d2c4');
  }

  private nursery(p: PropDef, n: number) {
    for (let i = 0; i < n; i++) {
      const x = p.x - p.w / 2 + 0.4 + i * 0.62;
      this.box(0.5, 0.08, 0.36, x, 0.89, p.z, '#9b7f5c');
      for (let k = 0; k < 6; k++) this.sph(0.07, x - 0.18 + (k % 3) * 0.18, 0.96, p.z - 0.08 + Math.floor(k / 3) * 0.16, '#7fb35a', 0.6);
    }
  }

  private woodStage(s: GameState): string {
    const l = s.labour!;
    const a = l.assignments.find((x) => x.workId === 'W08' && ['assigned', 'active', 'completed'].includes(x.state));
    return (a && l.orders.find((x) => x.id === a.target)?.stage) ?? 'none';
  }
  /** WIP trên bàn mộc theo bước của lệnh đang làm. */
  private wip(p: PropDef, stage: string) {
    const top = 0.92;
    const wood = stage === 'finished' ? '#e2c48e' : '#d2b27c';
    if (stage === 'blank' || stage === 'marked' || stage === 'rework') {
      for (let i = 0; i < 5; i++) this.box(0.42, 0.025, 0.09, p.x - 0.2, top + 0.015 + i * 0.026, p.z - 0.15 + (i % 2) * 0.02, i % 2 ? '#d2b27c' : '#c9a86f');
      this.box(0.3, 0.02, 0.08, p.x + 0.35, top + 0.01, p.z + 0.1, '#d2b27c');
      if (stage === 'marked') for (let i = 0; i < 3; i++) this.box(0.005, 0.002, 0.08, p.x - 0.32 + i * 0.12, top + 0.14, p.z - 0.15, '#2b2b2b');
    }
    if (stage === 'assembled' || stage === 'finished' || stage === 'awaiting_check') {
      this.box(0.4, 0.02, 0.3, p.x, top + 0.02, p.z, wood);
      this.box(0.4, 0.08, 0.02, p.x, top + 0.06, p.z - 0.14, wood); this.box(0.4, 0.08, 0.02, p.x, top + 0.06, p.z + 0.14, wood);
      this.box(0.02, 0.08, 0.26, p.x - 0.19, top + 0.06, p.z, wood); this.box(0.02, 0.08, 0.26, p.x + 0.19, top + 0.06, p.z, wood);
    }
  }

  private shelfKind(p: PropDef) { return p.id.endsWith('0') ? 'veg' : p.id.endsWith('1') ? 'fish' : 'tray'; }
  private shelfCount(p: PropDef, s: GameState) { const kind = this.shelfKind(p); return Math.min(8, s.labour!.batches.filter((b) => b.kind === kind && b.state !== 'pending_check').length + (kind === 'veg' ? 1 : 0)); }
  /** Kệ kho hiển thị lô đã nhận gần đây. */
  private shelf(p: PropDef, n: number) {
    const kind = this.shelfKind(p);
    for (let i = 0; i < n; i++) {
      const lvl = Math.floor(i / 4), col = i % 4;
      const x = p.x - p.w / 2 + 0.4 + col * 0.72, y = 0.12 + lvl * 0.6 + 0.16;
      if (kind === 'veg') { this.box(0.55, 0.26, 0.42, x, y, p.z, '#4f6b8a'); this.sph(0.4, x, y + 0.14, p.z, '#5f9a48', 0.45); }
      else if (kind === 'fish') this.box(0.55, 0.26, 0.42, x, y, p.z, '#d6dadc');
      else { this.box(0.4, 0.08, 0.3, x, y - 0.08, p.z, '#e2c48e'); this.box(0.4, 0.08, 0.3, x, y + 0.02, p.z, '#d2b27c'); }
    }
  }

  private pond(p: PropDef, s: GameState) {
    if (!this.water) {
      const w = MeshBuilder.CreateGround(`water_${p.id}`, { width: p.w, height: p.d }, this.scene);
      const m = new StandardMaterial('lab_water', this.scene); m.diffuseColor = Color3.FromHexString('#3f7f8f'); m.emissiveColor = Color3.FromHexString('#3f7f8f').scale(0.2); m.alpha = 0.62; m.specularColor = new Color3(0.2, 0.2, 0.2);
      w.material = m; w.position.set(p.x, 0.16, p.z); w.isPickable = false;
      this.water = w;
    }
    const pond = s.labour!.pond;
    const count = pond.stage === 'restock_ready' ? 0 : pond.stage === 'harvest_ready' ? 14 : 10;
    const sig = `${count}|${pond.cohortNo}`;
    if (sig !== this.fishSig) {
      this.fishSig = sig;
      for (const f of this.fish) f.m.dispose();
      this.fish = [];
      for (let i = 0; i < count; i++) {
        const m = MeshBuilder.CreateSphere(`fish_${i}`, { diameter: 0.42, segments: 4 }, this.scene);
        m.scaling.set(0.45, 0.4, 1); m.material = this.fishMat; m.isPickable = false;
        this.fish.push({ m, r: 1.2 + (i % 4) * 1.1, a: i * 0.9, sp: (i % 2 ? 1 : -1) * (0.25 + (i % 3) * 0.08), cx: p.x + ((i % 3) - 1) * 2.5, cz: p.z + ((i % 2) - 0.5) * 2.4, y: 0.11 });
      }
    }
    if (this.lastCare >= 0 && pond.careEvents > this.lastCare) {
      this.ripple?.m.dispose();
      const r = MeshBuilder.CreateTorus('ripple', { diameter: 0.6, thickness: 0.03, tessellation: 20 }, this.scene);
      r.position.set(p.x, 0.18, p.z + p.d / 2 - 1.4); r.material = this.rippleMat; this.rippleMat.alpha = 0.7;
      this.ripple = { m: r, t: 0 };
    }
    this.lastCare = pond.careEvents;
  }

  dispose() { for (const ms of this.meshes.values()) for (const m of ms) m.dispose(); for (const f of this.fish) f.m.dispose(); this.meshes.clear(); }
}
