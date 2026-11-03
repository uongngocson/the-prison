// F19 optional cloud save (Supabase Auth + Postgres RLS + RPC CAS). Chỉ bật khi có VITE_SUPABASE_URL/ANON_KEY.
// Cloud SP vẫn "sp_untrusted"; xung đột 409 không ghi đè — giữ bản local làm fork để người chơi chọn.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SaveEnvelope } from './saveCodec';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export interface CloudSaveMeta { id: string; slot: number; generation: number; revision: number; day: number; zone: string; name: string; updated_at: string; lineage_id: string }

class Cloud {
  private client: Promise<SupabaseClient> | null = null;
  configured() { return !!URL && !!KEY; }
  /** Một client duy nhất kể cả khi nhiều lời gọi đồng thời (tránh 2 GoTrueClient). */
  private c(): Promise<SupabaseClient> {
    if (!this.configured()) return Promise.reject(new Error('Chưa cấu hình dịch vụ đám mây.'));
    this.client ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(URL!, KEY!, { auth: { persistSession: true, autoRefreshToken: true } }));
    return this.client;
  }
  /** Client dùng chung (Realtime cho chế độ Trực tuyến). */
  sb(): Promise<SupabaseClient> { return this.c(); }
  async signIn(email: string, redirectPath = ''): Promise<{ ok: boolean; message: string }> {
    try {
      const c = await this.c();
      const { error } = await c.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: location.origin + redirectPath } });
      // Không tiết lộ email có tồn tại hay không (chống account enumeration)
      if (error && error.status === 429) return { ok: false, message: 'Quá nhiều yêu cầu, vui lòng thử lại sau ít phút.' };
      return { ok: true, message: '' };
    } catch (e) { return { ok: false, message: (e as Error).message }; }
  }
  async user(): Promise<{ id: string; email?: string } | null> {
    if (!this.configured()) return null;
    const c = await this.c();
    const { data } = await c.auth.getSession();
    return data.session ? { id: data.session.user.id, email: data.session.user.email } : null;
  }
  async signOut() { if (this.configured()) await (await this.c()).auth.signOut(); }

  async list(): Promise<CloudSaveMeta[]> {
    const c = await this.c();
    const { data, error } = await c.from('game_saves_head').select('id,slot,generation,revision,day,zone,name,updated_at,lineage_id').order('updated_at', { ascending: false }).limit(20);
    if (error) throw new Error(error.message);
    return (data ?? []) as CloudSaveMeta[];
  }

  /** CAS upload: expectedRevision null = first write. Returns conflict instead of overwriting. */
  async upload(env: SaveEnvelope, slot: number, expectedRevision: number | null, idempotencyKey: string): Promise<{ ok: true; revision: number } | { ok: false; conflict?: { currentRevision: number }; message: string }> {
    const c = await this.c();
    const { data, error } = await c.rpc('save_cas', {
      p_lineage_id: env.meta.lineageId, p_slot: slot, p_expected_revision: expectedRevision, p_schema_version: env.schemaVersion,
      p_content_version: env.contentVersion, p_snapshot: env.state, p_sha256: env.sha256, p_meta: env.meta, p_idempotency_key: idempotencyKey,
    });
    if (error) {
      if (error.code === 'P0409' || /SAVE_REVISION_CONFLICT/.test(error.message)) {
        const m = /current=(\d+)/.exec(error.message);
        return { ok: false, conflict: { currentRevision: m ? Number(m[1]) : -1 }, message: 'Bản trên đám mây mới hơn. Bản này được giữ cục bộ để bạn chọn.' };
      }
      if (/schema_version_check/.test(error.message)) return { ok: false, message: 'Máy chủ chưa hỗ trợ định dạng save mới (v3). Save vẫn an toàn trên máy này; cần chạy migration 0002 trên Supabase.' };
      return { ok: false, message: error.message };
    }
    return { ok: true, revision: (data as { revision: number }).revision };
  }

  async download(id: string): Promise<SaveEnvelope> {
    const c = await this.c();
    const { data, error } = await c.from('game_saves').select('snapshot,sha256,schema_version,content_version,meta,updated_at').eq('id', id).single();
    if (error) throw new Error(error.message);
    const d = data as { snapshot: SaveEnvelope['state']; sha256: string; schema_version: number; content_version: string; meta: SaveEnvelope['meta']; updated_at: string };
    return { format: 'mot-ngay-moi-save', schemaVersion: d.schema_version, contentVersion: d.content_version, savedAt: d.updated_at, sha256: d.sha256, bytes: 0, meta: d.meta, state: d.snapshot };
  }
}

export const cloud = new Cloud();

if (typeof window !== 'undefined') (window as unknown as { __mnmCloud: Cloud }).__mnmCloud = cloud;
