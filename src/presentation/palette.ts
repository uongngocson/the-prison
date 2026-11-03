// Character palette (no engine dependency) — shared by UI previews and presentation.
export const SKIN = ['#f1d3b6', '#e0b48f', '#c99068', '#a26a45', '#6e4630'];
export const HAIR = ['#1f1a17', '#4a3324', '#7a5a3a', '#9a9a96'];
// Bộ liền thân (jumpsuit) phạm nhân kiểu Mỹ: cam (mặc định), kaki, xanh denim. Giữ tiền tố 'stripe:' để tương thích save/protocol.
export const RES_OUTFIT = ['#e2722b', '#b49a6c', '#3f6491'];
export const stripe = (i: number) => `stripe:${RES_OUTFIT[i % RES_OUTFIT.length]}`;
export const STAFF_OUTFIT = '#2a3a55'; // áo xanh navy của nhân viên trại (correctional officer)
export const COSMETIC_OUTFIT: Record<string, string> = { sport_shirt: '#8a8f96', cardigan: '#5b4636', uniform_clean: 'stripe' };
