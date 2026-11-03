import { describe, expect, it } from 'vitest';
import { applyBotOverrides, defaultPersona, PERSONAS, PERSONA_BY_ID } from '../src/bots/personas';
import { DEFAULT_CONFIG, parseConfig } from '../src/config/remote';
import { fingerprint, ignorable, parseUA } from '../src/telemetry/fingerprint';

describe('ghi đè bạn tù từ admin', () => {
  it('áp tên/bật tắt/mức chủ động và giữ mặc định cho trường null', () => {
    applyBotOverrides([{ id: 'b01', name: 'Long Nhỏ', enabled: false, sociable: 2, personality: null }]);
    const p = PERSONA_BY_ID.b01;
    expect(p.name).toBe('Long Nhỏ');
    expect(p.enabled).toBe(false);
    expect(p.sociable).toBe(1);
    expect(p.personality).toBe(defaultPersona('b01')!.personality);
  });
  it('gọi lại với danh sách rỗng thì khôi phục mặc định', () => {
    applyBotOverrides([]);
    expect(PERSONA_BY_ID.b01.name).toBe('Hoàng Long');
    expect(PERSONAS.every((p) => p.enabled)).toBe(true);
  });
  it('bỏ qua chuỗi rỗng', () => {
    applyBotOverrides([{ id: 'b02', name: '   ' }]);
    expect(PERSONA_BY_ID.b02.name).toBe('Minh Tuấn');
    applyBotOverrides([]);
  });
});

describe('cấu hình từ xa', () => {
  it('đọc giá trị và dùng mặc định khi thiếu', () => {
    const c = parseConfig([{ key: 'bots', value: { enabled: false } }, { key: 'online', value: { open: false, cap: 30 } }], [{ id: 'b03', name: 'X' }, { id: 'bad' }]);
    expect(c.bots).toEqual({ enabled: false, llm: true });
    expect(c.online).toEqual({ open: false, cap: 30 });
    expect(c.overrides.map((o) => o.id)).toEqual(['b03']);
  });
  it('giá trị hỏng → mặc định', () => {
    const c = parseConfig([{ key: 'online', value: { cap: 'abc' } }], []);
    expect(c.online).toEqual(DEFAULT_CONFIG.online);
    expect(c.bots).toEqual(DEFAULT_CONFIG.bots);
  });
});

describe('dấu vân tay lỗi', () => {
  it('cùng lỗi khác số dòng/mã → cùng dấu vân tay', () => {
    const a = fingerprint('error', 'Cannot read id of undefined (item 12)', 'TypeError\n    at f (https://x/assets/index-abc.js?v=1:10:20)');
    const b = fingerprint('error', 'Cannot read id of undefined (item 99)', 'TypeError\n    at f (https://x/assets/index-abc.js?v=2:11:5)');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });
  it('khác loại hoặc khác thông điệp → khác', () => {
    expect(fingerprint('ui', 'A', '')).not.toBe(fingerprint('error', 'A', ''));
    expect(fingerprint('ui', 'A', '')).not.toBe(fingerprint('ui', 'B', ''));
  });
  it('bỏ qua lỗi nhiễu', () => {
    expect(ignorable('ResizeObserver loop completed with undelivered notifications.')).toBe(true);
    expect(ignorable('Script error.')).toBe(true);
    expect(ignorable('x', 'chrome-extension://abc/x.js')).toBe(true);
    expect(ignorable('TypeError: x is undefined')).toBe(false);
    expect(ignorable("ReferenceError: Can't find variable: zaloJSV2")).toBe(true); // trình duyệt trong Zalo
    expect(ignorable("TypeError: Cannot read properties of undefined (reading 'M_ID')", undefined, 'at Y (chrome-extension://eppio/executors/200.js:1:761)')).toBe(true);
    expect(ignorable('InvalidStateError: Failed to start the audio device', undefined, '')).toBe(false); // lỗi thật: đã xử lý trong audio
  });
  it('nhận diện hệ điều hành / trình duyệt', () => {
    expect(parseUA('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36')).toEqual({ os: 'Android', browser: 'Chrome' });
    expect(parseUA('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605 Version/18.0 Mobile/15E148 Safari/604.1')).toEqual({ os: 'iOS', browser: 'Safari' });
    expect(parseUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36 Edg/130')).toEqual({ os: 'Windows', browser: 'Edge' });
  });
});
