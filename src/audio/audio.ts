// Procedural WebAudio (F27): ambience per zone, UI cues, channels with independent volumes.
// AudioContext chỉ khởi tạo sau gesture người dùng; mọi cue quan trọng luôn có phụ đề/caption.
import type { Weather, ZoneId } from '../domain/types';

type Channel = 'music' | 'sfx' | 'dialogue' | 'ambience' | 'ui';

export class AudioSystem {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private ch: Partial<Record<Channel, GainNode>> = {};
  private amb: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
  private rain: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private musicOsc: OscillatorNode[] = [];
  private musicGain: GainNode | null = null;
  volumes = { master: 0.8, music: 0.5, sfx: 0.8, dialogue: 1, ambience: 0.6, ui: 0.6 };
  state: 'idle' | 'active' | 'suspended' | 'unavailable' = 'idle';

  resume() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) { this.state = 'unavailable'; return; }
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        for (const c of ['music', 'sfx', 'dialogue', 'ambience', 'ui'] as Channel[]) { const g = this.ctx.createGain(); g.connect(this.master); this.ch[c] = g; }
        this.buildAmbience();
      }
      if (this.ctx.state === 'running') { if (this.state !== 'active') { this.state = 'active'; this.apply(); } return; }
      // iOS có thể từ chối mở loa (đang gọi điện, app khác giữ loa, vừa quay lại từ nền): không ném lỗi,
      // giữ trạng thái tạm dừng và thử lại ở lần chạm kế tiếp.
      this.ctx.resume().then(() => { this.state = 'active'; this.apply(); }).catch(() => { this.state = 'suspended'; });
    } catch { this.state = 'unavailable'; }
  }
  suspend() { this.ctx?.suspend().catch(() => undefined); this.state = this.ctx ? 'suspended' : this.state; }

  setVolumes(v: typeof this.volumes) { this.volumes = { ...v }; this.apply(); }
  private apply() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.master, t, 0.05);
    for (const c of Object.keys(this.ch) as Channel[]) this.ch[c]!.gain.setTargetAtTime(this.volumes[c], t, 0.05);
  }

  private noiseBuffer(seconds: number, brown = true): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w * 0.4;
    }
    return buf;
  }

  private buildAmbience() {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(4);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    const gain = ctx.createGain();
    gain.gain.value = 0.25;
    src.connect(filter).connect(gain).connect(this.ch.ambience!);
    src.start();
    this.amb = { src, filter, gain };
    const rsrc = ctx.createBufferSource();
    rsrc.buffer = this.noiseBuffer(3, false);
    rsrc.loop = true;
    const rf = ctx.createBiquadFilter();
    rf.type = 'highpass';
    rf.frequency.value = 1800;
    const rg = ctx.createGain();
    rg.gain.value = 0;
    rsrc.connect(rf).connect(rg).connect(this.ch.ambience!);
    rsrc.start();
    this.rain = { src: rsrc, gain: rg };
    // soft pad music (generated, license-free)
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.0;
    this.musicGain.connect(this.ch.music!);
    for (const f of [130.81, 196, 261.63]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.05;
      o.connect(g).connect(this.musicGain);
      o.start();
      this.musicOsc.push(o);
    }
  }

  /** Zone acoustic profile + weather; transitions 300 ms (audio portal). */
  setEnvironment(zone: ZoneId, weather: Weather, sleeping: boolean, outdoor: boolean) {
    if (!this.ctx || !this.amb) return;
    const t = this.ctx.currentTime;
    const busy = ['L05', 'L03', 'L10', 'L09'].includes(zone);
    const quiet = ['L07', 'L17', 'L08', 'L16'].includes(zone);
    this.amb.filter.frequency.setTargetAtTime(outdoor ? 900 : busy ? 600 : 320, t, 0.3);
    this.amb.gain.gain.setTargetAtTime(sleeping ? 0.05 : quiet ? 0.08 : busy ? 0.35 : outdoor ? 0.3 : 0.18, t, 0.3);
    this.rain!.gain.gain.setTargetAtTime(weather === 'rain' ? (outdoor ? 0.35 : 0.06) : 0, t, 0.8);
    this.musicGain!.gain.setTargetAtTime(sleeping ? 0 : quiet ? 0.6 : 0.25, t, 1.5);
  }

  cue(kind: 'chime' | 'ok' | 'error' | 'step' | 'open' | 'notify') {
    if (!this.ctx || this.state !== 'active') return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const ch = kind === 'chime' ? this.ch.sfx! : this.ch.ui!;
    o.connect(g).connect(ch);
    const seq: Record<string, [number, number, number]> = { chime: [660, 880, 0.6], ok: [520, 780, 0.18], error: [300, 200, 0.25], step: [120, 90, 0.05], open: [440, 560, 0.1], notify: [600, 700, 0.15] };
    const [f1, f2, dur] = seq[kind];
    o.type = kind === 'chime' ? 'triangle' : 'sine';
    o.frequency.setValueAtTime(f1, t);
    o.frequency.linearRampToValueAtTime(f2, t + dur * 0.6);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(kind === 'step' ? 0.05 : 0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

export const audio = new AudioSystem();
