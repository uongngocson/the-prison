// PhysicsPort — kinematic capsule (XZ circle) vs static AABB colliders, fixed step, headless.
// ADR02 đề xuất Rapier sau adapter; bản này cài đặt cùng PhysicsPort bằng adapter AABB thuần TS để
// chạy được headless/test và giữ domain độc lập engine. Có thể thay adapter Rapier sau Phase 0.
import type { Vec3 } from '../domain/types';
import { PROPS, WALLS } from '../content/world';

export type ColliderTag = 'wall' | 'prop' | 'door';
export interface Aabb { id: string; tag: ColliderTag; minX: number; maxX: number; minZ: number; maxZ: number; h: number; enabled: boolean }

export interface PhysicsPort {
  moveCharacter(pos: Vec3, dx: number, dz: number, radius: number): Vec3;
  raycast(ax: number, az: number, bx: number, bz: number, tags?: ColliderTag[], ignoreId?: string): number;
  setDoor(doorId: string, closed: boolean): void;
  overlaps(x: number, z: number, r: number): boolean;
  segmentClear(ax: number, az: number, bx: number, bz: number, pad: number): boolean;
}

const CELL = 4;
const WALL_T = 0.2;

export class AabbPhysics implements PhysicsPort {
  colliders: Aabb[] = [];
  private grid = new Map<string, Aabb[]>();
  private doors = new Map<string, Aabb>();

  constructor() {
    for (const w of WALLS) {
      const a: Aabb = {
        id: w.doorId ?? `wall_${this.colliders.length}`,
        tag: w.doorId ? 'door' : 'wall',
        minX: Math.min(w.x0, w.x1) - WALL_T / 2,
        maxX: Math.max(w.x0, w.x1) + WALL_T / 2,
        minZ: Math.min(w.z0, w.z1) - WALL_T / 2,
        maxZ: Math.max(w.z0, w.z1) + WALL_T / 2,
        h: w.h,
        enabled: !w.doorId,
      };
      this.add(a);
      if (w.doorId) this.doors.set(w.doorId, a);
    }
    for (const p of PROPS) {
      if (!p.collider) continue;
      const c = Math.abs(Math.cos(p.yaw));
      const s = Math.abs(Math.sin(p.yaw));
      const hx = (p.w * c + p.d * s) / 2;
      const hz = (p.w * s + p.d * c) / 2;
      this.add({ id: p.id, tag: 'prop', minX: p.x - hx, maxX: p.x + hx, minZ: p.z - hz, maxZ: p.z + hz, h: p.h, enabled: true });
    }
  }

  private add(a: Aabb) {
    this.colliders.push(a);
    for (let gx = Math.floor(a.minX / CELL); gx <= Math.floor(a.maxX / CELL); gx++)
      for (let gz = Math.floor(a.minZ / CELL); gz <= Math.floor(a.maxZ / CELL); gz++) {
        const k = `${gx},${gz}`;
        let arr = this.grid.get(k);
        if (!arr) this.grid.set(k, (arr = []));
        arr.push(a);
      }
  }

  private near(minX: number, maxX: number, minZ: number, maxZ: number): Aabb[] {
    const out = new Set<Aabb>();
    for (let gx = Math.floor(minX / CELL); gx <= Math.floor(maxX / CELL); gx++)
      for (let gz = Math.floor(minZ / CELL); gz <= Math.floor(maxZ / CELL); gz++) {
        const arr = this.grid.get(`${gx},${gz}`);
        if (arr) for (const a of arr) if (a.enabled) out.add(a);
      }
    return [...out];
  }

  setDoor(doorId: string, closed: boolean) {
    const d = this.doors.get(doorId);
    if (d) d.enabled = closed;
  }

  overlaps(x: number, z: number, r: number): boolean {
    for (const a of this.near(x - r, x + r, z - r, z + r)) {
      const cx = Math.max(a.minX, Math.min(x, a.maxX));
      const cz = Math.max(a.minZ, Math.min(z, a.maxZ));
      if ((x - cx) ** 2 + (z - cz) ** 2 < r * r - 1e-6) return true;
    }
    return false;
  }

  /** Sweep + slide: sub-steps ≤ r/2, resolve penetration per collider (no tunneling at 30 Hz). */
  moveCharacter(pos: Vec3, dx: number, dz: number, r: number): Vec3 {
    const len = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(len / (r * 0.5)));
    let x = pos.x;
    let z = pos.z;
    for (let i = 0; i < steps; i++) {
      x += dx / steps;
      z += dz / steps;
      for (let iter = 0; iter < 3; iter++) {
        let moved = false;
        for (const a of this.near(x - r, x + r, z - r, z + r)) {
          const cx = Math.max(a.minX, Math.min(x, a.maxX));
          const cz = Math.max(a.minZ, Math.min(z, a.maxZ));
          let ox = x - cx;
          let oz = z - cz;
          const d2 = ox * ox + oz * oz;
          if (d2 >= r * r) continue;
          if (d2 < 1e-10) {
            // center inside box: push out along smallest axis
            const pl = x - a.minX, pr = a.maxX - x, pd = z - a.minZ, pu = a.maxZ - z;
            const m = Math.min(pl, pr, pd, pu);
            if (m === pl) x = a.minX - r; else if (m === pr) x = a.maxX + r; else if (m === pd) z = a.minZ - r; else z = a.maxZ + r;
          } else {
            const d = Math.sqrt(d2);
            ox /= d; oz /= d;
            x = cx + ox * r;
            z = cz + oz * r;
          }
          moved = true;
        }
        if (!moved) break;
      }
    }
    if (!Number.isFinite(x) || !Number.isFinite(z)) return { ...pos };
    return { x, y: pos.y, z };
  }

  /** Returns hit fraction t∈[0,1] (1 = clear). Slab test against AABBs. */
  raycast(ax: number, az: number, bx: number, bz: number, tags?: ColliderTag[], ignoreId?: string): number {
    const dx = bx - ax;
    const dz = bz - az;
    let best = 1;
    for (const a of this.near(Math.min(ax, bx), Math.max(ax, bx), Math.min(az, bz), Math.max(az, bz))) {
      if (tags && !tags.includes(a.tag)) continue;
      if (ignoreId && a.id === ignoreId) continue;
      let t0 = 0;
      let t1 = 1;
      const slab = (p: number, d: number, lo: number, hi: number) => {
        if (Math.abs(d) < 1e-9) return p >= lo && p <= hi;
        let ta = (lo - p) / d;
        let tb = (hi - p) / d;
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta);
        t1 = Math.min(t1, tb);
        return t0 <= t1;
      };
      if (slab(ax, dx, a.minX, a.maxX) && slab(az, dz, a.minZ, a.maxZ) && t0 < best) best = t0;
    }
    return best;
  }

  segmentClear(ax: number, az: number, bx: number, bz: number, pad: number): boolean {
    // Approximate capsule sweep by offset rays.
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const nx = (-(bz - az) / len) * pad;
    const nz = ((bx - ax) / len) * pad;
    return (
      this.raycast(ax, az, bx, bz) >= 1 &&
      this.raycast(ax + nx, az + nz, bx + nx, bz + nz) >= 1 &&
      this.raycast(ax - nx, az - nz, bx - nx, bz - nz) >= 1
    );
  }
}
