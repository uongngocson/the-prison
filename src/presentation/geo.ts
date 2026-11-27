// Gộp hình học nhanh: tích lũy "mảnh" (hộp/trụ/cầu/mesh có sẵn) rồi ghi thẳng vào một buffer vertex-color.
// Không tạo hàng nghìn Mesh trung gian (mỗi Mesh = GPU buffer + scene graph + dispose) — nguyên nhân chính làm loading treo.
import { Color3, Color4, Matrix, Mesh, Quaternion, Scene, Vector3, VertexBuffer, VertexData, CreateBoxVertexData, CreateCylinderVertexData, CreateSphereVertexData } from '@babylonjs/core';

export interface Piece { position: Vector3; rotation: Vector3; scaling: Vector3; color: Color4; data: () => VertexData; mesh?: Mesh }

const colorCache = new Map<string, Color4>();
export function color4(hex: string, mul = 1): Color4 {
  const key = `${hex}|${mul}`;
  let c = colorCache.get(key);
  if (!c) { const b = Color3.FromHexString(hex); c = new Color4(Math.min(1, b.r * mul), Math.min(1, b.g * mul), Math.min(1, b.b * mul), 1); colorCache.set(key, c); }
  return c;
}

const vdCache = new Map<string, VertexData>();
function cached(key: string, make: () => VertexData): () => VertexData { return () => { let v = vdCache.get(key); if (!v) { v = make(); vdCache.set(key, v); } return v; }; }

export function boxPiece(w: number, h: number, d: number, color: Color4): Piece {
  return { position: new Vector3(), rotation: new Vector3(), scaling: new Vector3(1, 1, 1), color, data: cached(`b${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}`, () => CreateBoxVertexData({ width: w, height: h, depth: d })) };
}
export function cylPiece(dia: number, h: number, tess: number, color: Color4, diaTop?: number): Piece {
  return { position: new Vector3(), rotation: new Vector3(), scaling: new Vector3(1, 1, 1), color, data: cached(`c${dia}|${diaTop ?? dia}|${h}|${tess}`, () => CreateCylinderVertexData({ diameterBottom: dia, diameterTop: diaTop ?? dia, height: h, tessellation: tess })) };
}
export function sphPiece(dia: number, color: Color4, segments = 6): Piece {
  return { position: new Vector3(), rotation: new Vector3(), scaling: new Vector3(1, 1, 1), color, data: cached(`s${dia}|${segments}`, () => CreateSphereVertexData({ diameter: dia, segments })) };
}
/** Mesh tạo bằng MeshBuilder (torus/ground…) — được nướng vào buffer rồi giải phóng. */
export function meshPiece(m: Mesh): Piece {
  return { position: m.position, rotation: m.rotation, scaling: m.scaling, color: new Color4(1, 1, 1, 1), data: () => new VertexData(), mesh: m };
}

const M = new Matrix(), N = new Matrix(), Q = new Quaternion(), T = new Vector3();
/** Gộp các mảnh thành một hoặc nhiều Mesh (≤ maxVerts mỗi mesh). */
export function mergePieces(scene: Scene, name: string, pieces: Piece[], maxVerts = 120000): Mesh[] {
  const out: Mesh[] = [];
  let start = 0;
  while (start < pieces.length) {
    // đếm đỉnh cho chunk
    let nv = 0, ni = 0, end = start;
    while (end < pieces.length) {
      const p = pieces[end];
      const v = p.mesh ? p.mesh.getTotalVertices() : p.data().positions!.length / 3;
      const i = p.mesh ? (p.mesh.getIndices()?.length ?? 0) : p.data().indices!.length;
      if (nv > 0 && nv + v > maxVerts) break;
      nv += v; ni += i; end++;
    }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 4);
    const idx = new Uint32Array(ni);
    let vo = 0, io = 0;
    for (let k = start; k < end; k++) {
      const p = pieces[k];
      let P: ArrayLike<number>, Nn: ArrayLike<number>, I: ArrayLike<number>, C: ArrayLike<number> | null = null;
      if (p.mesh) {
        p.mesh.computeWorldMatrix(true);
        M.copyFrom(p.mesh.getWorldMatrix());
        P = p.mesh.getVerticesData(VertexBuffer.PositionKind) ?? []; Nn = p.mesh.getVerticesData(VertexBuffer.NormalKind) ?? []; I = p.mesh.getIndices() ?? [];
        C = p.mesh.getVerticesData(VertexBuffer.ColorKind);
      } else {
        const vd = p.data();
        P = vd.positions!; Nn = vd.normals!; I = vd.indices!;
        Quaternion.RotationYawPitchRollToRef(p.rotation.y, p.rotation.x, p.rotation.z, Q);
        Matrix.ComposeToRef(p.scaling, Q, p.position, M);
      }
      M.invertToRef(N); N.transposeToRef(N);
      const n = P.length / 3;
      for (let i = 0; i < n; i++) {
        Vector3.TransformCoordinatesFromFloatsToRef(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], M, T);
        pos[(vo + i) * 3] = T.x; pos[(vo + i) * 3 + 1] = T.y; pos[(vo + i) * 3 + 2] = T.z;
        Vector3.TransformNormalFromFloatsToRef(Nn[i * 3] ?? 0, Nn[i * 3 + 1] ?? 1, Nn[i * 3 + 2] ?? 0, N, T);
        T.normalize();
        nor[(vo + i) * 3] = T.x; nor[(vo + i) * 3 + 1] = T.y; nor[(vo + i) * 3 + 2] = T.z;
        if (C) { col[(vo + i) * 4] = C[i * 4]; col[(vo + i) * 4 + 1] = C[i * 4 + 1]; col[(vo + i) * 4 + 2] = C[i * 4 + 2]; col[(vo + i) * 4 + 3] = 1; }
        else { col[(vo + i) * 4] = p.color.r; col[(vo + i) * 4 + 1] = p.color.g; col[(vo + i) * 4 + 2] = p.color.b; col[(vo + i) * 4 + 3] = 1; }
      }
      // mesh có định thức âm (scale âm) → đảo chiều tam giác
      const flip = M.determinant() < 0;
      for (let i = 0; i < I.length; i += 3) {
        idx[io + i] = I[i] + vo;
        idx[io + i + 1] = (flip ? I[i + 2] : I[i + 1]) + vo;
        idx[io + i + 2] = (flip ? I[i + 1] : I[i + 2]) + vo;
      }
      vo += n; io += I.length;
      if (p.mesh) p.mesh.dispose();
    }
    const mesh = new Mesh(`${name}_${out.length}`, scene);
    const vd = new VertexData();
    vd.positions = pos; vd.normals = nor; vd.colors = col; vd.indices = idx;
    vd.applyToMesh(mesh, false);
    mesh.isPickable = false;
    out.push(mesh);
    start = end;
  }
  return out;
}
/** Nhường luồng chính cho trình duyệt (vẽ thanh loading, nhận input). */
export const yieldFrame = () => new Promise<void>((r) => setTimeout(r, 0));
