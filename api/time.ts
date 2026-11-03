// Vercel Function: GET /api/time — giờ máy chủ (ms) để mọi máy tính cùng một đồng hồ trại (CR-TIME-01).
export function GET(): Response {
  return new Response(JSON.stringify({ now: Date.now() }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0' } });
}
