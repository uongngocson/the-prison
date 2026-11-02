# 20 — Kế hoạch kiểm thử UI hiện có trên đa kích thước thiết bị

Ngày 02/11/2026 · Phạm vi U01–U38 · Baseline `5491081cf5b3ea364c69ad7cca4e203c61b4b74a`.

## Phạm vi và cách ly

Theo yêu cầu, kiểm phần đã có trước khi Claude phát triển labour. Không kiểm F73–84, U39–44, W01–20 hoặc L23–28 ở [18](18-labour-rehabilitation-spec.md)/[19](19-labour-ui-art-direction.md). Không sửa source/game/SQL đang được tác giả khác cập nhật. Bản chạy là git archive của baseline, Vite riêng ở localhost:5186, không dùng `.env`/save/browser profile thật. Mỗi cấu hình có browser context và storage riêng.

Spec thực thi: [tests/e2e/ui-existing.spec.mjs](../../tests/e2e/ui-existing.spec.mjs). Kết quả/evidence: [21 — báo cáo thực chạy](21-existing-ui-audit-results.md). Không có Word/PDF trong đợt audit này.

## Ma trận dự kiến

| ID | Browser | CSS viewport | Input/DPR | Điều chứng minh |
|---|---|---|---|---|
| desktop-1440 | Chrome cài trên Windows | 1440×900 | Mouse/keyboard, DPR1 | Desktop UI và flow |
| desktop-1280 | Chrome | 1280×720 | Mouse/keyboard, DPR1 | Độ phân giải desktop thấp |
| phone-390 | Chrome | 390×844 | Touch emulation, DPR2 | Responsive phone dọc |
| phone-360 | Chrome | 360×800 | Touch emulation, DPR2 | Phone hẹp |
| phone-landscape | Chrome | 844×390 | Touch emulation, DPR2 | Phone ngang, chiều cao hạn chế |
| tablet-portrait | Chrome | 768×1024 | Touch emulation, DPR2 | Tablet dọc |
| tablet-landscape | Chrome | 1024×768 | Touch emulation, DPR2 | Tablet ngang |
| edge-desktop | Edge cài trên Windows | 1280×720 | Mouse/keyboard, DPR1 | Browser đối chứng |

Headless WebGL2 dùng SwiftShader. Low/resolution scale 0.65/no shadows được chọn qua UI cho đợt chạy chính, để tập trung chức năng/layout; không phải benchmark GPU hoặc chứng minh đồ họa high. Touch/CDP/gamepad giả lập không phải kiểm iPhone/iPad/Android/tay cầm vật lý. Safari/iOS WebKit, Firefox, NVDA, mạng mobile thật, thermal, microphone, fullscreen thiết bị thật và cloud production không được tự đánh dấu pass.

## Nhóm kiểm và oracle

| Nhóm | Nội dung và trạng thái cần có |
|---|---|
| Shell U01–05/24/25 | Landing/about, guest, menu empty/has-save, credits, unavailable lobby, create invalid/valid/random/undo, setup/chọn án, loading/progress/error/recovery |
| Admission U26/27/31 | Danh tính → đọc nội quy → tài sản → nhu cầu → housing; thao tác thật và state sau mỗi bước |
| HUD/input U06/16/18 | Canvas/HUD, di chuyển trong fixture hành lang trống, menu/hotkey, notifications, đổi hướng màn; actor state và input thực trong browser |
| Panels U08–14/17/19 | Túi/tủ/hộp/ký gửi, dùng/mặc/chuyển; profile/quan hệ/kỹ năng/thành tựu; nhiệm vụ/tab/theo dõi; map/waypoint; lịch; search help |
| Life U27–35 | Receipts/dispute, quote/order/cancel, thư, đặt/hủy call, request/withdraw, diet/support/culture/care, enroll/withdraw, incident response, transfer request, plan goal |
| Settings U21–23 | Graphics/audio, remap/reset, numeric fields, 200% text, contrast/reduced motion, tab/focus/Esc |
| Persistence U20/25 | Manual save/load/export/invalid và valid import, delete confirmation, reload giữ state/panel, quit/cancel |
| Dialogue/scene/sleep | NPC talk/choice/history/end, subtitle next/end, sleep/cancel/confirm có tiến phút game |
| Custody U36–38 | Setup 20 năm, admission skip, ba tab hồ sơ, rest/request tại buồng, map theo quyền, active order fixture |
| Logs/layout | Uncaught exceptions, console/network log, dialog bounds, document overflow, rendered controls, screenshot top/bottom khi panel scroll |

Các assertion kiểm kết quả domain hoặc state hiển thị, không chỉ trang có text. Một số điều kiện được seed bằng test hook `window.__mnm` và module imports; `method` ghi rõ `user-flow`, `fixture-navigation`, `UI-with-seeded-fixture`, `synthetic-state/input` hoặc `runtime-log`. Mở thẳng panel không chứng minh đường đi tới panel hoạt động, nên có case navigation riêng. Synthetic ending/loading/error không chứng minh đã hoàn thành mọi quest hoặc gây lỗi engine thật.

## Bằng chứng và cách chạy

```text
node tests/e2e/ui-existing.spec.mjs --url http://127.0.0.1:5186 --devices desktop-1440 --out docs/blueprint/evidence/ui-existing-2026-11-02/run-a
```

Không chạy trên dev server có `.env` production. Runner chặn request ngoài localhost. Không gửi email, đăng nhập tài khoản thật hoặc xóa save của người chơi. `--devices` là danh sách ID cách nhau dấu phẩy; mỗi invocation nên có output riêng. `--only` dành debug case với trạng thái chuẩn bị riêng, không phải chạy độc lập mọi case vì suite có dependency.

Mỗi case có ID, browser/device, method, status, timestamps, actions, trạng thái trước/sau, lỗi/assertion, ảnh PNG, JSON chi tiết. Panel dài có thêm ảnh sau scroll tới cuối. Mỗi context có trace ZIP và log browser/console/network. `results.json` được checkpoint sau từng case; `manifest.json` pin spec hash và commit. Báo cáo tổng hợp không dùng pilot lỗi selector làm bằng chứng bug game.

## Quy tắc báo cáo

Pass chỉ cho assertion đã chạy. Failed cần phân loại lỗi app, layout hoặc lỗi test/harness và tái hiện lại; blocked ghi lý do và phần chưa xác minh. Không lấy screenshot tồn tại làm bằng chứng mọi nút trên màn đã hoạt động. DOM controls inventory phục vụ truy vết, chưa là chứng nhận phủ mọi giá trị/tổ hợp trạng thái.

Độ phủ báo riêng: (1) logical screen IDs đã có evidence, (2) cases pass/fail/blocked, (3) viewport/browser đã chạy, (4) happy/error/empty/fixture states, (5) giới hạn còn lại. Chỉ gọi 100% khi có mẫu số rõ; không ghi “100% mọi UI trên mọi thiết bị” từ giả lập desktop. Bằng chứng không thay legal realism review, pentest, WCAG audit hoặc load/performance test.
