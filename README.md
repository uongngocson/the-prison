# the-prison — Một Ngày Mới / New Day

Game mô phỏng đời sống 3D góc nhìn thứ ba trong một cơ sở giam giữ **hư cấu**, chạy trên trình duyệt desktop, chơi đơn. Bản này được dựng theo bộ thiết kế trong [docs/blueprint/](docs/blueprint/README.md).

Trạng thái chi tiết của từng tính năng (F01–F60), màn hình (U01–U35) và khu (L01–L18), cùng các điểm lệch so với blueprint: [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md).

Đặc tả mở rộng **chưa triển khai**: [chọn mức án và mô phỏng giam giữ tham chiếu Việt Nam](docs/blueprint/13-vietnam-custody-audit.md), gồm setup, phân khu/buồng, quyền đi lại, giam riêng/kỷ luật, mapping UI và kế hoạch kiểm thử. Đọc theo [mục lục blueprint 1.2](docs/blueprint/README.md); tài liệu này không đổi hành vi game hiện tại.

## Chạy game

Hồ sơ thiết kế mới, **chưa triển khai**: [khu lao động và học nghề — bản Word](docs/deliverables/Labour-Rehabilitation-BA-1.3.docx), [nghiệp vụ](docs/blueprint/18-labour-rehabilitation-spec.md) và [UI/đồ họa minh họa](docs/blueprint/19-labour-ui-art-direction.md). Gồm trồng rau, nuôi cá, làm vườn, mộc và các việc phục vụ sinh hoạt chung; ảnh concept không phải screenshot game hiện tại.

Yêu cầu: Node.js 20 trở lên, trình duyệt desktop có WebGL2.

```bash
npm install
npm run dev        # mở http://localhost:5173
npm test           # 17 test domain/simulation (Vitest)
npm run build      # typecheck + bản build production vào dist/
```

Lưu đám mây là tùy chọn: chép `.env.example` thành `.env`, điền URL và anon key của Supabase, rồi áp dụng [supabase/migrations/0001_core.sql](supabase/migrations/0001_core.sql). Phần này **chưa được chạy thử trên một dự án Supabase thật**.

Có sẵn các script kiểm thử trên trình duyệt (cần server dev đang chạy và Chrome đã cài): `scripts/smoke.mjs`, `scripts/tour.mjs`, `scripts/panels.mjs`, `scripts/dialogue.mjs`.

## Điều khiển (đổi phím được trong Cài đặt)

| Phím | Hành động |
|---|---|
| W A S D / phím mũi tên | Di chuyển theo hướng camera |
| Shift | Chạy · C: cúi · V: đổi vai camera · lăn chuột: khoảng cách camera |
| Chuột | Nhấp vào khung hình để khóa chuột; nếu không khóa được thì kéo chuột phải |
| E | Tương tác (hành động chính) · phím 2–4: hành động phụ |
| F / Q | Tua nhanh / hủy hành động đang làm |
| K · J · M · I · P · L · H | Lịch · Nhiệm vụ · Bản đồ · Túi đồ · Hồ sơ · Đời sống · Sổ tay |
| Esc | Tạm dừng (chơi đơn thì đồng hồ game dừng) |

## Đa thiết bị

| Thiết bị | Cách chơi |
|---|---|
| Máy tính | Bàn phím + chuột (bảng trên) |
| Điện thoại / máy tính bảng | Cần điều khiển ảo góc trái (đẩy ra mép để chạy), vuốt nửa phải để xoay camera, chụm hai ngón để thu phóng, nút ✋ hoặc chạm nhanh để tương tác, thanh biểu tượng phía trên mở các menu. Hỗ trợ xoay dọc/ngang, toàn màn hình, tai thỏ (safe-area), thêm vào màn hình chính (manifest), chế độ thuận tay trái |
| Tay cầm (Xbox/PlayStation) | Cần trái di chuyển, cần phải camera, A tương tác, B hủy/đóng, X tua nhanh, Y đời sống, LB bản đồ, RB nhiệm vụ, Back lịch, Start tạm dừng, D-pad lên/xuống túi/hồ sơ; trong menu D-pad di chuyển, A chọn, B quay lại |

Đồ họa “Tự động” chọn mức thấp cho điện thoại (giảm độ phân giải, tắt bóng, giảm tầm vẽ NPC). Chế độ cảm ứng đổi được ở Cài đặt › Điều khiển (Tự động / Luôn bật / Tắt). Kiểm thử giả lập: `node scripts/mobile.mjs <thư-mục-ảnh>`.

## Kiến trúc

### Lưu và khôi phục khi tải lại trang

Khi đang chơi, tải lại cùng tab sẽ tự khôi phục phiên: nhân vật/vị trí, đồng hồ, NPC, inventory, nhiệm vụ, dữ liệu Đời sống, hành động hoặc hội thoại đang diễn ra, camera và panel/tab đang mở. Ứng dụng đọc checkpoint trước khi dựng thế giới, không tự quay về Home hay tạo hành trình mới. Giữ phím/khóa chuột/âm thanh không tự khôi phục; nhấp/chạm để tiếp tục điều khiển và bật âm thanh khi trình duyệt yêu cầu.

- Checkpoint đồng bộ trong `sessionStorage` riêng từng tab: cập nhật mỗi giây, sau lệnh/panel thay đổi và khi trang ẩn/rời trang. Giữ thêm một checkpoint trước, kiểm tra định dạng/phiên bản/checksum trước khi dùng. Lỗi cả hai bản sẽ mở màn khôi phục để thử lại hoặc về menu tải save, không âm thầm xóa tiến trình.
- Save IndexedDB giữ nguyên: ba ô thủ công và ô tự động, mỗi ô hai thế hệ. Có thêm autosave khi vào phiên và lưu best-effort khi ẩn trang; autosave định kỳ60 giây chơi vẫn hoạt động. Checkpoint reload không thay thế bản lưu thủ công hoặc cloud.
- “Về menu”/“Thoát không lưu” có chủ ý xóa checkpoint tự khôi phục của phiên, giữ nguyên các ô save. Reload sau khi thoát không tự đưa người chơi trở lại phiên đã bỏ. Màn kết thúc cũng được khôi phục đúng trạng thái đã kết thúc.
- Checkpoint chỉ cho cùng tab/origin; đóng tab, xóa dữ liệu website, đổi thiết bị/domain hoặc trình duyệt chặn storage có thể làm mất checkpoint. Dùng Save/Xuất file hoặc cloud đã cấu hình để lưu lâu dài. Không bảo đảm lần ghi trong sự kiện đóng trang sẽ chạy nếu trình duyệt/thiết bị bị tắt đột ngột; checkpoint định kỳ giảm mất tiến trình, lỗi ghi được báo trên UI.

Kiểm thử reload E2E bằng Chrome: chạy `npm run dev`, rồi `npm run test:resume -- http://localhost:5173/` (đặt `CHROME_PATH` nếu Chrome ở đường dẫn khác). Script dùng browser context riêng, không sửa save của người chơi đang mở.

```
src/domain/        Luật chơi thuần TypeScript, không phụ thuộc engine: nhu cầu, túi đồ, kỹ năng, quan hệ,
                   nhiệm vụ, hội thoại, hành động, và Full Life (life.ts: F33–F60)
src/content/       Dữ liệu: 18 khu + đồ vật/slot, 60 NPC, lịch, 18 nhiệm vụ, hội thoại, dịch vụ, chương trình
src/simulation/    LocalSession: bước cố định 30 Hz, đồng hồ, cổng lệnh, AI NPC, điều hướng
src/physics/       PhysicsPort: capsule kinematic va chạm với AABB (chạy headless được)
src/presentation/  Cầu nối Babylon.js: dựng thế giới thủ tục, nhân vật instanced, camera, ngày/đêm, mưa
src/persistence/   IndexedDB (3 ô + tự lưu, mỗi ô 2 thế hệ, SHA-256), codec/migration, cloud CAS tùy chọn
src/ui/            React: shell, HUD, các panel U01–U35, hub Đời sống, cài đặt/trợ năng
src/app/           Composition root (controller): vòng lặp, chiếu HUD, tự lưu, sự kiện → toast/phụ đề
tests/             Test invariant, mô phỏng 7 ngày, hành trình đầy đủ Q01→Q06
```

Tầng domain chỉ nhận lệnh có kiểu (intent) và phát sự kiện có kiểu. Phần thưởng, giao dịch và kết quả được ghi vào sổ cái theo source key nên thử lại không cấp phần thưởng hai lần. UI chỉ hiển thị projection, không giữ bản sao trạng thái của game.

## Nội dung hư cấu

Mọi nhân vật, quy định, giờ giấc, tiền tệ và thủ tục trong game đều là thiết kế trò chơi. Chúng không mô tả một cơ sở hay hệ thống pháp luật có thật, và không phải lời khuyên pháp lý hay y tế. Toàn bộ hình khối, âm thanh và nhạc nền được tạo thủ tục trong code; game không dùng tài sản bên thứ ba.
