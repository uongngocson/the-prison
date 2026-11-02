# 13 — Audit hiện trạng và căn cứ cho mô phỏng giam giữ Việt Nam

Revision 1.2, 02/11/2026, Asia/Saigon. **Chỉ đặc tả, chưa triển khai.** Đọc tiếp [14 — nghiệp vụ](14-sentence-custody-spec.md), [15 — UI và không gian](15-custody-ui-mapping.md), [16 — hợp đồng tích hợp](16-custody-contracts.md), [17 — backlog và nghiệm thu](17-custody-delivery-qa.md).

## 1. Yêu cầu và cách hiểu có thể kiểm chứng

Người chơi muốn chọn mức án ngay trong setup và trải nghiệm sự khác biệt có hệ quả thật trong game: phòng ở, phạm vi đi lại, lịch, hoạt động, liên lạc, quyết định chuyển nơi và kỷ luật. Chỉ đổi nhãn “3 năm” thành “chung thân” trên một thế giới đi lại như cũ không đạt yêu cầu.

Đích BA là bao phủ toàn bộ yêu cầu của baseline 1.2 bằng ID, luật, UI, dữ liệu, đường lỗi và tiêu chí kiểm thử. Không có bằng chứng cho tuyên bố “100% thực tế ở mọi trại giam”. Pháp luật quy định điều phải thực hiện; việc cơ sở thực hiện ra sao còn cần nghiên cứu thực địa, phỏng vấn có đồng thuận và chuyên gia kiểm tra. UI game là thiết kế, không có một bộ giao diện được pháp luật quy định tương ứng từng năm tù.

Nhãn bằng chứng: **[C]** đọc được trong code hiện tại; **[V]** nội dung đã đối chiếu nguồn chính thức; **[D]** quyết định thiết kế; **[U]** chưa xác minh đủ. Các phần 14–17 mặc định là [D], dù lấy phân biệt nghiệp vụ từ [V].

## 2. Phạm vi rà soát dự án

Đã lập inventory và quét toàn văn các tài liệu blueprint, source ứng dụng, tests, scripts trình duyệt và cấu hình công khai; đọc sâu chuỗi setup → khởi tạo → tiếp nhận → phân giường → lịch/cửa/di chuyển → dịch vụ/kỷ luật → chuyển nơi/kết thúc → save/resume. Inventory cuối file ghi đường dẫn và fingerprint để có thể đối chiếu lại. Quét toàn văn bằng công cụ không thay cho việc reviewer xác nhận từng dòng; không dùng cụm “đã chứng nhận 100% code”.

Không đọc giá trị secrets trong `.env`, không đưa dependency/vendor, build output, lịch sử Git hay ảnh sinh từ QA vào phạm vi chứng nhận. Các file đang được sửa ở working tree là đầu vào đọc, không bị chỉnh trong lần bàn giao tài liệu này. Không chạy test game trong đợt chỉ viết đặc tả; bằng chứng test cũ ở IMPLEMENTATION_STATUS không chứng minh tính năng mới.

| Thành phần | Bằng chứng [C] | Kết luận cho mở rộng |
|---|---|---|
| Setup | `src/ui/screens/Create.tsx`; `CharacterDraft` trong `src/domain/newgame.ts` | Chỉ tên, ngoại hình, gia đình; không có mức án |
| Hồ sơ | `Episode`, `LegalStatus`, `HousingAssignment` trong `src/domain/types.ts` | Có tên trạng thái, chưa có mô hình bản án/thời gian đã chấp hành |
| Chính sách | `POLICY_PROFILE` trong `src/content/life.ts` | Một profile hư cấu, hỗ trợ `sentenced`; không phải registry luật Việt Nam |
| Tiếp nhận | `createLifeState`, `admissionStep`, `skipAdmission` trong `src/domain/life.ts` | Mặc định `sentenced`, giường 3A; bỏ qua trình bày cũng phân cùng giường |
| Chuyển phòng | `PLAYER_START_BED`, `ROOM_MOVE_DEST_BED`, `confirmTransition` | Điểm đến cố định 7B, không xét phân loại pháp lý |
| Di chuyển | `GameSession.movePlayer`, `refreshDoors` trong `src/simulation/session.ts` | Kiểm vật cản/giờ/thời tiết/sự kiện; chưa có quyền qua ranh giới theo người |
| Cửa phòng | `CELL_DOORS` trong `src/content/world.ts`; phần cell doors trong `worldBuilder.ts` | Cửa trang trí mặc định mở; không đủ chứng minh giam giữ có hiệu lực |
| Vật lý/AI | `src/physics/physics.ts`, `src/simulation/nav.ts`, `npcAi.ts` | Door collider và graph khu chưa phân quyền từng actor |
| Hoạt động | `zoneOpen`, `verbsFor`, `commitAction` trong `src/domain/actions.ts` | Đang dựa nhiều vào khu mở và lịch; cần xét lại quyền khi commit |
| Kỷ luật | `advanceIncidents`, `recreationRestrictedUntil` | Nhắc nhở/hạn chế giải trí tối; chưa có lệnh vào/ra buồng kỷ luật |
| Màn hình | `App.tsx`, `store.ts`, `LifeHub.tsx`, HUD, Panels, Profile | Có hub U26–35 để tái sử dụng; không có setup mức án hay bảng quyền di chuyển |
| Ending | `releaseEligible`, `depart`, `releaseEligibleDay: 7`; Q06 | Mốc truyện 7 ngày không phải hết án; phải tách ở mode mới |
| Lưu | `saveCodec.ts`, `resume.ts`, `localStore.ts`, `cloud.ts` | Schema 2; checkpoint giữ state/UI/camera; thiếu hợp đồng dữ liệu custody |
| Cloud | `supabase/migrations/0001_core.sql` | `schema_version between 1 and 2`; save v3 sẽ bị chặn nếu chưa migration |
| Test | `tests/sim.test.ts`, `journey.test.ts`, `resume.test.ts`; scripts | Test hành trình cũ và recovery; chưa test mức án/phân khu/buồng kỷ luật |
| Đa thiết bị | `device.ts`, `TouchControls.tsx`, `MobileHud.tsx`, `styles.css` | Có code touch/gamepad đang phát triển; blueprint desktop cũ không đại diện đầy đủ working tree |
| Hình ảnh | `characters.ts`, `worldBuilder.ts`, `gameView.ts`, audio | Thế giới thủ tục; song sắt/đồng phục không chứng minh nghiệp vụ đúng |

## 3. Sổ nguồn Việt Nam, kiểm tra ngày 02/11/2026

Chỉ dùng nguồn chính thức cho kết luận pháp lý. Không dùng bản dịch tiếng Anh, diễn đàn, dự thảo hoặc lịch sinh hoạt trên báo làm luật áp dụng. Giữ cả ngày hiệu lực và giới hạn đọc được.

| Ref | Nguồn, trạng thái truy cập | Phạm vi dùng |
|---|---|---|
| VN01 | [Bộ luật Hình sự, VBHN 135/VBHN-VPQH ngày 05/09/2025](https://datafiles.chinhphu.vn/cpp/files/vbpq/2025/9/135-vbhn-vpqh.pdf), PDF trích xuất được | Điều 32, 38, 39, 55, 65; loại hình phạt và giới hạn preset |
| VN02 | [Luật Thi hành án hình sự 127/2025/QH15, Công báo 34](https://congbaocdn.chinhphu.vn/180507251028987904/2026/1/23/cong-bao-so-34-ngay-21-01-46932signed-17691535683541772504189.pdf), trích xuất qua tìm trong PDF được; mở trực tiếp có lần timeout | Điều 26, 41; phân khu và buồng kỷ luật |
| VN03 | [Giới thiệu Luật 127 trên Cổng Chính phủ](https://xaydungchinhsach.chinhphu.vn/noi-dung-co-ban-cua-luat-thi-hanh-an-hinh-su-so-127-2025-qh15-119260130151202311.htm), đọc được | Hiệu lực 01/07/2026; đối chiếu việc bổ sung phân khu; không thay toàn văn |
| VN04 | [Luật 128/2025/QH15](https://chinhphu.vn/?classid=1&docid=216508&orggroupid=1&pageid=27160), metadata đọc được; PDF lớn chưa trích xuất đầy đủ | Xác nhận có luật riêng về thi hành tạm giữ, tạm giam và cấm đi khỏi nơi cư trú, hiệu lực 01/07/2026; chưa công bố profile remand hoàn chỉnh |
| VN05 | [Nghị định 170/2026/NĐ-CP](https://vanban.chinhphu.vn/?classid=1&docid=218166&pageid=27160&typegroupid=4), ban hành 15/05/2026, hiệu lực 01/07/2026; PDF 50 trang là scan, chưa đọc đủ bằng OCR | Đầu vào bắt buộc cho review định mức, sinh hoạt, phân loại và thi hành kỷ luật; không tự điền thông số từ nhan đề |
| VN06 | [Thông tư 96/2026/TT-BCA](https://congbao.chinhphu.vn/van-ban/thong-tu-so-96-2026-tt-bca-469919.htm), ban hành 19/06/2026, hiệu lực 01/07/2026; metadata đọc được, tải PDF trả 502 | Nội quy phạm nhân là nguồn cần đối chiếu đầy đủ; chưa xác nhận từng quy tắc vận hành |
| VN07 | [Thông tư 88 — chế độ gặp, phần Điều 3 được Chính phủ công bố](https://xaydungchinhsach.chinhphu.vn/quy-dinh-che-do-gap-cua-pham-nhan-ap-dung-tu-1-7-119260701151022398.htm), đọc được | Quy tắc liên lạc gia đình phải xét quyết định hạn chế, không chỉ mức án |
| VN08 | [Thông tư 88 — nhận quà, nhận/gửi thư](https://xaydungchinhsach.chinhphu.vn/quy-dinh-ve-viec-pham-nhan-nhan-qua-nhan-gui-thu-119260701160225405.htm), đọc được | Tách quy tắc thư/quà khỏi quyền ra khỏi buồng |
| VN09 | [Thông tư 88 — tiền và đồ lưu ký](https://xaydungchinhsach.chinhphu.vn/quy-dinh-quan-ly-tien-va-do-luu-ky-cua-pham-nhan-pham-nhan-nhan-va-su-dung-tien-luu-ky-119260702152947759.htm) | Nguồn bổ sung cần reviewer đối chiếu toàn văn trước khi thay economy hư cấu; không coi đã nghiệm thu |
| VN10 | [Lịch sử hiệu lực Luật 127 tại CSDL quốc gia](https://vbpl.moj.gov.vn/bocongthuong/Pages/vbpq-lichsu.aspx?ItemID=187035&Keyword=) | CSDL báo hết hiệu lực một phần/có sửa đổi; bắt buộc xác định phần ảnh hưởng trước publish policy, không coi mọi điều của bản gốc còn nguyên |

### Tóm tắt pháp lý đã đối chiếu

**VN01 [V]:** Cá nhân có bảy hình phạt chính; tù có thời hạn và chung thân là hai hình phạt tù. Một tội có khung tù từ 3 tháng đến 20 năm; tổng hợp theo Điều 55 có giới hạn 30 năm. Án treo không thêm một hình phạt chính. Các nhóm pháp nhân không phải nhân vật tù nhân.

**VN02 [V]:** Điều 26 phân khu trên 15 năm/chung thân/tái phạm nguy hiểm và nhóm còn lại theo điều kiện luật, có ngoại lệ bố trí khu nhưng không chung buồng. Có trường hợp giam riêng. Điều 41 có khiển trách, cảnh cáo, buồng kỷ luật đến 10 ngày; cần quyết định bằng văn bản. Giam riêng khác buồng kỷ luật.

**VN07 [V]:** Chế độ gặp có ngoại lệ và hạn chế do vi phạm; đang ở buồng kỷ luật không gặp người thân thích. Ra khỏi buồng không tự chứng minh mọi hạn chế gặp đã hết. Liên lạc gia đình và yêu cầu hỗ trợ pháp lý/chăm sóc phải là các capability riêng.

Các đoạn trên là tóm tắt giới hạn, không thay toàn bộ điều luật. Quy tắc game ở phần 14–17 là thiết kế mới, không sao chép mô hình vận hành một cơ sở cụ thể.

## 4. Các kết luận BA cần tránh

| Suy luận sai | Cách mô hình hóa trong baseline mới [D] |
|---|---|
| 3/5/10/15 năm là bốn chế độ nhà tù riêng | Các giá trị thời hạn, có thể cùng profile sinh hoạt và phân nhóm; khác tiến độ hồ sơ |
| Trên 15 năm luôn bị biệt giam | Phân nhóm ban đầu khác; lệnh giam riêng/kỷ luật là dữ liệu độc lập |
| Án còn 14 năm tự chuyển nhóm | Xét cả án đã tuyên, quyết định giảm, điều kiện và quyết định phân loại; không đổi chỉ do đồng hồ chạy |
| Chung thân là 30 năm | `life` không có ngày hết án mặc định |
| Uy tín cao tự giảm án | Chỉ sự kiện quyết định có thẩm quyền trong kịch bản mới thay hồ sơ |
| Đang đóng cửa nghĩa là mọi người bị cấm qua | Cửa vật lý, quyền từng actor, lịch và nhiệm vụ nhân viên là bốn lớp riêng |
| Có quyền chăm sóc nghĩa là tự đi tới L08 | Có thể yêu cầu và được phục vụ tại chỗ/chuyển có phép |
| Hoàn thành Q06 nghĩa là được thả | Kết thúc chương riêng với kết thúc thi hành án |
| Body/tóc quyết định giới hay nơi giam | Metadata kịch bản giam giữ độc lập ngoại hình |
| Đọc luật đủ để cam kết thực tế toàn quốc | Profile ghi nguồn, hiệu lực, status review và giới hạn nghiên cứu |

## 5. Disposition cho toàn bộ nhóm án/trạng thái

| Nhóm | Setup bản 1.2 mục tiêu | Mapping và lý do |
|---|---|---|
| Tù có thời hạn | Chọn được khi content đã publish | U36 → U26 → phân nhóm → HUD/U37 |
| Chung thân | Chọn được khi content đã publish | Không đếm ngược ngày thả; vẫn có học/sinh hoạt và kết thúc chương |
| Cảnh cáo, tiền, cải tạo không giam giữ, trục xuất | Thẻ thông tin, không tạo phiên nhà tù tương ứng | Không tự gán phòng giam vì có tên hình phạt; gameplay cộng đồng cần scope riêng |
| Tử hình | Thông tin và trạng thái chưa hỗ trợ; không nút Start | Thiết kế chuyên biệt chưa có nghiên cứu/review; không biến thành chung thân hoặc buồng kỷ luật |
| Hình phạt bổ sung | Trường hồ sơ khi scenario có, chưa mở gameplay hậu giam giữ | Không tạo thêm “cấp nhà tù”; không ép chọn tội danh để chọn thời hạn |
| Án treo, tha trước hạn có điều kiện | Tham chiếu/đường chuyển trạng thái có kịch bản riêng | Không chọn làm một loại phòng; chưa mở chiến dịch ngoài cộng đồng |
| Tạm giữ/tạm giam | Thẻ riêng bị khóa, không gộp với `sentenced` | Nghiên cứu VN04 và subsystem riêng trước khi chơi được |
| Giam giữ riêng, kỷ luật, chăm sóc, chuyển nơi | Trạng thái trải nghiệm có mapping chi tiết | Không phải hình phạt chính; có scenario minh họa riêng sau setup mức án |
| Nữ, người nước ngoài, thai sản/trẻ theo mẹ, nhu cầu chuyên biệt | Đặc tả dữ liệu/UI và gate được theo dõi | Không suy diễn đã triển khai từ avatar; từng variant cần content và specialist review |

Phạm vi playable trước mắt [D]: người trưởng thành, profile kịch bản nam công dân Việt Nam, thi hành án đã có hiệu lực, không có nhu cầu chuyên biệt chưa được hỗ trợ. Thẻ nêu rõ phạm vi này trước xác nhận; không thu giới/án/tội danh thật của người chơi. Profile nữ và các biến thể khác không bị xóa khỏi roadmap nhưng không được nút “chơi” giả.

## 6. Quy tắc ưu tiên tài liệu

Phần 13–17 là change request **CR-VN-01** cho baseline mục tiêu 1.2. Chúng không xác nhận game đã nâng phiên bản. Với mode mới, hợp đồng chi tiết ở 16 ưu tiên các điểm xung đột đã liệt kê tại 17; mode hư cấu cũ giữ hành vi cũ. Không dùng các câu lịch sử “workspace chỉ có Markdown” ở hồ sơ 1.0/1.1 như mô tả hiện tại. IMPLEMENTATION_STATUS là báo cáo code, bảng mới luôn tách Documented/Implemented/Tested/RealismReviewed.

Mọi yêu cầu mở chỉ vì thiếu nghiên cứu đã có owner/gate ở 17. Không dừng việc đặc tả để xin duyệt một ý tưởng chưa có bản bàn giao cụ thể.

## 7. Inventory đầu vào

Inventory snapshot sau đồng bộ tài liệu: 2026-11-02T11:59:47.852Z. 84 files; 15170 lines; 1109483 bytes. Đã đọc toàn văn bằng công cụ để lập inventory; SHA-256 hiển thị 16 ký tự đầu. Đây là bằng chứng phạm vi quét, không phải kết quả chạy hoặc chứng nhận đã hiểu/kiểm chứng từng dòng. Source có thể tiếp tục được tác giả khác sửa sau mốc này. Không gồm dependencies, build output, lockfile, secrets hoặc chính 5 file đặc tả mới.

| File | Dòng | SHA-256 prefix |
|---|---:|---|
| [README.md](../../README.md) | 77 | 76757599d2bfc1a6 |
| [docs/IMPLEMENTATION_STATUS.md](../../docs/IMPLEMENTATION_STATUS.md) | 127 | 5ee90be3373dab8e |
| [docs/blueprint/01-research.md](../../docs/blueprint/01-research.md) | 100 | 33f400744dabb615 |
| [docs/blueprint/02-architecture.md](../../docs/blueprint/02-architecture.md) | 267 | febb85332a38f2bc |
| [docs/blueprint/03-world-assets.md](../../docs/blueprint/03-world-assets.md) | 422 | b497490b8830c080 |
| [docs/blueprint/04-gameplay.md](../../docs/blueprint/04-gameplay.md) | 484 | f20e841eebdf5fac |
| [docs/blueprint/05-ui-ux.md](../../docs/blueprint/05-ui-ux.md) | 385 | 9fbd38d05e65157b |
| [docs/blueprint/06-data-api-security.md](../../docs/blueprint/06-data-api-security.md) | 285 | 0daa51dfe578ee8e |
| [docs/blueprint/07-delivery-qa.md](../../docs/blueprint/07-delivery-qa.md) | 291 | cd24e1bfd3c6db2a |
| [docs/blueprint/08-traceability.md](../../docs/blueprint/08-traceability.md) | 257 | 35ffbf7ca76eeb77 |
| [docs/blueprint/09-realism-audit.md](../../docs/blueprint/09-realism-audit.md) | 102 | 19e03b2ddbc59a85 |
| [docs/blueprint/10-prison-life-systems.md](../../docs/blueprint/10-prison-life-systems.md) | 420 | 4cdb33ac7b9d0961 |
| [docs/blueprint/11-prison-life-contracts.md](../../docs/blueprint/11-prison-life-contracts.md) | 275 | 424663844d43314f |
| [docs/blueprint/12-realism-delivery.md](../../docs/blueprint/12-realism-delivery.md) | 145 | 49e12b80ec7ed887 |
| [docs/blueprint/README.md](../../docs/blueprint/README.md) | 82 | 957596fbe9be558f |
| [index.html](../../index.html) | 21 | 9f246e06cb58fe65 |
| [package.json](../../package.json) | 34 | f60072f93feb8704 |
| [public/icon.svg](../../public/icon.svg) | 2 | 8295747f8fefe438 |
| [public/manifest.webmanifest](../../public/manifest.webmanifest) | 12 | 262e55f4c85bbdee |
| [scripts/bars.mjs](../../scripts/bars.mjs) | 21 | d04936a89ce013dd |
| [scripts/dialogue.mjs](../../scripts/dialogue.mjs) | 35 | 9ecfc3649188691f |
| [scripts/home.mjs](../../scripts/home.mjs) | 16 | 052c3841e7f5c1e8 |
| [scripts/landing.mjs](../../scripts/landing.mjs) | 16 | 8f992ac2a0f4be38 |
| [scripts/mobile-audit.mjs](../../scripts/mobile-audit.mjs) | 34 | a4e033a2fc96a2cc |
| [scripts/mobile.mjs](../../scripts/mobile.mjs) | 48 | aeb723aeb1028642 |
| [scripts/panels.mjs](../../scripts/panels.mjs) | 29 | 19f139a9045062ac |
| [scripts/resume.mjs](../../scripts/resume.mjs) | 176 | a2824d1de08b437d |
| [scripts/smoke.mjs](../../scripts/smoke.mjs) | 67 | c32d2c6cb08ee263 |
| [scripts/tour.mjs](../../scripts/tour.mjs) | 40 | bbf6c2015cc71b0e |
| [src/App.tsx](../../src/App.tsx) | 76 | c6e170356b588a05 |
| [src/app/controller.ts](../../src/app/controller.ts) | 458 | b785231e8b31a3c4 |
| [src/audio/audio.ts](../../src/audio/audio.ts) | 131 | 7f9ce7e2c7fc917c |
| [src/content/dialogues.ts](../../src/content/dialogues.ts) | 323 | 8ce910c24371f1ff |
| [src/content/items.ts](../../src/content/items.ts) | 68 | e98ac978c5926ac7 |
| [src/content/life.ts](../../src/content/life.ts) | 138 | ea80587ced81c1e0 |
| [src/content/npcs.ts](../../src/content/npcs.ts) | 116 | d38891abcdc75bcf |
| [src/content/quests.ts](../../src/content/quests.ts) | 275 | 440690b15cb67c63 |
| [src/content/schedule.ts](../../src/content/schedule.ts) | 104 | a27023a0ca49c0c8 |
| [src/content/world.ts](../../src/content/world.ts) | 484 | 4c33005e0fe6fac1 |
| [src/domain/actions.ts](../../src/domain/actions.ts) | 316 | 10cd5beaa047deb1 |
| [src/domain/core.ts](../../src/domain/core.ts) | 252 | 066fc5a6915c4dc6 |
| [src/domain/dialogue.ts](../../src/domain/dialogue.ts) | 202 | ad16f26b20a68806 |
| [src/domain/life.ts](../../src/domain/life.ts) | 932 | db4f7c8ff1bd2e38 |
| [src/domain/newgame.ts](../../src/domain/newgame.ts) | 70 | 54ab1e7beffd1a0b |
| [src/domain/quests.ts](../../src/domain/quests.ts) | 222 | 3d540600d02a3eec |
| [src/domain/types.ts](../../src/domain/types.ts) | 265 | aebaee74571aedf3 |
| [src/domain/util.ts](../../src/domain/util.ts) | 105 | b903019133073883 |
| [src/main.tsx](../../src/main.tsx) | 11 | d77094aeb54f97fd |
| [src/persistence/cloud.ts](../../src/persistence/cloud.ts) | 73 | 90e2e5e16158d56a |
| [src/persistence/localStore.ts](../../src/persistence/localStore.ts) | 107 | 061a5591f0f9adb7 |
| [src/persistence/resume.ts](../../src/persistence/resume.ts) | 87 | f53a25daef3de612 |
| [src/persistence/saveCodec.ts](../../src/persistence/saveCodec.ts) | 85 | 97193248e0d5e5c3 |
| [src/physics/physics.ts](../../src/physics/physics.ts) | 160 | ac4e919465e331e8 |
| [src/presentation/characters.ts](../../src/presentation/characters.ts) | 257 | d52c2bb3a7ace06d |
| [src/presentation/gameView.ts](../../src/presentation/gameView.ts) | 380 | 2d429c763501afe0 |
| [src/presentation/palette.ts](../../src/presentation/palette.ts) | 9 | 37737135d9356bd3 |
| [src/presentation/worldBuilder.ts](../../src/presentation/worldBuilder.ts) | 436 | 2d52b983a43aee3b |
| [src/simulation/nav.ts](../../src/simulation/nav.ts) | 101 | 7e48cf6af28aa442 |
| [src/simulation/npcAi.ts](../../src/simulation/npcAi.ts) | 253 | 3e35864eec1d834b |
| [src/simulation/session.ts](../../src/simulation/session.ts) | 659 | 5e6a6dbc4077d4e8 |
| [src/ui/components.tsx](../../src/ui/components.tsx) | 83 | f293a70f1e577f76 |
| [src/ui/device.ts](../../src/ui/device.ts) | 71 | 48f1818e3a8fab55 |
| [src/ui/icons.tsx](../../src/ui/icons.tsx) | 59 | d8b7977da4602a1c |
| [src/ui/life/LifeHub.tsx](../../src/ui/life/LifeHub.tsx) | 474 | dac40099618a1f29 |
| [src/ui/screens/Create.tsx](../../src/ui/screens/Create.tsx) | 88 | 885f538295e2aa00 |
| [src/ui/screens/CreatePreview.tsx](../../src/ui/screens/CreatePreview.tsx) | 40 | 4f6c18ae5f315db9 |
| [src/ui/screens/GateScene.tsx](../../src/ui/screens/GateScene.tsx) | 121 | 2209c14bac7f0ef2 |
| [src/ui/screens/Hud.tsx](../../src/ui/screens/Hud.tsx) | 164 | ea1602a8e492f7b1 |
| [src/ui/screens/MobileHud.tsx](../../src/ui/screens/MobileHud.tsx) | 123 | df7d86fd5b590f49 |
| [src/ui/screens/Panels.tsx](../../src/ui/screens/Panels.tsx) | 401 | f3a07c83cd4bcc4c |
| [src/ui/screens/Profile.tsx](../../src/ui/screens/Profile.tsx) | 150 | 198f373a29278411 |
| [src/ui/screens/SavesSettings.tsx](../../src/ui/screens/SavesSettings.tsx) | 179 | b599fdb62534c63a |
| [src/ui/screens/Shell.tsx](../../src/ui/screens/Shell.tsx) | 230 | 1441274c4301637a |
| [src/ui/screens/TouchControls.tsx](../../src/ui/screens/TouchControls.tsx) | 188 | 0baff65f69672d7e |
| [src/ui/settings.ts](../../src/ui/settings.ts) | 86 | 1459bbec507a7ff3 |
| [src/ui/store.ts](../../src/ui/store.ts) | 76 | 7ad58b87e612223f |
| [src/ui/styles.css](../../src/ui/styles.css) | 595 | 1471dba769e00255 |
| [supabase/migrations/0001_core.sql](../../supabase/migrations/0001_core.sql) | 122 | 35095dd4bde298f6 |
| [tests/journey.test.ts](../../tests/journey.test.ts) | 145 | ea5167baed2b8a00 |
| [tests/resume.test.ts](../../tests/resume.test.ts) | 88 | b8f2cff35092c410 |
| [tests/sim.test.ts](../../tests/sim.test.ts) | 216 | d00fcb6c5f829c16 |
| [tsconfig.json](../../tsconfig.json) | 18 | be62755b92217b70 |
| [vercel.json](../../vercel.json) | 16 | c467ceb29490036e |
| [vite.config.ts](../../vite.config.ts) | 12 | 7453a5c86fde3a0e |
