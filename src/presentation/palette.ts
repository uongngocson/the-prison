// Character palette (no engine dependency) — shared by UI previews and presentation.
export const SKIN = ['#f1d3b6', '#e0b48f', '#c99068', '#a26a45', '#6e4630'];
export const HAIR = ['#1f1a17', '#4a3324', '#7a5a3a', '#9a9a96'];
// Màu sọc đồng phục phạm nhân (sọc ngang trắng ngà xen màu): xanh rêu (mặc định), xanh than, xám.
export const RES_OUTFIT = ['#3f5a40', '#2f3f58', '#4b4b4b'];
export const stripe = (i: number) => `stripe:${RES_OUTFIT[i % RES_OUTFIT.length]}`;
export const STAFF_OUTFIT = '#5a6b3c'; // quân phục xanh lá của cán bộ
export const COSMETIC_OUTFIT: Record<string, string> = { sport_shirt: '#b24a3c', cardigan: '#7a5a42', uniform_clean: 'stripe' };
