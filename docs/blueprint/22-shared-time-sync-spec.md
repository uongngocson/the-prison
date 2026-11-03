# 22 — Đồng bộ thời gian và lịch sinh hoạt cho chế độ trực tuyến

CR-TIME-01 · 03/11/2026 · Quyết định D1–D5 đã chốt (mục 8); đang triển khai. Kế thừa [02 — kiến trúc](02-architecture.md) (ADR05 single-player authority), [16 — custody contracts](16-custody-contracts.md) (clock, save v3), [18 — lao động](18-labour-rehabilitation-spec.md) và chế độ trực tuyến hiện có (`src/online/*`, `src/bots/*`).

## 1. Mục tiêu và phạm vi

Trong một phòng trực tuyến, mọi người chơi phải thấy **cùng một giờ trong trại**: cùng giờ điểm danh, giờ ăn, giờ ra sân, giờ khóa buồng, cùng ngày đêm và cùng thời tiết. Bạn tù AI cũng đi theo lịch chung đó.

| Trong phạm vi | Ngoài phạm vi |
|---|---|
| Đồng hồ chung cho chế độ trực tuyến | Thay đổi gameplay ngoại tuyến (giữ 100% như hiện tại) |
| Lịch sinh hoạt, cửa khu, đèn ngày/đêm, thời tiết, sự kiện chung theo phòng | Đồng bộ vị trí/hành vi NPC giữa các máy (NPC vẫn giả lập cục bộ) |
| Quy tắc tua thời gian khi đang trực tuyến (hành động, ngủ, tạm dừng) | Máy chủ có thẩm quyền cho toàn bộ mô phỏng |
| Bạn tù AI theo lịch chung | Đồng bộ tiến trình cá nhân (nhiệm vụ, bản án, lao động) giữa người chơi |
| Trang admin: xem và điều chỉnh đồng hồ chung | Chống gian lận đồng hồ ở mức máy chủ |

Tất cả giờ giấc, lịch và tốc độ là **thiết kế hư cấu** của game.

## 2. Audit hiện trạng (đọc code ngày 03/11/2026)

### 2.1 Đồng hồ

| Điểm | Hiện tại | File |
|---|---|---|
| Biến thời gian | `GameState.minute` — phút tuyệt đối kể từ 00:00 ngày 1, lưu trong save của từng người | [types.ts](../../src/domain/types.ts), [util.ts:47-49](../../src/domain/util.ts#L47-L49) (`dayOf`, `minuteOfDay`, `dayOfWeek`) |
| Thời điểm bắt đầu | Mọi nhân vật mới bắt đầu **Ngày 1, 09:00** | [newgame.ts:28](../../src/domain/newgame.ts#L28) |
| Tốc độ | `1440 / (dayLengthRealMin × 60)` phút game mỗi giây thực; `dayLengthRealMin` = **48 hoặc 72** theo cài đặt trợ năng của từng người | [session.ts:137](../../src/simulation/session.ts#L137), [controller.ts:138](../../src/app/controller.ts#L138), [settings.ts](../../src/ui/settings.ts) |
| Bước mô phỏng | 30 Hz cố định; tối đa 4 bước/khung; khung chậm thì mô phỏng chậm lại (`catchUpDebt`), không bỏ bước | [session.ts:110-122](../../src/simulation/session.ts#L110-L122) |
| Tạm dừng | `session.paused` khi mở panel/hội thoại/menu, khi không ở màn `game`; tab ẩn → lưu và dừng | [controller.ts:79-91, 291](../../src/app/controller.ts#L291) |
| Tua khi hành động | `ACTION_ACCEL = 14` (đi vệ sinh ×2) trong lúc thực hiện hành động | [session.ts:21, 139](../../src/simulation/session.ts#L139) |
| Bỏ qua hành động | `skipAction` → `fastForward(phần còn lại)` | [session.ts:545-552](../../src/simulation/session.ts#L545) |
| Ngủ | Chọn giờ thức, `fastForward` tối đa 14 giờ game, xử lý từng phút | [session.ts:597-631](../../src/simulation/session.ts#L597) |
| Khôi phục (F5) | Lấy lại `minute` từ snapshot phiên; thời gian thực khi đóng game **không** được tính | [resume.ts](../../src/persistence/resume.ts) |

### 2.2 Những gì phụ thuộc thời gian

Mỗi phút game, `minuteTick` gọi lần lượt: hao nhu cầu, mốc lịch, điểm danh, cửa khu, ca trực nhân viên, thời tiết, đạo diễn sự kiện, `lifeTick`, `custodyTick`, `labourTick`, nhiệm vụ, thành tích ([session.ts:162-202](../../src/simulation/session.ts#L162-L202)).

| Nhóm | Dựa vào | Ghi chú đồng bộ |
|---|---|---|
| Lịch chung `DAILY`, `MEALS`, `ROLL_CALLS` | `minuteOfDay` | Cùng giờ trong ngày → cùng lịch ([schedule.ts](../../src/content/schedule.ts)) |
| Lịch custody A/B (`CUSTODY_SCHEDULE`) | `minuteOfDay` + phân nhóm | Hai người khác nhóm có lịch khác nhau **hợp lệ** ([custody.ts:213-226](../../src/domain/custody.ts#L213-L226)) |
| Cửa khu theo giờ/mưa/sự kiện | `minuteOfDay`, `weather`, `activeEvent` | [session.ts:221-254](../../src/simulation/session.ts#L221-L254) |
| Ca trực nhân viên, NPC | `npcBlockAt(minuteOfDay)`; một số chọn chỗ theo `hash(id, dayOf)` | [schedule.ts:88](../../src/content/schedule.ts#L88), [npcAi.ts:32-77](../../src/simulation/npcAi.ts#L32-L77) |
| Thời tiết | `rng` riêng của save, đổi mỗi 4–8 giờ | [session.ts:256-266](../../src/simulation/session.ts#L256-L266) |
| Sự kiện (nhóm đọc, tập nhóm, đóng khu) | `dayOf`, `dayOfWeek`, `rng` riêng | [session.ts:269-297](../../src/simulation/session.ts#L269-L297) |
| Nhu cầu | Mỗi phút game đã trôi | [core.ts:165](../../src/domain/core.ts#L165) |
| Đời sống: lịch hẹn, đơn hàng (Thứ 2/4/6), thư, yêu cầu, vi phạm, chăm sóc | `minute` tuyệt đối + `dayOfWeek` | [life.ts](../../src/domain/life.ts) |
| Custody: ngày lịch, thời hạn bản án, lệnh có `endMinute`, giấy phép di chuyển | `dayOf(minute)` → ngày lịch hư cấu | [custody.ts:81-104, 457-500](../../src/domain/custody.ts#L457) |
| Lao động: ca, tưới/cỏ theo ngày, tăng trưởng cây, cá | `minute` tuyệt đối, `dayOf` | [labour.ts](../../src/domain/labour.ts) |
| Nhiệm vụ: Bình đến ngày 3, chương ngày 7, giờ sinh hoạt văn hóa | `dayOf`, `minuteOfDay` | [quests.ts:16-35](../../src/domain/quests.ts#L16-L35) |
| Đèn ngày/đêm | `minuteOfDay` | [gameView.ts:336-339](../../src/presentation/gameView.ts#L336) |
| HUD, panel lịch, công việc | `fmtClock`, `fmtDayClock` | `src/ui/screens/*` |

### 2.3 Chế độ trực tuyến hiện tại

- Chỉ gửi **vị trí, hướng, khu, tư thế** (`PosPacket`) và trò chuyện; không có trường thời gian ([protocol.ts:2, 48](../../src/online/protocol.ts#L48)).
- Bạn tù AI đi dạo ngẫu nhiên giữa các khu yêu thích, không theo lịch ([host.ts:210](../../src/bots/host.ts#L210)).
- Không có nguồn thời gian máy chủ; đồng hồ máy người chơi có thể lệch.

### 2.4 Kết luận audit

1. Mỗi người chơi có một dòng thời gian riêng: khác ngày, khác giờ, khác tốc độ, và lệch thêm mỗi lần tạm dừng, tua hay ngủ.
2. Thời tiết và sự kiện được tung ngẫu nhiên riêng theo từng save.
3. `minute` là trục chung của mọi hệ thống, và **luôn chỉ tăng**. Mọi thiết kế đồng bộ phải giữ bất biến này. Cho thời gian chạy lùi sẽ làm hỏng lịch hẹn, lệnh, ca lao động và nhật ký.

## 3. Vấn đề cần giải

| # | Tình huống hiện tại | Kỳ vọng |
|---|---|---|
| P1 | A thấy 07:00 (bữa sáng), B thấy 21:30 (điểm danh tối) dù đứng cạnh nhau | Cùng giờ trong ngày |
| P2 | A đặt 72 phút/ngày, B đặt 48 → lệch dần | Cùng tốc độ trong phòng |
| P3 | A mở túi đồ 5 phút → đồng hồ của A đứng | Đồng hồ phòng vẫn chạy |
| P4 | A tắm (tua ×14) hoặc ngủ 8 giờ → A nhảy vượt | Không ai tua được đồng hồ chung |
| P5 | A thấy mưa, sân đóng; B thấy nắng, sân mở | Cùng thời tiết, cùng trạng thái cửa |
| P6 | Bạn tù đi dạo sân lúc 22:00 | Bạn tù về buồng, có mặt khi điểm danh, đi ăn đúng giờ |
| P7 | “Chiều nay ra sân không?” vô nghĩa | Hội thoại theo cùng mốc giờ |

## 4. Nguyên tắc thiết kế

- **N1 — Ngoại tuyến giữ nguyên.** Mọi thay đổi chỉ bật khi `online.active`.
- **N2 — Thời gian chỉ tiến.** `GameState.minute` không bao giờ giảm.
- **N3 — Không cần máy chủ phát đồng hồ liên tục.** Mọi máy tự tính giờ chung từ một công thức xác định và một mốc thời gian đã hiệu chỉnh lệch.
- **N4 — Giờ trong ngày là chung, “Ngày thứ N” là của riêng mỗi người.** Mỗi tù nhân có số ngày đã ở trại khác nhau, giống ngoài đời. Ví dụ: A đang ở ngày 2, B đang ở ngày 15, nhưng cả hai đều thấy 07:00 và cùng đi ăn sáng.
- **N5 — Thế giới chung lấy hạt giống ngẫu nhiên theo phòng và ngày chung**, không lấy theo save, để mọi máy ra cùng thời tiết và sự kiện.
- **N6 — Tiến trình cá nhân không đồng bộ:** nhiệm vụ, bản án, lao động, nhu cầu vẫn thuộc save của từng người.

## 5. Thiết kế

### F85 — Đồng hồ chung (Shared Clock)

```
sharedMinute(t) = floor((serverNow(t) − EPOCH_MS) / 60000 × 1440 / DAY_LEN_MIN)
sharedDay       = floor(sharedMinute / 1440)      // chỉ số ngày chung (dùng cho seed)
sharedMoD       = sharedMinute mod 1440           // giờ trong ngày chung
```

- `EPOCH_MS`: mốc cố định, chọn sao cho giờ chung có ý nghĩa (ví dụ 00:00 giờ Việt Nam của một ngày cố định).
- `DAY_LEN_MIN`: độ dài một ngày game tính bằng phút thực, **cố định cho mọi phòng**. Đề xuất 48, bằng mặc định hiện tại. Khi đó một ngày game ≈ 48 phút thực, 30 ngày game ≈ 1 ngày thực.
- Cấu hình nằm ở bảng `app_config` (key mới `clock`): `{ epochMs, dayLengthMin, version }`. Đọc công khai; chỉ admin sửa được. Mọi máy đọc cùng một giá trị.
- `serverNow(t) = Date.now() + offset`, trong đó `offset` là độ lệch giữa đồng hồ máy và máy chủ (F86).
- Nếu chưa đo được độ lệch (offline hoặc lỗi mạng), đồng hồ máy được dùng tạm và HUD hiện cảnh báo nhỏ.

### F86 — Hiệu chỉnh lệch đồng hồ máy

- Lấy giờ máy chủ qua một endpoint nhẹ: Vercel Function `GET /api/time` trả `{ now }`, hoặc RPC Supabase `select now()`.
- Đo `offset = serverNow − (t0 + t1) / 2` với `t0`, `t1` là thời điểm gửi và nhận. Lấy trung vị của 3 lần đo, bỏ các lần có RTT > 1,5 s.
- Đo lại mỗi 10 phút và khi tab hiện lại. Ở tốc độ 48 phút/ngày, lệch 1 giây ≈ 0,5 phút game, chấp nhận được.
- Không cần chính xác tuyệt đối: sai số dưới 2 giây (khoảng 1 phút game) không ảnh hưởng gameplay.

### F87 — Nối save cá nhân vào đồng hồ chung khi vào phòng

Khi vào phòng (kể cả F5 vào lại), save được đưa **tiến tới** lần gần nhất có cùng giờ trong ngày với đồng hồ chung:

```
delta = (sharedMoD − minuteOfDay(s.minute) + 1440) mod 1440     // 0 … 1439 phút
s.minute += delta    (qua fastForward — xử lý đủ mốc, nhu cầu, lịch hẹn, ca…)
```

- Luôn tiến, tối đa 24 giờ game (N2). “Ngày N” của người chơi có thể tăng 1.
- Trước khi nối, hiện màn xác nhận: *“Giờ trong trại hiện là 15:40. Thời gian của bạn sẽ chuyển tới 15:40 (Ngày 3 → Ngày 4). Các mốc sẽ diễn ra:…”*, dùng lại `previewSleep` ([session.ts:587](../../src/simulation/session.ts#L587)).
- Phần thời gian bị bỏ qua được xử lý như **nghỉ ngơi nhẹ**: nhu cầu hao theo chế độ nghỉ, không tính vắng điểm danh; năng lượng hao chậm hơn. Lịch hẹn và ca lao động rơi vào khoảng này xử lý **giống khi ngủ**: tính là lỡ nhưng không phạt, đặt lại được. Quyết định D2 ở mục 8.
- Sau khi nối, mỗi khung hình đặt lại `s.minute` theo đồng hồ chung bằng cách cộng phần chênh qua `advanceMinutes`, không dùng `rate × DT` cục bộ nữa (F88).
- Rời phòng thì trở lại đồng hồ riêng, tiếp tục từ giờ hiện tại. Không cần đồng bộ lại.

### F88 — Quy tắc thời gian khi đang trực tuyến

| Hành vi | Ngoại tuyến (giữ nguyên) | Trực tuyến |
|---|---|---|
| Tốc độ | 48 hoặc 72 theo cài đặt | Cố định `DAY_LEN_MIN` (cài đặt 72 bị vô hiệu, có ghi chú trong Cài đặt) |
| Mở panel, túi đồ, hội thoại, tạm dừng | Đồng hồ đứng | **Đồng hồ vẫn chạy**; nhân vật đứng yên, an toàn |
| Tab ẩn, mất kết nối ngắn | Dừng | Khi quay lại: bù phần đã trôi bằng `fastForward` theo chế độ nghỉ nhẹ (tối đa 6 giờ game; vượt quá thì rời phòng và về ngoại tuyến) |
| Hành động (tắm, ăn, đọc…) | Tua ×14 | Không tua đồng hồ. Hành động kéo dài theo thời gian game thực tế, có giới hạn trên để người chơi không phải chờ quá lâu (quyết định D3) |
| Bỏ qua hành động | Có | Ẩn |
| Ngủ chọn giờ thức | `fastForward` tới giờ thức | Không tua. Chọn D4: ngủ theo thời gian chung (hồi năng lượng nhanh hơn, có thể làm việc khác ngoài game), hoặc rời phòng để ngủ ngoại tuyến |
| F5 | Khôi phục `minute` từ snapshot | Khôi phục rồi chạy lại F87 (tiến tới giờ chung) |

Khối lượng xử lý: một lần nối lâu nhất là 1440 lần `minuteTick` (ngủ hiện đã chạy tới 840). Cần chia thành nhiều khung kèm thanh tiến độ, để không đứng hình trên điện thoại.

### F89 — Thế giới chung theo phòng: thời tiết, sự kiện, cửa

- **Thời tiết:** khi trực tuyến, thời tiết là hàm xác định `weatherAt(room, sharedMinute)`: chia ngày chung thành các khung 4 giờ, lấy `hash32(room + ':' + sharedDay + ':' + slot)` → trời quang / nhiều mây / mưa với tỉ lệ 60/25/15 như hiện tại. Không dùng `rng` của save. Rời phòng thì save giữ thời tiết cuối cùng và tiếp tục cơ chế cũ.
- **Sự kiện của đạo diễn:** nhóm đọc (T2/T4/T6 19:00), tập nhóm 16:00 và đóng khu ngẫu nhiên đều dùng `sharedDay`, thứ trong tuần chung và `hash32(room, sharedDay)` thay cho `rng`. Thời gian chờ giữa hai lần đóng khu tính theo ngày chung.
- **Thứ trong tuần chung:** `sharedWeekday = sharedDay mod 7`. Lịch theo thứ (đơn hàng T2/T4/T6, nhóm đọc, chương trình học) có hai lựa chọn: theo thứ chung, hoặc theo ngày của riêng người chơi (D5).
- **Cửa khu:** tự đồng bộ vì đã tính từ giờ trong ngày, thời tiết và sự kiện.
- **Đèn ngày/đêm:** tự đồng bộ vì đã dùng `minuteOfDay`.

### F90 — NPC

NPC vẫn giả lập riêng trên mỗi máy (N6). Khi giờ trong ngày đã chung, các khối lịch `npcBlockAt` sẽ trùng nhau giữa các máy. Còn lệch ở hai điểm:
- Chọn chỗ đứng có dùng `hash32(id, from, dayOf(s.minute))` ([npcAi.ts:77](../../src/simulation/npcAi.ts#L77)). Khi trực tuyến nên dùng `sharedDay` để mọi máy chọn cùng chỗ.
- NPC trong cốt truyện (Tư, Bình, Hòa, Long…) đứng theo nhiệm vụ riêng của từng người. Chấp nhận khác nhau giữa các máy, vì đó là câu chuyện riêng.

### F91 — Bạn tù AI theo lịch chung

- Máy chủ trì bạn tù đọc `sharedMoD` để chọn khu: dùng bảng khối lịch tương tự `groupDay` ([schedule.ts](../../src/content/schedule.ts)), gán mỗi bạn tù một nhóm (ví dụ Văn Sơn → nhóm vườn, Minh Tuấn → bếp).
  - 06:30 và 21:30: về khu phòng ở để điểm danh.
  - Giờ ăn: tới nhà ăn.
  - 15:30–17:30: ra sân; trời mưa thì vào phòng tập.
  - 22:00–06:00: ở buồng. Hiện tư thế ngủ, không bắt chuyện, nhưng vẫn trả lời nếu được gọi tên, kiểu “ngái ngủ”.
- Bạn tù chỉ lại gần bắt chuyện khi lịch cho phép (giờ tự do, ra sân, giờ ăn).
- Lời nhắc hệ thống cho AI được thêm giờ hiện tại và hoạt động đang diễn ra (ví dụ “Bây giờ 12:10, đang giờ ăn trưa”), để câu trả lời khớp thực tế.
- Bàn giao máy chủ trì không ảnh hưởng, vì lịch tính từ đồng hồ chung chứ không từ trạng thái của máy chủ trì.

### F92 — Giao diện

- HUD hiện **giờ trại** (chung) như hiện nay. Khi trực tuyến có thêm biểu tượng nhỏ “đồng bộ”; bấm vào hiện chú thích *“Giờ chung của phân khu. Ngày 12 là số ngày bạn đã ở trại.”*
- Panel Lịch đánh dấu mốc kế tiếp theo giờ chung.
- Cài đặt “Độ dài một ngày game” có chú thích: *“Áp dụng khi chơi ngoại tuyến; phòng trực tuyến dùng tốc độ chung.”*
- Màn nối giờ khi vào phòng: xem F87.
- Trang admin, mục **Trực tuyến**:
  - xem giờ chung hiện tại, ngày chung, thời tiết của từng phòng;
  - sửa `dayLengthMin` và `epochMs`, có cảnh báo *“Thay đổi làm mọi người chơi nhảy giờ; chỉ tiến, không lùi.”*;
  - nút “Đẩy tới mốc 06:00 kế tiếp” cho sự kiện đặc biệt.

### 5.1 Hợp đồng dữ liệu

| ID | Nội dung |
|---|---|
| DB59 | `app_config.key = 'clock'`: `{ epochMs: number, dayLengthMin: 48, version: 1 }`. Mở rộng check `key in ('bots','online','clock')`. Ràng buộc: `dayLengthMin` 24–120. Khi sửa `epochMs`, chỉ cho phép thay đổi khiến `sharedMinute` hiện tại **không giảm**. |
| API21 | `GET /api/time` → `{ now: <ms> }`, không cache, rate limit nhẹ; hoặc RPC `server_now()` trên Supabase. |
| SAVE | Thêm trường tùy chọn `GameState.online?: { clockVersion: number; joinedSharedMinute: number; lastWeatherSlot?: string }`. Save cũ không có trường này vẫn chạy, nên **không cần nâng schema v3**. |
| NET | `PeerMeta` thêm `clockV` (version cấu hình đồng hồ) để phát hiện máy dùng cấu hình cũ, khi đó tự tải lại `app_config`. Không phát giờ qua mạng. |

## 6. Trường hợp biên

| Tình huống | Xử lý |
|---|---|
| Vào phòng đúng giờ điểm danh | Sau khi nối, nếu đang trong khung điểm danh và người chơi không ở khu phòng ở: không tính vắng cho lần này (miễn trừ “mới vào phòng”). |
| Đang có lịch hẹn, ca lao động, lệnh custody thì vào phòng | Nối thời gian tiến theo quy tắc nghỉ nhẹ, xử lý giống khi ngủ: lịch hẹn bị bỏ qua tính lỡ nhưng không phạt (đặt lại được); ca lao động và lệnh custody diễn tiến đúng như khi ngủ. |
| Hai tab cùng một save cùng vào phòng | Hệ thống hiện đã có `peerId` theo tab. Khi phát hiện cùng `lineageId`, tab sau chỉ được xem (giữ hành vi hiện có). |
| Đồng hồ máy sai nhiều giờ | F86 hiệu chỉnh. Nếu không đo được, không cho vào phòng trực tuyến và báo *“Không đồng bộ được giờ”*. |
| Admin đổi `dayLengthMin` khi đang có người chơi | Máy nhận `clockV` mới, chạy lại F87 với delta ≥ 0. Đổi epoch theo hướng lùi bị chặn ở tầng dữ liệu (DB59). |
| Mất mạng giữa chừng | Đồng hồ chung vẫn tính được cục bộ từ `offset` gần nhất. Khi có mạng lại thì đo lại; lệch dưới 2 phút game thì làm mượt dần, không giật. |
| Người chơi ở chế độ custody nhóm A và nhóm B trong cùng phòng | Lịch khác nhau là hợp lệ: cùng giờ chung, khác khung hoạt động. Bạn tù dùng lịch chung `DAILY`. |
| Ngủ khi trực tuyến (nếu chọn D4 phương án 2) | Rời phòng, ngủ ngoại tuyến, vào lại thì F87 đưa tiến tới giờ chung kế tiếp. |

## 7. Kiểm thử và nghiệm thu

| ID | Kịch bản | Tiêu chí đạt |
|---|---|---|
| QA39 | Hai máy vào cùng phòng ở hai thời điểm khác nhau | Giờ trên HUD lệch ≤ 1 phút game sau 10 phút thực |
| QA40 | Máy B đặt đồng hồ hệ thống sai +3 giờ | Giờ chung vẫn khớp máy A (sai số ≤ 1 phút game) |
| QA41 | A mở túi đồ 3 phút thực | Đồng hồ của A vẫn trôi khớp với B |
| QA42 | A thực hiện tắm / bỏ qua hành động / ngủ | Không làm A vượt trước giờ chung |
| QA43 | Thời tiết và cửa sân trong 3 giờ game trên 2 máy | Trùng nhau 100% |
| QA44 | Nối giờ khi vào phòng | `minute` chỉ tăng; không phát phần thưởng/điểm danh hai lần; lịch hẹn bị bỏ qua không bị phạt |
| QA45 | F5 giữa lúc đang trực tuyến | Vào lại và giờ khớp ngay, không màn nối thứ hai nếu delta < 2 phút game |
| QA46 | Bạn tù lúc 06:30, 12:00, 16:00, 22:30 | Ở đúng khu theo lịch; ban đêm không chủ động bắt chuyện |
| QA47 | Rời phòng rồi chơi ngoại tuyến | Tốc độ và tạm dừng trở lại theo cài đặt cũ; save hợp lệ |
| QA48 | Hiệu năng nối 24 giờ game trên điện thoại tầm trung | Không đứng hình > 100 ms mỗi khung; hoàn tất ≤ 5 s |
| QA49 | Test đơn vị `sharedMinute`, `weatherAt`, `delta` nối giờ | Xác định, trùng giữa các lần gọi, không âm |

## 8. Quyết định (đã chốt 03/11/2026)

Chủ dự án đã chốt: **D1** admin chỉnh được (mặc định 48) · **D2** nghỉ nhẹ · **D3** theo đề xuất · **D4** theo đề xuất · **D5** theo thứ chung.

| ID | Câu hỏi | Phương án | Đề xuất |
|---|---|---|---|
| D1 | Độ dài ngày game trực tuyến | 48 phút thực (mặc định hiện tại) / 72 / tùy admin | **48**, admin chỉnh được |
| D2 | Khi nối giờ lúc vào phòng, phần thời gian bỏ qua tính thế nào | (a) như thức bình thường (hao nhu cầu đầy đủ) / (b) như nghỉ nhẹ / (c) như ngủ | **(b)** nghỉ nhẹ: không phạt, không hồi năng lượng như ngủ |
| D3 | Hành động khi trực tuyến | (a) chạy đúng thời gian game, ví dụ tắm 20 phút game ≈ 40 giây thực / (b) hoàn tất nhanh như ngoại tuyến nhưng không tua đồng hồ | **(a)** có giới hạn: mỗi hành động tối đa khoảng 60 giây thực; hành động dài (ca làm, lớp học) theo khung lịch |
| D4 | Ngủ khi trực tuyến | (a) ngủ theo thời gian chung / (b) phải rời phòng mới ngủ được | **(a)** vẫn ở trong phòng, nhân vật nằm ngủ, năng lượng hồi nhanh hơn; có thể thoát game, lần sau vào thì nối giờ |
| D5 | Lịch theo thứ (đơn hàng, nhóm đọc, lớp) | (a) theo thứ chung / (b) theo ngày riêng | **(a)** để mọi người cùng thấy “hôm nay Thứ Tư” |

## 9. Kế hoạch triển khai

| Bước | Việc | File chính | Ước lượng |
|---|---|---|---|
| T1 | Module thuần `sharedClock.ts` (`sharedMinute`, `weatherAt`, `joinDelta`) + test đơn vị | `src/online/sharedClock.ts`, `tests/` | 0,5 ngày |
| T2 | Đo lệch đồng hồ + `/api/time` + key `clock` trong `app_config` (migration 0005) | `api/time.ts`, `src/config/*`, `supabase/migrations/0005_clock.sql` | 0,5 ngày |
| T3 | Session hỗ trợ “đồng hồ ngoài”: thay `rate × DT` bằng đuổi theo `sharedMinute`; tắt tạm dừng, tua và bỏ qua khi trực tuyến | `src/simulation/session.ts`, `src/app/controller.ts` | 1,5 ngày |
| T4 | Nối giờ khi vào phòng / F5 / quay lại tab, có màn xác nhận và chia khung | `controller.ts`, `src/ui/screens/Online.tsx` | 1 ngày |
| T5 | Thời tiết, sự kiện và thứ trong tuần chung (F89), chọn chỗ NPC theo ngày chung (F90) | `session.ts`, `npcAi.ts` | 1 ngày |
| T6 | Lịch bạn tù + đưa giờ vào lời nhắc AI (F91) | `src/bots/host.ts`, `brain.ts`, `prompt.ts`, `personas.ts` | 1 ngày |
| T7 | UI HUD/Lịch/Cài đặt + trang admin (đồng hồ chung) | `src/ui/screens/*`, `src/admin/pages/Online.tsx` | 0,5 ngày |
| T8 | E2E QA39–48 (2–3 trình duyệt, đồng hồ máy giả lập lệch) | `scripts/online-clock.mjs` | 1 ngày |

Tổng ước lượng: khoảng 7 ngày công. Rủi ro chính nằm ở T3–T4, vì chạm vào vòng lặp mô phỏng. Cần chạy lại toàn bộ test ngoại tuyến hiện có (`smoke`, `custody`, `labour`, `n2n`, `resume`) để chắc chắn N1 không bị phá.

## 10. Rủi ro

| Rủi ro | Ảnh hưởng | Giảm thiểu |
|---|---|---|
| Phá gameplay ngoại tuyến | Cao | Mọi nhánh mới gắn điều kiện `online.active`; chạy lại toàn bộ test ngoại tuyến |
| Nối 24 giờ game chậm trên điện thoại | Trung bình | Chia khung, có thanh tiến độ; ngủ hiện đã xử lý 14 giờ |
| Người chơi thấy “bị tua mất ngày” khi vào phòng | Trung bình | Màn xác nhận kèm danh sách mốc; quy tắc nghỉ nhẹ không phạt |
| Hành động trực tuyến chậm gây chán (D3) | Trung bình | Giới hạn 60 giây thực; cho làm việc khác trong lúc chờ |
| Lệch đồng hồ máy lớn | Thấp | F86 + chặn vào phòng khi không đo được |
| Gian lận sửa đồng hồ phía client | Thấp (không có xếp hạng, không có phần thưởng chung) | Ngoài phạm vi; ghi nhận để xem xét khi có tính năng cạnh tranh |
