// NavPort: logical zone graph + in-room waypoint routing validated by PhysicsPort segment checks.
// (01: offline navmesh binding chưa xác minh — đây là adapter graph đơn giản cùng interface path query.)
import type { Vec3, ZoneId } from '../domain/types';
import { CELL_ROOMS, ZONE_BY_ID, doorNodes, zoneCenter, type SlotDef } from '../content/world';
import type { PhysicsPort } from '../physics/physics';

const v = (x: number, z: number): Vec3 => ({ x, y: 0, z });

export function cellOf(pos: Vec3): (typeof CELL_ROOMS)[number] | null {
  const z0 = ZONE_BY_ID.L02.z0;
  const L2 = ZONE_BY_ID.L02;
  if (pos.x < L2.x0 || pos.x > L2.x1 || pos.z < L2.z0 || pos.z > L2.z1) return null;
  for (const c of CELL_ROOMS) {
    const halfW = c.inward === 1 ? 26 / 12 : 3;
    if (Math.abs(pos.x - c.door.x) > halfW) continue;
    if (c.inward === 1 && pos.z > z0 + 8.05) return c;
    if (c.inward === -1 && pos.z < z0 + 4.95) return c;
  }
  return null;
}
export function cellForSlot(slot: SlotDef) {
  if (!slot.propId) return null;
  return CELL_ROOMS.find((c) => c.beds.includes(slot.propId!) || c.locker === slot.propId) ?? null;
}
function cellExit(c: (typeof CELL_ROOMS)[number]): Vec3[] {
  return [v(c.door.x, c.door.z + c.inward * 1.4), v(c.door.x, c.door.z + c.inward * 0.6), v(c.door.x, c.door.z - c.inward * 0.8)];
}

export function slotApproach(slot: SlotDef): Vec3 {
  if (slot.pose === 'stand' || slot.kind === 'walk') return { ...slot.pos };
  const fx = Math.sin(slot.yaw);
  const fz = Math.cos(slot.yaw);
  return v(slot.pos.x - fx * 0.7, slot.pos.z - fz * 0.7);
}

/** Route within one room from a to b avoiding colliders when possible. */
export function roomRoute(phys: PhysicsPort, zone: ZoneId, a: Vec3, b: Vec3): Vec3[] {
  const pad = 0.3;
  const clear = (p: Vec3, q: Vec3) => phys.segmentClear(p.x, p.z, q.x, q.z, pad);
  if (clear(a, b)) return [b];
  const c1 = v(a.x, b.z);
  if (clear(a, c1) && clear(c1, b)) return [c1, b];
  const c2 = v(b.x, a.z);
  if (clear(a, c2) && clear(c2, b)) return [c2, b];
  const zd = ZONE_BY_ID[zone];
  for (const ex of [zd.x0 + 0.9, zd.x1 - 0.9]) {
    const p1 = v(ex, a.z);
    const p2 = v(ex, b.z);
    if (clear(a, p1) && clear(p1, p2) && clear(p2, b)) return [p1, p2, b];
  }
  const mid = zoneCenter(zone);
  if (clear(a, mid) && clear(mid, b)) return [mid, b];
  return [b];
}

export interface PathResult { points: Vec3[]; zones: ZoneId[] }

export function pathToSlot(phys: PhysicsPort, from: Vec3, fromZone: ZoneId, slot: SlotDef): PathResult {
  return pathToPoint(phys, from, fromZone, slot.zone, slotApproach(slot), slot);
}

export function pathToPoint(phys: PhysicsPort, from: Vec3, fromZone: ZoneId, toZone: ZoneId, target: Vec3, slot?: SlotDef): PathResult {
  const pts: Vec3[] = [];
  const zones: ZoneId[] = [];
  let cur = { ...from };
  const push = (p: Vec3, z: ZoneId) => { pts.push(p); zones.push(z); cur = p; };

  // leave a cell if inside one and target isn't the same cell
  const inCell = fromZone === 'L02' ? cellOf(from) : null;
  const targetCell = slot && slot.zone === 'L02' ? cellForSlot(slot) : null;
  if (inCell && (!targetCell || targetCell.id !== inCell.id)) for (const p of cellExit(inCell)) push(p, 'L02');

  if (fromZone !== toZone) {
    if (fromZone !== 'L03') {
      const dn = doorNodes(fromZone);
      if (dn) {
        for (const p of roomRoute(phys, fromZone, cur, dn.inside)) push(p, fromZone);
        push(dn.outside, 'L03');
      }
    }
    if (toZone !== 'L03') {
      const dn = doorNodes(toZone)!;
      push(dn.outside, 'L03');
      push(dn.inside, toZone);
    } else {
      push(v(target.x, Math.max(-1, Math.min(1, target.z))), 'L03');
    }
  }
  if (targetCell && (!inCell || inCell.id !== targetCell.id)) {
    const ex = cellExit(targetCell).reverse();
    for (const p of roomRoute(phys, toZone, cur, ex[0])) push(p, toZone);
    push(ex[1], 'L02');
    push(ex[2], 'L02');
    push(target, 'L02');
  } else {
    for (const p of roomRoute(phys, toZone, cur, target)) push(p, toZone);
  }
  if (slot) push({ ...slot.pos }, slot.zone);
  return { points: pts, zones };
}
