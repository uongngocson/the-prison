# 18 — Khu lao động, học nghề và phục vụ sinh hoạt chung

CR-LAB-01 · Baseline thiết kế 1.3 · 02/11/2026 · **Chỉ tài liệu; chưa triển khai các chức năng mới.** Bản Word: [Labour Rehabilitation — BA Specification.docx](../deliverables/Labour-Rehabilitation-BA-1.3.docx). Thiết kế UI/3D và mockup tại [19](19-labour-ui-art-direction.md). Kế thừa [custody contracts](16-custody-contracts.md), [UI nền](05-ui-ux.md) và [ca làm F48](10-prison-life-systems.md).

## 1. Mục tiêu, giới hạn và cách gọi

Người chơi nhìn thấy một cơ sở có hoạt động sản xuất và sinh hoạt: vườn rau thay đổi theo ngày, cá được chăm sóc, xưởng tạo ra đồ dùng, vật phẩm được kiểm nhận và chuyển tới nơi sử dụng. Mỗi nghề có vòng lặp, biểu diễn 3D và UI phù hợp, không dùng cùng một thanh chờ rồi đổi nhãn. Người chơi là người được phân công hoặc học nghề, không phải chủ trang trại toàn quyền mua bán hay người quản lý nhà tù.

“Công ích trong tù” trong brief được hiểu là **công việc phục vụ sinh hoạt chung của cơ sở trong game**. Không đánh đồng với một hình phạt lao động công ích ngoài cộng đồng; không coi học nghề, lao động sản xuất, nội vụ và phục vụ tập thể là cùng một chế định pháp luật. Không có danh sách nghề chung áp dụng cho mọi trại giam. “Full” ở đây nghĩa đủ vòng đời và danh mục phạm vi đã chốt, không tuyên bố mô phỏng toàn bộ mọi nghề ngoài đời.

Tất cả định lượng, giờ ca, giá trị điểm ghi nhận, mùa vụ, tốc độ tăng trưởng, vật tư và hình ảnh là **[D] thiết kế hư cấu**. Người dùng không nhập tình trạng sức khỏe, hồ sơ lao động hoặc bản án thật. Phần nguồn dưới là **[V] nội dung đã đọc** và **[U] điểm chưa xác minh**. Không đưa trích luật, mã nguồn, số phiên bản schema hay câu cảnh báo nghiên cứu dài vào HUD gameplay; thông tin nghiên cứu phục vụ đội phát triển, handbook có mô tả ngắn phù hợp sản phẩm.

### Mục tiêu nghiệm thu

- Có gameplay chủ động cho trồng rau, nuôi cá, làm vườn/cảnh quan và mộc; các việc phục vụ chung có task và bàn giao rõ.
- Phân công phù hợp điều kiện và quyền di chuyển; án dài không tự đồng nghĩa chỉ được làm việc nặng.
- Nhận/trả dụng cụ, nguyên liệu, batch sản phẩm và kết quả ca có sổ đối chiếu; reload không nhân đôi sản lượng/điểm.
- Có đường nghỉ, xin hỗ trợ, đổi công việc và phương thức thao tác tương đương; không mất ăn/nước/chăm sóc vì không đạt sản lượng.
- UI chuyên nghiệp có mockup, tokens, trạng thái, responsive/input, art briefs và acceptance criteria; ảnh mockup không phải ảnh chụp game đã có.

## 2. Audit đầu vào và delta

Đọc working tree ngày 02/11/2026; source đang được cập nhật song song. Không coi báo cáo thiết kế cũ là trạng thái code mới. Không sửa source hoặc SQL trong CR tài liệu này.

| Đầu vào hiện tại | Đã quan sát | Delta cần đặc tả/triển khai |
|---|---|---|
| `src/content/life.ts` | Khóa carpentry bốn bài; work_workshop/work_kitchen/work_laundry; các ca có wagePerShift hư cấu | Catalog nghề, task, dụng cụ, batch và lịch phân công có version |
| `src/domain/life.ts` | attendSession tích lũy phút; settleShifts ghi nhận một lần theo ca | Trạng thái từng task/production không chỉ phút có mặt; chuyển giao không phát công hai lần |
| L10, L06, L13 trong world | Xưởng, bếp, giặt và slot hiện có | Vườn, ao, vườn ươm, kho/nghiệm thu; xưởng mộc có workstation rõ |
| U32 trong LifeHub | Đăng ký/tiến độ khóa học và ca | U39–44, station HUD và preview ảnh hưởng đến lịch |
| Custody 1.2 đang được code | Có evaluator/quyền di chuyển và lịch theo mode | Tích hợp theo capability; không rút gọn thành `zoneOpen` hoặc chỉ ẩn nút |
| Save schema 3 đang được code | Có custody aggregate và migration SQL 0002 trong workspace | Labour aggregate có version, migration và kiểm giới hạn; không tự đổi schema trong tài liệu |
| F38/F39/F48 | Có account/order/wage/source keys | Tách điểm ghi nhận, thành phẩm thuộc cơ sở, vật liệu dùng sản xuất và đồ cá nhân |

Không xác nhận đã có garden/fish/wood production runtime chỉ vì có khóa “Mộc cơ bản”. Những gì mới trong CR-LAB-01 có trạng thái Documented=đặc tả, Implemented/Tested/RealismReviewed=chưa.

## 3. Nguồn và phân biệt thực tế / thiết kế

| Ref | Nguồn chính thức, ngày truy cập 02/11/2026 | Điều dùng / giới hạn |
|---|---|---|
| LAB-S01 | [Luật 127/2025/QH15, Công báo, Điều 28–30](https://congbaocdn.chinhphu.vn/180507251028987904/2026/1/23/cong-bao-so-34-ngay-21-01-46932signed-17691535683541772504189.pdf) | [V] Lao động dưới quản lý/giám sát, phù hợp tuổi/sức khỏe, có quy định giờ/nghỉ, miễn/giảm và sử dụng kết quả; [U] cần rà hiệu lực sửa đổi cùng chuyên gia trước profile pháp lý |
| LAB-S02 | [Bộ Công an: Nhiều hoạt động nhân văn ở Trại giam Xuân Phước](https://mps.gov.vn/bai-viet/nhieu-hoat-dong-nhan-van-o-trai-giam-xuan-phuoc-d23-t35466), bài ngày 20/06/2023 | [V] Ví dụ một cơ sở có may, mộc, đan lát, nông nghiệp/chăn nuôi và nguồn rau/thịt/cá; không suy ra mọi cơ sở hiện có cùng danh mục hoặc năng suất |
| LAB-S03 | [Nghị định 170/2026/NĐ-CP](https://vanban.chinhphu.vn/?classid=1&docid=218166&pageid=27160&typegroupid=4), hiệu lực 01/07/2026 | [V] Metadata văn bản hướng dẫn; [U] các tỷ lệ thu chi/định mức và ngoại lệ cần đọc toàn văn/review, không điền số bằng suy đoán |
| LAB-S04 | [Nguồn, hiệu lực và nội quy còn mở tại 13](13-vietnam-custody-audit.md) | Kế thừa source gaps về nội quy, chuyên biệt và thực tế đa cơ sở; không coi hình ảnh reference là quy chuẩn pháp luật |

Tóm tắt LAB-S01: quy định thông thường không quá 8 giờ/ngày và 5 ngày/tuần, có nghỉ và ngoại lệ luật định; một số trường hợp được miễn/giảm hoặc nghỉ lao động. Tham chiếu này không biến ca game 3 giờ thành định mức thật. Chưa publish rules overtime, lao động ngoài trại hoặc phân chia thu nhập pháp lý nếu thiếu đối chiếu. Thuật toán cộng giờ phải tính toàn bộ phân công/nghề và học nghề theo policy đã duyệt, không xét từng job riêng để lách tổng giờ.

Không thiết kế phần ra ngoài cơ sở, vận hành dây chuyền công nghiệp, hóa chất, thủ thuật an ninh hoặc mô tả tai nạn đồ họa trong baseline này. Nếu thêm, cần scope và review riêng; không vì muốn nhiều nghề mà để một người chơi dùng mọi dụng cụ ở mọi khu.

## 4. Danh mục hoạt động — phạm vi đầy đủ CR-LAB-01

P0: slice gồm rau và mộc; P1: hoàn thành bốn nghề chính và hạ tầng; P2: mở rộng các nhóm phục vụ chung theo nhiệm vụ đã viết. P2 vẫn là backlog có disposition, không gọi đã implemented. Không thêm hình phạt khi nhánh chưa mở.

| Work ID | Nhóm / nơi làm | Vòng lặp cụ thể | Kết quả, mức đích / ưu tiên |
|---|---|---|---|
| W01 | Rau ăn lá / L23 | Nhận luống → chuẩn bị → gieo/trồng → tưới/chăm → kiểm tra → thu hoạch → cân/nhận | Batch rau tới L27, Interactive / P0 |
| W02 | Rau củ/quả giàn thấp / L23 | Đặt cây giống → chăm theo giai đoạn → ghi nhận phát triển → thu theo đợt | Batch theo đợt, không reset cây sau một lần hái; Interactive / P1 |
| W03 | Ươm cây giống / L25 | Nhận khay → gieo → tưới nhẹ → phân loại cây sẵn sàng → bàn giao luống | Nursery batch, tái sử dụng cho W01/02; Interactive / P1 |
| W04 | Tưới và chăm đất / L23/25 | Kiểm nhu cầu → chọn lượng trong preset → thao tác → ghi nhận → cất dụng cụ | Soil/care event; không spam tưới nhận XP; Interactive / P0 |
| W05 | Nuôi cá / L24 | Nhận ao được giao → quan sát → cho ăn theo kế hoạch → kiểm môi trường trừu tượng → báo vấn đề → hỗ trợ thu hoạch | Pond/care/harvest batch; Interactive / P1 |
| W06 | Cảnh quan, cây hoa / L25/28 | Nhận khu vực → làm cỏ/tỉa nhẹ/trồng hoa → gom phế liệu → nghiệm thu | Scene sạch/đẹp có thời hạn, task receipt; Interactive / P1 |
| W07 | Cây lâu năm/cây bóng mát / L25 | Kiểm cây → tưới/chăm gốc nhẹ → ghi nhật ký/báo cần hỗ trợ | Không trèo cao/cưa cây; Interactive nhẹ / P2 |
| W08 | Mộc cơ bản / L10 | Brief đồ dùng → nhận phôi → đo/đánh dấu → thao tác trừu tượng → ghép/hoàn thiện → kiểm nhận | Ghế thấp/kệ/khay cây; production order; Interactive / P0 |
| W09 | Sửa đồ dùng / L10/28 | Kiểm phiếu → nhận vật tư → thay chi tiết an toàn → kiểm → trả nơi dùng | Repair receipt, không duplicate vật gốc; Interactive / P1 |
| W10 | Đan lát/thủ công / L10 | Chọn mẫu được giao → phân loại vật liệu → thao tác ghép → hoàn thiện → nghiệm thu | Rổ/giỏ/khay, thao tác ngồi tương đương; Interactive / P2 |
| W11 | May và sửa đồ vải / L13 | Nhận lô → phân loại → sửa đường may trừu tượng → kiểm đếm → bàn giao | Batch đồ vải không gắn dữ kiện người thật; Interactive / P2 |
| W12 | Bếp, sơ chế được phân công / L06 | Nhận lô đạt kiểm → chuẩn bị khu → phân loại/rửa/chia phần → giao đầu bếp → dọn | Prep batch, không tự đưa rau/cá chưa kiểm vào bữa ăn; Interactive / P1 |
| W13 | Rửa khay, dụng cụ ăn / L06/05 | Nhận mẻ → xử lý trừu tượng → xếp/kiểm → trả station | Clean equipment batch; Interactive / P1 |
| W14 | Giặt, phơi/gấp và cấp phát / L13 | Nhận lô → phân loại → thao tác → kiểm đếm → giao | Service receipt, khác inventory cá nhân; Interactive / P1 |
| W15 | Vệ sinh khu chung / L28, khu được phép | Nhận phạm vi → quét/lau → gom → bàn giao khu → trả dụng cụ | Cleanliness state theo zone, không vô hạn XP; Interactive / P1 |
| W16 | Phân loại rác/tái sử dụng / L28 | Nhận nhiệm vụ → phân loại theo pictogram → đưa đúng điểm → ghi nhận | Bounded batches; nội dung môi trường hư cấu, không quy trình hóa chất; Interactive / P2 |
| W17 | Kho, cân và đóng gói / L27 | Nhận lô → đối chiếu → cân/đếm → ghi nhãn → bàn giao | Stock transaction, không chỉ đóng hộp cosmetic; Interactive / P0 |
| W18 | Sắp sách, vật tư lớp học / L07/14 | Phiếu phân công → sắp → kiểm danh mục → trả chỗ | Dùng lại F29 nhưng source key theo ca; Interactive / P2 |
| W19 | Chăm vật nuôi nhỏ / variant L26 | Nhận phân công → cấp thức ăn/nước → vệ sinh trừu tượng → ghi quan sát | Không bắt buộc chăn nuôi sống trong slice; Interactive có review / P2 |
| W20 | Chuẩn bị sinh hoạt tập thể / L17/28 | Nhận kế hoạch → kê/xếp vật tư an toàn → kiểm → thu dọn sau buổi | Task chain có người nhận, không tạo event vô hạn; Interactive / P2 |

Mỗi W có `workDefinitionId/version`, eligibility, station, input/output, duration game-time, phương thức hỗ trợ và evidence hoàn tất. Những W dùng cùng engine task vẫn phải có props/animation/text/recap khác. Không dùng W18 cũ để tự đánh dấu W01–20 đã làm.

## 5. Nghiệp vụ chung và quy tắc domain

### 5.1 Vòng đời một ca

Offer/assignment → đọc nội dung/điều kiện → xác nhận hoặc yêu cầu đổi → safety orientation → schedule/capability check → di chuyển theo phép → check-in → nhận dụng cụ/vật tư → làm task → kiểm tra/bàn giao → trả dụng cụ → recap và credit nếu policy có → checkpoint. Thuộc tính `kind` phân biệt học nghề, ca sản xuất và phục vụ chung; thời gian cùng phút không được tính hai lần.

Một người có một ca active; có thể có nhiều enrollment nhưng không double-book. Nhận phân công không phải chọn tội danh hay bỏ qua custody. Cán bộ/giáo viên là NPC có vai trò phù hợp; không thêm người chơi làm cán bộ. Nhận việc chưa đủ để spawn sản phẩm hoặc cấp điểm; chỉ accepted outcome mới commit.

### 5.2 Ma trận chế độ giam giữ × công việc

| Context | Điều kiện tham gia | UI và xử lý |
|---|---|---|
| Legacy/cốt truyện | Enrollment/lịch và chỗ làm phù hợp | U39 đăng ký/xem lịch, không tự áp lệnh custody vào save cũ |
| Nhóm A/B, được phân ca | Grant tới đúng nơi và khung giờ; cohort tương thích | U39 nhận phân công, U17/U13 chỉ route hợp lệ; B không tự cấm mọi nghề |
| Giờ ở buồng/ban đêm | Không tự đi qua cửa chỉ vì có việc | Hẹn ca tiếp theo hoặc bài lý thuyết tại buồng nếu được hỗ trợ |
| Kỷ luật/bố trí riêng | Không cấp phép ra xưởng/vườn bằng nút “Bắt đầu” | Reassign/hold/excused, không đánh giá vắng do hệ thống; học tại buồng chỉ nếu policy cho |
| Nghỉ chăm sóc/hỗ trợ | Dựa plan có thời hạn, không suy từ thanh mood | Task ngồi/tự hoàn tất/đổi ca; không phạt hoặc hạ chất lượng vì dùng hỗ trợ |
| Chuyển khu/rời cơ sở | Reconcile ca, grant, dụng cụ và batch | Chốt phần hợp lệ, bàn giao cho NPC; hủy reservation chưa dùng; không bắt ở lại quá mốc release vì thiếu tool do lỗi |
| Biến thể chuyên biệt chưa hỗ trợ | Không tự dùng profile mặc định | Thẻ có lý do/đường hỗ trợ, không mở nhiệm vụ giả |

### 5.3 Dụng cụ và an toàn

Tool ledger tách khỏi bag/locker cá nhân: available → reserved → issued → in_use → returned/inspection/damaged/missing_review. Mỗi tool có ID/type/condition/authorized station/custodian; không có recipe chế tạo từ tool hoặc mua để tự mang giữa khu. Tool không là vật thưởng để bán. UI checkout chỉ cho đúng kit của ca, quantity integer; nhận/trả nguyên tử với ca và receipt.

Nếu tool không về đúng số: hiển thị chênh lệch, rà transaction và hỏi hỗ trợ. Không tự gán tội, tăng án hoặc kỷ luật từ một lỗi mất mạng/rollback. Case review lưu provenance; NPC giám sát nhận tiếp trách nhiệm khi người chơi chuyển nơi, không giữ người chơi trong vòng không thể thoát. Không mô phỏng thao tác nguy hiểm thực tế; animation xưởng là clip/sequence có thể skip, không hướng dẫn cắt máy/pha hóa chất hoặc ép QTE.

### 5.4 Sản lượng, kiểm nhận và luồng sử dụng

Input lot/reservation → WIP → ready_for_check → accepted/rework/held → stock batch L27 → allocation tới bếp/sửa chữa/cảnh quan/đơn nội bộ → consumed/installed/archived. Ai chăm không tự sở hữu cây/cá/sản phẩm của cơ sở. Crop/pond output không xuất vào bag đồng thời xuất vào kho. Cân/đếm có expected revision, đơn vị chuẩn g/ml/count nguyên; UI đổi kg/lít để đọc, không dùng float tích lũy tiền/stock.

Quality là mức kiểm sản phẩm, không phải giá trị đạo đức con người. `rework` có hướng dẫn và vật tư được cấp, không buộc mua bằng tiền cá nhân; `held` có reason, reviewer và hạn review. Output lỗi/thiếu không làm mất khẩu phần cơ bản. Cấm credit cả `wage:shift` cũ và outcome mới cho cùng phút/ca: một settlement owner/canonical key; XP học và ghi nhận ca có semantics riêng, không lặp vì nhặt lại đồ.

### 5.5 Tính liên tục, RNG, thời tiết và nghỉ

Một simulation clock dùng chung custody. Crop/pond progression theo game-minute và seeded content, không theo wall time; đóng tab/pause SP không làm cây chết hoặc cá đói. NPC được phân có thể duy trì chăm sóc cơ bản khi người chơi được điều sang việc khác; record công của NPC không thành công người chơi. Không giả deterministic cross-version; pin content hash.

Tưới đủ có cooldown/need budget, tưới thêm không tạo XP hoặc tăng trưởng vô hạn. Fish feed theo plan có event nguồn, không cộng hiệu quả từ spam. Mưa có thể giảm nhu cầu tưới hoặc đóng khu theo policy hư cấu; nóng/ngập/sự cố là authored event có fallback, không đồ họa gây sốc. Thu hoạch không phải realtime biological calculator. Skip đến hết ca xử lý từng boundary, không vượt giờ về buồng hay receipt thiếu.

Giờ mẫu: ca ngắn 08:30–10:00, nghỉ và ca sau theo assignment. Đây là pacing game, không lịch thực tế. UI cho biết phút game và thời lượng chơi dự kiến theo setting 48/72 phút/ngày. Tự hoàn tất thay thao tác, không tự miễn quyền di chuyển hay cấp công khi không có ca.

## 6. Bốn nghề chính: đặc tả từng vòng lặp

### 6.1 Trồng rau W01–W04

State luống: empty → prepared → sown/transplanted → seedling → growing → ready → harvested → cleaning → empty. Nhiều vụ lưu history tách `cropCycleId`; thu lại trên cycle đã harvested trả kết quả cũ. W02 có `harvestWaveId`, không dùng logic thu một lần của rau lá.

Người chơi nhận luống và task hiện tại, không chỉnh đất toàn khu. Gieo cần seed stock và phiên canh tác phù hợp; UI preview số khay/luống sẽ dùng. Tưới dùng lượng preset và điều kiện hiện tại; tương tác cúi/tưới có animation ngắn + action progress. Chăm cỏ/quan sát là task khác, không cho cùng animation thay mọi bước.

Thu hoạch: xác nhận đúng luống/cycle → reserve output quyền riêng → commit lượng nguyên → hiện giỏ/kiện cosmetic → tạo batch pending QA ở L27. Cân xác nhận chất lượng và người nhận; lượng batch mới vào kho. Thành phẩm không tự làm bữa ăn tốt hơn trước food acceptance. Nếu full stock, giữ batch awaiting_capacity, không xóa rau hoặc phát lại.

Ngoại lệ: mưa trước tưới → task chuyển kiểm thoát nước/ghi quan sát an toàn; cây chưa ready → thấy mốc dự kiến, gợi ý task khác; ca kết thúc giữa harvest → commit lượng hợp lệ, handover phần còn lại, không reset vụ. Narrative cây/cá chỉ ví dụ game, không lời khuyên kỹ thuật canh tác.

### 6.2 Nuôi cá W05

State ao: preparation → stocked → growing → harvest_ready → scheduled_harvest → harvest_pending_check → restock_ready. Cấu hình abstract fish cohorts; render đàn cá không phải mỗi mesh tương ứng một stock row. UI hiển thị đúng ba nhóm cần hiểu: kế hoạch chăm, quan sát môi trường và lịch thu; không dashboard mô phỏng quản trại có hàng trăm chỉ số.

Người chơi đứng tại sàn/điểm tương tác được thiết kế, không xuống nước/bơi. Quan sát nước có mức bình thường/cần kiểm tra; cho ăn dùng phần đã phân; báo bất thường tạo maintenance/care work case, không tự điều trị cá/pha thuốc. Khi thiếu feed, supervisor dùng fallback và ca chuyển task, không bắt người chơi dùng tiền riêng.

Thu hoạch cần work order và task support riêng; biểu diễn trừu tượng tại điểm tiếp nhận, có lô cân/kiểm nhận. Cá đã accepted mới allocation tới L06; không có tự câu cá trong ao để bỏ túi. Sự cố được xử lý qua đánh dấu ao/nhờ hỗ trợ, không yêu cầu người chơi trực tab cả ngày.

### 6.3 Làm vườn/cảnh quan W03/W06/W07

Mỗi garden patch có state cần chăm/đang xử lý/đợi nghiệm thu/đã nghiệm thu; người chơi thấy before/after trên cùng anchor. Nursery cây giống khác hoa trang trí; thành phẩm nursery chuyển qua transfer receipt, không vừa trồng hoa vừa tiêu lô cây dành vườn rau.

Task: chọn patch được giao → xem brief và kit → trồng/bố trí theo mẫu có vị trí hợp lệ → tưới/chăm → gom vật liệu → kiểm. Không cho free-build che lối thoát, giảm clearance hoặc mở nav trái quyền. Bố trí dùng socket đã kiểm; accessibility route được giữ. Mẫu hiển thị thumbnail, material và số cây cần; Back trước commit trả reservation.

Cleanliness/appearance degrade nhẹ theo simulation, có giới hạn và cooldown; không tạo hàng ngàn rác hoặc task vô hạn để farm XP. Ban đêm/mưa không tự kéo người chơi ra khu ngoài trời. Người chơi có thể nhận vai trò ngồi phân khay/cây giống khi cần hỗ trợ.

### 6.4 Mộc W08/W09

State work order: assigned → materials_reserved → in_progress → awaiting_check → rework/accepted → delivered → installed. Recipes baseline là đồ dùng cơ sở: khay cây, ghế thấp, kệ sách; kích thước/vật tư hư cấu, không hướng dẫn chế tạo đồ nguy hiểm. Khóa học bốn bài hiện tại trở thành prerequisite/learning outcome có mapping, không tự ghi mọi người đã được chứng nhận thật.

Các stage: đọc brief/mẫu → kiểm phôi → đo/đánh dấu bằng UI lựa chọn rõ → clip thao tác xưởng trừu tượng → ghép bằng socket → hoàn thiện → đối chiếu checklist chất lượng. Không cần thao tác chính xác theo phản xạ; keyboard/touch/assist có cùng quality outcomes nếu cùng lựa chọn. Không có lỗi ngẫu nhiên khi chơi chế độ trợ năng.

QC có ba tiêu chí hư cấu dễ hiểu: đúng mẫu, đủ chi tiết, hoàn thiện. Sản phẩm cần làm lại ghi tiêu chí và vật tư phù hợp; không phá hủy tiến độ tùy tiện. Delivery tới sách/cảnh quan có transaction và scene update một lần; người chơi không kéo ghế vào bất kỳ buồng để vượt access. Repair dùng identity vật gốc, không tạo thêm bản sao sau sửa.

## 7. Features mới F73–F84 và acceptance

Mọi feature kế thừa C0 validate → reserve → commit theo actionId → event → projection → checkpoint; output chưa durable không ghi đã hoàn tất cloud. UI chi tiết nằm tại 19.

| ID | User story / luồng chính | Nhánh lỗi và AC bắt buộc | UI / data / task / QA |
|---|---|---|---|
| F73 | Xem và nhận phân công có nội dung, giờ, nơi, điều kiện; một ca active | AC73: chặn double-book và unsupported role; grant đúng nơi; đổi ca có receipt | U39/U17/U32; DB51/52; T12-01/02; QA33 |
| F74 | Nhận/trả kit, vật tư theo ca và orientation | AC74: một tool một custodian; retry không phát thêm; missing_review không tự phạt; exit có handover | U43; DB53/57; T12-03; QA34 |
| F75 | Trồng/chăm/thu rau theo cycle và harvest wave | AC75: stage/rng/pause nhất quán; spam tưới không farm; thu một output cho mỗi nguồn | U40; DB54/56; T12-04; QA35 |
| F76 | Chăm ao cá và hỗ trợ thu hoạch theo plan | AC76: feed budget không âm, một harvest outcome; không chết do offline SP; không nhận cá cá nhân | U41; DB55/56; T12-04; QA35 |
| F77 | Vườn ươm/cảnh quan và nghiệm thu before/after | AC77: socket không chặn route, nursery transfer bảo toàn stock; task cooldown có giới hạn | U40/U39; DB54/56/58; T12-04; QA35/38 |
| F78 | Làm mộc/sửa đồ qua work order/stages/QC | AC78: prerequisites và kit đúng; rework có reason; retry không tăng accepted stock; repair giữ item identity | U42/U43/U44; DB56/57; T12-05; QA36 |
| F79 | Công việc phục vụ chung W10–20 có task/receipt riêng | AC79: mỗi W có input/output/animation; không clone một ca rỗng; cấp phát/food quality vẫn đúng | U39/U43/U44; DB51/52/56/58; T12-05; QA36 |
| F80 | Kho/cân/kiểm nhận/bàn giao batch tới nơi dùng | AC80: stock/output không double bag; full kho giữ pending; reject có review; từng allocation một source key | U44/U28/U27; DB56/57; T12-03/05; QA34/36 |
| F81 | NPC tổ đội/giám sát, occupancy và handover | AC81: NPC không biết hồ sơ riêng; actor xa vẫn theo lịch; slot không hai owner; handover không thành công user | U39/U40–42; DB52/58; T12-06; QA37 |
| F82 | Nhận ghi nhận ca/học nghề, xem recap và lợi ích tập thể | AC82: không cộng trùng wage cũ/mới, không tự giảm án; dùng assist không hạ điểm; no-work vẫn essentials | U44/U09/U11/U32; DB33/39/57; T12-02/05; QA36 |
| F83 | Save/resume/migrate tiến trình nghề và production | AC83: mỗi stage giữ đủ graph, source key, tools, camera/panel; legacy không bị gán ca; no policy hash silent switch | U20/U25/U39–44; DB19/51–58; T12-07; QA37 |
| F84 | UI/3D chuyên nghiệp, responsive và kiểm độ phủ nghề | AC84: đủ mapping U39–44, scene/props/poses khác nghề, đủ loading/empty/error/pending; không tuyên bố ảnh mockup là game | 19; L23–28; T12-06/08; QA38 |

## 8. Data dictionary DB51–DB58

Logical aggregates trong snapshot-first; chưa là bảng SQL thực. Owner/episode/lineage/revision theo phần 06/16. Mọi mutable row có ID, version, sourceKey, minute; refs immutable có id+version/hash. Timestamp gameplay dùng simulation minute, audit save dùng UTC riêng. Sensitive support/incident chỉ owner và vai trò có task được phép đọc.

| ID | Aggregate và fields chính | Invariants / access |
|---|---|---|
| DB51 | WorkDefinitions: id/version, kind, W id, eligibility, stationKinds, prerequisites, input/output schemas, scheduleRef, creditPolicy, supportVariants, published | Publisher immutable; chưa publish không cho Start; giá trị [D] có provenance |
| DB52 | WorkAssignments/Shifts: actor/episode, definitionRef, plannedStart/end, actualIntervals, state, team, supervisorRole, grantRef, reviewReason | Một active ca/actor; intervals không chồng và không tính cả học/làm cho cùng phút; state offered/assigned/active/paused/excused/handed_over/completed/settled |
| DB53 | ToolCustody: toolId/type/condition, status, stationScope, custodian, reservationRef, issue/return receipt refs | Không count negative; tool không vào personal bag hoặc trading; index actor+active, toolId unique |
| DB54 | Cultivation: plot/patch/cycle, cropRef, stage, plantedAt, nextStageAt, careBudget/history, seedLot, expectedOutput, harvestWave refs, revision | Một active cycle/plot; stage transitions hợp lệ; garden/nursery distinct; units nguyên |
| DB55 | Aquaculture: pondId/cohort, stage, simulationModelRef, plannedFeedBudget, careEvents, observationState, harvestOrderRef, revision | Có 1 harvest head; fish rendered không tạo inventory row mỗi mesh; feed event idempotent |
| DB56 | Production/Stock: orderId/stage, input reservations, WIP/outputLot, quantity/unit, quality, inspection, destinationAllocation, lifecycle | Conservation: opening + accepted − consumption − allocated ± correction = closing; không phân bổ hai lần |
| DB57 | WorkOutcomes/Receipts: assignment/session/task source keys, accepted quantities, quality reason, actor attribution, credits, prior wage linkage, settlementRef, supersedes | Một settlement owner; immutable corrections dùng reversal; không clear key để tiết kiệm save |
| DB58 | SiteTasks/Handover: site/task/scope, claimant, requiredKit, due, progress, interruption, NPC handover, completion/cooldown | Slot/scope khóa theo revision; reclaim không phát reward lần nữa; public projection bỏ facts riêng |

Tạo `labourState.version=1` là đề xuất module, không tự tuyên bố schema v4 bắt buộc. Khi code, review save validator/cloud constraints để chọn mở rộng schema 3 tương thích hay migrate mới; chỉ publish khi codec, checkpoint, SQL và rollback cùng chấp nhận. Module v1 thiếu trong save cũ → registry chưa tham gia, stock mở 0 hoặc seeded inventory của cơ sở được ghi một opening receipt, không phát tiền cá nhân/giấy học nghề mới.

### API18–API20 / local command contracts

| ID | Intent và input | Outcome / reject |
|---|---|---|
| API18 | Work assignment: request/accept/check-in/pause/change/handover, episodeId, assignmentRef, expectedRevision, actionId | Valid schedule/eligibility/grant; receipt; reject invalid/overlap/stale, không nhận client-completed minutes |
| API19 | Station actions: issue/return kit, care, feed, step work, harvest, expectedStation/lotRevision, actionId | Authority computes material usage/output/quality; client không truyền reward hoặc số kg tùy ý; busy/need stage/no access có alternative |
| API20 | Inspect/deliver/read summary: order/lot/shift refs, destination, expectedRevision, actionId | Hành động inspector/settlement chỉ authority NPC event hoặc role được cấp; user request review không tự approve; owner-only summary |

Chưa có HTTP routes thực; SP dùng session commands. Không broadcast mọi tick vào Postgres; Realtime không tự trở thành production authority. MP sau này phải có room owner, station reservations, delta batches và reconnect reconciliation; không import stock/credits từ save SP. CR này không triển khai multiplayer hoặc cam kết 100 người.

## 9. Tích hợp, lỗi và khôi phục

Tất cả `move`, interact, assist, finishAction, fastForward và resume phải kiểm cùng custody capability theo actor/purpose/time; work grant không mở toàn campus. Lịch sản xuất phát sinh không được ghi đè lịch thăm/care hoặc khóa release. Weather closure tạo system interruption và thay phương thức, không vắng không phép.

| Sự cố | Xử lý và thông điệp sản phẩm |
|---|---|
| Không có phân công | U39: “Chưa có ca phù hợp. Xem lịch hoặc gửi yêu cầu đổi việc.” |
| Hết seed/feed/phôi | Giữ order/ca, yêu cầu bổ sung hoặc task thay thế; không âm stock/khóa nhu cầu thiết yếu |
| Tool/station bận | Queue giới hạn/slot khác hợp lệ, không kéo tool từ tay NPC |
| Custody đổi giữa action | Recheck trước commit; compensate chưa dùng; bàn giao hợp lệ; không teleport trái quyền |
| Mưa/đóng khu | Plan indoor task/hoãn hợp lệ, ghi source; không buộc làm ngoài trời |
| Batch bị giữ kiểm | “Đang chờ kiểm nhận” + reason/next review; không báo đã vào bếp |
| Save full/quota | Giữ snapshot tốt trước đó, thông báo/xuất file; archive có integrity hoặc tăng budget được duyệt, không silent trim |
| Scene load fail | Giữ phase/room trước commit, retry cùng action/transition; không spawn trong ao |
| Double click/reload | Canonical source id trả cùng kết quả; restore action không tạo sản phẩm/credit lần hai |
| Thoát giữa ca | Save phần hợp lệ, reconcile handover khi quay lại; không realtime offline deterioration |

Checkpoint phải lưu activeAction stage, assignment intervals, tool custodian, material reservations, crop/pond cycle, QC/batches, NPC slot/handover, rng, window/grant refs và overlay selection. Renderer restore từ domain, không đọc scale mesh cây để suy stage. UI pending write không được báo cloud đã lưu khi chỉ ghi local.

## 10. Roadmap và RTM / T12-01–T12-08

| Task / owner | Deliverable | Dependency / feature / test |
|---|---|---|
| T12-01 BA/content/legal | Work catalog 20 W, policy/source review, eligible schedules và recipe briefs | Trước publish policy; F73/79, QA33 |
| T12-02 Domain/UI | Assignment/routine/module ownership, U39, recap semantics và nối F48 | 01; F73/82, QA33/36 |
| T12-03 Domain/inventory | Tool/stock/batch/QC transaction và conservation fixtures | 01/02; F74/80, QA34 |
| T12-04 Gameplay/art | Rau, nursery, cảnh quan, ao cá có staged assets, care và harvest | 02/03; F75–77, QA35 |
| T12-05 Gameplay/content | Mộc/repair/common services, settlement không lặp | 02/03; F78/79/80/82, QA36 |
| T12-06 Art/AI/UI | L23–28, props/poses, supervisor/team, HUD và input parity | 03/04/05; F81/84, QA37/38 |
| T12-07 Persistence | Module migration, validator/cloud negotiation, checkpoint graph và size tests | 02–06 contracts; F83, QA37 |
| T12-08 QA/review | QA33–38, LAB-SC01–20, visual/device evidence, release report | Package tương ứng; F73–84/Gate LAB |

Không ghi số tuần AI code khi chưa có velocity/asset/reviewer capacity. Slice P0: một vụ rau và một khay cây gỗ đi hết từ phân công đến stock/recap/save. Hoàn thành slice không có nghĩa full W01–20. Mở P1 gồm ao/cảnh quan và service links; P2 chỉ mở nghề khi đủ task, art, eligibility, receipt, QA và nội dung; không nút giả.

## 11. QA33–QA38 và scenario nghiệm thu

| QA | Scope | Pass / evidence |
|---|---|---|
| QA33 | Assignment/schedule/access | Eligibility và tổng giờ theo policy; overlap/exemption/grants, một active ca; unit + UI integration |
| QA34 | Tools/stock/conservation | 1.000 giao dịch seeded issue/return/harvest/QA/allocation không âm/duplicate; property-based invariants và fault traces |
| QA35 | Crop/pond/garden simulation | Pause/offline SP, seeded growth, cooldown, wave harvest, NPC maintenance, weather và không stale stage; simulation + normal-speed walkthrough |
| QA36 | Work/QC/economy | Rework/held, actor attribution, wage migration, học vs sản xuất, no XP exploit; ledger + task integration |
| QA37 | Lifecycle/save/AI | Save ở mỗi reserve/commit/handover, 100 game-day run có budget, NPC slot và migration/cloud negotiation | 
| QA38 | UI/art/accessibility/perf | U39–44, L23–28, four nghề chính có scene khác, text200%, keyboard/touch/gamepad; máy thật, không tự lấy PNG làm runtime evidence |

| Scenario | Given / When | Then |
|---|---|---|
| LAB-SC01 | Được phân rau và đăng ký mộc trùng giờ | Chặn overlap; preview lịch giữ cả ca và yêu cầu đổi |
| LAB-SC02 | Nhóm B có ca hợp lệ, thử đi khu khác bằng grant | Tới đúng station được phép; grant không mở cả campus |
| LAB-SC03 | Đang nghỉ chăm sóc/kỷ luật, nhận work offer | Hold/excused/đổi ca, không xuyên restriction hoặc tự vi phạm |
| LAB-SC04 | Double issue kit rồi reload trước/sau commit | Một tool một custodian, không tăng tổng |
| LAB-SC05 | Return thiếu tool do giả lập lỗi receipt | Missing_review có record/handover, không tự kỷ luật |
| LAB-SC06 | Gieo trồng với seed vừa hết, retry cùng action | Không âm seed, không hai crop cycle |
| LAB-SC07 | Spam tưới/feed trong cùng nhu cầu | Budget/cooldown và XP không cộng vô hạn |
| LAB-SC08 | Pause/đóng tab dài, mở lại | Growth/order theo simulation clock, không realtime die-off |
| LAB-SC09 | Hai lần thu cùng luống/wave hoặc ao | Một accepted output; retry trả receipt cũ |
| LAB-SC10 | Full kho hoặc quality hold | Output pending/held còn nguyên; bếp chưa được allocation |
| LAB-SC11 | Mưa tới trước ca ngoài trời | Indoor fallback/rebook, không vắng bị phạt |
| LAB-SC12 | NPC chăm tiếp khi người chơi chuyển nơi | Cây/cá duy trì hợp lệ; không cấp user công NPC |
| LAB-SC13 | Mộc chưa học orientation, dùng assist sau đủ điều kiện | Chặn trước đủ điều kiện; assist không giảm chất lượng/credit |
| LAB-SC14 | Repair và deliver hai lần | Giữ item identity, scene installed một lần |
| LAB-SC15 | Ca mới nối wage logic cũ và reload qua giờ settle | Một settlement/key; không nhận hai nguồn công |
| LAB-SC16 | Chuyển buồng/hết án giữa ca, còn kit/WIP | Handover + conservation, không khóa release vì tool lỗi |
| LAB-SC17 | Save cũ không labour module; save mới mất ref hoặc vượt quota | Không tự cấp vật tư cá nhân; recovery giữ file/last-good |
| LAB-SC18 | Garden layout chọn socket che đường hoặc hết chỗ | Chặn overlap/clearance; không giảm nav/accessibility |
| LAB-SC19 | Từng W10–20 mở từ thẻ công việc | Có brief/props/task/output/receipt riêng; nhánh chưa có hiển thị unavailable |
| LAB-SC20 | U39–44 ở 1280×720, 390×844 và gamepad/text200% | Đọc/điều khiển được, no hover-only, focus đúng; phân biệt mockup và implementation |

Các scenario là đặc tả chưa chạy; không ghi pass từ ảnh minh họa hoặc số dòng source. Realtime/MP race phải bổ sung khi MP thực sự được đặc tả, không dùng deterministic SP để chứng nhận mạng.

## 12. Gate LAB và trạng thái bàn giao

- [ ] F73–84 và W01–20 đúng phạm vi được mở, mỗi phần có code/content/test evidence.
- [ ] Bốn nghề chính có vòng đời đầy đủ, output tới nơi dùng, không chỉ thanh tiến trình.
- [ ] U39–44/L23–28 art/UI/collision/LOD/animation/input/accessibility có evidence trên build.
- [ ] Source/legal review xác nhận policy trước claim realism; no universal/prison-wide assumption từ bài báo 2023.
- [ ] Tools/material/output/credits/XP bảo toàn, no worker deprivation, no bug-generated discipline.
- [ ] Custody/return/care/release, schema/checkpoint/cloud/recovery và giới hạn byte vẫn đúng.
- [ ] QA33–38/LAB-SC01–20 và hồi quy F29/38/39/47/48/52/56/57/64/68/71 pass.
- [ ] Benchmark scene/load/2 giờ chơi trên thiết bị mục tiêu, supported devices ghi theo số đo thật.

**Đã bàn giao ở mức tài liệu:** đặc tả BA, hướng hình ảnh, sáu mockup minh họa và DOCX. **Chưa bàn giao:** implementation nghề mới, asset 3D production, animation rig, chứng nhận nghề thật, phỏng vấn thực tế, benchmark, legal sign-off hoặc khả năng multiplayer mới. Không push Git theo yêu cầu dừng trước đó.
