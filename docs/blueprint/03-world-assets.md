# 03 — World & Level Design / Asset Production Pipeline

**CR-LAB-01 / thiết kế 1.3:** [19](19-labour-ui-art-direction.md) bổ sung L23–L28, nâng cấp art/slot xưởng L10 và sáu concept; nghiệp vụ tại [18](18-labour-rehabilitation-spec.md). Không phải asset đã sản xuất hoặc benchmark.

**CR-VN-01 / thiết kế 1.2:** [15](15-custody-ui-mapping.md) bổ sung L19–L22 và contract room/boundary/service; L01–L18 dưới đây vẫn là baseline cũ.

**Bổ sung1.1:** L01–L14 là campus baseline ban đầu; [audit09](09-realism-audit.md) và [F33–F60](10-prison-life-systems.md) bổ sung gameplay còn thiếu. L15–L18 cuối file mở rộng thành18 khu/chức năng không gian cho Full Life, có thể đặt trong phòng tái sử dụng thay xây4 tòa nhà. Số này không đồng nghĩa đã có asset hoặc phải render toàn bộ cùng lúc.

## GDD: bối cảnh và nguyên tắc không gian

Tên làm việc **Một Ngày Mới / New Day**. Cơ sở hư cấu tập trung sinh hoạt, phục hồi và quan hệ xã hội; không mô phỏng bản vẽ an ninh thật. Người chơi mới đến, học nếp sống và theo đuổi ba hướng: học tập, sức khỏe, cộng đồng. Không tính điểm dựa trên tội danh hoặc ép người chơi bạo lực. NPC có cá tính, mục tiêu và giới hạn riêng; xung đột nhỏ giải được bằng đối thoại/chờ/nhờ hỗ trợ. Narrative designer review định kiến, phẩm giá và độ tuổi nội dung; rating chính thức chưa xác định.

Thế giới dạng campus nhỏ, chia cell streaming 20–40 m, kết nối graph có cửa theo lịch hư cấu. MVP không open world vô hạn. Mỗi khu phải có: anchor spawn, safe recovery anchor, interaction slots, nav/collision manifest, acoustic zone, light/probe data, accessibility route và test path. Các kích thước dưới là **blockout game**, không tiêu chuẩn xây dựng hay mô tả cơ sở có thật.

## Quy chuẩn level chung (áp dụng cho mọi L01–L14)

1. Mỗi khu dùng 1 unit = 1 m; lưới module 0,5 m, nền tầng reference thống nhất. Không áp nonuniform scale lên collider runtime.
2. Cửa hoạt động có khoảng đi hữu dụng 1,2–1,6 m; hành lang chính 3–4 m để camera/crowd dễ đọc. Đây là thông số gameplay cần thử, không chuẩn kiến trúc pháp lý.
3. Collision proxy static đơn giản, render details không tạo cạnh mắc capsule. Nav capsule theo phần 02; kiểm hai chiều cửa, reserve queue và disabled links.
4. Mỗi action spot có approach, align, occupancy, exit và cancel anchor; hai NPC không sở hữu cùng slot. Interactive object có stable content ID, không lấy tên mesh tự động làm ID persistence.
5. Ánh sáng baked/analytic cơ bản, exposure xuyên khu không nhảy; không dùng bóng đổ thời gian thực cho tất cả đồ nội thất. Audio portal chuyển 150–400 ms, limit voices theo tier.
6. Reuse module nhưng thêm story props có chủ đích; palette khác theo chức năng, không mọi phòng cùng một bộ decal. Bất kỳ asset reuse nào cũng giữ license ledger.
7. Level designer phải bàn giao top-down blockout, route 5/10 phút, danh sách sightline, heatmap queue, encounter placements, camera captures và perf capture với dân số mục tiêu. Test player không thể đi vào vùng chưa có collider/nav bằng đường tắt ngoài thiết kế.

## Đặc tả từng khu

Mỗi bảng có đủ 15 trường yêu cầu; quy tắc chung phía trên là dependency bắt buộc, không thay cho nội dung riêng của khu.

### L01 — Cổng và tiếp nhận (Full release; đoạn onboarding rút gọn MVP)

| Trường | Đặc tả |
|---|---|
| Gameplay | Giới thiệu danh tính, thiết lập nhân vật, nhận lịch và tutorial; không mô phỏng kiểm tra an ninh chi tiết |
| Cấu trúc | Sảnh tiếp đón → bàn hồ sơ → khu chờ → transition tới khu ở |
| Tỷ lệ | Blockout 24×18 m; sảnh trần 4 m, lối chính 3 m |
| Đối tượng | Bàn, ghế, biển khu, tủ hồ sơ, bảng thông báo, cổng cảnh quan không tương tác kỹ thuật |
| Vật liệu | Concrete nhạt, kính mờ, sơn kim loại, giấy; 2 trim sheets + decal atlas |
| Ánh sáng | Daylight cửa sổ + fill baked, 1 key light cho thoại |
| Âm thanh | Tiếng giấy, ghế, ambience nhẹ, PA có subtitle |
| NPC | Nhân viên tiếp nhận, người mới đến, cán bộ hướng dẫn |
| Tương tác | Xác nhận tên/ngoại hình, nhận handbook, hỏi đường |
| Collision | Static bàn/tường, trigger tiếp nhận, không thao tác khóa thật |
| Navmesh | 3 điểm queue và đường bypass cho NPC, off-mesh transition do story |
| Sự kiện | Hồ sơ chưa đủ → hướng dẫn bổ sung, mất kết nối → guest onboarding |
| Tối ưu | Ngoại cảnh low LOD, không render toàn campus qua cửa |
| Reuse | Bộ bàn/ghế dùng L11/L12; signage palette tiếp nhận |
| LD bàn giao | Tutorial route dưới 5 phút; người mới luôn thấy hướng đi kế, skip tutorial không softlock |

### L02 — Khu phòng giam (Slice/MVP)

| Trường | Đặc tả |
|---|---|
| Gameplay | Không gian cá nhân, ngủ, lưu, inventory và quan hệ bạn cùng phòng |
| Cấu trúc | 8 phòng quanh hành lang, phòng người chơi có góc đọc; hình thức hư cấu |
| Tỷ lệ | Cụm 32×18 m; phòng mẫu 4×5 m, trần 3 m |
| Đối tượng | Giường, đệm, chăn, tủ cá nhân, bàn nhỏ, đèn, ảnh được cấp phép |
| Vật liệu | Bê tông sơn, vải roughness cao, thép painted; wear vừa phải |
| Ánh sáng | Baked ambient, cửa sổ light patch, practical lamp giới hạn |
| Âm thanh | Vải/giường, bước chân xa, room tone; giảm nhạc lúc ngủ |
| NPC | Bạn cùng phòng, 4–8 cư dân theo lịch, người hướng dẫn đi ngang |
| Tương tác | Ngủ, ngồi, xem lịch, lấy đồ tủ, trò chuyện |
| Collision | Proxy giường/tủ, không colliding từng thanh song; door occupancy |
| Navmesh | Mỗi bed/chair có slot/exit, cửa link bật theo state; tránh spawn ở khe hẹp |
| Sự kiện | Lời mời học, nhắc giờ ăn, thư cá nhân được authored |
| Tối ưu | Room culling; active 2–3 phòng lân cận, share material/bed mesh |
| Reuse | 4 biến thể props để có cá tính, cùng skeleton furniture modules |
| LD bàn giao | Camera test cạnh giường; sleep/wake không clip trần; safe anchor không bị tủ chặn |

### L03 — Hành lang (Slice/MVP)

| Trường | Đặc tả |
|---|---|
| Gameplay | Định hướng, encounter ngắn, kết nối streaming |
| Cấu trúc | Trục rõ, ngã ba dễ phân biệt bằng màu/biển, không maze |
| Tỷ lệ | 40×4 m mỗi đoạn, trần 3,5 m, turning pocket 6×6 m |
| Đối tượng | Ghế nghỉ, bảng lịch, biển, cửa modules, cột và đèn |
| Vật liệu | Sơn hai tông, sàn mờ, handrail kim loại, không phản chiếu gương |
| Ánh sáng | Baked fixtures, light pool dẫn hướng, không tất cả shadow-casting |
| Âm thanh | Footsteps vật liệu, occlusion qua door portals |
| NPC | Người đi giữa hoạt động, nhóm 2–4, cán bộ hỗ trợ |
| Tương tác | Đọc biển/lịch, chào, hỏi đường |
| Collision | Continuous wall proxy, bevel collision ở góc, no tiny protrusion |
| Navmesh | Queue/yield pockets, cell portal links; crowd benchmark choke point |
| Sự kiện | Hẹn đổi địa điểm, khu tạm đóng vì bảo trì hư cấu |
| Tối ưu | Portal culling và prefetch khu bên kia; merge theo segment |
| Reuse | Wall/floor/door kit dùng toàn cơ sở |
| LD bàn giao | Không nhìn thấy unloaded void; 8 NPC hai chiều không deadlock >10 s |

### L04 — Sân sinh hoạt (Slice/MVP)

| Trường | Đặc tả |
|---|---|
| Gameplay | Tập luyện, kết bạn, quan sát day/night |
| Cấu trúc | Vòng đi bộ, sân hoạt động, ghế nghỉ, cây cảnh |
| Tỷ lệ | 60×40 m, tuyến vòng ~150 m; background wall chỉ cảnh quan |
| Đối tượng | Ghế, cây, rổ bóng cảnh quan, xà tập, vòi nước, bảng lịch |
| Vật liệu | Asphalt, concrete, painted metal, foliage alpha hạn chế |
| Ánh sáng | Sun directional + shadow theo tier, sky IBL/probes |
| Âm thanh | Gió, chim, nhóm nói chuyện, giày; voice priority gần |
| NPC | Nhóm thể thao, người đi dạo, người đọc sách, cán bộ hỗ trợ |
| Tương tác | Đi vòng, exercise slot, ngồi, thoại nhóm |
| Collision | Sân phẳng, cây proxy, equipment simple shapes; không physics bóng thi đấu MVP |
| Navmesh | Rộng, group anchors và route tránh exercise slots |
| Sự kiện | Buổi tập nhóm; mưa nhẹ chuyển hoạt động vào L09 (Full) |
| Tối ưu | Foliage LOD, baked distant skyline, hạn chế shadow distance |
| Reuse | Bench/trash/sign kit; 3 cây instanced |
| LD bàn giao | Worst-case 12 NPC slice, sun shadow route, đo alpha overdraw và heat soak |

### L05 — Nhà ăn (Slice/MVP)

| Trường | Đặc tả |
|---|---|
| Gameplay | Ăn, lựa chọn bạn ngồi, quest xã hội |
| Cấu trúc | Lối vào → quầy phục vụ → bàn nhóm → chỗ trả khay |
| Tỷ lệ | 30×22 m, khoảng bàn ≥1,5 m, 16–24 chỗ có slot |
| Đối tượng | Bàn liền ghế, khay, đồ ăn, menu, quầy; không trăm rigid bodies |
| Vật liệu | Inox rough, nhựa mờ, gạch; đồ ăn mesh đơn giản |
| Ánh sáng | Window/baked overhead, exposure không cháy inox |
| Âm thanh | Khay/bát, crowd bed phân lớp, lời thoại ưu tiên |
| NPC | Nhân viên bếp, người ăn, NPC quest |
| Tương tác | Reserve queue, nhận suất, ngồi/ăn, trả khay |
| Collision | Bàn/static; tray cosmetic khi cầm; blocked exit cancel sang điểm an toàn |
| Navmesh | Queue lanes, seat approach/exit, no path qua bàn |
| Sự kiện | Hết món ưu tiên → món thay thế tương đương, không bỏ đói |
| Tối ưu | Tray instances, props gắn animation thay dynamic physics, room cull |
| Reuse | Table/food/tray kit dùng L06; seat animation dùng L07/L12 |
| LD bàn giao | 24 NPC giờ ăn; fairness queue; người chơi vào muộn vẫn có lựa chọn ăn |

### L06 — Nhà bếp (Full)

| Trường | Đặc tả |
|---|---|
| Gameplay | Việc nhóm và kỹ năng tổ chức, minigame phân loại an toàn |
| Cấu trúc | Kho nguyên liệu hư cấu → bàn chuẩn bị → rửa/thu dọn |
| Tỷ lệ | 22×16 m, work aisle 2 m |
| Đối tượng | Bàn prep, kệ, thùng rau, bồn rửa, props thực phẩm; máy móc chỉ cảnh quan |
| Vật liệu | Ceramic, inox rough, rubber, tile decal |
| Ánh sáng | Baked task lighting, steam cosmetic low density |
| Âm thanh | Nước/rửa, quạt hút, đồ dùng; duck khi thoại |
| NPC | Người phụ trách, nhóm lao động 3–4 |
| Tương tác | Sắp đồ, rửa, phối hợp ca; không mô phỏng vật dụng nguy hiểm |
| Collision | Worktop static, props pickup whitelist, wet floor cosmetic |
| Navmesh | Reserved work bays và route giao đồ, queue không cắt cửa |
| Sự kiện | Thiếu một thùng đồ → đổi thứ tự công việc |
| Tối ưu | Shared kitchen atlas, particle cap, fake steam |
| Reuse | Food/tray L05, storage L10 |
| LD bàn giao | 4 người/NPC làm việc không đụng slot, mọi minigame có cancel |

### L07 — Thư viện (MVP)

| Trường | Đặc tả |
|---|---|
| Gameplay | Học, nhiệm vụ sách, phát triển trust/kỹ năng |
| Cấu trúc | Quầy → 3 dãy kệ → góc đọc → bảng lớp |
| Tỷ lệ | 24×18 m, aisle 1,8 m, 8 chỗ đọc |
| Đối tượng | Kệ, sách atlas, bàn, ghế, đèn đọc, bảng |
| Vật liệu | Gỗ laminate, giấy, vải, warm accent |
| Ánh sáng | Diffuse warm/cool cân bằng, glare thấp cho đọc UI |
| Âm thanh | Giấy, ghế, HVAC nhỏ; không toàn bộ NPC có voice |
| NPC | Người quản sách, người học, mentor |
| Tương tác | Mượn/trả, sắp sách, đọc, hỏi mentor |
| Collision | Kệ proxy, sách pick bằng logical target không từng collider |
| Navmesh | Kệ không nav, interaction target at aisle edge, tránh ghế exit |
| Sự kiện | Nhóm đọc sách, tìm sách theo chủ đề |
| Tối ưu | Book mesh atlas instances, occlusion bằng kệ, ít vật liệu |
| Reuse | Chair/table kit L01, sách biến thể texture |
| LD bàn giao | 10 phút chơi khác nhà ăn; font đọc được; không path xuyên kệ |

### L08 — Phòng y tế (Full)

| Trường | Đặc tả |
|---|---|
| Gameplay | Nghỉ phục hồi, hỗ trợ accessibility, story chăm sóc; không tư vấn y khoa |
| Cấu trúc | Chờ → bàn tiếp nhận → phòng nghỉ |
| Tỷ lệ | 20×16 m, 3 giường, aisle 2 m |
| Đối tượng | Giường, rèm, ghế, tủ cảnh quan, biển hỗ trợ |
| Vật liệu | Sơn sáng, vải sạch, vinyl matte |
| Ánh sáng | Soft baked, không nhấp nháy/strobe |
| Âm thanh | Room tone êm, thoại nhẹ; thiết bị chỉ ambient |
| NPC | Nhân viên y tế hư cấu, người nghỉ |
| Tương tác | Xin nghỉ, nhận hỗ trợ trong game, thoại story |
| Collision | Bed/curtain boundary proxy, không dynamic cloth collision |
| Navmesh | Bed reserve và exit rộng, route hỗ trợ |
| Sự kiện | Cuộc hẹn theo story, phục hồi mood/energy bounded |
| Tối ưu | Curtains opaque khi phù hợp, reuse room light setup |
| Reuse | Beds đổi material L02, chairs L01 |
| LD bàn giao | Không chặn tiến trình sau bỏ lỡ hẹn; recovery route luôn hoạt động |

### L09 — Phòng tập (Full)

| Trường | Đặc tả |
|---|---|
| Gameplay | Tập trong nhà, lựa chọn thay thế khi thời tiết xấu |
| Cấu trúc | Warm-up → thảm → equipment bays → nghỉ |
| Tỷ lệ | 28×20 m, mỗi animation bay 3×3 m |
| Đối tượng | Thảm, ghế tập, thiết bị hư cấu, chai nước |
| Vật liệu | Rubber, painted steel, concrete; mirror giả/probe |
| Ánh sáng | Baked overhead, shadow nhân vật gần tùy tier |
| Âm thanh | Dụng cụ, giày, nhịp thở; volume chỉnh riêng |
| NPC | Huấn luyện nhóm, 4–8 người tập |
| Tương tác | Stretch/exercise theo nhịp tùy chọn, nghỉ, hỏi hướng dẫn |
| Collision | Animated equipment không impulse người khác; slot exclusion |
| Navmesh | Navigation quanh bay, không băng qua animation bounds |
| Sự kiện | Ca nhóm, mentor khuyến khích |
| Tối ưu | Không planar mirror toàn phòng, update animation LOD |
| Reuse | Exercise clips L04, benches |
| LD bàn giao | Không yêu cầu bấm nhanh bắt buộc; toggle auto-complete accessible |

### L10 — Khu lao động (Full)

| Trường | Đặc tả |
|---|---|
| Gameplay | Kỹ năng tập trung, hợp tác, nhiệm vụ đóng gói/kiểm kê |
| Cấu trúc | Bảng ca → kho nhẹ → bàn làm → giao hàng |
| Tỷ lệ | 36×24 m, 6 work bays, aisle 2–3 m |
| Đối tượng | Bàn, thùng, vải/giấy, nhãn, kệ; không quy trình sản xuất nguy hiểm |
| Vật liệu | Gỗ, cardboard, fabric, painted metal |
| Ánh sáng | Baked industrial soft, task light giới hạn |
| Âm thanh | Giấy/thùng, ambience máy xa không tương tác |
| NPC | Người phụ trách, nhóm 4–6 |
| Tương tác | Phân loại, kiểm kê, chuyển thùng lightweight, phối hợp |
| Collision | Thùng game-critical kinematic/convex, stacked decoration static |
| Navmesh | Cart lanes cảnh quan, occupancy theo work bay |
| Sự kiện | Đổi yêu cầu đơn, hướng dẫn người mới |
| Tối ưu | Instanced boxes, chỉ ≤8 dynamic props gần |
| Reuse | Storage shelves L06/L11, interaction pick clips |
| LD bàn giao | Reward theo chất lượng bounded, không farming vô hạn qua reset props |

### L11 — Khu quản lý (Full)

| Trường | Đặc tả |
|---|---|
| Gameplay | Hẹn tư vấn mục tiêu, xem tiến trình, giải quyết story |
| Cấu trúc | Chờ và hai phòng gặp, khu nền không chơi |
| Tỷ lệ | 24×16 m, phòng thoại 5×6 m |
| Đối tượng | Bàn, ghế, hồ sơ giả, bảng mục tiêu, cây |
| Vật liệu | Laminate, giấy, kính mờ, sơn trung tính |
| Ánh sáng | Baked office + key thoại |
| Âm thanh | HVAC, bút/giấy; voice intelligibility |
| NPC | Cố vấn, nhân viên hành chính |
| Tương tác | Đặt/đổi hẹn, review mục tiêu, chọn story branch |
| Collision | Static desk, route không vào background set |
| Navmesh | Waiting slots, appointment transitions |
| Sự kiện | Hẹn bị đổi giờ → thông báo và lựa chọn mới |
| Tối ưu | Hai phòng active, background façade |
| Reuse | Office kit L01/L12 |
| LD bàn giao | Missed appointment không phá quest chain; affordance vùng có thể vào rõ |

### L12 — Phòng thăm gặp (Full)

| Trường | Đặc tả |
|---|---|
| Gameplay | Story liên hệ người thân, mục tiêu dài hạn, mood tích cực |
| Cấu trúc | Khu chờ → bàn gặp riêng tư vừa đủ → lối ra |
| Tỷ lệ | 28×18 m, 6 bàn tách 2 m |
| Đối tượng | Bàn/ghế, clock, biển lịch; background visitors low detail |
| Vật liệu | Sơn ấm, gỗ laminate, vải |
| Ánh sáng | Soft daylight, không cinematic effect gây khó đọc |
| Âm thanh | Crowd rất thấp, thoại ưu tiên, subtitles speaker |
| NPC | Người thân hư cấu, người hướng dẫn, visitors |
| Tương tác | Đối thoại nhánh, chọn chủ đề, xem thư |
| Collision | Static tables, seated slot locks, exit cancel |
| Navmesh | Tách arrival/wait/exit, chỉ actor story full fidelity |
| Sự kiện | Thư thay buổi gặp khi story yêu cầu, luôn có recap |
| Tối ưu | Facial update chỉ cặp thoại, background animation thấp |
| Reuse | Seated dialogue rig/office furniture |
| LD bàn giao | Camera không xuyên bàn; thoại có pause/skip và recap |

### L13 — Vệ sinh và giặt (MVP)

| Trường | Đặc tả |
|---|---|
| Gameplay | Hygiene nhẹ, reset nhịp ngày, nhiệm vụ đồ vải |
| Cấu trúc | Bồn rửa → buồng dùng riêng chuyển cảnh kín đáo → khu giặt |
| Tỷ lệ | 20×14 m, buồng trigger 2×2 m, aisle 2 m |
| Đối tượng | Sink, towel, locker, laundry bin; không nhân vật khỏa thân |
| Vật liệu | Matte tile, ceramic, fabric; tránh mirror realtime |
| Ánh sáng | Baked diffuse, không flashing |
| Âm thanh | Nước, vải, quạt; fade khi dùng hành động |
| NPC | Người sinh hoạt theo stagger schedule, nhóm giặt |
| Tương tác | Rửa, hygiene transition, nhận/trả đồ vải |
| Collision | Buồng logical occupancy, sensor only bên trong action, no clipping |
| Navmesh | Queue fair, reserve 1 người/buồng, cleanup khi disconnect |
| Sự kiện | Bận chỗ → hẹn slot hoặc lựa chọn rửa thay thế |
| Tối ưu | Không reflection camera, water shader đơn giản |
| Reuse | Sink L06, fabric L02 |
| LD bàn giao | Privacy composition và cancel flow; không bắt chờ queue quá 30 s thật |

### L14 — Phòng sinh hoạt/lớp học (Full)

| Trường | Đặc tả |
|---|---|
| Gameplay | Achievement cộng đồng, lớp kỹ năng, kết thúc chương |
| Cấu trúc | Bảng thông báo → bàn nhóm → góc trình bày |
| Tỷ lệ | 32×20 m, 20 chỗ nhưng tối đa 12 full-detail gần |
| Đối tượng | Bảng, sách, bàn ghép, ghế, artwork được cấp phép |
| Vật liệu | Warm paint, fabric panels, wood |
| Ánh sáng | Baked soft, optional một key động |
| Âm thanh | Room tone, giấy, nhóm; không stream 20 voice đồng thời |
| NPC | Giáo viên/mentor, nhóm học, người tổ chức |
| Tương tác | Dự lớp, góp ý, hoạt động nhóm, xem achievement |
| Collision | Layout tĩnh theo scene variant, không kéo bàn realtime MVP |
| Navmesh | Seat claims, group entry stagger, exit accessible |
| Sự kiện | Workshop, trao giấy ghi nhận hư cấu |
| Tối ưu | Crowd animation LOD, room variant preload |
| Reuse | Classroom/library kit L07 và bàn L05 |
| LD bàn giao | Nhóm vào/ra không thắt nút, dialogue focus không bị crowd audio lấn |

## Asset pipeline và QC

Cơ sở đã nghiên cứu: glTF S27, tooling S29–S33; Blender exporter S28 còn chưa xác minh. Quy trình [D]: concept/reference hợp pháp → blockout → gameplay scale/camera review → high/low mesh → UV/bake → PBR texture → rig/animation → export candidate → validate → compress variant → target-browser test → content manifest → CDN staged → art/QA sign-off. Không tối ưu nén trước khi mesh và scale ổn định.

| Quy chuẩn | Yêu cầu bàn giao |
|---|---|
| Naming | `env_cell_bed_a_lod0`, `col_cell_bed_a`, `npc_mentor_body_a`, `mat_concrete_painted`, `tex_concrete_orm_1k`; ASCII lowercase; stable gameplay ID tách filename |
| Folder | `assets-src/{environment,characters,animations,audio,ui}/zone_or_family`; `assets-build/<contentVersion>/<hash>/...`; license ledger theo source |
| Geometry budget [A] | Hero 35k triangles LOD0 / 18k LOD1 / 6k LOD2; NPC 20k/10k/3k; prop nhỏ 0,3–2k; furniture 1–5k. Budget là trần khởi điểm, cảnh tổng vẫn phải đạt PERF |
| Materials | Hero ≤4 material slots, NPC ≤3, prop thường 1; trim/atlas cho kit. Không tạo unique material/texture chỉ đổi một màu |
| Textures | 512–1k props, 2k hero/trim quan trọng, 4k chỉ ngoại lệ có đo. UV0 texture, UV1 lightmap không overlap cho static. Texel density mục tiêu 256 px/m cho môi trường gần |
| PBR | BaseColor/emissive sRGB, ORM packed tuyến tính, tangent normal linear; metalness vật liệu hợp lý; bake cage/ray distance lưu trong source |
| LOD | Silhouette/contact giữ; screen thresholds + hysteresis test, không chỉ giảm poly tự động rồi xuất. Collision riêng không thay theo render LOD |
| Rig | Shared named skeleton, max 4 influences/vertex khởi điểm, scale applied, rest pose/version; foot/hand sockets rõ; retarget test mọi body variant |
| Animation | `loc_idle`, `loc_walk_fwd`, `loc_run_fwd`, `loc_crouch`, `act_sit_enter/loop/exit`, `act_sleep_enter/loop/exit`, `act_pick`, `act_drop`, `dlg_talk_a`; marker schema có thời gian và semantic |
| Export | Chốt GLB, meters, triangulated, transforms applied; selective export; animation sampling và morph settings phải thử exporter thực; không tự khẳng định checkbox chưa đọc |
| Mesh compression | Meshopt vs Draco A/B total cold load, decode peak memory và artifact; loader/decoder versions pinned; fallback uncompressed debug |
| Texture compression | KTX2 ETC1S cho color phù hợp, UASTC ứng viên normal/detail; kiểm banding/normal errors; transcode target theo device, không gọi KTX2 là universal GPU format |
| Animation compression | Key reduction tolerance vị trí 1 mm/rotation 0,5° khởi điểm; foot drift/contact review trước chấp nhận; data reduction không thay gameplay marker |
| Audio | Masters WAV, runtime codec chọn sau browser test; loop seam, LUFS/peak target do audio lead chốt; metadata license, caption, distance/priority |
| Version | Asset source commit + exporter/tool/decoder versions + content hash + dependencies; không overwrite immutable URL |

Một texture RGBA8 2048² là khoảng 16 MiB trước mipmaps, khoảng 21,3 MiB với mip chain đầy đủ; download JPEG nhỏ không có nghĩa GPU memory nhỏ. Theo dõi resident GPU estimate và driver thực tế nếu có, không cộng compressed transfer bytes thay memory. Mỗi chunk có transfer, decode peak và resident estimates riêng.

QC bắt buộc: glTF Validator không errors; warnings được review từng loại; missing textures/UV/tangents, skeleton mismatch, negative scale, duplicate IDs, license thiếu hoặc budget không được duyệt → chặn phát hành. Kiểm thêm bằng custom asset report: bounds, triangles, material count, texture size/colorspace, animation duration, collider layers, nav anchors, dependencies và tổng byte. Kiểm bằng mắt trên 3 tier: lighting reference, seam, foot sliding, clipping áo/tóc, transparency, LOD popping. “Validator pass” không thay art approval.

Progressive loading: boot UI + character minimal + L02 playable, tải L03/L04 sau, optional detail texture sau ổn định. Trước chuyển khu phải có collision/nav và minimum visual set; nếu timeout giữ ở vùng an toàn với Retry/Back. Bundles theo zone và common kit, không một GLB toàn cơ sở. CDN immutable cache một năm cho hashed blobs, manifest revalidate; retain N và N−1 trong rollout, không service worker cache nhầm auth/save API. Content rollback chỉ khi save schema tương thích; migration content ID map phải được kiểm tra bằng fixture cũ.

## Không gian bổ sung Full Life1.1

Quy chuẩn level chung đầu file áp dụng cả L15–L18. Các tỷ lệ sau là blockout game hư cấu; tasks T10-10 và tests QA17–24 ở phần12. Private room tối thiểu không đồng nghĩa camera được xem thông tin của NPC khác. Accommodations cần route/action equivalent, không chỉ đặt biển.

### L15 — Quầy dịch vụ, cấp phát và cửa hàng nội bộ

| Trường | Đặc tả |
|---|---|
| Gameplay |F34/F38/F39/F49: biên nhận, cấp thiết yếu, order/pickup, không cửa hàng tiền thật |
| Cấu trúc |Sảnh chờ → quầy nhận yêu cầu → pickup/return bays; storage nền không cho free roaming |
| Tỷ lệ |18×14 m, quầy dài4 m, aisle2 m,4 waiting slots |
| Đối tượng |Kệ mẫu catalog, desk, receipt folder, hộp cấp phát, lockers, signage |
| Vật liệu |Painted wood/metal, cardboard atlas, labels localization không bake chữ cố định |
| Ánh sáng |Baked neutral, quầy đọc rõ, một key optional không thêm shadow cho mọi shelf |
| Âm thanh |Giấy/hộp, quiet queue, subtitle thông báo đến lượt |
| NPC |Clerk/supply handler, tối đa4 người chờ near detail |
| Tương tác |Xem catalog, confirm order, collect/return, request essentials, dispute receipt |
| Collision |Quầy static, pickup prop logical target; parcels không hàng chục rigid bodies |
| Navmesh |Queue token/approach/exit riêng; alternative service UI khi route busy hoặc mobility cần |
| Sự kiện |Stock-out/refund/delivery delay, supply fallback không khóa thiết yếu |
| Tối ưu |Thumbnails/atlas instances, shelves background LOD, off-screen service truth |
| Reuse |L01 office/L06 storage/L10 boxes; không unique material per product |
| LD bàn giao |Route usable bằng keyboard/UI, full bag không drop đồ ngoài map, no-money path tới essentials rõ |

### L16 — Góc liên lạc và phòng tư vấn riêng

| Trường | Đặc tả |
|---|---|
| Gameplay |F40/F41/F43/F44: thư/call, tư vấn pháp lý hư cấu và phản hồi riêng tư |
| Cấu trúc |2 contact stations + bàn thư + phòng hẹn riêng, tách public waiting/meeting slot |
| Tỷ lệ |20×12 m; phòng riêng5×5 m, approach/turn pocket tối thiểu3×3 m |
| Đối tượng |Phone-style prop không nhập số thật, screen cảnh quan, bàn/ghế, letter tray, privacy signs |
| Vật liệu |Acoustic fabric, matte metal, glass mờ không realtime transparency nhiều lớp |
| Ánh sáng |Baked warm-neutral, dialogue exposure đúng, no intrusive spotlight |
| Âm thanh |Acoustic zones/portal attenuation; nội dung private không phát spatially tới player khác |
| NPC |Contact clerk, advisor theo booking; người thân virtual chỉ authored dialogue |
| Tương tác |Gửi chủ đề thư, đọc reply, book/rebook, call caption-only, private appointment |
| Collision |Station static, seat reservation/exit, background staff set không route security thật |
| Navmesh |Private meeting1 participant set, waiting anchors không đứng nhìn xuyên actor; public routes bypass |
| Sự kiện |No-show/reschedule, private letter routing, interpreter support |
| Tối ưu |Không actual video streaming/WebRTC camera, portrait animation bounded, shared scene seats |
| Reuse |L11/L12 office/seated clips, U15 dialogue assets |
| LD bàn giao |Không camera clipping qua private room, no audio/text leak in MP, waiting có skip và confirmation reason |

### L17 — Phòng yên tĩnh và sinh hoạt tinh thần/văn hóa

| Trường | Đặc tả |
|---|---|
| Gameplay |F46/F51/F58: quiet support, peer conversation, reflection/cultural sessions tùy chọn |
| Cấu trúc |Quiet room + khu ngồi linh hoạt; variant hoạt động theo booking, không trộn nghi lễ tùy tiện |
| Tỷ lệ |18×16 m,8 slots, clear path2 m và quiet nook4×4 m |
| Đối tượng |Ghế/thảm/kệ sách, bảng lịch, cây, art hợp pháp; biểu tượng cụ thể chỉ khi được content review |
| Vật liệu |Fabric/wood/sơn ấm, low contrast floor pattern không gây rối thị giác |
| Ánh sáng |Diffuse soft, no flashing, player có comfort options |
| Âm thanh |Ambience nhẹ/quiet, captions, không gán âm tôn giáo chưa license/review |
| NPC |Facilitator, peer listener, interpreter/mentor, nhóm≤4 near full detail |
| Tương tác |Opt-in/out, quiet time, book support, authored group talk, reflection nonreligious equivalent |
| Collision |Simple furniture, no physics mats; personal-space slots |
| Navmesh |Wide approach/exit và equivalent station cho mobility, group không cắt quiet nook |
| Sự kiện |Cultural gathering, activity rescheduled, private check-in, no forced emotional disclosure |
| Tối ưu |Shared room shell, content variant swap, no complex particles or heavy transparent curtains |
| Reuse |L07/L14 learning kit và seated talk clips |
| LD bàn giao |Người không tham gia vẫn route được, no belief/stat modifiers, support private voice projection |

### L18 — Khu hướng nghiệp, chuẩn bị chuyển nơi và rời cơ sở

| Trường | Đặc tả |
|---|---|
| Gameplay |F56/F57/F59: packing review, advisor plan, property/account summary, departure story |
| Cấu trúc |Planning desk → return pack counter → chờ transition; ngoại cảnh departure abstract |
| Tỷ lệ |24×14 m,2 planning desks,4 waiting slots, packing bay4×4 m |
| Đối tượng |Desk, fictional forms, bags, notice board, chair, photo-style epilogue art |
| Vật liệu |Office laminate/fabric/cardboard; recurring warm accent cho kết thúc |
| Ánh sáng |Baked neutral, cinematic departure optional có reduced-motion still |
| Âm thanh |Room tone/giấy, optional gentle music, dialogue subtitles all steps |
| NPC |Reintegration advisor, property clerk, mentor; family contact qua story nếu phù hợp |
| Tương tác |Plan goals, ask help, review receipts/settlement, confirm transition, recap ending |
| Collision |Static desks/bags; transition trigger chỉ mở khi authority staged, không chạy xuyên unloaded exit |
| Navmesh |Route tới service slots và fallback; destination spawn checked ready trước world swap |
| Sự kiện |Destination changed, missing pickup re-route, review milestone, support referral fictional |
| Tối ưu |Reuse L01/L11 room shell, transition không vehicle/campus ngoại cảnh mới, release old scenes |
| Reuse |Receipt UI L15, office kit, bag prop, U05 loading art framework |
| LD bàn giao |Không gate ending bằng max XP/tiền, no real address/legal formula, crash-recovery one location/settlement |

### Gắn lại gameplay vào L01–L14

L01 dùng F33/F34/F36, L02 F35/F37/F49/F50 và roommate boundaries F54; L03 thông tin dịch vụ/maintenance F55, không lộ routing nội bộ. L04/L09 có supported exercise và routine exemptions; L05/L06 có diet/free basic food, shift outcomes F48. L07/L14 dùng F47 curriculum thật trong content schema thay vì chỉ action cộngXP; L08 dùng F45/F46 care flow + private plans; L10 work terms/attendance/credit; L11 case review/advisor, L12 visit booking/no-show/family alternatives; L13 supply/laundry/privacy/grooming F49/F50. Mọi zone phải map service_id, supported variant, booking slots và fallback vào manifest. Không cộng NPC/asset count hai lần khi cùng một role dùng lại nhiều phòng.
