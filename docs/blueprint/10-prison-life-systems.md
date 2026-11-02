# 10 — Full Life Specification: hệ thống đời sống bổ sung

**CR-LAB-01 / thiết kế 1.3:** [18](18-labour-rehabilitation-spec.md) mở rộng F48 thành phân công, tools, crop/pond/work-order/QC/bàn giao; F73–84 là delta chưa triển khai, không thay công ca bằng một minigame không có ledger.

**CR-VN-01 / thiết kế 1.2:** [14](14-sentence-custody-spec.md) mở rộng F35/F37/F52/F56/F57 trong mode VN; [17](17-custody-delivery-qa.md) phân biệt baseline và delta; giữ hành vi legacy.

Tiếp nối F01–F32 của [phần04](04-gameplay.md). Mọi F33–F60 dưới đây là **đề xuất thiết kế hư cấu**, nhận diện từ [audit09](09-realism-audit.md), chưa có code/test. Kế thừa C0 authority/atomic/idempotency, clock/gameplay accessibility và save trust mode. DB/UI/API mới ở [phần11](11-prison-life-contracts.md), tasks/tests ở [phần12](12-realism-delivery.md).

## Quy tắc tích hợp bắt buộc

**Life baseline1.1** gồm F01–F60 ở độ sâu ghi trong09. MVP cơ sở vẫn là mốc giao hàng nhỏ, không được quảng cáo là Full Life baseline đã hoàn tất. Các feature P1-L là bắt buộc để nghiệm thu **Full Life**, dù không bắt buộc cho slice/MVP cũ. Variant profile chuyên biệt như remand hoặc thai sản có thể chưa phát hành; UI/content manifest phải ghi support state và không xem profile đó là đã được mô phỏng nếu chỉ có tài liệu.

Mọi hạn mức, giờ mở, tiền và số ngày sau đây là **[A] giá trị playtest**, không định mức thật. Giữ cùng world clock; nghiệp vụ có dueAtGameMinute, createdTick, content/profile version và bounded histories. Sleep/time skip xử lý priority boundaries; trình bày rõ sự kiện nào bị đổi/hủy. Essential access không phụ thuộc trust/reputation/currency. Dịch vụ không đủ capacity chuyển sang lịch hẹn/fallback, không spawn nhân viên full-detail vô hạn.

### F33 — Admission và hồ sơ tình trạng giam giữ

| Thành phần | Đặc tả |
|---|---|
| Description / User Story |“Tôi muốn biết mình đang ở giai đoạn nào, ai hỗ trợ và việc cần làm ngày đầu”; tiếp nhận từ arrival đến assigned housing |
| Preconditions |F01, policy profile hỗ trợ legalStatus, L01 ready, chưa admission complete |
| Main Flow |Chọn story preset → xác nhận tên/fictional status → nhận mã nhân vật trong thế giới → orientation → property receipt F34 → initial support offer → placement F35 → stable checkpoint |
| Alternative Flow |Skip presentation vẫn tạo records; remand profile bỏ diễn giải kết tội; không cung cấp chi tiết cá nhân có thể dùng preset |
| Game Rules / States |Created/Arrived/Orienting/PlacementPending/Admitted; legalStatus là authored metadata, không infer từ ngoại hình; admission source key một lần/lineage |
| Data Model / Dependencies |DB28 custody episodes, DB29 receipts, DB06; F02/F34/F35/F36/F58 |
| UI Requirements / Technical Approach |U26 admission checklist/status; orchestrator saga checkpoint từng bước, resume không phát đồ hai lần |
| Edge Cases |Quit giữa nhận đồ và chọn phòng, content status unsupported, staff unavailable; tiếp tục từ completed step cuối |
| Acceptance Criteria / Priority |AC33: skip/xem/reload ở mọi bước cùng admitted state, không mất receipts/items; P1-L, rút gọn tùy MVP |

### F34 — Ký gửi và hoàn trả tài sản

| Thành phần | Đặc tả |
|---|---|
| Description / User Story |“Tôi muốn biết đồ nào được giữ, đồ nào ký gửi và được trả khi chuyển/ra”; custody khác inventory |
| Preconditions |Episode active, item provenance và policy whitelist hợp lệ |
| Main Flow |Kiểm kê authored personal items → phân issued/retained/stored → preview receipt → xác nhận → chuyển container atomic → biên nhận read-only |
| Alternative Flow |Dispute missing item tạo F44 case; item không được giữ gửi storage hoặc trả theo story, không tự biến mất |
| Game Rules / States |Listed/Stored/Issued/ReturnPending/Returned/Disputed; không lấy receipt thành item usable; returned chỉ một lần/unique item |
| Data Model / Dependencies |DB29 property_receipts, DB09/10, DB26 transfer outcome; F11/12/F56/F57 |
| UI Requirements / Technical Approach |U27 receipt + provenance + location; transactional container transfer, no duplicate asset identity |
| Edge Cases |Full bag khi trả → locker/return pack; corrupt receipt → repair workflow chứ không tự cấp lại đồ |
| Acceptance Criteria / Priority |AC34: tổng item owned+stored+returned bảo toàn qua100 transfer/retry; disputed state không xóa history; P1-L |

### F35 — Phân chỗ ở và thay bạn cùng phòng

| Thành phần | Đặc tả |
|---|---|
| Description / User Story |“Tôi muốn chỗ ở có lý do và có cách xin đổi khi cần”; hỗ trợ compatibility và needs |
| Preconditions |Eligible housing slots, accessibility/privacy needs từ F58, status/profile allowed |
| Main Flow |Placement service lọc phòng compatible → reserve bed → thông báo → chuyển đồ an toàn → confirm occupancy → introduce roommate |
| Alternative Flow |Hết chỗ → fallback assigned room capacity hợp lệ/story staging; request move qua F44; tạm solo room chỉ nếu content có |
| Game Rules / States |Unassigned/Reserved/Occupied/MoveRequested/Moving; không vượt capacity; không quyết định chỉ bằng race/religion/reputation; player không mất bed khi offline SP |
| Data Model / Dependencies |DB30 housing_assignments, DB28, DB06; NavPort/F56/F58 |
| UI Requirements / Technical Approach |U26/U13 room info/why move + U27 packed list; constraint solver nhỏ deterministic, không loop reroll |
| Edge Cases |Hai placements cùng bed, roommate unavailable, move đúng sleep commit; delay transition tới safe boundary |
| Acceptance Criteria / Priority |AC35: 100 concurrent assignment attempts không duplicate active bed, nhu cầu accommodation giữ đúng; P1-L |

### F36 — Nội quy, quyền và hướng dẫn tiếp cận dịch vụ

| Thành phần | Đặc tả |
|---|---|
| Description / User Story |“Tôi muốn hiểu quy tắc và biết cách hỏi khi không hiểu”; handbook có profile/version |
| Preconditions |Profile published, localization/accessible format available |
| Main Flow |Orientation giới thiệu daily routine/rights/services/property/review → tùy chọn hỏi lại → acknowledged topics → handbook mở lại bất kỳ lúc |
| Alternative Flow |Simplified language/read-aloud/subtitle; skip không mất essential services; policy changed hiện summary khác biệt |
| Game Rules / States |Unseen/Presented/Acknowledged/Changed; acknowledgment không là từ bỏ quyền; không quiz phạt hoặc yêu cầu literacy score |
| Data Model / Dependencies |DB28.orientation_flags, policy hash/content; F03/F20/F44/F58 |
| UI Requirements / Technical Approach |U14/U26 sections rõ “luật hư cấu”, search, contact help; content validation every rule has explanation/recovery |
| Edge Cases |Bản dịch thiếu, load profile cũ, policy đổi giữa phiên → không silently apply |
| Acceptance Criteria / Priority |AC36: mọi restriction visible có reason và service/review link, user skip vẫn tìm được hỗ trợ; P1-L |

### F37 — Điểm danh, nhịp đêm và thời gian chờ

| Thành phần | Đặc tả |
|---|---|
| Description / User Story |“Tôi cảm nhận lịch có những lúc cần ở đúng nơi nhưng không phải đợi vô ích”; roll call hư cấu |
| Preconditions |F15/F21, attendance roster, reachable muster/rest anchors |
| Main Flow |Advance notice → present/authorized absence check → short authored check → resolve → reopen activity windows |
| Alternative Flow |Medical/visit/accommodation exemption; người mắc path lỗi dùng reconcile attendance, không tạo vi phạm; sleep skip boundary giải đúng roster |
| Game Rules / States |Announced/Checking/Reconciling/Complete; presentation mặc định≤20 s thật có skip, không phải lịch cơ sở thật; quiet/night activities còn available |
| Data Model / Dependencies |DB31 service bookings loại routine, DB06 attendance checkpoint; F45/F58/F60 |
| UI Requirements / Technical Approach |U17/U18 notices, accepted absence; event-boundary reducer, no polling all actors every frame |
| Edge Cases |Player trong toilet, lost connection MP, cutscene vượt window; không phạt lỗi hệ thống |
| Acceptance Criteria / Priority |AC37: ngủ qua hai lần check không duplicate/miss exempt attendance; path failure không sinh case kỷ luật; P1-L |

### F38 — Tài khoản và sổ giao dịch giả lập

| Thành phần | Đặc tả |
|---|---|
| Description / User Story |“Tôi muốn hiểu khoản nhận/chi và không bị mất tiền do lỗi”; currency nội bộ hư cấu |
| Preconditions |Episode account provisioned, ledger service available |
| Main Flow |Authored allowance/work outcome/family event → ledger credit → available balance → purchase debit/reserve → statement |
| Alternative Flow |No balance vẫn được vật dụng thiết yếu; declined purchase không debit; refund reversal link về giao dịch gốc |
| Game Rules / States |Integer minor units, no cash-out/topup bằng tiền thật/trade player; Open/FrozenForReview/Settled; audit có nguồn, balance không client edit |
| Data Model / Dependencies |DB32 accounts, DB33 ledger, DB26; F39/F48/F57 |
| UI Requirements / Technical Approach |U28 statement, available/reserved amount; double-entry batch balanced, locks theo account ID, atomic unique source |
| Edge Cases |Negative balance, replay allowance, release đúng settlement, disconnected commit; no optimistic final spend |
| Acceptance Criteria / Priority |AC38:1k randomized operations không âm available/batch imbalance, retry cùng action một ledger outcome; P1-L |

### F39 — Cửa hàng nội bộ và đơn đặt hàng

| Thành phần | Đặc tả |
|---|---|
| Description / User Story |“Tôi muốn mua đồ hợp lệ và biết khi nào nhận”; catalog giới hạn hữu ích, không loot box |
| Preconditions |Published catalog/profile, order window, account balance/quota và capacity |
| Main Flow |Browse→quote price/version→confirm→reserve funds/stock→prepare→collect/deliver→debit+item transfer→receipt |
| Alternative Flow |Out of stock offer wait/substitute có consent, cancel pre-dispatch release hold; delivery fail credit reversal + source recovery |
| Game Rules / States |Draft/Quoted/Reserved/Preparing/Delivered/Cancelled/Refunded; prices server authority, essentials free route; stock/week quota reset theo game clock |
| Data Model / Dependencies |DB34 orders/catalog stock state, DB32/33/09; F11/F38/F60 |
| UI Requirements / Technical Approach |U28 cart/status/quote expiry; request idempotency + reservation expiry due queue, no floating-point currency |
| Edge Cases |Stale quote, full locker, two orders last stock, sleep past pickup; no charge without deliverable outcome |
| Acceptance Criteria / Priority |AC39: race last unit một winner, refund chỉ1, retry deliver không duplicate item; P1-L |

### F40 — Thư từ và bưu phẩm được phép

| Thành phần | Đặc tả |
|---|---|
| Description / User Story |“Tôi muốn trao đổi chuyện với người thân và biết thư đang ở đâu”; authored text |
| Preconditions |Known fictional contact, permitted content item, appropriate channel |
| Main Flow |Chọn chủ đề thư→preview→submit→processing state→delivered→authored reply event→journal |
| Alternative Flow |Delay/returned có reason và resubmit; legal communication F43 vào route riêng, không regular-story inspection |
| Game Rules / States |Draft/Submitted/Processing/Delivered/Returned/Archived; không gửi email/người thật, không open player chat; một reply per source |
| Data Model / Dependencies |DB35 contacts, DB36 correspondence, optional DB29 parcel receipt; F06/F07/F34 |
| UI Requirements / Technical Approach |U29 inbox/outbox/status/captions; graph choices thay free text ở baseline, due boundary scheduled |
| Edge Cases |Contact removed story, reply while zone unloaded, duplicate parcel, import old letter ID |
| Acceptance Criteria / Priority |AC40: thư delayed không chặn story vĩnh viễn, delivered parcel giữ provenance/retry safe; P1-L |

### F41 — Điện thoại và cuộc gọi video giả lập

| Thành phần | Đặc tả |
|---|---|
| Description / User Story |“Tôi muốn hẹn và thực hiện cuộc gọi với người thân mà không phải nhập số thật.” |
| Preconditions |Fictional approved contact, service window/station available, privacy/caption settings |
| Main Flow |Request slot→confirm→reminder→reserve station→authored conversation→complete→record summary, charge nếu profile thiết kế có phí |
| Alternative Flow |Contact unavailable→reschedule/letter, urgent story support không paywall; no microphone/camera permission needed |
| Game Rules / States |Requested/Booked/Waiting/InCall/Completed/Missed/Cancelled; cuộc gọi cinematic không WebRTC người thật; minute cap là fiction data |
| Data Model / Dependencies |DB31 booking, DB35 contact, DB36 summary; F38 if costs/F60 |
| UI Requirements / Technical Approach |U29 contact+schedule+subtitle, reminder không interrupt critical scene; booking dedupe và reason precedence |
| Edge Cases |Schedule changed, audio denied, pause midline, MP player offline; no charge failed connection |
| Acceptance Criteria / Priority |AC41: caption-only hoàn tất, cancel không mất lượt/phí ngoài rule đã preview; P1-L |

### F42 — Thăm gặp và tình huống đổi lịch

| Thành phần | Đặc tả |
|---|---|
| Description / User Story |“Tôi muốn lên lịch, gặp và giữ liên hệ kể cả khi có thay đổi.” |
| Preconditions |Contact eligibility/profile, visitor authored availability, L12 minimum ready |
| Main Flow |Request visit→book slot→notify→arrival check abstracted→seated conversation→closing recap→next contact option |
| Alternative Flow |Visitor không tới/cơ sở đổi lịch→ack reason→rebook or letter; cannot control real visitor outcomes; never spend real money |
| Game Rules / States |Requested/Confirmed/Rescheduled/InProgress/Completed/NoShow/Cancelled; private family info not shared to other MP players |
| Data Model / Dependencies |DB31/35/36, quest flags; F06/F41/F59 |
| UI Requirements / Technical Approach |U29/U17/U15, booking details và cancel effects; visitor render proxy only while relevant |
| Edge Cases |No seats, offline at start, simultaneous medical booking, child-dependent narrative needs review |
| Acceptance Criteria / Priority |AC42: cancel/reload không nhân visitor, no-show có authored alternative và không softlock; P1-L |

### F43 — Tiếp cận thông tin và người hỗ trợ pháp lý

| Thành phần | Đặc tả |
|---|---|
| Description / User Story |“Tôi muốn biết tình trạng hồ sơ hư cấu và có cách liên hệ người tư vấn.” |
| Preconditions |Policy/status support, fictional advisor role, case metadata |
| Main Flow |Read case summary→request confidential appointment/channel→view authored explanation→record next narrative milestone |
| Alternative Flow |Interpreter/accessible text, pending appointment fallback status summary; remand không ép nhận tội |
| Game Rules / States |InformationAvailable/Requested/Scheduled/Discussed/AwaitingUpdate; không luật thật/không thuật toán đoán án, verdict/release do story authority |
| Data Model / Dependencies |DB28 status, DB31 confidential booking, DB37 request kind legal; F36/F58/F60 |
| UI Requirements / Technical Approach |U26/U30, confidential label được phân biệt UI; actor-bound projection, không đồng bộ dialogue/legal notes ra AOI |
| Edge Cases |Staff gossip không đọc được legal case; stale status; authored pending lâu cần recap |
| Acceptance Criteria / Priority |AC43: legal info không đổi theo reputation và không lộ other-player data, no inferred conviction; P1-L |

### F44 — Đơn yêu cầu, kiến nghị, khiếu nại và xem xét lại

| Thành phần | Đặc tả |
|---|---|
| Description / User Story |“Tôi muốn yêu cầu hỗ trợ và theo dõi phản hồi, kể cả phản đối quyết định”; khác player bug report |
| Preconditions |Episode active, topic allowlist, service route và review role |
| Main Flow |Chọn category/sự kiện→preview facts known→submit receipt→assigned→acknowledged→response→accept/ask review→resolved |
| Alternative Flow |Urgent safety/care escalates đúng route, unavailable handler reassigned, retract không xóa decision history |
| Game Rules / States |Draft/Submitted/Acknowledged/InReview/Answered/Appealed/Resolved/Withdrawn; không phạt vì gửi đơn, không cần tiền/trust, bounded case workload không khóa urgent route |
| Data Model / Dependencies |DB37 service_cases, DB31 followups, history events; F34/F45/F52/F54/F55 |
| UI Requirements / Technical Approach |U30 ticket/status/next due, structured selections baseline; category routing+dedup by incident/source, không free-form sensitive PII |
| Edge Cases |Repeated submit, appeal original handler, resolve while status stale, duplicate report same maintenance incident |
| Acceptance Criteria / Priority |AC44: every case có receipt/owner/status/review option, retry một case, no retaliation reducer; P1-L |

### F45 — Chăm sóc sức khỏe và lịch hẹn

| Thành phần | Đặc tả |
|---|---|
| Description / User Story |“Tôi muốn xin chăm sóc, đi hẹn và có hỗ trợ phù hợp”; care service không chỉ mood refill |
| Preconditions |Fictional care needs/status, health role availability, privacy projection |
| Main Flow |Request support→abstract triage priority→book→attend dialogue/fade→care plan constraints/rest→follow-up/complete |
| Alternative Flow |Urgent authored event dùng assistance route, nghỉ thay work/rollcall có exemption; external care off-screen transition |
| Game Rules / States |Requested/Scheduled/Attending/PlanActive/FollowUp/Closed; không chẩn đoán thật, không dosage/minigame uống thuốc; health không trao đổi được với người chơi khác |
| Data Model / Dependencies |DB38 support_plans, DB31 booking, DB37 request; F22/F37/F48/F58 |
| UI Requirements / Technical Approach |U31/U17, abstract plan/check-in/rest cues; condition data allowlist và no health data telemetry |
| Edge Cases |Sleep across care appointment, staff shifts, unavailable room, treatment declined narrative → lựa chọn hỗ trợ phù hợp |
| Acceptance Criteria / Priority |AC45: care access không bị khóa bởi tiền/kỷ luật, exemption không bị ghi absent violation, no private MP leak; P1-L |

### F46 — Hỗ trợ tinh thần và đồng đẳng

| Thành phần | Đặc tả |
|---|---|
| Description / User Story |“Tôi muốn tìm người lắng nghe hoặc hoạt động hỗ trợ”; khác một chỉ số mood |
| Preconditions |Optional player need/choice, peer/professional availability, content preference |
| Main Flow |Chọn private check-in/peer/group/quiet activity→schedule or immediate authored support→conversation/skip→self-selected follow-up |
| Alternative Flow |Decline vẫn giữ access; sensitive topic off chuyển neutral support summary; crisis story chỉ off-screen reviewed |
| Game Rules / States |Offered/OptedIn/Booked/Active/FollowUp/Declined; không diagnose/score resilience hoặc tăng thân mật bắt buộc; no reward for distress |
| Data Model / Dependencies |DB38 plan flags, DB31, DB35 support roles; F25/F54/F58 |
| UI Requirements / Technical Approach |U31/U15, content notes/reduced-intensity, consent flags pinned; no LLM baseline |
| Edge Cases |Support NPC unavailable, repeated offers spam, player skip; cooldown cosmetic prompts, urgent route remains |
| Acceptance Criteria / Priority |AC46: decline/skip không penalty, no self-harm method content, no secret sharing to crowd NPCs; P1-L |

### F47 — Kế hoạch học tập và hoàn thành khóa

| Thành phần | Đặc tả |
|---|---|
| Description / User Story |“Tôi muốn chọn khóa, học theo tiến độ và thấy thành quả”; cơ bản chữ/số/vocational fictional tracks |
| Preconditions |Published course/accessible route, capacity, prerequisites không stereotype |
| Main Flow |Read plan→enroll→book sessions→participate/assisted variant→record progress→complete authored assessment→certificate in game |
| Alternative Flow |Waitlist, make-up class cho care/visit conflict, change course giữ completed units |
| Game Rules / States |Available/Waitlisted/Enrolled/InProgress/Paused/Completed; certificate không phải chứng nhận nghề thật; XP F16 là projection, không source attendance |
| Data Model / Dependencies |DB39 program_enrollments, DB31 sessions, DB15 XP ledger; F29/F58/F60 |
| UI Requirements / Technical Approach |U32 syllabus/progress/options; content graph validate prerequisites and alternative assessments |
| Edge Cases |Teacher unavailable, content unit renamed, fast-forward/cancel farm; completion unique unit ledger |
| Acceptance Criteria / Priority |AC47: course resume giữ units, disability assist không mất certificate, no repeat XP per session; P1-L |

### F48 — Phân công công việc và ca làm

| Thành phần | Đặc tả |
|---|---|
| Description / User Story |“Tôi muốn công việc có vai trò, lịch, người hướng dẫn và ghi nhận rõ.” |
| Preconditions |Eligible fictional assignment, compatible support constraints, work slot |
| Main Flow |Offer/read terms→accept/assignment narrative→safety orientation abstract→attend shift→task outcomes→supervisor summary→credit once if applicable |
| Alternative Flow |Medical rest/reassignment/missed shift có review và makeup, unsafe task request pause/support; không đói vì không làm |
| Game Rules / States |Offered/Assigned/Active/Excused/Reassigned/Completed; tasks an toàn, wage rates game data, not coercion economy; work không đổi ngày tha tự động |
| Data Model / Dependencies |DB39 enrollment kind work, DB31 shifts, DB33 credits; F29/F38/F45/F58 |
| UI Requirements / Technical Approach |U32 terms/duration/credit/rest, activity effects qua F29; attendance unique shift ID |
| Edge Cases |Partial shift/cancel, service disruption, supervisor absent, delivered outcome chưa durable |
| Acceptance Criteria / Priority |AC48: 100 shift replay không duplicate wages, valid care exemption không violation, essentials available without job; P1-L |

### F49 — Cấp phát, giặt, vệ sinh phòng và chăm sóc cá nhân

| Thành phần | Đặc tả |
|---|---|
| Description / User Story |“Tôi muốn có quần áo/chăn sạch và vật dụng vệ sinh, biết cách đổi đồ hỏng.” |
| Preconditions |Issued item catalog, station/stock services, personal preferences |
| Main Flow |Request basic kit→issue ledger→use bounded supplies→laundry exchange/clean room→return clean set→optional haircut/grooming |
| Alternative Flow |No stock immediate basic substitute/free issue; privacy/accessible action skip; repair/replace broken issued item with provenance |
| Game Rules / States |Issued/InUse/NeedsExchange/Queued/Exchanged; toilet paper/hygiene necessities không paywall, visual dirt capped không humiliation |
| Data Model / Dependencies |DB29 issue receipts, DB31 bookings, DB09 stock units; F13/F24/F34/F58 |
| UI Requirements / Technical Approach |U27/U31/U16, request/replace counts; exchange atomic old→new, hygiene effects bounded |
| Edge Cases |Two queue slots, lost laundry token, full bag, item damaged in migration; recovery service luôn có |
| Acceptance Criteria / Priority |AC49: fresh set exchange không duplicate/mất owned items, free essential path usable với balance0; P1-L |

### F50 — Nước uống, nhu cầu riêng tư và chế độ ăn

| Thành phần | Đặc tả |
|---|---|
| Description / User Story |“Tôi muốn sinh hoạt cơ bản có tính thuyết phục mà không phải quản lý cơ thể phiền phức.” |
| Preconditions |Water station/private action/diet metadata ready |
| Main Flow |Choose drink/toilet/private hygiene or dietary preference→validate access→short action/fade→set comfort flags/appropriate meal availability |
| Alternative Flow |Toilet/hydration auto-manage mặc định; detail option prompts nhẹ, full support style use instant abstract transition; diet substitute khi món hết |
| Game Rules / States |No dehydration/toilet accident humiliation/death; no separate mandatory HUD bladder bar; dietary need không phải min-max buff, no allergy medical simulation |
| Data Model / Dependencies |DB38 preferences/accommodations, progress.life_comfort schema extension; F23/F24/F58 |
| UI Requirements / Technical Approach |U31/U16 meal labels/privacy, effects integrated need reducer; no anatomical animations |
| Edge Cases |Queue, privacy interrupted, night closure, fast-forward; essentials luôn reachable hoặc abstracted fallback |
| Acceptance Criteria / Priority |AC50: day-long auto-manage không softlock, diet choice consistently served, no unwanted intimate rendering; P1-L |

### F51 — Tín ngưỡng, văn hóa và ngôn ngữ

| Thành phần | Đặc tả |
|---|---|
| Description / User Story |“Tôi muốn có lựa chọn tinh thần/văn hóa hoặc không tham gia, và hiểu nội dung.” |
| Preconditions |Optional preferences, reviewed authored content, spaces/service capacity |
| Main Flow |Opt-in activities/quiet space/readings/celebrations→booking→attend/decline→review next sessions; interpreter request khi cần |
| Alternative Flow |Nonreligious quiet reflection equivalent access; schedule/diet accommodation through F58; no proof of belief |
| Game Rules / States |Unset/OptedIn/Scheduled/Participating/OptedOut; no religion-derived crime/trust/skill modifier, identity disclosure optional and private |
| Data Model / Dependencies |DB38 preferences, DB39 programs, DB31 booking; F36/F47/F58 |
| UI Requirements / Technical Approach |U31/U32/U14, localized plain-language labels; content reviewed tránh tự bịa nghi lễ/tuyên bố đại diện |
| Edge Cases |Conflicting events, unsupported language, sensitive preference shared MP; permission-filtered projection |
| Acceptance Criteria / Priority |AC51: opt-out không mất main progress, belief không ảnh hưởng NPC morality, translated service request giữ semantics; P1-L |

### F52 — Nội quy, sự việc và xem xét kỷ luật

| Thành phần | Đặc tả |
|---|---|
| Description / User Story |“Tôi muốn biết vì sao bị nhắc/xem xét, có thể trình bày và được xem lại quyết định.” |
| Preconditions |Published fictional rule, observed event/evidence provenance, authorized case role |
| Main Flow |Event record→notice of concern→player response/context→review evidence/exemptions→reasoned decision→time-bounded consequence if applicable→appeal→expire/resolve |
| Alternative Flow |Insufficient evidence/due to bug→dismiss; misunderstanding→correct record; dialogue mediation thay formal consequence khi authored |
| Game Rules / States |Reported/Notified/Review/Decided/Appealed/Overturned/Expired; allegation khác established outcome, no basic-right withdrawal, no arbitrary solitary/minute-long forced waiting; không tăng án thật bằng code |
| Data Model / Dependencies |DB40 incident_reviews + DB37 appeal; F08/F36/F37/F54/F60 |
| UI Requirements / Technical Approach |U33 facts/known evidence/reply/deadline/effect, pure policy adjudication reducer no inference guilt from reputation |
| Edge Cases |Witness rumor, duplicate report, NPC unavailable, care exemption, save before appeal; canonical incident and immutable decision history |
| Acceptance Criteria / Priority |AC52: cùng facts khác appearance/reputation không khác quyết định nếu rule không liên quan; no bug-generated penalty; appeal/reversal restores entitlements; P1-L |

### F53 — Kiểm tra vật dụng và biên nhận

| Thành phần | Đặc tả |
|---|---|
| Description / User Story |“Tôi muốn thay đổi đồ vật sau kiểm tra được giải thích và có thể phản hồi.” |
| Preconditions |Fictional inspection event, authorized staff, property inventory revision |
| Main Flow |Notify generic review→short fade/summary→classify held items allowed/storage/review→atomic custody receipt→return/review request option |
| Alternative Flow |Unsupported/medical-essential item keep accessible pending reviewed replacement; property dispute F44 |
| Game Rules / States |Scheduled/InReview/ReceiptReady/Disputed/Closed; không body-search gameplay hoặc camera humiliating; no exact detection method/patrol timetable/evasion hints |
| Data Model / Dependencies |DB29 receipts, DB40 generic incident if needed, DB09; F34/F44/F52 |
| UI Requirements / Technical Approach |U27/U33 item reasons, no “random invisible delete”; reconcile revision before state transfer |
| Edge Cases |Item moved before review, duplicate inspection after reload, essential item accidentally flagged |
| Acceptance Criteria / Priority |AC53: every removed item có receipt/source/recovery, no technical evasion info and no essential-right loss; P1-L |

### F54 — Ranh giới xã hội, xung đột và bảo vệ

| Thành phần | Đặc tả |
|---|---|
| Description / User Story |“Tôi muốn từ chối áp lực, xin giúp đỡ và hòa giải mà không phải chiến đấu.” |
| Preconditions |Authored conflict event, available safety response role/alternative |
| Main Flow |Disagreement/pressure cue→choice decline/leave/seek staff/mediation→safe separation if needed→record response→follow-up relationship changes from observed facts |
| Alternative Flow |Skip sensitive scene→summary+safe option, confidential report via F44, supported housing F35 if needed |
| Game Rules / States |Tension/BoundarySet/HelpRequested/Separated/Mediating/Resolved; no reward bullying/coercion; consent không suy từ trust score, no mandatory graphic assault |
| Data Model / Dependencies |DB40 incident summary, DB37 request, DB13 relationships, support flags; F08/F25/F35/F46/F52 |
| UI Requirements / Technical Approach |U15/U30/U31 explicit leave/support choices; group rumor provenance bounded, no weapon/combat mechanic required |
| Edge Cases |NPC follows and blocks route, player offline MP, hostile report abuse; platform reporting tách fictional case |
| Acceptance Criteria / Priority |AC54: every event có reachable nonviolent exit/help path, witness knowledge scoped, victim no progression penalty; P1-L |

### F55 — Bảo trì, dịch vụ gián đoạn và tình huống an toàn

| Thành phần | Đặc tả |
|---|---|
| Description / User Story |“Tôi muốn cơ sở có vấn đề đời thường, biết báo hỏng và được hướng dẫn khi gián đoạn.” |
| Preconditions |Fixture/zone service metadata, authored incident and fallback anchors |
| Main Flow |Observe broken fixture/service outage/drill→report→maintenance assignment→temporary alternative→repair/resolve→notification |
| Alternative Flow |Essential water/meal/care inaccessible→abstract immediate substitute; skip drill travel nếu accessibility cần |
| Game Rules / States |Reported/Assigned/Unavailable/Workaround/Resolved; no sabotage mechanics/no detailed emergency vulnerabilities; no fire/smoke damage spectacle baseline |
| Data Model / Dependencies |DB41 facility_incidents, DB37 cases, DB06 overrides; F28/F44/F58/F60 |
| UI Requirements / Technical Approach |U16/U30/U17, visual+caption cue, event priority override with timeout; invalidate nav/service links atomically |
| Edge Cases |All sinks unavailable, alert during private action, stale duplicate report; one incident multiple reports, source dedup |
| Acceptance Criteria / Priority |AC55: essential access invariant holds every outage scenario, no unsafe path hint or trapped player, report resolves once; P1-L |

### F56 — Chuyển khu, chuyển phòng hoặc cơ sở

| Thành phần | Đặc tả |
|---|---|
| Description / User Story |“Tôi muốn chuyển nơi mà không mất đồ, hồ sơ, liên hệ hay tiến trình.” |
| Preconditions |Authored/approved transfer order, destination/profile compatibility và capacity |
| Main Flow |Notice→review packing/property→reserve destination→checkpoint→abstract travel/load→commit episode/location/housing→rebook affected appointments→receipt+orientation delta |
| Alternative Flow |Destination fail/load error→rollback staged transfer; external site off-screen if chưa có playable map, không giả có world lớn |
| Game Rules / States |Proposed/Approved/Packing/InTransit/Arrived/Cancelled; commit one transferId, release old bed only after destination secured |
| Data Model / Dependencies |DB42 transitions, DB28/29/30/31, save checkpoint; F18/F34/F35/F36 |
| UI Requirements / Technical Approach |U34 preview consequences/packing/status, staged world swap/saga with compensations, no double active housing |
| Edge Cases |Crash at commit, changed destination, in-flight wages/letters, MP owner reconnect; resume according persisted stage |
| Acceptance Criteria / Priority |AC56: fault injection at every stage leaves1 location owner, item totals conserved, bookings not orphaned; P1-L |

### F57 — Chuẩn bị rời cơ sở và tái hòa nhập

| Thành phần | Đặc tả |
|---|---|
| Description / User Story |“Tôi muốn hành trình có kết thúc có ý nghĩa, nhận lại đồ và kế hoạch bước tiếp.” |
| Preconditions |Authored story eligibility/status, advisor access; không yêu cầu max skills/trust |
| Main Flow |Review release story milestone→plan housing/work/study/contact/support→confirm property/account settlement→departure checkpoint→ending/epilogue→archive hoặc new sandbox fork |
| Alternative Flow |Kế hoạch thiếu vẫn có hỗ trợ/conditional narrative outcome, không khẳng định người chơi bị giữ lại vì nghèo; story date changed có explanation/next review |
| Game Rules / States |Planning/Review/Ready/Departure/Released/Archived; no real-world sentence calculator, good behavior≠guaranteed parole; departure reward only once |
| Data Model / Dependencies |DB43 reintegration_plans, DB42 transition release, DB29/32 settlement; F34/F38/F43/F47/F48 |
| UI Requirements / Technical Approach |U35 checklist/recap/known next steps; terminal episode state, optional post-ending sandbox là fork riêng rõ |
| Edge Cases |Uncollected order/property dispute, pending appeal, save after ending, MP friend still confined |
| Acceptance Criteria / Priority |AC57: released episode không quay về overnight routine, no double settlement/item return, ending không bị khóa bởi optional goals; P1-L |

### F58 — Nhu cầu cá nhân và accommodation

| Thành phần | Đặc tả |
|---|---|
| Description / User Story |“Tôi muốn hoạt động và không gian hỗ trợ cách tham gia của mình”; mobility/sensory/language/diet/privacy needs |
| Preconditions |Player opted preferences hoặc authored NPC need, supported variants content |
| Main Flow |Choose functional needs không cần medical proof→review suitable options→assign accommodation→propagate housing/schedule/input/action constraints→verify access |
| Alternative Flow |Không disclose thì dùng default accessible options; no route → abstracted equivalent action không giảm outcome; request review F44 |
| Game Rules / States |Unset/Requested/Applied/ReviewNeeded; needs khác difficulty cheats; not tied ethnicity/gender stats, privacy private by default |
| Data Model / Dependencies |DB38 support_plans/functional flags, DB30 placement, DB31 booking, DB18 account UI prefs; F20/F35/F45/F50/F51 |
| UI Requirements / Technical Approach |U31/U23 clear distinction UI accessibility vs character support, shared eligibility constraints graph |
| Edge Cases |Change need mid-action, incompatible old save, no staffing, MP private info; equivalent service fallback |
| Acceptance Criteria / Priority |AC58: every mandatory activity offers supported variant/equivalent, no certificate/achievement penalty and no MP disclosure; P1-L |

### F59 — Quan hệ gia đình, người phụ thuộc và hỗ trợ đặc thù

| Thành phần | Đặc tả |
|---|---|
| Description / User Story |“Tôi muốn thấy liên hệ gia đình và trách nhiệm bên ngoài ảnh hưởng câu chuyện có sự hỗ trợ.” |
| Preconditions |Optional fictional family story chosen; age/content preferences; specialist-reviewed variant nếu có maternity/childcare |
| Main Flow |Choose authored contact/dependent context→care-plan discussion→schedule contact/support→respond to family event→update plan/recap |
| Alternative Flow |No family/estranged storyline có peer/community alternatives; family distress scene skip; maternity needs abstract professional support, no medical minigame |
| Game Rules / States |NotDisclosed/PlanOffered/Active/Updated/Closed; child NPCs chỉ narrative/care context không playable prisoner; no pregnancy/random abuse generator |
| Data Model / Dependencies |DB35 contact fictional role, DB38 support, DB43 plan if release; F41/F42/F46/F58 |
| UI Requirements / Technical Approach |U29/U31/U35 opt-in/context labels, no real child identifiers; authored variants explicit supported/review pending |
| Edge Cases |Contact unavailable/deceased story only reviewed/off-screen, plan privacy, unsupported specialized profile |
| Acceptance Criteria / Priority |AC59: no-family path đủ progression, specialist variant chưa review bị chặn publish và không counted implemented; P1-L functional planning, specialized content gated |

### F60 — Nhân viên, dịch vụ và trách nhiệm xử lý

| Thành phần | Đặc tả |
|---|---|
| Description / User Story |“Tôi muốn biết ai làm gì, giờ nào được giúp và hồ sơ của mình không bị bỏ quên.” |
| Preconditions |Staff role/service definitions, shift/availability calendar, handler permissions |
| Main Flow |Request routed tới role→service capacity check→assign case owner→booking/reminder→resolve/reassign→audit outcome |
| Alternative Flow |NPC face actor absent dùng off-screen qualified service role, no free-for-all AI; urgent requests có fallback không chờ shift thường |
| Game Rules / States |OffDuty/Available/Assigned/Busy/Handover; staff shift abstract, không expose tuần tra/security timings; worker role không tự có care/legal permission |
| Data Model / Dependencies |DB44 service_definitions/staff assignments, DB31/37/38; F26 utility+schedule |
| UI Requirements / Technical Approach |U30/U31 who handles/status/rebook, capability matrix not raw technical role labels; indexed due queue + AI actor proxy |
| Edge Cases |Shift handover pending case, case owner disabled, two handlers resolve same case, capacity exhausted |
| Acceptance Criteria / Priority |AC60: case ownership handoff không orphan, unauthorized role không đọc private care/legal data, NPC LOD không đổi service truth; P1-L |

## Nhịp tuần và kịch bản tích hợp

Calendar bổ sung `absoluteGameMinute` và `dayOfWeek=(day−1) mod7` [D], không phụ thuộc lịch thật. Các cửa sổ minh họa: library/care/work theo ngày, cửa hàng đặt3 lần/tuần, nhóm đọc2 lần, visit theo fictional booking availability. Không ghi khung giờ của cơ sở thật. Due queue phải có timezone-free boundary semantics; ngày dài48/72 phút chỉ đổi presentation pace, không đổi thứ tự nghiệp vụ.

| Scenario | Luồng cần chơi/skip được | Invariants |
|---|---|---|
| Ngày đầu |F33→F36→F34→F58 optional→F35→F37→F23→F40 intro→F22 |Skip không thiếu item/receipt/rights; không xếp nhân vật vào unsupported legal profile |
| Một ngày thường |Routine→meal→work hoặc course→request/quiet activity→call→laundry→night |Không double-book; no-job/no-money vẫn nhu cầu thiết yếu; do việc có hệ quả khác nhau |
| Mâu thuẫn nhỏ |F54→seek help→F44→mediation→F52 dismissed/decision→F35 if needed |Không force combat, no guilt from reputation, known facts only |
| Cần nghỉ/hỗ trợ |F45/F46→F58→excused work/rollcall→rescheduled learning |Không penalty do accommodation; private data không thành gossip |
| Dịch vụ gián đoạn |F55→station unavailable→substitute water/meal→F60 repair→resolve |No softlock; queue upper bound; no exact security procedure |
| Chuyển khu |F56 staging→F34 packing→booking migration→F35 destination→F36 delta |One authoritative location, all item provenance/account/case continuity |
| Rời cơ sở |F57 plan→property/account/booking closure→departure→epilogue |No duplicate payout; archived state stable; optional goals không gate release story |

Conflict precedence [D]: urgent assistance/safety→essential care/accommodation→legal/visit appointment hợp lệ→routine attendance exemption→work/study→optional recreation. Đây là luật gameplay, không quy tắc pháp luật. Không tự hủy lịch: ghi reason/source và đề xuất reschedule; người chơi được xem ảnh hưởng trước fast-forward. Sau load, reconcile all due states bằng source IDs, không replay presentation như một mutation mới.
