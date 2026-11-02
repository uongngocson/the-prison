# Trạng thái triển khai so với Blueprint 1.1

Ngày 02/11/2026. Báo cáo theo quy tắc của [phần 12](blueprint/12-realism-delivery.md): mỗi mục tách 4 cột **Documented / Implemented / Tested / RealismReviewed**. Cột *RealismReviewed* đều là **chưa**: chưa có chuyên gia jurisdiction, người có trải nghiệm hay reviewer nội dung nào xem xét. Không mục nào được gọi là "100% thực tế".

Quy ước cột Tested:
- **A**: có test tự động (Vitest, `npm test`, hiện 38 test, tất cả pass)
- **B**: đã chạy thử trong trình duyệt qua script Playwright (Chrome headless, SwiftShader)
- **—**: chưa có bằng chứng kiểm thử

## Tóm tắt

### CR-LAB-01 — tài liệu lao động 1.3, chưa triển khai — 02/11/2026

Đã bổ sung [đặc tả BA](blueprint/18-labour-rehabilitation-spec.md), [UI/đồ họa](blueprint/19-labour-ui-art-direction.md) và [bản DOCX](deliverables/Labour-Rehabilitation-BA-1.3.docx). Phạm vi mới: 20 nhóm công việc, F73–84, U39–44, L23–28, DB51–58, API18–20, QA33–38 và 20 scenario. Có sáu ảnh concept; không phải UI runtime hay asset 3D đã tích hợp. Bản hiện tại có ca xưởng/bếp/giặt trừu tượng và khóa mộc, chưa đồng nghĩa có crop/pond/production loop mới.

| Nhóm mới | Documented | Implemented | Tested | RealismReviewed |
|---|---|---|---|---|
| F73–84 / W01–20 | Có đặc tả, scope P0/P1/P2 | Chưa theo CR-LAB-01 | Chưa | Chưa |
| U39–44 / L23–28 | Contracts/art brief và sáu mockup | Chưa | Chưa trên game | Chưa |
| Tools/stock/production/module save | DB/API contracts | Chưa | Chưa | Chưa |
| QA33–38 / LAB-SC01–20 | Test specification | Chưa tự động hóa | Chưa chạy | Chưa |

Đợt bàn giao này chỉ tạo/cập nhật tài liệu và hình minh họa, không sửa source game, tests, SQL hoặc push Git. Thay đổi custody đang có trong working tree là công việc riêng, giữ nguyên. Kiểm tra cấu trúc DOCX/Markdown không được tính là test gameplay.

### CR-VN-01 — đã triển khai bản đầu (chưa review độ chân thực), 02/11/2026

Đã code theo hồ sơ [13–17](blueprint/13-vietnam-custody-audit.md). Bối cảnh mới `vn_custody` chạy song song với `fictional_life` (hành trình cũ không đổi). Kiểm thử: `tests/custody.test.ts` (15 test, cùng 23 test cũ — tổng 38 test pass), `tsc` và `vite build` sạch; luồng Chrome headless trong `scripts/custody.mjs` (U03→U36, reload giữ draft, tiếp nhận vào buồng B-02, U37, chặn rời buồng lúc 22:30 bằng input bàn phím thật, U38 tua qua đêm, lịch/bản đồ). Màn hình di động đã chụp kiểm tra (phase chip, U38). Chưa kiểm tra trên thiết bị thật.

| Feature | Implemented | Tested | RealismReviewed | Ghi chú |
|---|---|---|---|---|
| F61 Chọn chế độ & mức án (U36) | Có | A, B | Chưa | Một màn: 2 chế độ (Cốt truyện / Thụ án) + 6 mức án (1, 3, 5, 10, 20 năm, chung thân) + nút Ngẫu nhiên; draft trong sessionStorage. Đã bỏ chữ tham chiếu luật/Việt Nam khỏi UI theo yêu cầu |
| F62 Hồ sơ bản án & tiến độ | Có | A | Chưa | Lịch theo ngày (addMonths kẹp cuối tháng); trừ thời gian tạm giam một lần; chung thân không có ngày/đếm ngược |
| F63 Phân nhóm & phân buồng | Có | A | Chưa | Bảng 14 §3: đúng 15 năm → A, 181 tháng → B; giảm án không có quyết định vẫn B; không fallback sang cohort khác |
| F64 Ranh giới & quyền đi lại | Có | A, B | Chưa | Một evaluator cho bàn phím/cảm ứng/tay cầm; thông báo lý do có dedup; props trong buồng khác bị khóa |
| F65 Ra/về buồng, ban đêm | Có | A, B | Chưa | Lịch nhóm A/B hư cấu [D]; quyền trở về 45 phút rồi áp giải trừu tượng "không ghi nhận vi phạm"; thư gửi được từ buồng |
| F66 Kỷ luật & buồng kỷ luật | Có | A | Chưa | Thang: khiển trách → cảnh cáo → buồng kỷ luật 3 ngày; tối đa 10 ngày; không trùng nguồn; hết hạn đưa về buồng tương thích; hạn chế gặp là lệnh riêng |
| F67 Bố trí riêng | Có | — | Chưa | Kịch bản minh họa có hạn xem xét lại; không phải kỷ luật |
| F68 Dịch vụ dưới ràng buộc | Một phần | — | Chưa | Quyền di chuyển theo lịch hẹn/lớp/ca; suất ăn tại buồng khi bị giới hạn. Chưa có nội dung tại buồng riêng cho từng dịch vụ |
| F69 Chuyển khu & thay đổi bản án | Một phần | — | Chưa | Kịch bản "giữa hành trình": giảm 30 tháng → quyết định phân loại → đề xuất chuyển buồng. Chưa có các loại sửa án khác |
| F70 Chương ≠ ra trại | Có | A | Chưa | "Kết thúc chương" không đổi trạng thái chấp hành; rời cơ sở chỉ khi đến mốc hết hạn |
| F71 Lưu/khôi phục | Có | A | Chưa | Save v3; v2→v3 = `fictional_life`, không gán án; kiểm tra pin profile/hash, lệnh, cohort; khôi phục xử lý mốc trước input |
| F72 Màn chế độ thụ án (U37) | Có | B | Chưa | 3 tab Tổng quan / Lịch / Quyết định; đã bỏ tab Nguồn và trích dẫn văn bản luật khỏi UI |
| L19–L22 | Có (blockout) | B | Chưa | Khu A, khu B, bố trí riêng, buồng kỷ luật; cửa buồng động chỉ là hình ảnh, quyền do evaluator quyết định |

**Cần làm trước khi deploy:** chạy `supabase/migrations/0002_schema_v3.sql` trên Supabase (nới check `schema_version` lên 1..3); nếu chưa chạy, cloud save v3 bị từ chối (client hiện thông báo rõ, save cục bộ vẫn an toàn).

**Chưa làm / giới hạn:** nhập số tháng tùy chỉnh; tử hình, tạm giam, án treo, nữ/người nước ngoài (khóa có lý do); quy định chi tiết của NĐ 170/2026 và TT 96/2026 chưa đối chiếu (giờ giấc là hư cấu); QA25–QA32 mới tự động hóa một phần; chưa có review pháp lý T11-01.

### Sửa khôi phục phiên khi reload — 02/11/2026

Đã bổ sung checkpoint phiên đồng bộ theo tab và bootstrap auto-resume (F18/F31): giữ domain state, vị trí NPC/player, camera, action/dialogue và panel đang mở; không khởi tạo lại NPC khi khôi phục checkpoint. Các ô IndexedDB và lựa chọn “Thoát không lưu” vẫn độc lập. Lỗi checkpoint có fallback thế hệ trước hoặc màn recovery, không tự bắt đầu lại. Kết thúc hành trình được khôi phục ở màn Ending và đồng hồ dừng.

Kiểm tra cho thay đổi này:6 regression unit tests trong `tests/resume.test.ts`, luồng Chrome/WebGL trong `scripts/resume.mjs` (new game trước autosave, state/UI/camera, dialogue không áp effect lại, action, tab isolation, lifecycle checkpoint, điều khiển sau resume, deliberate quit và save, ending, corrupt recovery). Tất cả dùng local browser storage, không xác nhận Supabase cloud, thiết bị mobile thật hoặc browser crash/power-loss durability. Các số test/bằng chứng phần bảng cũ là mốc trước thay đổi này.

Kết quả chạy trên bản sửa cuối: `npm run build` thành công (còn cảnh báo bundle lớn/static-dynamic import); `npm test` **23/23 pass**; `npm run test:resume -- http://127.0.0.1:5174/` **toàn bộ luồng pass**, không có browser runtime error. Đã bổ sung kiểm tra và sửa race giữa mở panel bằng phím với sự kiện visibility/pointer-lock lúc reload; panel đang mở không bị đổi thành Tạm dừng. Chrome headless dùng SwiftShader là evidence chức năng, không phải benchmark GPU máy thật.

| Hạng mục | Blueprint | Đã có trong code |
|---|---|---|
| Feature | F01–F60 | 58 có triển khai (phần lớn ở mức Interactive/Abstracted). F32 Multiplayer chưa làm (P2). F59 chỉ có phần chức năng; nội dung chuyên biệt (thai sản, trẻ phụ thuộc, tạm giam) bị chặn đúng như blueprint yêu cầu |
| Màn hình | U01–U35 | Có đủ 35. U24 Lobby chỉ là màn thông báo "chưa mở" |
| Khu | L01–L18 | Có đủ 18 khu dạng blockout thủ tục, kèm đồ vật, slot và giờ mở cửa |
| NPC | 60 danh tính | 60 (40 cư dân, 20 nhân viên), có lịch, slot, trí nhớ và AI LOD |
| Nhiệm vụ | 30 (full) / 10 (MVP) | **18** (6 chính, 12 phụ). Chưa đạt mục tiêu 30 của bản full |
| Vật phẩm / thành tựu / kỹ năng | 20 / 10 / 3 | 32 / 12 / 3 |
| Dữ liệu | DB01–DB44 | Ở chế độ chơi đơn, mọi bảng nằm trong save DTO (`lifeState`, schema v2), điều phần 11 cho phép ở MVP. SQL thật chỉ có cho DB02/03/18/19/25 + RPC `save_cas` |
| API | API01–API13 | Chơi đơn dùng lệnh cục bộ cùng hợp đồng. API HTTP duy nhất là RPC save CAS, **chưa chạy trên Supabase thật** |

## Lệch so với blueprint (quyết định khi triển khai)

| Blueprint | Bản này | Lý do / hệ quả |
|---|---|---|
| Phase 0 benchmark rồi mới chọn engine (ADR01) | Dùng thẳng Babylon.js 7 (WebGL2) | Không có máy đo và thiết bị mục tiêu. PERF01–21 **chưa đo** trên phần cứng thật |
| Rapier WASM sau PhysicsPort (ADR02) | PhysicsPort tự viết: capsule XZ với AABB | Chạy headless, test được. Không có bậc thang/dốc vì thế giới phẳng. Có thể thay Rapier phía sau cùng interface |
| Navmesh baked + Recast | Đồ thị khu + waypoint trong phòng, kiểm va chạm đoạn thẳng | Đủ cho blockout; chưa có tránh vật cản động hay đám đông thật |
| Utility AI có điểm số (02) | Lịch → slot (có reservation) → đường đi → hành động; chọn slot theo hash có seed | Đơn giản và dễ truy vết; chưa có chấm điểm utility |
| Asset GLB/KTX2 từ Blender, PBR, GI baked, probe | Hình khối thủ tục gộp theo khu bằng vertex color; StandardMaterial; ánh sáng hemi + sun; bóng đổ chỉ ở sân | Không có asset. Đây là chất lượng blockout, chưa phải đích hình ảnh G01 |
| Hoạt ảnh skeletal (clip, blend, IK) | Nhân vật ghép khối, instanced; tư thế thủ tục (đi, chạy, cúi, ngồi, nằm, tập, làm việc, nói) | Không có rig hay clip |
| Vercel API + Supabase + container MP | Vite SPA; cloud chỉ qua Supabase RPC (tùy chọn); không có server game | Chưa có tài khoản cloud nên chưa triển khai |
| Telemetry, CSP, monitoring, runbook | Chưa làm | Thuộc Phase 6–8 |

## Bảng feature

Mức: I = Interactive, Ab = Abstracted (theo phần 09).

| ID | Tính năng | Implemented | Tested | Ghi chú / giới hạn |
|---|---|---|---|---|
| F01 | Tạo nhân vật | Có | B | Preview 3D, dáng người/da/tóc/màu/đồng phục, kiểm tên, ngẫu nhiên/hoàn tác. Chưa QA clipping 20 tổ hợp |
| F02 | Khởi tạo hành trình | Có | A,B | Ngày 1 09:00 tại L01 → tiếp nhận → L02 → Q01 |
| F03 | Hướng dẫn & sổ tay | Có | B | 6 bước theo sự kiện, bỏ qua/xem lại, phím hiển thị theo remap |
| F04 | Di chuyển & camera | Có | A,B | Đi/chạy/cúi, camera chống xuyên tường, đổi vai, độ nhạy, đảo trục. Không nhảy (đúng spec). Chưa làm QA03 100 tuyến |
| F05 | Tương tác | Có | A,B | Tầm 1,35–1,8 m + LOS + hysteresis 150 ms, slot bận, hủy/tua, commit một lần theo actionId |
| F06 | Hội thoại | Có | A,B | 25 đồ thị, điều kiện/hiệu ứng theo allowlist, phần thưởng một lần qua ledger, lịch sử thoại |
| F07 | Nhiệm vụ | Có | A | 18 nhiệm vụ, mỗi nhiệm vụ có đường thay thế và ledger key. Hành trình Q01→Q06 được test end-to-end |
| F08 | Quan hệ | Có | A | Tin cậy/tôn trọng/thân quen; chỉ NPC chứng kiến mới cập nhật; lặp trong ngày giảm hiệu quả |
| F09 | Uy tín nhóm | Có | — | 7 nhóm, tách khỏi tình bạn |
| F10 | Sự kiện động | Có | A | Nhóm đọc, buổi tập nhóm, đóng khu bảo trì; seeded, có cooldown, mỗi lúc tối đa 1 sự kiện |
| F11 | Túi đồ | Có | A | Túi 12 ô, tủ 24 ô, hộp nhận đồ khi túi đầy, đồ ký gửi. Test bảo toàn 1.000 thao tác |
| F12 | Nhặt/bỏ/dùng | Một phần | A | Dùng/ăn/mặc/chuyển túi↔tủ. **Chưa có** vật phẩm nằm trên mặt đất (DB10 world_items) |
| F13 | Trang phục | Có | B | Đổi trang phục thẩm mỹ |
| F14 | Tiến trình & hồ sơ | Có | B | Chương 1–3 chỉ tăng, trang hồ sơ |
| F15 | Lịch hằng ngày | Có | A,B | 12 mốc, loa thông báo, U17 |
| F16 | Kỹ năng | Có | A | Ngưỡng 0/100/250/450/700, giới hạn mềm theo ngày, idempotent |
| F17 | Thành tựu | Có | — | 12 thành tựu, đánh dấu "cục bộ" |
| F18 | Lưu cục bộ | Có | A | IndexedDB, 3 ô + tự lưu, 2 thế hệ, SHA-256, kiểm schema, migration v1→v2, xuất/nhập file. Chưa test 100 lần ghi bị ngắt trong trình duyệt |
| F19 | Đăng nhập & lưu đám mây | Code có | — | Magic link, CAS 409 không ghi đè, RLS. **Chưa chạy trên Supabase thật** |
| F20 | Cài đặt & trợ năng | Có | B | Đồ họa/âm thanh/phím (tự hoán đổi khi trùng)/phụ đề/giảm chuyển động/tương phản cao/nhu cầu nhẹ/tự hoàn tất/ngày 72 phút |
| F21 | Thời gian & ngày đêm | Có | A,B | Ngày 48/72 phút thực, bầu trời, mặt trời, cửa sổ phát sáng |
| F22 | Ngủ | Có | A | Chọn giờ thức, xem trước những gì sẽ bỏ qua, tua nhanh qua các mốc |
| F23 | Ăn | Có | A | Khung giờ ăn, mỗi bữa nhận một lần, suất dự phòng, trả khay, ăn cùng mọi người |
| F24 | Vệ sinh | Có | — | Rửa, tắm, vệ sinh; riêng tư, chỉ trừu tượng |
| F25 | Tâm trạng | Có | A | Kéo về mức nền, ghi nguyên nhân |
| F26 | NPC: lịch, trí nhớ | Có | A,B | 60 NPC, giữ slot, nhường đường/đổi đường, AI LOD, trí nhớ tối đa 32, không biết mọi thứ |
| F27 | Thời tiết & âm thanh | Có | B | Quang/âm u/mưa (sân đóng), mưa chỉ ngoài trời, âm thanh WebAudio thủ tục, phụ đề |
| F28 | Thay đổi thế giới | Có | A | Cửa theo giờ/thời tiết/sự kiện; khu đang có người thì ở trạng thái "sắp đóng", không nhốt người chơi |
| F29 | Hoạt động | Có | A | Đọc, tập, giúp việc, sắp sách, học, làm ca... có XP và giới hạn mềm |
| F30 | Bản đồ | Có | B | Sơ đồ SVG, danh sách khu, trạng thái đường đi, mũi tên chỉ đường trên HUD |
| F31 | Tạm dừng & thông báo | Có | B | Tạm dừng khi chơi đơn, tối đa 3 toast, lịch sử 100, lỗi lưu hiển thị cố định |
| F32 | Nhiều người chơi | **Không** | — | P2, chưa làm |
| F33 | Tiếp nhận | Có (I) | A,B | Saga 5 bước, bỏ qua phần trình bày, resume idempotent |
| F34 | Tài sản ký gửi | Có (I) | A | Biên nhận ký gửi/cấp phát/hoàn trả/kiểm tra, khiếu nại tạo yêu cầu, bảo toàn khi rời |
| F35 | Chỗ ở | Có (I) | — | Phân giường, xin đổi phòng → yêu cầu → đề xuất chuyển |
| F36 | Nội quy & quyền | Có (I) | B | 5 chủ đề, xác nhận đã hiểu |
| F37 | Điểm danh | Có (Ab) | A | 06:30/21:30, miễn trừ theo lịch hẹn/kế hoạch nghỉ, lần đầu chỉ nhắc |
| F38 | Tài khoản & sổ cái | Có (I) | A | Bút toán kép, không âm, trùng nguồn bị từ chối |
| F39 | Cửa hàng nội bộ | Có (I) | A,B | Báo giá có hạn, ngày đặt hàng, tồn kho/hạn mức, giữ tiền → nhận → trừ, hủy |
| F40 | Thư từ | Có (I) | A | Chủ đề soạn sẵn, độ trễ xử lý, hồi âm |
| F41 | Cuộc gọi | Có (I) | A | Đặt lịch, chỉ phụ đề, liên hệ bận thì đổi lịch không mất lượt |
| F42 | Thăm gặp | Có (I) | — | Đặt lịch, khách có thể không đến (có lựa chọn thay thế) |
| F43 | Thông tin pháp lý | Có (Ab) | — | Hẹn riêng, mốc câu chuyện, không đoán án |
| F44 | Yêu cầu & khiếu nại | Có (I) | A | Biên nhận, người xử lý, hạn, phản hồi, xem xét lại độc lập, rút yêu cầu |
| F45 | Chăm sóc sức khỏe | Có (Ab) | — | Hẹn, kế hoạch nghỉ 24 giờ, miễn trừ, hẹn xem lại |
| F46 | Hỗ trợ tinh thần | Có | — | Người lắng nghe đồng đẳng, đặt hẹn, phòng yên tĩnh, từ chối không bị phạt |
| F47 | Học tập | Có (I) | A | 3 khóa, từng bài, giấy ghi nhận trong game |
| F48 | Ca làm việc | Có (I) | A | 3 phân công, mỗi người tối đa 1, công trả một lần mỗi ca, có mức một phần/miễn |
| F49 | Cấp phát, giặt, cắt tóc | Có | A | Đồ thiết yếu miễn phí mỗi ngày (số dư 0 vẫn nhận), đổi đồ giặt, cắt tóc |
| F50 | Nước, riêng tư, chế độ ăn | Có | — | Vòi nước, buồng vệ sinh, chế độ ăn quyết định thực đơn |
| F51 | Văn hóa / tinh thần | Có | — | Tham gia / suy ngẫm không tôn giáo / không tham gia, không ảnh hưởng chỉ số |
| F52 | Xem xét kỷ luật | Có (Ab) | A | Trình bày → quyết định → xem xét lại → hủy; hệ quả chỉ chạm đặc quyền tùy chọn |
| F53 | Kiểm tra đồ | Có (Ab) | — | Hằng tuần, có biên nhận, không có cơ chế né tránh |
| F54 | Ranh giới & an toàn | Có | — | Kịch bản với Long: từ chối/rời đi/nhờ cán bộ/hòa giải, không có chiến đấu |
| F55 | Bảo trì | Có | — | Bồn rửa hỏng ngày 2, báo hỏng, sửa; khu đóng tạm có lựa chọn thay thế |
| F56 | Chuyển nơi | Một phần | — | Saga chuyển phòng. **Chưa có** chuyển sang cơ sở khác |
| F57 | Rời cơ sở | Có | A | Mục tiêu kế hoạch, mốc ngày 7, quyết toán một lần, trả tài sản, kết thúc, bản sao chơi tự do |
| F58 | Nhu cầu cá nhân | Có | — | Hạn chế vận động → tự hoàn tất; cần nghỉ → năng lượng giảm chậm hơn; các nhu cầu khác chủ yếu là thông tin |
| F59 | Gia đình | Một phần | — | 3 bối cảnh gia đình; nhánh chuyên biệt chưa có (bị chặn theo đúng spec) |
| F60 | Nhân viên & dịch vụ | Có | A | 20 nhân viên theo ca, vai trò đang trực, bàn giao yêu cầu không để mồ côi |

## QA trong blueprint chưa thực hiện

QA02 (RLS/API), QA03 (100 tuyến vật lý), QA05 (playtest người thật), QA06 (ma trận thiết bị/trình duyệt), QA07 (golden đồ họa), QA08 (hiệu năng trên máy thật, phiên 2 giờ), QA09 (bảo mật), QA10/11/12 (tải/mạng/MP), QA14 (audit trợ năng bằng axe/NVDA), QA15 (DR), QA16 (review nội dung/bản quyền), QA20 (quyền riêng tư ở chế độ nhiều người), QA22 (review độ chân thực). Gate A–E và Gate L **chưa đạt**.
