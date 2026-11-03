// Hàm thuần cho bộ ghi lỗi (test được trong Node).
export function parseUA(ua: string): { os: string; browser: string } {
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac OS X|Macintosh/i.test(ua) ? 'macOS' : /CrOS/i.test(ua) ? 'ChromeOS' : /Linux/i.test(ua) ? 'Linux' : 'Khác';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Khác';
  return { os, browser };
}

/** Dấu vân tay lỗi: loại + thông điệp đã bỏ số/mã + khung stack đầu tiên (bỏ query/hash của file). */
export function fingerprint(kind: string, message: string, stack: string): string {
  const norm = message.replace(/\b[0-9a-f]{8,}\b/gi, '#').replace(/\d+/g, 'N').slice(0, 200);
  const frame = (stack.split('\n').find((l) => /at |@/.test(l)) ?? '').replace(/\?[^:)\s]*/g, '').replace(/:\d+:\d+/g, '').trim().slice(0, 160);
  const s = `${kind}|${norm}|${frame}`;
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 2246822519); }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

/** Lỗi không đáng ghi (tiện ích trình duyệt, ResizeObserver, hủy yêu cầu). */
export function ignorable(message: string, source?: string): boolean {
  if (/ResizeObserver loop|Script error\.?$|AbortError|The user aborted|cancelled|NotAllowedError: play\(\)/i.test(message)) return true;
  if (source && /^(chrome|moz|safari)-extension:/.test(source)) return true;
  return false;
}
