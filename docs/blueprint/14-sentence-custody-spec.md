# 14 — Đặc tả chọn mức án và vòng đời giam giữ

CR-VN-01 / baseline mục tiêu 1.2 / 02/11/2026. **Toàn bộ quy tắc ở đây là [D] thiết kế game**, chưa có implementation hoặc realism sign-off. Căn cứ và giới hạn pháp lý tại [13](13-vietnam-custody-audit.md); UI tại [15](15-custody-ui-mapping.md), dữ liệu tại [16](16-custody-contracts.md), nghiệm thu tại [17](17-custody-delivery-qa.md).

## 1. Phạm vi sản phẩm và thuật ngữ

Hai mode độc lập: `fictional_life` cho hành trình cũ và `vn_custody` cho trải nghiệm lấy cảm hứng từ quy định Việt Nam. Mode mới hiển thị “Tham chiếu quy định Việt Nam — cơ sở và nhân vật hư cấu; chưa được chuyên gia xác nhận đầy đủ” cho tới khi có bằng chứng review. Chọn mức án là chọn bối cảnh game, không phải khai hồ sơ cá nhân hoặc công cụ tính án.

Không tạo một difficulty “nhẹ/vừa/nặng” rồi trình bày như phân loại pháp luật. Hỗ trợ thao tác, tốc độ chơi và độ dài chương là setting trải nghiệm; bản án, quyết định giam giữ và quyền ra khỏi buồng là domain state riêng. Chọn chung thân không tự khóa học tập, thư, chăm sóc hoặc hoạt động phù hợp.

| Thuật ngữ | Ý nghĩa trong thiết kế |
|---|---|
| Judgment | Bản án đã tuyên trong kịch bản, có nguồn sự kiện và lịch sử sửa đổi |
| Sentence | Loại hình phạt và thời hạn thuộc judgment; không chứa UI state |
| Classification | Quyết định phân nhóm giam giữ; không phải điểm uy tín |
| Housing | Khu/buồng/giường đang được bố trí; có thể thay đổi mà không đổi sentence |
| Custody order | Quyết định hữu hiệu về giam riêng, kỷ luật, chăm sóc hoặc chuyển nơi |
| Movement authorization | Phạm vi, mục đích, khoảng thời gian được di chuyển của một actor |
| Chapter end | Hoàn thành đoạn trải nghiệm; không làm nhân vật hết án |
| Release | Rời trạng thái chấp hành án căn cứ sự kiện hợp lệ của scenario |
| Scenario | Bộ dữ kiện hư cấu đã được kiểm, không phải người chơi tự tuyên án cho người thật |

## 2. Setup bắt buộc trước New Game

Luồng: U04 New → U03 Ngoại hình → **U36 Bối cảnh và mức án** → xác nhận → U05 → U26 tiếp nhận → U06. Back giữ draft, chưa tạo lineage. Bấm Enter tại ô tên không được bỏ qua U36. Continue/import/reload không chạy lại setup.

U36 có bốn bước: (1) chọn mode; (2) chọn thời hạn/chung thân; (3) chọn điểm bắt đầu và hỗ trợ trải nghiệm; (4) xem tóm tắt hệ quả. Mặc định mode hư cấu hiện có thể được chọn; khi người dùng chọn mode VN thì **chưa có mức án mặc định** và phải xác nhận rõ. Không random mức án bằng nút random ngoại hình.

### Catalog mức án mục tiêu

Các preset dưới là ví dụ sản phẩm, không phải danh sách các mức án duy nhất pháp luật cho phép. Các preset A/B chỉ là khóa phân nhóm nội bộ game, không đặt tên “trại loại A/B theo luật”. Điều kiện chi tiết vẫn được scenario và quyết định phân loại xác nhận.

| Preset | Loại / thời hạn | Trường hợp | Phân nhóm khởi đầu đơn giản | Tóm tắt nhìn thấy trước Start |
|---|---|---|---|---|
| VN-T03M | Có thời hạn / 3 tháng | Một tội, chưa giảm | A | Cùng quy tắc sinh hoạt của nhóm A, tiến độ thời hạn ngắn |
| VN-T06M | Có thời hạn / 6 tháng | Như trên | A | Không tự do ra khỏi khu vì án ngắn |
| VN-T01Y | Có thời hạn / 1 năm | Như trên | A | Có giờ ra/về buồng và hoạt động được phân công |
| VN-T03Y | Có thời hạn / 3 năm | Như trên | A | Không tự cho hưởng án treo |
| VN-T05Y | Có thời hạn / 5 năm | Như trên | A | Không tự chuyển sang cơ sở khác chỉ do mốc 5 năm |
| VN-T10Y | Có thời hạn / 10 năm | Như trên | A | Học tập, công việc và gặp theo eligibility riêng |
| VN-T15Y | Có thời hạn / 15 năm | Như trên | A | Mốc biên; không coi là trên 15 năm |
| VN-T20Y | Có thời hạn / 20 năm | Một tội, chưa giảm | B | Phân khu/buồng khác nhóm A, không mặc định biệt giam |
| VN-T30Y | Có thời hạn / 30 năm | Tổng hợp đã xác lập trong scenario | B | Ghi rõ án tổng hợp; không chọn làm mức của một tội |
| VN-LIFE | Chung thân | Không thời hạn | B | Không có ngày hết án mặc định; kết thúc chương vẫn chơi tiếp được |

Tùy chỉnh nâng cao: nhập **tháng nguyên**, 3–240 với kịch bản một tội; 3–360 với scenario tổng hợp được publish. Trên 240 phải có `aggregate` và dữ kiện tổng hợp do content cung cấp; không nhận checkbox tự khai làm bằng chứng. Catalog custom ban đầu chỉ cho dùng khi scenario generator đã qua QA, nếu chưa có thì hiện “Chưa hỗ trợ tùy chỉnh” và giữ đủ preset. Giá trị 0, âm, NaN, vô hạn, số lẻ tháng, vượt giới hạn bị chặn tại U36 và tại command khởi tạo. `life` dùng giá trị thời hạn null; không đổi thành 9999 ngày.

### Điểm bắt đầu trải nghiệm

| Chế độ | Dữ kiện | Điều kiện |
|---|---|---|
| Tiếp nhận mới | Bắt đầu tại L01, bước tiếp nhận chưa hoàn tất | Mặc định cho mọi preset; số ngày đã chấp hành/tạm giam ghi theo scenario, không suy từ ngày tạo game |
| Một đoạn giữa hành trình | Đã có judgment, housing, chương đang mở | Scenario có thời gian đã chấp hành và quyết định được xác minh; không slider sửa hồ sơ sau khi Start |
| Minh họa kỷ luật | Vẫn chọn sentence trước; mở bằng notice/quyết định hư cấu đã có | Nhãn trải nghiệm riêng, nút xem tóm tắt/bỏ phần trình bày; không chọn “biệt giam” làm hình phạt chính |
| Minh họa giam riêng | Lý do và phạm vi cụ thể, không đồng nghĩa vi phạm | Không tự gán bệnh hoặc bản sắc nhạy cảm cho avatar |

Các scenario minh họa chỉ publish sau QA và review nội dung tương ứng; setup mô tả trạng thái chưa có thay vì tạo phiên khác với thẻ đã chọn. Tất cả preset playable phải có ít nhất đoạn tiếp nhận, một ngày đúng lịch, một sự kiện có lựa chọn và một recap chương, không phải chỉ số/placeholder.

## 3. Quy tắc phân loại và bố trí

### Bảng quyết định nghiệp vụ nội bộ

Các hàng thể hiện mô hình áp dụng tham chiếu VN02, cần review trước publish. `termAtJudgment` khác `remainingTerm`; không suy ngược hồ sơ từ ngày còn lại.

| Ưu tiên | Điều kiện | Kết quả xử lý |
|---|---|---|
| 1 | Thiếu profile/bản án/quyết định có version, dữ kiện mâu thuẫn | Review-required; giữ state đã hợp lệ, không phân ngẫu nhiên |
| 2 | Có nhu cầu bố trí riêng tương thích profile đã hỗ trợ | Tính phân nhóm trước, sau đó chọn buồng riêng trong phạm vi phù hợp; không xóa nhóm gốc |
| 3 | Chung thân hoặc tái phạm nguy hiểm chưa có điều kiện chuyển | Nhóm B |
| 4 | Án đã tuyên trên 15 năm, chưa có quyết định giảm phù hợp | Nhóm B, kể cả thời gian tự nhiên còn dưới 15 năm |
| 5 | Án trên 15 năm, có giảm và phần còn lại dưới 15 năm, có quyết định phân loại | Nhóm A theo decision |
| 6 | Tái phạm nguy hiểm, đã chấp hành ít nhất nửa thời hạn và có giảm, có quyết định phân loại | Nhóm A theo decision |
| 7 | Án không quá 15 năm, không có điều kiện ưu tiên khác | Nhóm A |
| 8 | Ngoại lệ bố trí khu do điều kiện chỗ ở, có decision | Có thể cùng khu vật lý nhưng không chung buồng giữa cohort không tương thích |

Biên “còn đúng 15 năm” không đạt điều kiện “dưới 15 năm” của hàng 5. Không lấy đoạn chữ hiển thị “15 năm” đã làm tròn để quyết định. Không dùng tội danh để suy ra tái phạm nguy hiểm; đây là trường có nguồn trong judgment. Nếu nhiều điều kiện tranh chấp, trả review-required; không chọn hàng thuận tiện nhất.

### Bố trí riêng và phạm vi chuyên biệt

Registry có các lý do độc lập: nhóm nữ, quốc tịch nước ngoài, truyền nhiễm nhóm A, chờ giám định theo hồ sơ, thai sản/con theo mẹ, thường xuyên vi phạm và trường hợp giới tính theo quy định. Nguồn chính sách phải xác định lý do nào bắt buộc, lý do nào có thể áp dụng; không hardcode mọi lý do đều là hình phạt. Các tổ hợp chưa có profile được gắn unsupported, có thông tin và backlog, không tự bỏ qua khi phân giường.

Đề xuất `support_separation` cho tình huống bảo vệ/an toàn là thiết kế hư cấu có review riêng, không gắn nhãn tự động là một khoản cụ thể của Điều 26. L21 là họ không gian dùng cho nhiều variant độc lập, không giam chung mọi nhóm trong một phòng. Avatar đổi tóc/da/dáng không làm chuyển buồng, đổi kết quả xem xét hoặc eligibility.

## 4. Chu kỳ giam giữ trong ngày

Phase custody riêng với `PlayerMode`: `intake`, `in_cell`, `scheduled_movement`, `authorized_activity`, `returning`, `night_confinement`, `separate_housing`, `disciplinary_confinement`, `care_transfer`, `transfer_pending`, `released`.

Giờ cụ thể thuộc policy cơ sở hư cấu, không tự coi giờ DAILY hiện có là giờ toàn quốc. Bản content phải xuất được bảng đầy đủ 24 giờ, địa điểm, nhóm áp dụng, bắt buộc/tự chọn, điều kiện miễn và phương án thay thế; interval nửa mở [start,end), không có khoảng thiếu mode.

| Phase | Quyền và tương tác | Cách kết thúc |
|---|---|---|
| Intake | Chỉ vùng tiếp nhận; có hỗ trợ/cấp phát tại chỗ | Hoàn tất saga phân chỗ; skip presentation vẫn giữ luật |
| In cell | Trong buồng được phân; đọc, nghỉ, vệ sinh, yêu cầu | Có lịch và quyền di chuyển mới |
| Scheduled movement | Qua ranh giới đã cấp phép, mục đích/điểm đến rõ | Đến điểm, hết window hoặc bị thu hồi có lý do |
| Authorized activity | Chỉ khu hoạt động và tuyến quay về phù hợp | Hết ca hoặc chuyển có phép |
| Returning | Ưu tiên về chỗ, nhắc và hỗ trợ | Xác nhận đã về; không kẹt ngoài vì cửa đóng |
| Night confinement | Di chuyển trong buồng; camera/menu/save/hỗ trợ vẫn dùng | Tới phase tiếp; fast-forward có recap |
| Separate housing | Buồng được bố trí; dịch vụ theo variant | Decision kết thúc/chuyển; không áp mặc định 10 ngày |
| Disciplinary confinement | Chỉ buồng kỷ luật; hoạt động/dịch vụ thay thế | Hết order hoặc được thay/hủy quyết định |
| Care transfer | Yêu cầu → cho phép → chuyển, hoặc dịch vụ tại chỗ | Plan/decision trả về vị trí tương thích |
| Transfer pending | Chờ readiness/chuyển có checkpoint | Commit đích một lần hoặc rollback |
| Released | Không chạy routine giam giữ | Epilogue/archive; sandbox phải là fork khác |

Không nhốt người chơi bằng overlay không thể thoát. Game có thể khóa di chuyển ngoài buồng nhưng luôn cho mở menu/cài đặt/lưu/thoát và yêu cầu hỗ trợ. Không bắt đợi 10 ngày theo thời gian thật. Tua nhanh không đổi nhãn thành “đã ra tù”.

## 5. Feature catalog mới F61–F72

Các feature kế thừa C0 về validate/reserve/commit/event/checkpoint/idempotency. Khi lỗi, giữ bản state hợp lệ gần nhất, giải thích mã lỗi và phương án tiếp tục. Chỉ F61–72 đủ chưa thay QA của F01–60.

### F61 — Chọn bối cảnh và mức án

- **Story:** Tôi muốn biết mình sẽ trải nghiệm án nào và ảnh hưởng gì trước khi bắt đầu.
- **Đầu vào:** CharacterDraft hợp lệ; scenario/profile đã publish, còn tương thích. U36 cho term/life, điểm bắt đầu và bản tóm tắt.
- **Luồng:** Chọn → kiểm dữ liệu → preview placement/khác biệt → xác nhận snapshot draft → tạo một lineage. Content đổi trong lúc xem phải yêu cầu xem lại.
- **Nhánh lỗi:** Sửa số tháng, Back, reload draft, scenario chưa hỗ trợ; Start pending không cho gửi đôi. Guest không bắt đăng nhập.
- **AC61:** Mọi preset catalog hợp lệ có đường Start; invalid bị chặn cả UI/domain; double-submit một nhân vật; random ngoại hình không sửa sentence; U03 Enter không bỏ U36.
- **Liên kết:** U03/U36/U05/U26; DB45/46; T11-02; QA25; VN-SC01/02.

### F62 — Hồ sơ bản án và tiến độ

- **Story:** Tôi muốn phân biệt án đã tuyên, đã chấp hành, còn lại và chương game.
- **Luồng:** Tạo judgment version → trình bày U26/U37 → cập nhật tiến độ từ đồng hồ domain → ghi amendment nếu có decision. Không sửa judgment qua ô hồ sơ UI.
- **Nhánh:** Có thời hạn, chung thân, án tổng hợp, credit quá trình trước scenario; thiếu dữ kiện trả “Chưa xác định” và khóa dự báo ngày, không ra số 0 giả.
- **AC62:** Life không có release countdown; mức 30 năm ghi aggregate; không cộng thời gian tạm giam hai lần; ngày kết chương không ghi “hết án”.
- **Liên kết:** U09/U26/U35/U37; DB46; T11-03; QA25/30; VN-SC03/04/20.

### F63 — Phân nhóm và phân buồng tương thích

- **Story:** Tôi muốn nơi giam phản ánh hồ sơ và quyết định, không chỉ số điểm.
- **Luồng:** Resolve classification → lọc buồng tương thích → reserve giường → trình quyết định U26/U34 → commit housing → cập nhật access.
- **Nhánh:** Hết chỗ, nguồn luật/profile thiếu, sai cohort, ngoại lệ cùng khu khác buồng. Không fallback sang 3A bất chấp điều kiện.
- **AC63:** Đúng các biên bảng phân loại; một housing active mỗi actor; không chung buồng cohort xung đột; không tự chuyển chỉ vì thời gian còn giảm.
- **Liên kết:** U26/U34/U37; L19/20/21; DB30/47; T11-03/04; QA26; VN-SC05–08.

### F64 — Ranh giới và quyền di chuyển

- **Story:** Tôi muốn hiểu vì sao được/không được đi, và game thực thi giống thông báo.
- **Luồng:** Authority kiểm actor, phase, boundary, purpose, decision revision, time window → cho qua/đi có phép/từ chối có lý do. Recheck tại crossing và action commit.
- **Nhánh:** Cửa mở do NPC, boundary không có mesh, đi chéo/đi nhanh, teleport hồi phục, click map, UI gọi thẳng command, quyền đổi giữa action; đều dùng cùng evaluator.
- **AC64:** Không lọt khu trái quyền bằng các input; nav/map/verbs/HUD cùng revision; không từ chối dịch vụ thiết yếu chỉ vì không được tự đi tới phòng.
- **Liên kết:** U06/U13/U16/U17/U37; DB48/49; T11-05; QA27; VN-SC09–12.

### F65 — Ra/về buồng và giam buồng ban đêm

- **Story:** Tôi muốn trải nghiệm sinh hoạt có giờ và về buồng, có cách xử lý khi đang ngoài.
- **Luồng:** Cảnh báo → return phase → route phù hợp → xác nhận ở buồng → khóa boundary theo actor. Người đang đi chăm sóc có exemption/source cụ thể.
- **Nhánh:** Đường bị bảo trì, NPC kẹt, pause trong notice, mất render, hết thời gian ngoài vùng; hỗ trợ/abstract transition và record không quy lỗi cho bug.
- **AC65:** Không dùng cơ chế “có người thì luôn cho ra” của F28 để vô hiệu giam buồng; không đóng collider xuyên người; reload trước/sau boundary không mở cửa trái phép.
- **Liên kết:** U06/U17/U37; L19/20; DB48/49; T11-05; QA27/30; VN-SC10/11/18.

### F66 — Quyết định kỷ luật và buồng kỷ luật

- **Story:** Tôi muốn thấy sự việc, trình bày, quyết định, thời hạn và đường xem xét lại.
- **Luồng:** F52 notice/facts/response → quyết định theo policy → nếu order buồng kỷ luật thì reserve L22 → chuyển có checkpoint → sinh hoạt tại buồng → expiry/revoke → trở về housing tương thích.
- **Nhánh:** Khiển trách/cảnh cáo không tự đưa L22; evidence thiếu thì dismiss. Điều kiện sức khỏe/support làm thay cách trình bày/phục vụ; không biến thành debuff chẩn đoán. Khiếu nại không tự đình chỉ lệnh nếu chưa có quyết định tương ứng.
- **AC66:** Order có issuer/reason/start/end; bản VN tham chiếu không vượt 10 ngày; không gia hạn lén bằng chuỗi order cùng sự việc; thời gian chạy theo domain; expiry và reload không reset hạn. Hạn chế gặp có lifecycle riêng, không gộp với hết buồng.
- **Liên kết:** U30/U33/U38; L22; DB40/48; T11-06; QA28; VN-SC13–16.

### F67 — Giam giữ riêng theo lý do

- **Story:** Tôi muốn biết chuyển riêng là vì bố trí, chăm sóc hay kỷ luật.
- **Luồng:** Scenario/decision có reason → resolve variant → phân buồng L21 phù hợp → áp activity/contact policies riêng → review/return khi có event.
- **Nhánh:** Lý do nhạy cảm chỉ owner thấy; specialist variant chưa publish không cho Start. Trường hợp bản sắc không tự tạo incident hoặc hạ uy tín.
- **AC67:** Không dùng countdown kỷ luật cho mọi giam riêng; không tự tạo record vi phạm; hai actor cần tách không share room chỉ vì cùng zone L21.
- **Liên kết:** U26/U31/U34/U37; L21; DB30/38/48; T11-04/06; QA26/28/32; VN-SC17.

### F68 — Dịch vụ, học và công việc dưới ràng buộc

- **Story:** Tôi muốn các lựa chọn vẫn dùng được đúng cách khi không tự tới quầy/phòng.
- **Luồng:** Capability kiểm điều kiện → tự đi theo phép hoặc request/delivery/abstract service → booking kết quả. Ăn, nước, vệ sinh, hỗ trợ vẫn có đường phù hợp tại buồng.
- **Nhánh:** Hủy/đổi lịch do custody ghi reason, không thành vắng mặt có lỗi. Thư/call/gặp người thân/trao đổi pháp lý có policy riêng; không coi “liên lạc” là một Boolean.
- **AC68:** Không xuyên restriction bằng mở LifeHub rồi collect/enroll; không mất tiền/lượt vì chuyển do hệ thống; không tự gán cùng mức lao động cho mọi condition.
- **Liên kết:** U08/U16/U27–32; DB31/35/36/38/39/49; T11-07; QA29; VN-SC12/15/19.

### F69 — Chuyển khu và quyết định thay đổi bản án

- **Story:** Tôi muốn chuyển nơi giữ đúng đồ đạc, hồ sơ và hoạt động.
- **Luồng:** Decision versioned → kiểm lại classification/eligibility → F56 reserve/stage → checkpoint → destination ready → atomic commit → reconcile bookings/orders/actions.
- **Nhánh:** Bản án thay đổi mà nhóm không đổi; hết chỗ; crash sau reserve; bị thu hồi decision; nguồn/đích cùng mesh nhưng khác room policy.
- **AC69:** Không dùng điểm đến 7B cố định cho mode VN; judgment và housing có history riêng; retry không phát đồ/settle/đặt quyền hai lần.
- **Liên kết:** U05/U26/U34/U37; DB42/46/47/48; T11-08; QA30; VN-SC08/18/21.

### F70 — Kết thúc chương, hết hạn và quyết định rời cơ sở

- **Story:** Tôi muốn hoàn thành trải nghiệm mà không bị thông báo hết án sai.
- **Luồng:** Chương hoàn tất → recap “Kết thúc chương — đang tiếp tục chấp hành án” → tiếp tục/đổi đoạn scenario/archival menu. Chỉ release event phù hợp mới chạy F57 settlement/depart.
- **Nhánh:** Chung thân không có ngày thả; eligibility không bằng approval; quyết định giảm/tha/đặc xá là authored events có reference, không suy từ XP. Quy tắc hậu giam giữ được thông tin, không giả đã mô phỏng.
- **AC70:** Không release vào ngày 7 vì Q06 trong mode VN; không khóa chứng nhận hết hạn bằng số goal học/việc làm; settlement đúng một lần khi thực sự release, không khi kết chương.
- **Liên kết:** U12/U19/U35/U37; DB43/46/48; T11-08; QA30; VN-SC20/22.

### F71 — Lưu và khôi phục custody

- **Story:** Reload giữ nguyên phòng, hạn lệnh, quyền và panel, không trở thành tự do.
- **Luồng:** Checkpoint có profile/scenario refs + toàn graph custody → validate/migrate → resolve permissions và vị trí hợp lệ → scene/UI readiness → cho input.
- **Nhánh:** Save v1/v2 vẫn mode hư cấu; v3 không mở bằng client cũ; policy mất/hết hỗ trợ mở recovery giữ file; cloud schema chưa nâng phải báo chưa sync được, local vẫn dùng.
- **AC71:** Không đổi profile luật âm thầm; reload trước/sau expiry hoặc transfer không lặp effect; vị trí safe anchor phải đúng room và quyền; không tự bắt đầu lại khi dữ liệu lỗi.
- **Liên kết:** U05/U20/U25/U36–38; DB19/45–50; T11-09; QA31; VN-SC18/21/23.

### F72 — Giải thích chế độ, nguồn và kiểm tra độ phủ

- **Story:** Tôi muốn biết quy tắc hiện tại và đâu là luật tham chiếu/đâu là game.
- **Luồng:** U37 hiển thị sentence, classification, housing, phase, next change, restrictions và available actions; liên kết handbook và nguồn theo profile; reason code đi kèm text dễ hiểu.
- **Nhánh:** Nguồn không truy cập được vẫn có bản tóm tắt versioned, không hard fail gameplay; unknown không hiện “được phép”. Privacy bảo vệ lý do riêng tư trong HUD chung.
- **AC72:** Mọi restriction có reason/source hoặc nhãn [D]; UI không bịa hạn hết án; tất cả 38 screen có mapping; không ghi “đúng 100% thực tế” chỉ vì test pass.
- **Liên kết:** U14/U36/U37/U38; DB45/50; T11-01/10; QA32; VN-SC24.

## 6. Một ngày mẫu và hai vòng đời ví dụ

Mọi giờ sau đây là lịch mẫu hư cấu để designer viết content, không tuyên bố lịch thực tế: thức dậy tại buồng → điểm danh tại vị trí được chỉ định → chuyển có phép tới bữa ăn/nhận tại buồng theo variant → học/làm theo phân công → nghỉ trong phạm vi → hoạt động được phép → trả về buồng → điểm danh/khóa đêm. Từng khoảng có text, route/interaction và phương án hỗ trợ, không chỉ nhạc loa.

**Ví dụ án 5 năm:** Chọn VN-T05Y → tiếp nhận → nhóm A, buồng ở L19 → ngoài giờ ra buồng chỉ đi trong buồng → đến window học được route tới lớp → hết window có nhắc về → Q06 kết chương nhưng hồ sơ vẫn còn án. Nếu có notice, U33 cho trình bày; chỉ decision phù hợp mới thay capability.

**Ví dụ án 20 năm:** Chọn VN-T20Y → nhóm B, L20 → vòng đời sinh hoạt tương tự theo phân công, không mặc định cô lập → scenario có quyết định giảm làm phần còn dưới ngưỡng và có decision phân loại → U34 cho xem thay đổi, bảo toàn tài sản → housing L19 sau commit. Chỉ đồng hồ giảm tự nhiên chưa đủ trigger đổi nhóm.

**Ví dụ kỷ luật:** Bản án 5 năm giữ nguyên → notice/quyết định → chuyển L22 → hiện thời hạn lệnh, các hoạt động tại buồng và hỗ trợ → fast-forward đến review/end → trả về buồng phù hợp. Hạn chế thăm gặp còn hay hết là quyết định/policy riêng được hiển thị, không dùng một timer cho cả hai.

## 7. Các nội dung chưa được coi là hoàn thành

Chưa có bộ thoại cuối, asset phòng mới, profile chuyên biệt đã review, dữ liệu vận hành đại diện, SQL/API thực thi, benchmark hoặc test mới. Tất cả nằm trong backlog 17. Không thêm multiplayer, người chơi làm cán bộ, voice/chat hoặc thay hosting chỉ để có custody SP. Kiến trúc tương lai vẫn phải cho authority kiểm quyền, không tin nút UI bị ẩn.
