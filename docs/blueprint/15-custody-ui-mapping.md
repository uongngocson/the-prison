# 15 — Mapping UI, không gian 3D và quyền theo chế độ giam giữ

CR-VN-01 / baseline mục tiêu 1.2 / 02/11/2026. **Đây là thiết kế [D], không có “UI pháp luật 100%”.** [13](13-vietnam-custody-audit.md) ghi nguồn; [14](14-sentence-custody-spec.md) ghi luật nghiệp vụ; [16](16-custody-contracts.md) là hợp đồng authority; [17](17-custody-delivery-qa.md) là kiểm thử. C-UI phần 05 tiếp tục áp dụng trừ delta chỉ rõ dưới đây.

## 1. Cách đọc mapping đầy đủ

Không nhân bản mười bộ UI cho mười preset. Mức án → judgment/classification; classification + housing + phase + order + lịch + nhu cầu → capabilities → UI projection và hành vi 3D. Vì vậy 3 năm và 10 năm có thể dùng cùng cấu trúc giao diện; điều đó đúng nếu hệ quả khác biệt cần có được thể hiện, không cần đổi màu hoặc bố cục giả để làm như hai chế độ luật khác nhau.

Coverage gồm ba bảng phải đọc cùng nhau: **preset tại 14 §2 × ngữ cảnh tại §2 dưới đây × toàn màn hình tại §3**. Kết hợp không hợp lệ ghi unsupported; không tạo hàng giả cho mọi tổ hợp. Trạng thái mới không tự làm thay sentence. Những hạn mức không có bằng chứng được gắn lịch/chính sách cơ sở hư cấu và chờ review, không tự coi án dài thì ít quyền hơn.

## 2. Ma trận ngữ cảnh → trải nghiệm nhìn thấy

Các ID C01–C12 chỉ là ID ngữ cảnh thiết kế, không phải phân hạng phạm nhân theo luật.

| Context | HUD và thông báo | 3D/cửa/đi lại | Hoạt động và liên lạc | CTA chính, điểm thoát |
|---|---|---|---|---|
| C01 Tiếp nhận | “Đang tiếp nhận”, bước hiện tại | Vùng L01 được chỉ định; không thả toàn cơ sở | Hồ sơ, cấp phát, hỗ trợ tại chỗ | Tiếp tục tiếp nhận / Hỏi hỗ trợ |
| C02 Nhóm A trong buồng | Khu/buồng, “Trong giờ ở buồng”, mốc tiếp theo | Buồng L19 được phân; không tự ra hành lang | Đọc/nghỉ/vệ sinh/yêu cầu | Xem lịch / Hoạt động tại buồng |
| C03 Nhóm B trong buồng | Tương tự C02; hồ sơ giải thích phân nhóm | Buồng L20, đúng cohort | Không mặc định cấm học/gặp vì B | Xem chế độ / Hoạt động tại buồng |
| C04 Chuyển có phép | Điểm đến, mục đích, window | Chỉ liên kết được phép; camera vẫn tự điều khiển | Không dùng window này đi quầy khác | Đi tới hoạt động / Nhờ hướng dẫn |
| C05 Hoạt động ngoài buồng | Địa điểm/phân công, lúc kết thúc | Khu hoạt động tương ứng và vùng phụ trợ được phép | Học/làm/ăn/tập đúng eligibility | Thực hiện / Xem đường về |
| C06 Về buồng | Notice rõ và deadline game-time | Return permission; không khóa người đang ở ngưỡng cửa | Tạm dừng/đổi lịch việc xung đột do hệ thống | Về buồng / Hỗ trợ di chuyển |
| C07 Đêm | “Giờ ở buồng”, giờ thay đổi tiếp | Giới hạn room, không tắt input toàn game | Nghỉ/đọc/yêu cầu; skip có recap | Nghỉ đến mốc tiếp / Yêu cầu hỗ trợ |
| C08 Giam giữ riêng | “Bố trí riêng”, lý do chi tiết chỉ trong hồ sơ | Variant L21, không chung buồng khác cohort | Phục vụ/đưa đi theo profile riêng | Xem bố trí / Yêu cầu chăm sóc |
| C09 Buồng kỷ luật | “Đang chấp hành quyết định”, hạn còn lại của lệnh | L22; boundary riêng; không tự mở vì cửa chung mở | Hoạt động tại buồng, hỗ trợ, xem xét lại; gặp gia đình theo restriction | Xem quyết định / Sinh hoạt tại buồng |
| C10 Chăm sóc | “Đang có lịch/chuyển chăm sóc” | Tại chỗ hoặc tới L08 theo phép | Miễn/đổi lịch khi có plan, không quy vắng có lỗi | Nhận hỗ trợ / Xem thay đổi lịch |
| C11 Chuyển khu | “Đang chuẩn bị/đang khôi phục chuyển nơi” | Giữ nguồn tới readiness; commit một điểm đến | Packing/booking changes, không tương tác nguồn sau commit | Xem chuyển nơi / Thử lại |
| C12 Rời cơ sở | “Đã chấp hành xong/đã có quyết định…” theo event | Ending; không quay routine cũ | Summary/biên nhận/quyết toán | Đọc kết thúc / Menu / Fork sandbox |

Chung thân dùng C03/C04/C05… như mọi sentence phù hợp; badge “Chung thân” ở hồ sơ, không chiếm hết HUD hay luôn che cảnh bằng cảnh báo. Kết thúc chương là overlay recap trên episode còn active, không dùng C12 nếu chưa release. Có thể lồng context (ví dụ C09 có chăm sóc): resolver ở 16 quyết định capability theo từng mục, không lấy một context ưu tiên rồi xóa mọi nhu cầu khác.

## 3. Mapping toàn bộ U01–U38

Tên U01–25 giữ theo blueprint 05; U26–35 theo 11. Mỗi hàng là delta bắt buộc cho mode mới, không xác nhận màn đó đã hỗ trợ delta. Mọi CTA mutation phải qua domain; UI disabled không phải lớp thực thi duy nhất.

| Screen | Nội dung/luồng phải cập nhật | Khi bị giới hạn hoặc dữ liệu lỗi |
|---|---|---|
| U01 Landing | Mô tả SP, hai mode, phạm vi tham chiếu và chất lượng đồ họa thật | Không quảng cáo mọi chế độ đã có; yêu cầu thiết bị dựa bằng chứng |
| U02 Auth | Tùy chọn cloud, intended route quay setup/save | Đăng nhập thất bại vẫn guest; không mất draft mức án |
| U03 Create | Ngoại hình/gia đình; CTA “Tiếp tục chọn bối cảnh” | Enter chỉ sang U36; Back giữ draft; không reset sentence khi đổi tóc |
| U04 Main Menu | New/Continue có mode, preset và thời điểm save | Không tự đưa vào setup khi resume; profile thiếu có recovery |
| U05 Loading | Stages profile → state/custody → scene/collider → permissions → input | Scene thiếu giữ snapshot; Retry cùng transition, không spawn 3A |
| U06 HUD | Room, phase, next permitted change; mở U37; notice thay đổi quyền | Chỉ báo ngắn không tiết lộ lý do riêng; không ghi “Tự do” trong C07/C09 |
| U07 Pause | Lưu/cài đặt/thoát; ghi “Chơi đơn đang tạm dừng” | Hạn lệnh không chạy bằng đồng hồ thật khi pause |
| U08 Inventory | Carried/locker/stored, quyền dùng và nhận tại chỗ | Không truy cập tủ phòng cũ từ L22; collect có delivery hoặc pending |
| U09 Profile | Sentence, mode, trạng thái pháp lý, chương; link U37 | Không trộn “ngày chơi” với “ngày đã chấp hành” |
| U10 Relationships | NPC biết được, lý do tương tác hợp lệ | Không hiển thị hồ sơ kỷ luật/y tế/quốc tịch riêng của NPC |
| U11 Skills | XP/khóa học giữ nguyên; lịch học phù hợp | Không hứa đổi án/tha vì lên level |
| U12 Journal | Objective variant tại buồng/được phép/chờ điều kiện | Không waypoint qua cửa trái phép; hệ thống chặn thì không phạt bỏ nhiệm vụ |
| U13 Map | Điểm hiện tại, đích, trạng thái đến được/tới khi có phép/không thuộc khu | Không dùng mỗi `zoneOpen`; lý do và CTA xin hỗ trợ; không đường tuần tra thật |
| U14 Handbook | Thuật ngữ, khác biệt giam riêng/kỷ luật, nguồn và phần hư cấu | Tóm tắt versioned đọc offline; link ngoài không bắt buộc để chơi |
| U15 Dialogue | Cán bộ/nhân vật tương tác qua đúng phạm vi; authored topics | Không xuyên tường để nói chuyện; yêu cầu tại buồng có channel riêng |
| U16 Interaction | Các verb có capability, phương thức và lý do chưa dùng được | Recheck commit; không dùng phím E/touch/gamepad vượt khóa |
| U17 Schedule | Lịch cá nhân, phase, mandatory/optional, phép và miễn trừ | Booking hoãn do custody có reason và phương án thay thế |
| U18 Notifications | Notice trở về/lệnh mới/expiry, link U33/U37 | Dedup; không công khai dữ kiện nhạy cảm; không spam countdown mỗi giây |
| U19 Achievements | Thành tựu theo nội dung hợp lệ và mode | Không thưởng chịu kỷ luật lâu/vi phạm/được giảm án tự động |
| U20 Saves | Mode/preset/room/order summary, schema/policy version | Save v3 không upload SQL v1–2; không báo cloud thành công giả |
| U21 Graphics settings | Chất lượng cảnh và camera | Không đổi collider/authority khi giảm chất lượng |
| U22 Audio settings | Volume/phụ đề/loa; notice có text tương đương | Tắt âm không làm mất lệnh về buồng |
| U23 Controls/accessibility | Remap, touch/gamepad, text scale, skip/assist | Auto-complete vẫn giữ quyền domain; assist không biến thành teleport tự do |
| U24 Lobby | Chưa có MP, nêu trạng thái thật | Không cho chọn phòng multiplayer custody giả |
| U25 Recovery | Giữ file, bản checkpoint trước, policy/schema mismatch | Không chuyển mode hoặc bắt đầu lại để “chữa” save |
| U26 Admission | Tóm tắt sentence, profile, bố trí và điều kiện; stage persisted | Không sửa án ở bước xác nhận danh tính; skip vẫn resolve đúng phân khu |
| U27 Property | Receipt/issue/locker mới, đồ nhận tại buồng hay ký gửi | Chuyển khu không mất/nhân đôi tài sản; không nhận đồ ở xa trái quyền |
| U28 Account/store | Đặt hàng và phương thức nhận theo regime | Không mua phép đi lại; pending delivery không debit lại |
| U29 Contacts | Thư, call, gặp người thân, pháp lý tách channel và eligibility | Hạn chế một kênh không khóa mọi kênh; hiện review/end condition riêng |
| U30 Requests | Yêu cầu chăm sóc/giải thích/phản hồi/khiếu nại từ buồng | Không cần tới bàn cán bộ mới gửi; trả receipt và trạng thái |
| U31 Care/support | Tại chỗ hoặc chuyển có phép; nhu cầu riêng tư | Không chẩn đoán từ mood, không đổi bản án bằng checkbox |
| U32 Study/work/culture | Program được phân/được chọn, khả năng tham gia và hỗ trợ | Hoãn có lý do, bài thay thế đúng content; không bỏ eligibility vì khóa học cần quest |
| U33 Incidents | Facts/response/decision/review và liên kết custody order | Allegation chưa thành quyết định; khiếu nại không tự unlock nếu lệnh còn hiệu lực |
| U34 Transfer | From/to room/cohort, reason, đồ/lịch thay đổi, atomic stages | Retry/rollback tới đúng nguồn hợp lệ; không hardcode 7B |
| U35 Reintegration/ending | Chapter recap riêng; release đủ điều kiện/decision mới settlement | Không thả ngày 7 cho term/life; không khóa hết hạn chỉ vì thiếu goal |
| U36 Scenario & sentence setup | Chọn mode, preset/custom hợp lệ, điểm bắt đầu và confirm | Unsupported có lý do; draft restore; không Start placeholder |
| U37 Custody profile | Tổng hợp sentence/classification/housing/phase/capabilities/source | Stale/review-required hiển thị rõ; không tự coi unknown là allowed |
| U38 In-cell experience | Hoạt động tại buồng, mốc phase/lệnh, dịch vụ/yêu cầu và skip | Có thể đóng panel để nhìn/đi trong phòng; menu/save/thoát luôn dùng được |

## 4. Screen contracts mới

Kế thừa C-UI: Loading/Empty/Error/Ready, keyboard/focus, thông báo có text, không chỉ màu, target ưu tiên 44 CSS px, reflow 200%, reduced motion và không tải nhiều scene preview đồng thời. Nếu bản hiện tại chưa đáp ứng C-UI thì đây vẫn là yêu cầu chưa nghiệm thu.

### U36 — Thiết lập bối cảnh và mức án

| Trường | Hợp đồng |
|---|---|
| Purpose | Chọn rõ bối cảnh và hệ quả trước tạo lineage |
| Layout | Desktop: stepper + form trái, summary/preview phải; compact: stepper đầu, summary gập mở, footer không che lỗi |
| Hierarchy | Mode → sentence kind → preset/term → scenario start → hỗ trợ → hệ quả → confirm |
| Fields | Tên preset; months khi term; aggregate từ scenario; phạm vi nhân vật được hỗ trợ; nhãn luật tham chiếu; next/Back |
| Actions | Chọn/so sánh/đọc giải thích/Back/confirm; không sửa judgment sau start tại screen này |
| States | Draft, validating, invalid, unsupported, stale content, ready, creating, failed; Error giữ toàn draft |
| Transitions | U03↔U36; confirm→U05→U26; auth optional quay đúng draft; resume đang chơi không đi U36 |
| Keyboard | Tab theo thứ tự; radio dùng phím mũi tên; numeric input có label/min/max/error; Enter confirm chỉ ở bước cuối |
| Touch/gamepad | Radio/card chạm được, không hover-only; D-pad/stick focus, A chọn, B Back; không đòi bàn phím số cho preset |
| Accessibility | Tên chế độ có text; summary announce khi người dùng đổi lựa chọn, không mỗi frame; nhãn chung thân không chỉ biểu tượng ∞ |
| Visual/performance | Preview một room thumbnail/scene nhẹ, fallback ảnh/text; loading không dựng cả L19–22 |
| Privacy | Không hỏi án thật, CCCD, hồ sơ y tế hoặc địa chỉ thật; draft chỉ là dữ liệu hư cấu local |
| Errors | FIELD_INVALID, SCENARIO_UNSUPPORTED, POLICY_UNAVAILABLE, CONTENT_CHANGED, CREATE_FAILED; text chỉ cách khắc phục |
| Acceptance | UI36: không bỏ setup qua Enter; double click một lineage; reload/back giữ draft; summary và khởi tạo cùng profile hash |

Wireframe nội dung (không phải bản vẽ cơ sở thật):

```text
Thiết lập trải nghiệm                         Bước 2/4
Mô hình: Tham chiếu Việt Nam · cơ sở hư cấu

Hình phạt:  (●) Có thời hạn    ( ) Chung thân
Mức án:     [3 tháng] [1 năm] [5 năm] [15 năm] [20 năm]
            [30 năm · án tổng hợp] [Tùy chỉnh nếu hỗ trợ]

Tóm tắt lựa chọn
  Án đã tuyên: 5 năm           Bắt đầu: Tiếp nhận
  Phân nhóm dự kiến: A         Chưa phải quyết định phân buồng
  Đi lại: Theo lịch và quyền di chuyển; có giờ ở buồng
  Sau chương 7 ngày: Tiếp tục chấp hành án
  Căn cứ tham chiếu / Những phần game giản lược

[Quay lại]                                      [Tiếp tục]
```

### U37 — Hồ sơ chế độ giam giữ

| Trường | Hợp đồng |
|---|---|
| Purpose/layout | Giải thích trạng thái có hiệu lực; summary trên, tabs Hồ sơ/Nơi ở/Đi lại/Quyết định/Nguồn |
| Content | Judgment version, thời gian đã chấp hành/còn lại nếu xác định; classification decision; room; phase; next review/change |
| Actions | Xem lịch/map, đọc decision, gửi yêu cầu U30, xem sự việc U33; không có nút chỉnh án trực tiếp |
| States | Loading, ready, no active order, stale projection, review-required, missing policy; Empty không có nghĩa tự do |
| Transitions | HUD/Profile/LifeHub→U37→U17/U30/U33/U34; Back trả về focus ban đầu |
| Responsive/input | Tabs chuyển thành danh sách khi hẹp; keyboard/touch/gamepad tương đương, long labels không tràn |
| Accessibility/privacy | Phân biệt nhãn value/reason/source bằng text; lý do nhạy cảm owner-only; timeline không live announce toàn lịch sử |
| Visual/performance | Không scene thứ hai; snapshot projection theo revision; paginate lịch sử, không poll mỗi frame |
| Acceptance | UI37: text “được tới” khớp evaluator; life không date giả; mỗi constraint có reason và thời điểm/điều kiện xem lại |

```text
Chế độ hiện tại
  Án: 20 năm · đang chấp hành        Chương: Làm quen
  Nơi ở: Khu B / buồng B-04          Phase: Giờ ở buồng
  Tiếp theo: Theo lịch đã công bố    [Xem lịch]

Quyền thao tác lúc này
  Đọc/nghỉ tại buồng                 Có
  Tự tới thư viện                    Chưa được đi · ngoài lịch
  Yêu cầu chăm sóc                   Có · phục vụ/chuyển theo phép
  Gặp người thân                     Xem điều kiện đặt lịch

[Xem quyết định] [Yêu cầu giải thích] [Nguồn & giới hạn]
```

### U38 — Sinh hoạt tại buồng và thông tin lệnh

| Trường | Hợp đồng |
|---|---|
| Purpose/layout | Panel tùy mở trên scene 3D; header room/phase, action list, next event; không khóa full-screen bắt chờ |
| Content | Hoạt động tại buồng, tình trạng suất ăn/vệ sinh/cấp phát, yêu cầu, lệnh còn hiệu lực; chỉ hiện countdown khi có end hợp lệ |
| Actions | Đọc/nghỉ/yêu cầu/hỗ trợ/xem quyết định/tua đến mốc; closing panel không hủy restriction |
| States | Ready, action running, request pending, no optional activity, decision review, expiry pending transition, recovery |
| Transitions | Context prompt→U38; U33/U37 liên kết; hỗ trợ U30/31; về HUD vẫn giữ room restriction |
| Input/accessibility | Không hold bắt buộc hoặc chờ thật dài; read transcript/skip; keypad và touch đầy đủ; cancel action theo C0 |
| Visual/audio | Cảnh sáng đủ đọc/hướng nhìn, có privacy; không màn đen dài hoặc hiệu ứng làm nhục; reduced-motion bỏ chuyển camera |
| Performance | Reuse scene/props; không spawn toàn trại; chỉ cập nhật countdown theo phút game; scene readiness trước input |
| Acceptance | UI38: có nội dung chơi được, không chỉ timer; fast-forward xử lý tất cả boundary; không mất menu/save/thoát hoặc quyền hỗ trợ |

## 5. Mapping không gian 3D

Các kích thước/layout là hư cấu và phải do level designer dựng thử. Không sao chép cơ sở thật, lộ trình áp giải thật, lịch tuần tra hoặc cơ chế khóa thực tế. Phân nhóm logic không đồng nghĩa phải tải hai bản toàn trại cùng lúc.

| ID | Vai trò mục tiêu | Người dùng/capability | Props/slots và hoạt động | Cửa, nav, service, acceptance |
|---|---|---|---|---|
| L19 | Khu ở có quản lý nhóm A | Housing tương thích A; role staff theo task | Room/bed/locker, nước/vệ sinh riêng tư, bàn đọc, điểm nhận phục vụ | Boundary từng room + wing; ra theo window; xác nhận slot/lastSafe đúng buồng |
| L20 | Khu ở có quản lý nhóm B | Housing tương thích B | Tái sử dụng asset kit; số slot theo thiết kế, không tự giảm tiện ích vì án dài | Không tự dùng L19 khi hết chỗ; khu dùng chung vẫn tách cohort/room |
| L21 | Họ không gian bố trí riêng | Một instance và variant/lý do rõ ràng | Props theo nhu cầu và hoạt động được duyệt; service-at-room | Không trộn người cần tách trong cùng room; lý do private; không timer 10 ngày mặc định |
| L22 | Buồng kỷ luật | Actor có order hợp lệ; staff task được cấp | Hoạt động tại buồng, yêu cầu, nhu cầu thiết yếu và nội dung tóm tắt | Restriction thực thi; expiry/revoke đưa về housing tương thích; source và return anchor có checkpoint |

Các L01–18 được tái sử dụng theo mục đích: L01 intake; L02 giữ legacy; L03 hành lang phải có boundary/actor context; L04/09 hoạt động được phép; L05 ăn theo phương thức; L06/10 công việc theo phân công; L07/14 học; L08 care; L11 hồ sơ; L12 gặp; L13 vệ sinh/giặt; L15 cấp phát/đơn; L16 liên lạc; L17 yên tĩnh; L18 chuẩn bị chuyển/ra. Có tên khu trên bản đồ không tự trao quyền tới khu đó.

### Contract level áp dụng chung L19–22

1. Instance có `roomId`, zone, cohort, capacity, slot ownership và profile version; không suy quyền từ label màu.
2. Spawn/bed/locker/interaction/exit/safe anchors có tọa độ hợp lệ, clearance vật lý và eligibility. Mỗi room có fallback trong cùng phạm vi hợp lệ.
3. Camera chống xuyên tường/che đầu hoạt động trong phòng nhỏ; không nhìn xuyên buồng khác do near clipping.
4. Có đủ ánh sáng, audio caption và cue ra/về buồng; tắt hiệu ứng không ảnh hưởng quyền.
5. Cửa render phản ánh physical state; evaluator riêng quyết định actor qua được. Cửa đang mở cho nhân viên không cho người chơi đi theo nếu chưa có phép.
6. Không đóng mesh/collider vào capsule. Đang chuyển ở threshold thì reserve link tới safe anchor, sau đó khóa; khôi phục không coi actor nằm giữa tường là vi phạm.
7. Water/meal/hygiene/help có route tại chỗ hoặc interaction trừu tượng. Không buộc mở cửa để chống softlock rồi vô hiệu toàn regime.
8. AI LOD không bỏ rule; NPC xa vẫn phân nhóm/điểm danh/lịch đúng. Slot reservation có owner/revision.
9. Nav và culling dựa room/cohort; không teleport NPC cạnh player để giả áp giải.
10. Chụp bộ bằng chứng ngày/đêm, mouse/touch/gamepad, text 200%, low/high; route physics và 2 giờ chơi trên máy mục tiêu vẫn chưa được chứng minh bởi tài liệu.

## 6. Hành vi lỗi và thông điệp chuẩn

| Reason code | Text đề xuất | Hành động thay thế |
|---|---|---|
| ROOM_CONFINEMENT | “Hiện là giờ ở buồng. Xem lịch để biết hoạt động tiếp theo.” | U17/U38 |
| AUTHORIZATION_REQUIRED | “Bạn chưa có phép di chuyển tới khu này.” | Xem phân công / Yêu cầu hướng dẫn |
| DIFFERENT_COHORT | “Khu này không thuộc phạm vi được bố trí cho bạn.” | U37, không tiết lộ danh tính người ở đó |
| DISCIPLINE_ORDER_ACTIVE | “Quyết định hiện tại giới hạn việc ra khỏi buồng.” | U33/U38 |
| FAMILY_VISIT_RESTRICTED | “Chưa thể đặt lịch gặp theo quyết định hiện tại.” | Xem lý do/điều kiện xem lại; không tự đóng các kênh khác |
| CARE_SERVICE_AT_ROOM | “Bạn có thể gửi yêu cầu chăm sóc tại đây.” | Request không cần tới L08 |
| TRANSITION_PENDING | “Đang chuẩn bị nơi đến. Vị trí hiện tại vẫn được giữ.” | Theo dõi / Retry khi lỗi |
| POLICY_REVIEW_REQUIRED | “Chưa đủ dữ kiện để áp dụng chế độ này.” | Recovery, giữ save; không bắt đầu tự do |
| CHAPTER_ONLY | “Bạn đã hoàn thành chương; nhân vật vẫn tiếp tục chấp hành án.” | Tiếp tục / Menu / Đoạn tiếp theo nếu đã có |

Thông báo là microcopy thiết kế, không giả trích quyết định của cơ quan nhà nước. Không thêm quốc huy/chữ ký/dấu thật vào giấy tờ game để tạo cảm giác có giá trị pháp lý.

## 7. Đa thiết bị và kiểm duyệt mapping

Target kiểm UI mới: desktop 1280×720; compact 390×844 và landscape 844×390 là fixture QA, không phải chứng nhận mọi máy mobile chạy được game. Text scale 200%, safe-area, bàn phím ảo, touch left-handed và gamepad focus cần giữ đủ bước setup/capability. Không có nút quan trọng chỉ xuất hiện ở hover. Preview/cinematic có Skip và text summary; không mất provenance hoặc bypass decision khi Skip.

Review UI bắt buộc theo context: C01 intake; C02/03 trong buồng; C04 di chuyển; C06 về; C07 đêm; C08 riêng; C09 kỷ luật; C10 care; C11 transfer; C12 release. Áp bảng U01–38, ghi N/A với lý do khi không thể đến screen ở context đó. Ảnh đẹp một màn HUD không chứng minh toàn mapping.
