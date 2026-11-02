// Procedural humanoids via hardware instancing (per-instance color) — shared "skeleton" layout, body variants,
// pose FSM: locomotion (walk/run/crouch) · sit · lie · exercise · work · talk. Animation chỉ là trình bày (02).
import { Color3, Color4, DynamicTexture, InstancedMesh, Mesh, MeshBuilder, Scene, StandardMaterial, Texture, TransformNode, VertexBuffer } from '@babylonjs/core';
import type { Appearance } from '../domain/types';

import { SKIN, HAIR } from './palette';
export { SKIN, HAIR, RES_OUTFIT, STAFF_OUTFIT, COSMETIC_OUTFIT } from './palette';

export type Pose = 'idle' | 'walk' | 'run' | 'crouch' | 'sit' | 'lie' | 'exercise' | 'work' | 'talk' | 'read' | 'eat' | 'toilet';

interface Sources { torso: Mesh; hips: Mesh; head: Mesh; hair0: Mesh; hair1: Mesh; hair2: Mesh; arm: Mesh; leg: Mesh; eye: Mesh; shadow: Mesh }

let sources: Sources | null = null;
function makeSources(scene: Scene): Sources {
  if (sources && sources.torso.getScene() === scene && !sources.torso.isDisposed()) return sources;
  const mat = new StandardMaterial('mat_char', scene);
  mat.diffuseColor = new Color3(1, 1, 1);
  mat.specularColor = new Color3(0.08, 0.08, 0.08);
  const shadowMat = new StandardMaterial('mat_blob', scene);
  shadowMat.diffuseColor = new Color3(0, 0, 0);
  shadowMat.specularColor = new Color3(0, 0, 0);
  shadowMat.alpha = 0.35;
  shadowMat.disableLighting = true;
  const prep = (m: Mesh, mt = mat) => {
    m.material = mt;
    m.position.y = -1000;
    m.registerInstancedBuffer(VertexBuffer.ColorKind, 4);
    m.instancedBuffers.color = new Color4(1, 1, 1, 1);
    m.isPickable = false;
    return m;
  };
  sources = {
    torso: prep(MeshBuilder.CreateBox('src_torso', { width: 0.42, height: 0.56, depth: 0.24 }, scene)),
    hips: prep(MeshBuilder.CreateBox('src_hips', { width: 0.38, height: 0.18, depth: 0.22 }, scene)),
    head: prep(MeshBuilder.CreateSphere('src_head', { diameter: 0.26, segments: 8 }, scene)),
    hair0: prep(MeshBuilder.CreateSphere('src_hair0', { diameter: 0.28, segments: 8, slice: 0.55 }, scene)),
    hair1: prep(MeshBuilder.CreateBox('src_hair1', { width: 0.27, height: 0.08, depth: 0.27 }, scene)),
    hair2: prep(MeshBuilder.CreateBox('src_hair2', { width: 0.28, height: 0.3, depth: 0.12 }, scene)),
    arm: prep(MeshBuilder.CreateCapsule('src_arm', { radius: 0.055, height: 0.62, tessellation: 6, subdivisions: 1 }, scene)),
    leg: prep(MeshBuilder.CreateCapsule('src_leg', { radius: 0.075, height: 0.84, tessellation: 6, subdivisions: 1 }, scene)),
    eye: prep(MeshBuilder.CreateSphere('src_eye', { diameter: 0.035, segments: 4 }, scene)),
    shadow: prep(MeshBuilder.CreateDisc('src_shadow', { radius: 0.38, tessellation: 16 }, scene), shadowMat),
  };
  sources.shadow.rotation.x = Math.PI / 2;
  return sources;
}

/** Đồng phục kẻ sọc ngang (áo + quần cùng màu sọc), dạng 'stripe:#RRGGBB'. */
type StripePart = 'torso' | 'hips' | 'arm' | 'leg';
const STRIPE_REPEAT: Record<StripePart, number> = { torso: 4.5, hips: 1.5, arm: 5, leg: 7 };
const stripeCache = new Map<string, Mesh>();
let stripeScene: Scene | null = null;
function stripedSource(scene: Scene, part: StripePart, color: string): Mesh {
  if (stripeScene !== scene) { stripeCache.clear(); stripeScene = scene; }
  const key = `${part}|${color}`;
  const hit = stripeCache.get(key);
  if (hit && !hit.isDisposed()) return hit;
  const tex = new DynamicTexture(`tx_stripe_${key}`, { width: 16, height: 64 }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = '#e8e6dc'; ctx.fillRect(0, 0, 16, 64);
  ctx.fillStyle = color; ctx.fillRect(0, 32, 16, 32);
  tex.update();
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  tex.vScale = STRIPE_REPEAT[part];
  tex.updateSamplingMode(Texture.BILINEAR_SAMPLINGMODE);
  const mat = new StandardMaterial(`mat_stripe_${key}`, scene);
  mat.diffuseTexture = tex;
  mat.specularColor = new Color3(0.05, 0.05, 0.05);
  const m = part === 'torso' ? MeshBuilder.CreateBox(`src_st_${key}`, { width: 0.42, height: 0.56, depth: 0.24, wrap: true }, scene)
    : part === 'hips' ? MeshBuilder.CreateBox(`src_st_${key}`, { width: 0.38, height: 0.18, depth: 0.22, wrap: true }, scene)
    : part === 'arm' ? MeshBuilder.CreateCapsule(`src_st_${key}`, { radius: 0.06, height: 0.62, tessellation: 8, subdivisions: 1 }, scene)
    : MeshBuilder.CreateCapsule(`src_st_${key}`, { radius: 0.085, height: 0.84, tessellation: 8, subdivisions: 1 }, scene);
  m.material = mat;
  m.position.y = -1000;
  m.registerInstancedBuffer(VertexBuffer.ColorKind, 4);
  m.instancedBuffers.color = new Color4(1, 1, 1, 1);
  m.isPickable = false;
  stripeCache.set(key, m);
  return m;
}

const c4 = (hex: string) => { const c = Color3.FromHexString(hex); return new Color4(c.r, c.g, c.b, 1); };

export class Humanoid {
  root: TransformNode;
  body: TransformNode;
  private torso: InstancedMesh;
  private hips: InstancedMesh;
  private head: InstancedMesh;
  private hair: InstancedMesh | null = null;
  private armL: TransformNode;
  private armR: TransformNode;
  private legL: TransformNode;
  private legR: TransformNode;
  private shadow: InstancedMesh;
  private parts: InstancedMesh[] = [];
  phase = Math.random() * 6;
  pose: Pose = 'idle';
  private visible = true;
  private outfitHex = '';
  private stripeColor: string | null = null;
  private torsoStripe: InstancedMesh | null = null;
  private armsStripe: InstancedMesh[] = [];
  private armsSolid: InstancedMesh[] = [];

  constructor(scene: Scene, public id: string, look: Appearance, outfitHex: string) {
    const src = makeSources(scene);
    this.root = new TransformNode(`ch_${id}`, scene);
    this.body = new TransformNode(`chb_${id}`, scene);
    this.body.parent = this.root;
    const k = look.body === 'slim' ? 0.9 : look.body === 'broad' ? 1.15 : 1;
    const inst = (m: Mesh, name: string, parent: TransformNode, hex: string) => {
      const i = m.createInstance(`${name}_${id}`);
      i.parent = parent;
      i.instancedBuffers.color = c4(hex);
      i.isPickable = false;
      this.parts.push(i);
      return i;
    };
    const skin = SKIN[look.skin % SKIN.length];
    this.stripeColor = outfitHex.startsWith('stripe:') ? outfitHex.slice(7) : null;
    const solidHex = this.stripeColor ? '#7f97ab' : outfitHex;
    const st = (part: StripePart, name: string, parent: TransformNode) => inst(stripedSource(scene, part, this.stripeColor!), name, parent, '#ffffff');
    this.hips = this.stripeColor ? st('hips', 'hips', this.body) : inst(src.hips, 'hips', this.body, '#3d4246');
    this.hips.position.y = 0.92;
    this.hips.scaling.x = k;
    this.torso = inst(src.torso, 'torso', this.body, solidHex);
    this.torso.position.y = 1.28;
    this.torso.scaling.x = k;
    if (this.stripeColor) {
      this.torsoStripe = st('torso', 'torsost', this.body);
      this.torsoStripe.position.y = 1.28;
      this.torsoStripe.scaling.x = k;
      this.torso.setEnabled(false);
    }
    this.head = inst(src.head, 'head', this.body, skin);
    this.head.position.y = 1.7;
    for (const sx of [-0.055, 0.055]) { const e = inst(src.eye, 'eye', this.head as unknown as TransformNode, '#1b1b1b'); e.position.set(sx, 0.02, 0.115); }
    const hc = HAIR[look.hairColor % HAIR.length];
    if (look.hair === 0) { this.hair = inst(src.hair0, 'hair', this.body, hc); this.hair.position.y = 1.74; }
    else if (look.hair === 1) { this.hair = inst(src.hair1, 'hair', this.body, hc); this.hair.position.y = 1.81; }
    else if (look.hair === 2) { this.hair = inst(src.hair0, 'hair', this.body, hc); this.hair.position.y = 1.74; const b = inst(src.hair2, 'hairb', this.body, hc); b.position.set(0, 1.62, -0.09); }
    const limb = (side: number, isArm: boolean) => {
      const pivot = new TransformNode(`${isArm ? 'arm' : 'leg'}${side}_${id}`, scene);
      pivot.parent = this.body;
      if (isArm) {
        pivot.position.set(side * (0.27 * k), 1.52, 0);
        const a = inst(src.arm, 'arm', pivot, solidHex); a.position.y = -0.3; this.armsSolid.push(a);
        if (this.stripeColor) { const as = st('arm', 'armst', pivot); as.position.y = -0.3; this.armsStripe.push(as); a.setEnabled(false); }
        const h = inst(src.eye, 'hand', pivot, skin); h.scaling.setAll(2.4); h.position.y = -0.62;
      } else {
        pivot.position.set(side * 0.1 * k, 0.88, 0);
        const l = this.stripeColor ? st('leg', 'legst', pivot) : inst(src.leg, 'leg', pivot, '#3d4246');
        l.position.y = -0.42;
      }
      return pivot;
    };
    this.armL = limb(-1, true);
    this.armR = limb(1, true);
    this.legL = limb(-1, false);
    this.legR = limb(1, false);
    this.shadow = inst(src.shadow, 'shadow', this.root, '#000000');
    this.shadow.position.y = 0.012;
    this.shadow.rotation.x = Math.PI / 2;
    this.outfitHex = outfitHex;
  }

  /** 'stripe' = đồng phục sọc; mã màu = trang phục thẩm mỹ (áo trơn, quần vẫn đồng phục). */
  setOutfit(hex: string) {
    if (hex === this.outfitHex) return;
    this.outfitHex = hex;
    const striped = hex === 'stripe' && !!this.stripeColor;
    this.torsoStripe?.setEnabled(striped);
    for (const a of this.armsStripe) a.setEnabled(striped);
    this.torso.setEnabled(!striped || !this.torsoStripe);
    for (const a of this.armsSolid) a.setEnabled(!striped || !this.armsStripe.length);
    if (!striped && hex !== 'stripe') {
      this.torso.instancedBuffers.color = c4(hex);
      for (const a of this.armsSolid) a.instancedBuffers.color = c4(hex);
    }
  }

  setVisible(v: boolean) {
    if (v === this.visible) return;
    this.visible = v;
    this.root.setEnabled(v);
  }

  /** Apply pose. speed m/s for locomotion phase. */
  animate(dt: number, pose: Pose, speed: number, reducedMotion: boolean) {
    this.pose = pose;
    const b = this.body;
    b.rotation.set(0, 0, 0);
    b.position.set(0, 0, 0);
    this.armL.rotation.set(0, 0, 0); this.armR.rotation.set(0, 0, 0);
    this.legL.rotation.set(0, 0, 0); this.legR.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
    this.torso.rotation.set(0, 0, 0);
    this.shadow.setEnabled(pose !== 'lie');
    switch (pose) {
      case 'walk': case 'run': case 'crouch': {
        this.phase += dt * Math.max(2, speed * (pose === 'run' ? 3.2 : 4.2));
        const amp = pose === 'run' ? 0.85 : pose === 'crouch' ? 0.35 : 0.55;
        const s = Math.sin(this.phase);
        this.legL.rotation.x = s * amp; this.legR.rotation.x = -s * amp;
        this.armL.rotation.x = -s * amp * 0.8; this.armR.rotation.x = s * amp * 0.8;
        b.position.y = Math.abs(Math.cos(this.phase)) * (pose === 'run' ? 0.06 : 0.03);
        if (pose === 'run') this.torso.rotation.x = 0.12;
        if (pose === 'crouch') { b.position.y = -0.32; this.legL.rotation.x -= 0.7; this.legR.rotation.x -= 0.7; this.torso.rotation.x = 0.35; }
        break;
      }
      case 'toilet': {
        b.position.y = -0.44;
        this.legL.rotation.x = -1.35; this.legR.rotation.x = -1.35;
        this.legL.rotation.z = -0.08; this.legR.rotation.z = 0.08;
        this.torso.rotation.x = 0.28; this.head.rotation.x = 0.25;
        this.armL.rotation.x = -0.75; this.armR.rotation.x = -0.75; this.armL.rotation.z = 0.12; this.armR.rotation.z = -0.12;
        break;
      }
      case 'sit': case 'eat': case 'read': {
        b.position.y = -0.42;
        this.legL.rotation.x = -1.5; this.legR.rotation.x = -1.5;
        if (pose === 'eat') { this.phase += dt * 3; this.armR.rotation.x = -1.1 - Math.max(0, Math.sin(this.phase)) * 0.5; this.armL.rotation.x = -0.9; }
        else if (pose === 'read') { this.armL.rotation.x = -1.0; this.armR.rotation.x = -1.0; this.armL.rotation.z = 0.25; this.armR.rotation.z = -0.25; this.head.rotation.x = 0.35; }
        else { this.armL.rotation.x = -0.3; this.armR.rotation.x = -0.3; }
        break;
      }
      case 'lie':
        b.rotation.x = -Math.PI / 2;
        b.position.set(0, 0.62, 0.9);
        this.armL.rotation.z = -0.1; this.armR.rotation.z = 0.1;
        break;
      case 'exercise': {
        this.phase += dt * (reducedMotion ? 2 : 4);
        const s = (Math.sin(this.phase) + 1) / 2;
        this.armL.rotation.z = -0.3 - s * 2.4; this.armR.rotation.z = 0.3 + s * 2.4;
        this.legL.rotation.z = -s * 0.25; this.legR.rotation.z = s * 0.25;
        b.position.y = s * 0.05;
        break;
      }
      case 'work': {
        this.phase += dt * 3;
        this.armL.rotation.x = -1.0 + Math.sin(this.phase) * 0.25;
        this.armR.rotation.x = -1.0 - Math.sin(this.phase) * 0.25;
        this.torso.rotation.x = 0.15; this.head.rotation.x = 0.3;
        break;
      }
      case 'talk': {
        this.phase += dt * 2;
        this.armR.rotation.x = -0.5 + Math.sin(this.phase * 1.7) * 0.25;
        this.head.rotation.x = Math.sin(this.phase) * 0.05;
        break;
      }
      default: {
        this.phase += dt;
        this.torso.scaling.y = 1 + Math.sin(this.phase * 1.6) * 0.012;
        this.armL.rotation.z = -0.06; this.armR.rotation.z = 0.06;
      }
    }
  }

  dispose() { this.root.dispose(); }
}
