// Chế độ Trực tuyến — dựng người chơi khác: avatar Humanoid + tên trên đầu + bong bóng lời. Nội suy vị trí mượt.
import { Color3, DynamicTexture, Mesh, MeshBuilder, Scene, StandardMaterial, TransformNode } from '@babylonjs/core';
import { Humanoid, type Pose } from './characters';
import { stripe } from './palette';
import type { Peer } from '../online/client';

const POSES = new Set<Pose>(['idle', 'walk', 'run', 'crouch', 'sit', 'lie', 'exercise', 'work', 'talk', 'read', 'eat', 'toilet', 'tend', 'water', 'sweep']);

function textPlane(scene: Scene, name: string, w: number, h: number): { mesh: Mesh; tex: DynamicTexture; mat: StandardMaterial } {
  const tex = new DynamicTexture(`tx_${name}`, { width: Math.round(w * 256), height: Math.round(h * 256) }, scene, true);
  tex.hasAlpha = true;
  const mat = new StandardMaterial(`m_${name}`, scene);
  mat.diffuseTexture = tex; mat.emissiveColor = new Color3(1, 1, 1); mat.disableLighting = true; mat.useAlphaFromDiffuseTexture = true; mat.backFaceCulling = false;
  const mesh = MeshBuilder.CreatePlane(name, { width: w, height: h }, scene);
  mesh.material = mat; mesh.billboardMode = Mesh.BILLBOARDMODE_ALL; mesh.isPickable = false;
  // tên/bong bóng luôn đọc được: vẽ sau cùng, không bị cây/tường che (giống nhãn tên trong game)
  mat.disableDepthWrite = true; mesh.renderingGroupId = 1;
  return { mesh, tex, mat };
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  if (lines.length > 2) { lines.length = 2; lines[1] = lines[1].replace(/\s*\S*$/, '') + '…'; }
  return lines;
}

interface Avatar { h: Humanoid; tag: ReturnType<typeof textPlane>; bubble: ReturnType<typeof textPlane>; bubbleText: string; tagText: string; anchor: TransformNode }

export class RemotePlayers {
  private avatars = new Map<string, Avatar>();
  private selfBubble: ReturnType<typeof textPlane> | null = null;
  private selfText = '';
  constructor(private scene: Scene) {}

  update(dt: number, peers: Map<string, Peer>, cam: { x: number; z: number }, cull: number, reducedMotion: boolean, blocked: (id: string) => boolean) {
    const now = performance.now();
    for (const [id, a] of this.avatars) if (!peers.has(id)) { this.dispose(a); this.avatars.delete(id); }
    for (const [id, p] of peers) {
      if (!p.pos || !p.target) { const old = this.avatars.get(id); if (old) { old.h.setVisible(false); old.tag.mesh.setEnabled(false); old.bubble.mesh.setEnabled(false); } continue; }
      let a = this.avatars.get(id);
      if (!a) a = this.create(id, p);
      // nội suy mượt về vị trí mới nhất (8 Hz → 60 fps)
      const k = Math.min(1, dt * 6); // gói có thể thưa (1–8 Hz theo số người) → nội suy mềm
      const dx = p.target.x - p.pos.x, dz = p.target.z - p.pos.z;
      const jump = Math.hypot(dx, dz) > 6;
      p.pos.x = jump ? p.target.x : p.pos.x + dx * k;
      p.pos.z = jump ? p.target.z : p.pos.z + dz * k;
      let dy = p.target.yaw - p.pos.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      p.pos.yaw += dy * k;
      const far = Math.hypot(p.pos.x - cam.x, p.pos.z - cam.z) > cull;
      a.h.setVisible(!far);
      a.tag.mesh.setEnabled(!far);
      if (far) { a.bubble.mesh.setEnabled(false); continue; }
      a.h.root.position.set(p.pos.x, 0, p.pos.z);
      a.h.root.rotation.y = p.pos.yaw;
      const moving = Math.hypot(dx, dz) * POS_SPEED;
      const pose = (POSES.has(p.pose as Pose) ? p.pose : 'idle') as Pose;
      a.h.animate(dt, pose === 'idle' && moving > 0.3 ? 'walk' : pose, moving, reducedMotion);
      a.anchor.position.set(p.pos.x, 0, p.pos.z);
      // kích thước trên màn hình gần như cố định: gần camera thì thu nhỏ (trước đây phình to che kín màn hình), quá sát thì ẩn
      const dCam = Math.hypot(p.pos.x - cam.x, p.pos.z - cam.z);
      const sc = Math.max(0.3, Math.min(1, dCam / LABEL_REF_DIST));
      a.tag.mesh.scaling.setAll(sc); a.bubble.mesh.scaling.setAll(sc);
      a.tag.mesh.position.y = 2.0 + 0.12 * sc; a.bubble.mesh.position.y = 2.1 + 0.42 * sc;
      a.tag.mesh.setEnabled(dCam > 1.4);
      // tên
      const tagText = `${p.meta.name}`;
      if (tagText !== a.tagText) { a.tagText = tagText; this.drawTag(a.tag.tex, tagText); }
      // bong bóng lời
      const bubble = p.bubble && p.bubble.until > now && !blocked(id) ? p.bubble.text : '';
      if (bubble !== a.bubbleText) { a.bubbleText = bubble; if (bubble) this.drawBubble(a.bubble.tex, bubble); }
      a.bubble.mesh.setEnabled(!!bubble && dCam > 1.4);
    }
  }

  /** Bong bóng lời của chính người chơi (để biết tin đã gửi). */
  updateSelf(pos: { x: number; z: number } | null, bubble: { text: string; until: number } | null) {
    const text = bubble && bubble.until > performance.now() ? bubble.text : '';
    if (!this.selfBubble) { this.selfBubble = textPlane(this.scene, 'self_bubble', 2.4, 0.9); this.selfBubble.mesh.setEnabled(false); }
    if (text !== this.selfText) { this.selfText = text; if (text) this.drawBubble(this.selfBubble.tex, text); }
    this.selfBubble.mesh.setEnabled(false); // dòng chat ở góc trái đã hiển thị tin của bạn; tránh che khung nhìn sau lưng
    void text;
    if (pos) this.selfBubble.mesh.position.set(pos.x, 2.75, pos.z);
  }

  private create(id: string, p: Peer): Avatar {
    const h = new Humanoid(this.scene, `rp_${id}`, p.meta.look, stripe(p.meta.outfit ?? p.meta.look.outfit ?? 0));
    const anchor = new TransformNode(`rpa_${id}`, this.scene);
    const tag = textPlane(this.scene, `rptag_${id}`, 1.1, 0.22);
    tag.mesh.parent = anchor; tag.mesh.position.y = 2.18;
    const bubble = textPlane(this.scene, `rpbub_${id}`, 1.7, 0.56);
    bubble.mesh.parent = anchor; bubble.mesh.position.y = 2.75; bubble.mesh.setEnabled(false);
    const a: Avatar = { h, tag, bubble, bubbleText: '', tagText: '', anchor };
    this.avatars.set(id, a);
    return a;
  }
  private drawTag(tex: DynamicTexture, text: string) {
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    const { width: W, height: H } = tex.getSize();
    ctx.clearRect(0, 0, W, H);
    ctx.font = `700 ${Math.round(H * 0.5)}px "Noto Sans", "Segoe UI", sans-serif`;
    const tw = Math.min(W - 8, ctx.measureText(text).width + H * 0.7);
    ctx.fillStyle = 'rgba(16,28,32,0.82)'; roundRect(ctx, (W - tw) / 2, H * 0.08, tw, H * 0.84, H * 0.4); ctx.fill();
    ctx.fillStyle = '#7fd6a0'; ctx.beginPath(); ctx.arc((W - tw) / 2 + H * 0.32, H / 2, H * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f0f1e9'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2 + H * 0.12, H / 2 + 1, tw - H * 0.6);
    tex.update();
  }
  private drawBubble(tex: DynamicTexture, text: string) {
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    const { width: W, height: H } = tex.getSize();
    ctx.clearRect(0, 0, W, H);
    const fs = Math.round(H * 0.24);
    ctx.font = `600 ${fs}px "Noto Sans", "Segoe UI", sans-serif`;
    const lines = wrap(ctx, text, W * 0.86);
    const bh = lines.length * fs * 1.25 + fs * 0.9;
    const bw = Math.min(W - 6, Math.max(...lines.map((l) => ctx.measureText(l).width)) + fs * 1.4);
    const x = (W - bw) / 2, y = H - bh - H * 0.12;
    ctx.fillStyle = 'rgba(245,244,236,0.96)'; roundRect(ctx, x, y, bw, bh, fs * 0.6); ctx.fill();
    ctx.beginPath(); ctx.moveTo(W / 2 - fs * 0.4, y + bh - 1); ctx.lineTo(W / 2, H - 2); ctx.lineTo(W / 2 + fs * 0.4, y + bh - 1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1b1b1b'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, W / 2, y + fs * 0.45 + i * fs * 1.25));
    tex.update();
  }
  private dispose(a: Avatar) { a.h.dispose(); a.tag.mesh.dispose(); a.tag.tex.dispose(); a.tag.mat.dispose(); a.bubble.mesh.dispose(); a.bubble.tex.dispose(); a.bubble.mat.dispose(); a.anchor.dispose(); }
  disposeAll() { for (const a of this.avatars.values()) this.dispose(a); this.avatars.clear(); this.selfBubble?.mesh.dispose(); this.selfBubble = null; }
}
const POS_SPEED = 3; // hệ số chuyển khoảng cách còn lại → tốc độ animation đi bộ
/** Khoảng cách camera (m) mà nhãn tên/bong bóng hiển thị đủ kích thước; gần hơn thì thu nhỏ tương ứng. */
const LABEL_REF_DIST = 7;
