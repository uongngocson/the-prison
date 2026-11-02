import { describe, expect, it } from 'vitest';
import { createNewGame } from '../src/domain/newgame';
import { GameSession } from '../src/simulation/session';
import { skipAdmission } from '../src/domain/life';
import { RESUME_KEY, RESUME_PREVIOUS_KEY, clearResume, readResume, writeResume, type ResumeSnapshot } from '../src/persistence/resume';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(k: string) { return this.values.get(k) ?? null; }
  key(i: number) { return [...this.values.keys()][i] ?? null; }
  removeItem(k: string) { this.values.delete(k); }
  setItem(k: string, v: string) { this.values.set(k, v); }
}
const settings = { lightNeeds: false, autoComplete: false, dayLengthRealMin: 48 as const };
function snapshot(): ResumeSnapshot {
  const state = createNewGame({ name: 'An', appearance: { body: 'medium', skin: 1, hair: 1, hairColor: 0, outfit: 0 }, familyContext: 'family', seed: 7 }, 'resume-test');
  const session = new GameSession(state, settings);
  session.exec((ctx) => skipAdmission(ctx, { familyContext: 'family' }));
  return { version: 1, state, slot: 'slot2', ui: { screen: 'game', overlay: 'life', overlayParams: {}, lifeTab: 'contacts', profileTab: 'skills', settingsTab: 'audio', waypoint: 'L07' }, dialogue: null, camera: { yaw: 1.2, pitch: 0.3, boom: 3, shoulder: -1 } };
}

describe('reload recovery journal', () => {
  it('round-trips gameplay, panel, slot and camera independently per tab', () => {
    const a = new MemoryStorage(), b = new MemoryStorage();
    const saved = snapshot();
    saved.state.flags.reload_probe = 'kept';
    saved.state.inventory.bag[0]!.qty = 2;
    writeResume(a, saved);
    expect(readResume(a).snapshot).toEqual(saved);
    expect(readResume(b)).toEqual({});
  });
  it('recovers the preceding valid generation and retains corrupt evidence', () => {
    const storage = new MemoryStorage();
    const s = snapshot();
    writeResume(storage, s);
    s.state.minute += 10;
    writeResume(storage, s);
    storage.setItem(RESUME_KEY, '{broken');
    const result = readResume(storage);
    expect(result.snapshot!.state.minute).toBe(s.state.minute - 10);
    expect(result.warning).toBeTruthy();
    expect(storage.getItem(RESUME_KEY)).toBe('{broken');
  });
  it('does not silently start a new game when both checkpoints are corrupt', () => {
    const storage = new MemoryStorage();
    storage.setItem(RESUME_KEY, 'bad');
    storage.setItem(RESUME_PREVIOUS_KEY, 'bad too');
    expect(readResume(storage)).toMatchObject({ error: expect.any(String) });
    expect(storage.length).toBe(2);
  });
  it('preserves the preceding checkpoint when a write fails', () => {
    const storage = new MemoryStorage();
    const s = snapshot();
    writeResume(storage, s);
    const set = storage.setItem.bind(storage);
    storage.setItem = (key, value) => { if (key === RESUME_KEY) throw new Error('quota'); set(key, value); };
    s.state.minute += 10;
    expect(() => writeResume(storage, s)).toThrow('quota');
    expect(readResume(storage).snapshot!.state.minute).toBe(s.state.minute - 10);
  });
  it('explicit quit clears recovery without touching other storage', () => {
    const storage = new MemoryStorage();
    writeResume(storage, snapshot());
    storage.setItem('settings', 'kept');
    clearResume(storage);
    expect(readResume(storage)).toEqual({});
    expect(storage.getItem('settings')).toBe('kept');
  });
  it('restores an in-flight action and NPC reservations without snapping or committing it', () => {
    const s = snapshot();
    const session = new GameSession(s.state, settings);
    const npc = session.s.npcs.tu;
    npc.pos = { x: 2, y: 0, z: 3 };
    session.s.world.reservations['player:probe'] = 'player';
    session.s.player.mode = 'acting';
    session.s.player.action = { actionId: 'in-flight', verb: 'read', targetId: 'probe', startMinute: session.s.minute, durationMin: 30, elapsedMin: 12, committed: false };
    const storage = new MemoryStorage();
    writeResume(storage, s);
    const recovered = new GameSession(readResume(storage).snapshot!.state, settings, { resume: true });
    expect(recovered.s.player.action?.elapsedMin).toBe(12);
    expect(recovered.s.player.action?.committed).toBe(false);
    expect(recovered.s.world.reservations['player:probe']).toBe('player');
    expect(recovered.s.npcs.tu.pos).toEqual({ x: 2, y: 0, z: 3 });
  });
});
