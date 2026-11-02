# 17 — Backlog, truy vết và nghiệm thu mở rộng custody

CR-VN-01 / baseline mục tiêu 1.2 / 02/11/2026. **Bàn giao tài liệu, không triển khai code.** Đọc [13 — audit/nguồn](13-vietnam-custody-audit.md), [14 — nghiệp vụ](14-sentence-custody-spec.md), [15 — UI](15-custody-ui-mapping.md), [16 — contracts](16-custody-contracts.md).

## 1. Baseline và trạng thái

| Nhóm | Baseline 1.1 | Delta thiết kế 1.2 | Target cộng dồn |
|---|---|---|---|
| Features | F01–60 | F61–72 | 72 ID; không đồng nghĩa 72 đã code |
| Screens | U01–35 | U36–38, sửa mapping U01–35 | 38 screen contracts |
| Không gian | L01–18 | L19–22 | 22 logical spaces; có thể dùng instance/reuse asset |
| Dữ liệu | DB01–44 | DB45–50 | 50 logical IDs; không phải 50 bảng SQL |
| API contracts | API01–13 | API14–17 | 17 contract IDs; SP có thể dùng local commands |
| QA suites | QA01–24 | QA25–32 | 32 nhóm kiểm thử, không phải số test case |
| WBS | T00–T10 đã có | T11-01–10 | 10 work packages mới, không tính là đã hoàn thành |
| Save | Schema 2 đang dùng | Schema 3 đề xuất | Chỉ đổi khi implement/migration/recovery đã pass |

Tất cả F61–72: **Documented = có đặc tả; Implemented = chưa; Tested = chưa; RealismReviewed = chưa**. Chưa chạy benchmark, browser flow custody hoặc Supabase staging trong đợt tài liệu. Các kết quả 23 test cũ chỉ là bằng chứng cho baseline đã kiểm trước, không chuyển sang cột Tested của tính năng mới.

## 2. Change impact và giải quyết xung đột tài liệu cũ

| Điều hiện tại | Quyết định cho mode VN | Điều giữ lại |
|---|---|---|
| README blueprint nói workspace chưa có game | Đọc là lịch sử hồ sơ thiết kế; 13 và IMPLEMENTATION_STATUS mô tả hiện trạng | Không xóa bằng chứng lịch sử |
| U03 Start tạo ngay game | Sang U36 và confirm mới tạo lineage | Ngoại hình/draft không mất |
| F02/33 bắt đầu giống nhau, giường 3A | Placement theo scenario/decision | Legacy giữ 3A |
| F28 không nhốt người chơi, khu có người thì sắp đóng | Tách cửa tiện ích với custody boundary; return safety trước khóa | Không đóng collider vào actor; essentials có đường khác |
| F52 chỉ hạn chế đặc quyền tùy chọn, không arbitrary solitary | VN có order buồng kỷ luật có căn cứ, bounded, review và dịch vụ tại chỗ | Không tùy tiện/quy lỗi từ reputation; vẫn có hỗ trợ và menu |
| `rightsFloor` chứa “liên hệ hỗ trợ” | Giữ hỗ trợ/care/review; tách family visit khỏi help/legal channel | Không coi mọi liên lạc là một Boolean luôn mở |
| F35/56 chuyển tới 7B | Tìm chỗ tương thích, saga source/destination | Ledger/property/reservation invariants |
| F57/Q06 ngày 7 ra cơ sở | Mode VN tách kết chương và release | Legacy story cũ giữ kết thúc cũ |
| L02 là khu ở duy nhất | L19–22 phục vụ mode VN, L02 legacy | Reuse asset không reuse quyền sai |
| Mọi ngoại hình/đồng phục đều tự chọn tự do | Chính sách thẩm mỹ của VN cần đối chiếu nội quy; có preview trước confirm | Không dùng ngoại hình suy nhân thân/nhóm pháp lý |
| Save schema 2, SQL chặn trên 2 | v3 migration có backwards compatibility/cloud capability gate | Giữ save cũ và hai thế hệ recovery |
| Blueprint chỉ desktop, source có touch/gamepad | Mapping 15 quy định cả input đang có, QA mới ghi rõ thiết bị | Không tuyên bố mobile production-ready từ emulator |
| UK/UN reference đời sống | Chỉ làm nguồn tham khảo đúng phạm vi; policy VN có ledger riêng | Không tự chuyển định mức UK sang VN |

Tài liệu mới ưu tiên các delta này trong `vn_custody`. Với nội dung không được thay rõ, C0/C-UI/privacy/performance/QA nền vẫn áp dụng. Không dùng delta để tuyên bố đã hoàn thành các QA còn thiếu trong IMPLEMENTATION_STATUS.

## 3. WBS theo dependency

| Task | Owner đề xuất, độ phức tạp | Đầu ra review được | Phụ thuộc / gate |
|---|---|---|---|
| T11-01 | BA/research + chuyên gia luật VN, L | Pin nguồn/hiệu lực, xử lý VN10, fulltext VN05/06, rule ledger và scope signed review | Trước publish profile; spec draft có thể viết/test fiction trước |
| T11-02 | UI + domain, M | U36 draft/setup/preview/confirm, catalog preset và validation F61 | T11-01 rule baseline; AC61/QA25 |
| T11-03 | Domain/content, L | DB45–47, judgment/progress/classification, biên 15 năm, fixture term/life/aggregate | T11-01; F62/63 |
| T11-04 | Level/art + physics/AI, XL | L19–22/rooms/anchors/cohorts và compatibility placement, asset QC | T11-03 classification contract; QA26/27 |
| T11-05 | Gameplay/physics/AI, XL | Shared evaluator, boundaries, per-actor nav, routine/return/night, revalidation | T11-03/04; F64/65, QA27 |
| T11-06 | Domain/narrative + reviewer, L | F66/67 decisions/orders, U33/38, giam riêng/kỷ luật distinct, reversal | T11-01/03/05; QA28 |
| T11-07 | Gameplay/UI, L | Reconcile services, chapters/quests và capability methods trên U01–38 | T11-05/06; F68/72, QA29/32 |
| T11-08 | Domain/narrative, L | Transfer saga, judgment amendments, chapter/release split, ending receipts | T11-03/05/06/07; F69/70, QA30 |
| T11-09 | Persistence/backend, L | Save v3, resume/draft migration, SQL/RPC plan implemented ở giai đoạn code, staging/cloud negotiation | DB contracts ổn định; F71, QA31 |
| T11-10 | QA + UX + realism reviewers, XL | Run VN-SC01–24, regression base, report từng evidence, supported devices và release note đúng scope | Các package tương ứng; QA25–32/Gate VN |

M/L/XL là độ phức tạp tương đối, không phải số ngày AI code. Chưa có velocity, asset/reviewer capacity nên không chốt lịch giả. Khi estimate, tách effort BA/legal, gameplay, art, content, QA, mobile và backend; không cộng nguyên ngân sách blueprint 1.1 vào phần game đã có. T11-10 không chỉ là chạy một lệnh test; gồm kiểm tác vụ người thật và review nội dung.

### Thứ tự triển khai đề xuất sau khi người dùng yêu cầu code

1. Pin policy và fixture; giữ legacy chạy được. Một lát cắt có U36, term A/B và life, một room mỗi nhóm, khóa đêm và save/resume.
2. Chứng minh evaluator chặn mọi đường crossing/command trước làm đẹp phòng; acceptance route không dùng teleport helper.
3. Thêm giam riêng và buồng kỷ luật, dịch vụ tại buồng, hết/hủy order và quay về.
4. Tích hợp transfer, chapter/release, full UI mapping, cloud v3 và input đã hỗ trợ.
5. Gate VN cùng hồi quy base; không mở tất cả preset nếu chúng vẫn có CTA/nhiệm vụ hỏng.

Không phải yêu cầu đổi engine hoặc thêm server game. Không code trong đợt hiện tại.

## 4. RTM F61–72

| Feature / AC | UI | Data | Task | QA / scenario evidence cần có |
|---|---|---|---|---|
| F61 / AC61 | U03/36/05/26 | DB45/46 | T11-02 | QA25; VN-SC01/02 |
| F62 / AC62 | U09/26/35/37 | DB46/28 | T11-03 | QA25/30; VN-SC03/04/20 |
| F63 / AC63 | U26/34/37 | DB30/47 | T11-03/04 | QA26; VN-SC05–08 |
| F64 / AC64 | U06/13/16/17/37 | DB48/49 | T11-05 | QA27; VN-SC09–12 |
| F65 / AC65 | U06/17/37/38 | DB48/49 | T11-05 | QA27/30; VN-SC10/11/18 |
| F66 / AC66 | U30/33/38 | DB40/48 | T11-06 | QA28; VN-SC13–16 |
| F67 / AC67 | U26/31/34/37/38 | DB30/38/48 | T11-04/06 | QA26/28/32; VN-SC17 |
| F68 / AC68 | U08/16/27–32 | DB31/35/36/38/39/49 | T11-07 | QA29; VN-SC12/15/19 |
| F69 / AC69 | U05/26/34/37 | DB42/46/47/48 | T11-08 | QA30; VN-SC08/18/21 |
| F70 / AC70 | U12/19/35/37 | DB43/46/48 | T11-08 | QA30; VN-SC20/22 |
| F71 / AC71 | U05/20/25/36–38 | DB19/45–50 | T11-09 | QA31; VN-SC18/21/23 |
| F72 / AC72 | U14/36/37/38 | DB45/50 | T11-01/07/10 | QA32; VN-SC24 |

Feature cũ bị tác động phải hồi quy: F01/02/04/05/06/07/15/18/19/20/21/22/23/26/28/30/31/33/35/37/39–48/50/52/56/57/58/60. RTM này là phần bổ sung, không xóa RTM 08/12 hoặc yêu cầu security/performance nền.

## 5. QA25–QA32

| QA | Nội dung | Điều kiện pass | Bằng chứng |
|---|---|---|---|
| QA25 | Setup/sentence validation/progress | Catalog + invalid values, term/life/aggregate, draft/back/reload/duplicate, pin version; không nhầm ngày chương | Unit tables + browser keyboard/touch/gamepad flow |
| QA26 | Classification/cohort/housing | Biên 15, giảm đủ/chưa đủ, tái phạm nguy hiểm, ngoại lệ cùng khu khác buồng, hết chỗ | Deterministic fixtures + housing/decision traces + scene screenshots |
| QA27 | Movement/routine enforcement | Mouse/keyboard/touch/gamepad đều bị cùng rule; swept crossing; staff-open door; slot/recovery/fast-forward không bypass | Physics/session tests + browser tuyến thật, video trước/sau boundary |
| QA28 | Kỷ luật/giam riêng | Bounded decision, notice/response/review, separation khác punishment, expiry/revoke và family restriction độc lập | State machine tests + scenario screenshots/timeline |
| QA29 | Services/rights/methods | Essential services at room, contact channels, booking/work exemption, remote inventory không vượt quyền | Domain + UI integration, conservation checks |
| QA30 | Transition/time/chapter/release | Reserve/commit/recovery; date/calendar fixtures; ngày 7 không thả; life không hết hạn; release không cần max goals | Fault injection tại stages, outcome ledgers, chapter/ending browser flow |
| QA31 | Save v3/cloud/reload | v1/v2 unchanged legacy; v3 complete graph; schema mismatch; policy pin; quota/UTF-8/SQL limits; không reset order | Fixtures trước/sau migration, local E2E, staging RPC/RLS khi có cloud |
| QA32 | UI/content/privacy/realism coverage | 38 màn có mapping, unsupported rõ; source/fiction labels; hỗ trợ input; không suy identity/guilt | Checklist theo context, accessibility/device captures, reviewer notes |

Bộ test mới phải kiểm kết quả nghiệp vụ, không chỉ assert các field bằng hằng đã viết. Test helper đặt tọa độ trực tiếp có thể tạo fixture nhưng không dùng để chứng minh movement đúng. Không viết test mới trong lần chỉ bàn giao docs.

## 6. Acceptance scenario pack VN-SC01–24

Mỗi scenario phải ghi build/commit, profile+scenario hash, initial state, commands/input, expected domain state, expected UI text, failure injection và actual evidence. Các hàng dưới là **test specification, chưa chạy**.

| ID | Given / When | Then bắt buộc |
|---|---|---|
| VN-SC01 | Draft mới; thử toàn bộ 10 preset và Start hai lần | Một lineage/lần intent, judgment đúng; 30 năm là aggregate; từng preset có đoạn playable, không chỉ badge |
| VN-SC02 | Term 0/âm/2 tháng/241 tháng một tội/361 tháng tổng hợp/số lẻ/NaN; Back/reload/content đổi | Chặn invalid domain+UI, giữ draft; stale buộc preview lại; random tóc không đổi sentence |
| VN-SC03 | Life, chơi và tua qua nhiều chương | Không có ngày hết án/0 ngày còn lại; recap ghi còn chấp hành, không settlement |
| VN-SC04 | Có prior credit và served period theo fixture, chạy qua ngày nhuận/cuối tháng | Không double credit; calendar đúng dữ kiện đã duyệt; unknown không phát ngày giả |
| VN-SC05 | Term đúng 15 năm so với trên 15 năm; không tái phạm nguy hiểm | Đúng 15 → A, trên 15 → B; text làm tròn không quyết định group |
| VN-SC06 | Án trên 15, còn dưới 15 do thời gian tự chạy nhưng chưa có giảm | Không tự chuyển A; U37 giải thích classification hiện hành |
| VN-SC07 | Án trên 15 đã giảm, còn đúng 15 rồi dưới 15; có decision | Đúng 15 chưa đạt điều kiện dưới; dưới 15 và đủ quyết định mới chuyển; không cùng phòng cohort xung đột |
| VN-SC08 | Tái phạm nguy hiểm; chưa/đã đủ nửa và chưa/đã giảm; ngoại lệ bố trí cùng khu | Đủ đúng conditions+decision mới đổi group; cùng khu không chung room trái cohort; hết chỗ giữ source hợp lệ |
| VN-SC09 | Cửa mở cho staff; player chưa có grant đi theo, chạy chéo qua boundary | Staff làm task đúng; player bị từ chối có reason; không lọt cửa bằng khung hình/dt lớn |
| VN-SC10 | Đang hoạt động thì đến giờ về, đường bị bảo trì hoặc NPC chặn | Có return grant/alternative, không bị đóng collider vào người; không incident do lỗi hệ thống |
| VN-SC11 | Đêm ở buồng, thử WASD/touch/gamepad/map/slot/safe recovery | Chỉ trong phạm vi hợp lệ; mọi input cùng kết quả; menu/save/help còn dùng |
| VN-SC12 | Đặt action khi allowed, order đổi trước commit; gọi command trực tiếp từ UI | Recheck revision, compensate reservation/booking, không reward/di chuyển trái quyền |
| VN-SC13 | Sự việc không đủ evidence hoặc có exemption hợp lệ | Dismiss/correct, không tạo order L22 hoặc hạ uy tín tự động |
| VN-SC14 | Decision buồng kỷ luật hợp lệ; thử duration vượt 10 ngày và order lặp cùng source | Reject invalid; order hợp lệ có start/end/issuer/reason; không nối lén cùng sự việc |
| VN-SC15 | Ở L22, yêu cầu ăn/nước/vệ sinh/care/review và đặt gặp người thân | Dịch vụ đúng phương thức; family restriction có giải thích riêng; không khóa mọi hỗ trợ hoặc tự cho đi L08 |
| VN-SC16 | Appeal đang pending, sau đó revoke hoặc expiry; restriction gặp chưa hết | Pending không tự unlock; revoke/expiry trả đúng housing; U29 vẫn phản ánh restriction riêng |
| VN-SC17 | Separation không phải kỷ luật; đổi ngoại hình; thử specialist chưa publish | Không incident/countdown kỷ luật; không đổi placement do tóc; unsupported không Start giả |
| VN-SC18 | Save/reload ngay trước/sau khóa đêm, expiry, chuyển L22 và return | Giữ room/clock/order/grants/camera/panel; không cấp quyền tự do một frame trước bootstrap |
| VN-SC19 | Bị chuyển do hệ thống trùng ca học/làm/call/order ready | Excuse/rebook/method phù hợp; không phạt vắng, trừ tiền/lượt hoặc phát đồ hai lần |
| VN-SC20 | VN term và life tới ngày 7/Q06; legacy tới mốc cũ | VN chỉ recap chương, còn án; legacy giữ ending cũ; term eligible không tự release vì XP |
| VN-SC21 | Crash/load failure tại reserve/stage/commit chuyển nơi | Một housing active, một outcome; source giữ trước commit, destination sau commit; tiền/đồ nguyên vẹn |
| VN-SC22 | Term đủ mốc/decision release theo fixture nhưng thiếu goal; retry depart | Release không bị khóa bởi goal; settlement/trả đồ một lần; reload ending không chạy routine |
| VN-SC23 | v1/v2 migration, v3 missing policy/refs/corrupt, quota, cloud SQL cũ, old client | Legacy không bị gán án; recovery giữ file; local v3 không báo sync thành công nếu server chưa hỗ trợ |
| VN-SC24 | Review U01–38 trên C01–12, keyboard/touch/gamepad, zoom/text 200%, offline source link | Đủ nhãn/mapping/reasons/focus, không riêng màu/hover; private facts không ra HUD công khai; unknown/research gaps đúng nhãn |

### Cross-matrix coverage

- Tất cả 10 preset: setup → intake → housing → một ngày routine → checkpoint/reload → chapter recap. Dùng boundary custom để bổ sung, không thay kiểm từng preset.
- A và B: ngày/đêm/hoạt động/return/care/transfer; life tối thiểu có routine, separation tương thích và no-release.
- Giam riêng/kỷ luật: discipline vs non-discipline, active/expiry/revoke, save ở mỗi transition stage, service method và contact restrictions.
- Input: mọi mutation/quyền quan trọng có keyboard/mouse/touch/gamepad parity; browser/thiết bị thực theo danh sách được công bố sau QA, không tự nhận emulator là máy thật.
- Án/phân khu/order không tương thích được kiểm bằng negative cases. Variant chưa hỗ trợ cũng phải có UI/test xác nhận không tạo phiên sai.

## 7. Gate VN — chưa mục nào được đánh dấu đạt

- [ ] T11-01 xác định hiệu lực/amendments liên quan, fulltext VN05/06, source pin và chuyên gia VN review các rule áp dụng.
- [ ] F61–72 có implementation evidence, AC61–72 và VN-SC01–24 pass; không lấy số trang tài liệu làm phần trăm game hoàn thành.
- [ ] Toàn bộ preset được mở có playable content, đủ vòng lifecycle; custom generator chỉ mở khi valid/negative fixtures pass.
- [ ] U01–38 và L19–22 có kiểm mapping/input/collision/camera/recovery; cơ chế giam giữ thực thi cả domain và boundary.
- [ ] Judgment/progress/classification và orders không xung đột; kỷ luật/giam riêng khác nhau; không release ngày 7 hoặc life countdown giả.
- [ ] Có dịch vụ tại buồng, lịch miễn/đổi hợp lệ, privacy, appeal/reversal, atomic transfer và settlement invariants.
- [ ] v1/v2 giữ nguyên legacy; v3 local/resume/cloud staging/version negotiation không mất dữ liệu; lỗi policy/schema có recovery usable.
- [ ] QA nền vẫn đạt: save/RLS/security/physics/perf/accessibility/device/long-session/content review; những gate chưa đạt ở báo cáo cũ vẫn là chưa đạt.
- [ ] Công bố đúng mức “tham chiếu pháp luật/cơ sở hư cấu”, supported variants và phần chưa mô phỏng; không quảng cáo “100% mọi nhà tù Việt Nam”.

## 8. Rủi ro/nghiên cứu còn mở và owner

| ID | Khoảng trống | Owner và điều kiện đóng |
|---|---|---|
| VN-O01 | CSDL báo Luật 127 hết hiệu lực một phần; chưa xác định đủ tác động lên rules dùng | Legal/research: so sánh bản hợp nhất/amendments, chốt điều khoản áp dụng trước publish |
| VN-O02 | NĐ170 scan và TT96 attachment chưa đọc đầy đủ | Research: lấy bản toàn văn chính thức/OCR + kiểm trang gốc; legal review các định mức, trình tự và nội quy |
| VN-O03 | Chính sách hair/outfit/vật dụng hiện cho tự chọn rộng | Content/legal: mapping nội quy → allowed cosmetics/items theo profile, giải thích trước confirm; không dùng mỹ thuật hư cấu để claim đúng quy định |
| VN-O04 | Chưa nghiên cứu thực tế đa cơ sở và người có trải nghiệm | BA: consented research, ghi mẫu/giới hạn/bất đồng; chuyên gia rà soát; không suy mỗi cơ sở đều vận hành như nhau |
| VN-O05 | Lịch cơ sở, mức lao động/học, điều kiện hoạt động và hạn mức liên lạc chi tiết | Legal + content: policy tables có nguồn/version và variants; trước đó chỉ gắn nhãn fiction, không tự dùng giờ cũ như luật |
| VN-O06 | Tính hạn, credit, thay đổi án và ngày release có ngoại lệ | Legal/domain: duyệt calendar fixtures và phạm vi calculator; không nhận hồ sơ thật hoặc suy án từ tội danh |
| VN-O07 | Nữ/người nước ngoài/thai sản/con theo mẹ/y tế/giới tính/remand | Specialist + product: mỗi profile có content, placement, channels, source và QA; chưa có thì reference-only |
| VN-O08 | Chưa có asset budget/perf thật cho L19–22 hoặc chứng nhận mobile | Art/tech/QA: blockout route rồi đo máy thật; reuse không bảo đảm FPS |
| VN-O09 | Scope creep sang tử hình/cộng đồng/hậu giam giữ/MP | Product: giữ disposition rõ ở 13; mỗi campaign có change request và estimate riêng, không mở nút giả |
| VN-O10 | Docs và source đang thay đổi đồng thời | Maintainer: đối chiếu fingerprint/audit với commit khi bắt đầu code; refresh finding đã lệch, không ghi đè thay đổi của tác giả khác |

Không cần user xác nhận lại để hoàn tất tài liệu này. Các gate trên là điều kiện sản xuất nội dung/phát hành, không phải yêu cầu người dùng cho phép mỗi bước viết docs.

## 9. Checklist review tài liệu bàn giao

Kiểm local links tồn tại; fence đóng; ID mới không đè baseline; F61–72 có AC/UI/data/task/QA; U36–38 có contract và U01–35 có delta; L19–22 có room/boundary/service/restore requirements; scenario 24 hàng có kết quả; nguồn có ngày/status; IMPLEMENTATION_STATUS đánh dấu tính năng mới chưa code. Kiểm tra cấu trúc không xác nhận pháp lý, runtime hay hình ảnh đã đạt.

### Kết quả kiểm tra cấu trúc thực chạy — 02/11/2026

Đã kiểm 20 file Markdown gồm blueprint, README dự án và IMPLEMENTATION_STATUS: 183 liên kết file nội bộ tồn tại (gồm 84 link inventory), code fences đóng đủ. Các chuỗi ID mới liên tục/không lặp định nghĩa: F61–72 (12), U36–38 (3), L19–22 (4), DB45–50 (6), API14–17 (4), QA25–32 (8), T11-01–10 (10), VN-SC01–24 (24). Bảng mapping có đủ U01–38 và 12 context C01–12; từng feature mới có AC, UI, DB, task và QA. `git diff --check` trên tài liệu tracked không báo lỗi whitespace. Đã kiểm lại encoding chú thích tiếng Việt và fingerprint cả 84 file inventory, không còn lỗi ở lần kiểm cuối.

Inventory 13 ghi 84 file đầu vào với fingerprint tại thời điểm quét, gồm 15.170 dòng. Đây là kiểm tra tài liệu và phạm vi audit, **không phải** kiểm thử game, render Mermaid, legal sign-off hoặc chứng minh đã đọc hiểu/kiểm chứng mọi dòng. Không chạy npm tests/build vì lần này chỉ sửa Markdown. Các source thay đổi có sẵn/đang được tác giả khác cập nhật không thuộc thay đổi triển khai của CR này.
