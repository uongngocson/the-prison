// Chặn thao tác trình duyệt làm vỡ UI game trên điện thoại: menu nhấn giữ, bôi đen chữ, kéo ảnh, phóng to trang.
// Ô nhập chữ vẫn hoạt động bình thường (chọn, dán, sửa).
const editable = (t: EventTarget | null) => t instanceof HTMLElement && !!t.closest('input, textarea, select, [contenteditable="true"]');

export function lockGameGestures() {
  const block = (e: Event) => { if (!editable(e.target)) e.preventDefault(); };
  document.addEventListener('contextmenu', block);
  document.addEventListener('selectstart', block);
  document.addEventListener('dragstart', block);
  // Safari iOS: chặn phóng to trang bằng hai ngón (camera game dùng cử chỉ riêng trên lớp cảm ứng)
  document.addEventListener('gesturestart', block as EventListener);
  // không cho người chơi phóng to cả trang (UI game đã có cỡ chữ trong Cài đặt)
  const vp = document.querySelector<HTMLMetaElement>('meta[name=viewport]');
  if (vp && !/maximum-scale/.test(vp.content)) vp.content += ', maximum-scale=1, user-scalable=no';
}
