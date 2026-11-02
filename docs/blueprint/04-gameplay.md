# 04 — Core Gameplay Specifications / GDD

**CR-VN-01 / thiết kế 1.2:** [14](14-sentence-custody-spec.md) bổ sung F61–F72 và delta về chọn án, quyền di chuyển, kết thúc chương/release cho mode VN mới; chưa code.

**Revision1.1:** F01–F32 là nền tảng; [10 — Full Life systems](10-prison-life-systems.md) là phần tiếp nối bắt buộc khi dùng label Full Life. Quy mô Full Release ở dưới là baseline1.0, chưa bao gồm delta28 tính năng/4 không gian. Audit09 xác định rõ phần trước còn thiếu; phần12 cập nhật phạm vi/effort/Gate L. Không diễn giải32 tính năng cũ là100% đời sống nhà tù.

## Scope, pacing và quy tắc chung

**Vertical slice** là chứng minh chất lượng 20–30 phút: L02/L03/L04/L05, 12 NPC danh tính, character controller, 3 nhiệm vụ authored, một nhịp ngày rút gọn, local save và UI cốt lõi. Không phải bản phát hành thu nhỏ có mọi hệ thống.

**MVP** là trải nghiệm SP lặp lại được: thêm L07/L13, 24 NPC mô phỏng theo LOD, 10 nhiệm vụ (3 chính/7 phụ), 3 kỹ năng, 20 item types, 10 achievements, local guest + opt-in Auth/cloud save, tối thiểu 2 giờ nội dung có ý nghĩa. Số giờ là giả định content cần playtest; không được tăng bằng grind.

**Full Release đề xuất**: 14 khu L01–L14, 60 NPC danh tính nhưng tối đa active theo PERF, 30 nhiệm vụ (8 chính/22 phụ), 3 nhánh tiến trình, thêm thời tiết nhẹ và contextual animation. Không đưa multiplayer/LLM vào điều kiện launch SP. **Long-term**: co-op 4→8 người, thêm nội dung biên tập; UGC/voice/combat chưa được đặc tả hay ước lượng.

Ưu tiên: P0 bắt buộc slice/MVP như ghi trong hàng; P1 full-release; P2 mở rộng có gate; P3 nghiên cứu. ID AC cùng số feature cho traceability. Mọi luồng dưới kế thừa **C0**: authority kiểm input/content version và quyền; validate trạng thái → reserve tài nguyên → commit atomic qua actionId duy nhất → emit event → UI projection → checkpoint khi cần. Retry không cấp lại reward. Cancel trước commit hoàn nguyên reservation, sau commit chỉ kết thúc presentation. Error trả mã dễ hiểu, không mutation một nửa. Đây là yêu cầu chung, không code.

### Hệ sinh hoạt, balance ban đầu [A]

Needs 0..100, số cao tốt; không HP/death do bỏ bữa. Energy/hunger/hygiene/mood lưu trên character_progress. Hunger giảm 3/giờ game, energy 2/giờ thức, hygiene 1,5/giờ; mood kéo về baseline 60 với authored events bounded. Ăn +35 hunger, ngủ +8 energy/giờ game, hygiene action +60, hoạt động vui +10 mood. Clamp và apply một lần qua elapsed simulation time, không theo render FPS. Dưới 25: gợi ý mềm; dưới 10: hiệu suất hoạt động giảm tối đa 15%, không khóa di chuyển/nhiệm vụ chính. Accessibility “nhu cầu nhẹ” giảm decay 50%, không phạt achievement. Các hằng số là data versioned và phải playtest, không tunable bí mật theo người dùng.

Ngày mặc định 48 phút thật; lựa chọn 72 phút và pause SP. Các hoạt động có thể skip animation hoặc fast-forward hợp lệ; không bắt ngồi nhìn nhân vật ăn vài phút. Mục tiêu chơi thử: ≥80% tester hiểu lịch sau tutorial; ≥70% mô tả được hai lựa chọn có ý nghĩa; chưa có kết quả đo.

## Feature catalog — đầy đủ các trường bắt buộc

Mỗi F dùng bảng hai cột; nhãn ghép vẫn quy định từng trường độc lập. Dependencies trỏ tới feature hoặc technical port ở phần 02, UI tới U ở phần 05, data tới phần 06.

### F01 — Tạo nhân vật

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | Chọn ngoại hình/tên để có nhân vật dễ nhận diện; “Tôi muốn hình đại diện phù hợp mà không bị khóa vào chỉ số theo ngoại hình.” |
| Preconditions | Content customization validated; guest slot hoặc authenticated user; U03 |
| Main Flow | Preview preset → chọn body/hair/skin/outfit → đặt tên → xác nhận → tạo character + progress + initial inventory một transaction |
| Alternative Flow | Randomize có thể undo; guest offline tạo local ID, import cloud sau; Back giữ draft |
| Game Rules / States | Ngoại hình cosmetic; tên 2–24 ký tự hiển thị, normalize Unicode, không dùng làm ID; Draft/Validating/Created/Error |
| Data Model / Dependencies | characters, character_customization; content preset IDs; auth tùy chọn; F18/F19 |
| UI Requirements / Technical Approach | U03 model preview riêng, rotate/reset; schema allowlist, asset load cancellable, disable double submit |
| Edge Cases | Asset preset missing → default cùng rig; retry create dùng idempotency key; không sinh hai character |
| Acceptance Criteria / Priority | AC01: 20 tổ hợp chuẩn không clip nghiêm trọng, retry 3 lần vẫn 1 record; P0 MVP (slice preset) |

### F02 — Khởi tạo hành trình

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | “Tôi muốn bắt đầu ở nơi an toàn và biết mục tiêu đầu tiên”; intro có skip |
| Preconditions | F01 committed, content version có spawn anchor |
| Main Flow | New game → tạo world/save lineage → L02 spawn → nhận handbook và quest Q01 → autosave |
| Alternative Flow | Full release L01 intro trước L02; skip intro vẫn cấp đúng flags/items |
| Game Rules / States | Mỗi lineage khởi tạo một lần; Loading/Intro/Ready/Failed |
| Data Model / Dependencies | world_states, game_saves, mission_progress, inventory; F18, asset/nav/physics |
| UI Requirements / Technical Approach | U04/U05/U06, loading theo stage thực; readiness barrier collider+nav+minimum visuals |
| Edge Cases | Missing anchor dùng fallback cùng zone; load fail không spawn trong void; cancel trở main menu |
| Acceptance Criteria / Priority | AC02: skip và xem intro cùng initial state; cold load có retry giữ character; P0 slice |

### F03 — Tutorial và handbook

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | “Tôi muốn học từng thao tác khi cần và xem lại”; hướng dẫn movement, camera, interact, lịch và save |
| Preconditions | F02 ready; input context gameplay |
| Main Flow | Trigger bước → hiển thị phím theo binding → quan sát hành động đúng → xác nhận → bước kế |
| Alternative Flow | Skip/replay trong handbook; dùng remapped key thay ký tự hard-coded |
| Game Rules / States | Không chặn tự do quá 30 s, không cấp quest reward lần nữa; Unseen/Active/Done/Skipped |
| Data Model / Dependencies | player_progress.tutorial_flags; input map; F04/F05/U14 |
| UI Requirements / Technical Approach | U06/U16 tooltip một mục tiêu, event-driven completion, subtitle thay lời thoại |
| Edge Cases | Blur/remap mid-step cập nhật prompt; reload tiếp bước hợp lệ |
| Acceptance Criteria / Priority | AC03: tutorial hoàn thành chỉ bàn phím + mouse, skip không softlock; P0 slice |

### F04 — Di chuyển và camera

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | Đi/chạy/crouch, quan sát tự nhiên; “Tôi muốn đi quanh khu mà không mắc đồ vật.” |
| Preconditions | World ready, không modal/action lock, valid collider |
| Main Flow | Input semantic → command tick → controller sweep → authority pose → interpolated camera/mesh |
| Alternative Flow | UI focus thả held input; shoulder swap; recovery safe anchor khi invalid |
| Game Rules / States | Thông số phần 02; Grounded/Moving/Crouched/Interacting/Recovering; không stand khi trần thấp |
| Data Model / Dependencies | transient transform/velocity/mode; checkpoint anchor; PhysicsPort/Input/Camera |
| UI Requirements / Technical Approach | U06/U23, sensitivity/invert/remap; không React state theo frame |
| Edge Cases | Diagonal boost, door closes, corner tunneling, tab hidden, pointer-lock denied |
| Acceptance Criteria / Priority | AC04: QA03 100 routes không xuyên/mắc >10 s; tốc độ 30/60/144 render Hz chênh ≤2%; P0 slice |

### F05 — Tương tác môi trường

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | “Tôi muốn biết đồ gì dùng được và thao tác có kết quả rõ”; cửa/ghế/bảng/giường |
| Preconditions | Target usable, distance ≤1,8 m và line-of-sight, state/slot hợp lệ |
| Main Flow | Focus → prompt → request → reserve → align → commit action → feedback → release |
| Alternative Flow | Busy → wait/choose other; cancel trước commit; auto-align accessible |
| Game Rules / States | C0, interaction duration theo content; Available/Reserved/Acting/Cooldown/Disabled |
| Data Model / Dependencies | interactable state, actionId, slot owner/expiry; F04, physics queries, animation |
| UI Requirements / Technical Approach | U16 range/verb/key/reason disabled; registry typed actions, không execute script từ content |
| Edge Cases | Target unload/disconnect, object deleted, exit blocked, double press |
| Acceptance Criteria / Priority | AC05: một slot không hai owner, retry không double event, unload release reservation; P0 slice |

### F06 — Đối thoại và NPC interaction

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | Chọn lời nói có hệ quả nhất quán; “Tôi muốn NPC phản hồi theo những việc đã biết.” |
| Preconditions | NPC sẵn sàng, không action ưu tiên cao, graph/node hợp lệ |
| Main Flow | Greet → reserve talk slot → mở graph theo context → chọn branch → atomic effects → recap/exit |
| Alternative Flow | NPC bận cho câu hẹn; skip line không skip effect; optional voice tắt vẫn đủ subtitle |
| Game Rules / States | Không LLM MVP; mỗi choice effect key một lần/quest stage; Idle/Talking/Choice/Closing |
| Data Model / Dependencies | dialogue flags, relationships, quest flags, observed memories; F05/F07/F08/F09 |
| UI Requirements / Technical Approach | U15 speaker, text, choices, history; authored graph validator dead-link/cycle, localization keys |
| Edge Cases | Quest stage đổi giữa thoại → revalidate choice; NPC schedule đổi → finish safe boundary |
| Acceptance Criteria / Priority | AC06: 50 branch fixtures đúng flags/rewards, reload không lặp reward; P0 slice |

### F07 — Nhiệm vụ chính và phụ

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | Theo mục tiêu rõ nhưng có lựa chọn; “Tôi muốn hiểu việc cần làm và vì sao.” |
| Preconditions | Mission prerequisites, actor/world lineage hợp lệ |
| Main Flow | Accept → track objectives → domain events cập nhật → validate completion → claim atomic reward → journal |
| Alternative Flow | Side quest decline/abandon theo authored reset; bỏ giờ hẹn chuyển stage thay vì fail vĩnh viễn |
| Game Rules / States | Main không chặn bởi needs thấp; Locked/Offered/Active/Ready/Completed/Abandoned; reward ledger unique mission/stage |
| Data Model / Dependencies | missions versioned definitions, mission_progress, flags; F05/F06/F11/F16 |
| UI Requirements / Technical Approach | U12/U06, tối đa 1 tracked quest + 2 objectives HUD; event reducers idempotent |
| Edge Cases | Item bỏ sau objective, content revision bỏ target, out-of-order event, inventory full |
| Acceptance Criteria / Priority | AC07: Q01–Q03 hoàn tất 3 thứ tự hành động hợp lệ, đầy túi reward vào storage mailbox; P0 slice |

### F08 — Relationships

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | “Tôi muốn sự giúp đỡ được ghi nhớ”; trust/respect/familiarity mở thoại và hoạt động |
| Preconditions | Known NPC, event có actor/target/provenance |
| Main Flow | NPC quan sát hành động → relationship delta bounded → threshold event → mở dialogue/activity |
| Alternative Flow | Xin lỗi/giúp về sau sửa quan hệ; NPC không thấy không tự biết |
| Game Rules / States | Trust/respect −100..100, familiarity 0..100; cùng repeat action giảm hiệu quả theo ngày; Unknown/Known/Trusted/Strained derive từ số |
| Data Model / Dependencies | npc_relationships, NPC memories, dialogue flags; F06/F26 |
| UI Requirements / Technical Approach | U10/U15 phản hồi định tính, chi tiết tùy setting; pure relationship reducer |
| Edge Cases | Event replay, witness unload, memory expiry không xóa main quest flag |
| Acceptance Criteria / Priority | AC08: witness nhận delta, NPC ngoài zone không nhận; restore giữ thresholds; P0 MVP (slice trust đơn) |

### F09 — Reputation nhóm

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | “Tôi muốn cộng đồng nhận ra đóng góp lâu dài”; reputation khác tình bạn |
| Preconditions | Authored group ID, significant event thuộc allowlist |
| Main Flow | Group-relevant event → delta −100..100 → tier → eligible activity/response |
| Alternative Flow | Rumor authored có confidence/decay; correction event khôi phục khi hiểu nhầm |
| Game Rules / States | Không cascade mọi NPC tự động; không khóa tuyến chính vĩnh viễn; Neutral/Recognized/Respected/Concerned |
| Data Model / Dependencies | player_progress.reputation map, event provenance; F08/F26/F28 |
| UI Requirements / Technical Approach | U10 badge + giải thích nguồn gần nhất; reducer data-driven |
| Edge Cases | Group content removed → migration alias; repeated farming event dedup |
| Acceptance Criteria / Priority | AC09: reputation đổi không sửa trust từng NPC ngoài rule; có đường phục hồi; P1 |

### F10 — Dynamic events

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | “Tôi muốn ngày có biến đổi hợp lý”; lịch nhóm, sách thất lạc, thay địa điểm |
| Preconditions | Eligible zone/time, cooldown, actor available; budget max 1 foreground event |
| Main Flow | Director xét weighted authored candidates → chọn seeded → reserve actors → announce → run → cleanup |
| Alternative Flow | Không đủ actor/path → hoãn, không spawn trước mặt; decline không phạt |
| Game Rules / States | Không chồng critical quest/cinematic; Eligible/Scheduled/Running/Resolved/Expired |
| Data Model / Dependencies | world_states.active_events, seed, cooldowns; F07/F26/F27 |
| UI Requirements / Technical Approach | U18/U17 thông báo nhẹ; event director finite catalog, không procedural story vô hạn |
| Edge Cases | Reload đang event, zone unload, NPC bận, trời đổi |
| Acceptance Criteria / Priority | AC10: 100 seeded days không actor double-book, cleanup slot mọi exit; P0 MVP (slice scripted) |

### F11 — Inventory

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | “Tôi muốn quản lý đồ dễ hiểu”; 12 slots MVP, stack limit theo type |
| Preconditions | Character active, item catalog hợp lệ |
| Main Flow | Add/move/split/use → validate capacity/ownership/quantity → transaction → UI result |
| Alternative Flow | Full → giữ vật tại source hoặc gửi reward storage; sort chỉ presentation |
| Game Rules / States | Quest items không drop nếu content không có recovery; no negative/duplicate counts; Closed/Open/Mutating/Error |
| Data Model / Dependencies | inventories, inventory_entries, item definitions; F12/F18; C0 |
| UI Requirements / Technical Approach | U08 keyboard grid/list, pending state; transaction reducer, cloud payload validate |
| Edge Cases | Double click use, stack overflow, stale revision, disconnect during move |
| Acceptance Criteria / Priority | AC11: property tests bảo toàn item total trừ consume/reward logged, retry không duplicate; P0 slice |

### F12 — Nhặt, bỏ và dùng item

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | “Tôi muốn vật thể và túi đồ khớp nhau”; whitelist props sách/khay/vải |
| Preconditions | F05 target usable, F11 capacity, item allowed action |
| Main Flow | Pick request → reserve object → animation → commit world removal + inventory add → socket cosmetic |
| Alternative Flow | Drop vào safe placement query, nếu blocked vẫn giữ túi; consume theo needs rule |
| Game Rules / States | Một item instance ở đúng một container/world; Available/Held/Stored/Consumed |
| Data Model / Dependencies | item_instance ID, container/location, state revision; F05/F11/PhysicsPort |
| UI Requirements / Technical Approach | U16/U08 action verbs; projection mesh không là nguồn item ownership |
| Edge Cases | Two users same item (MP), drop outside bounds, target removed trước commit |
| Acceptance Criteria / Priority | AC12: race pick một winner, drop invalid không mất item; P0 slice |

### F13 — Equipment và ngoại hình sau tạo

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | “Tôi muốn đổi trang phục/đồ cầm mà không làm hỏng animation.” |
| Preconditions | Item owned, rig socket compatible, không action lock |
| Main Flow | Select slot → preview → validate → equip → update render proxy và save |
| Alternative Flow | Missing cosmetic asset dùng default; unequip trở inventory/storage |
| Game Rules / States | Cosmetic MVP, không stat exploit; Unequipped/Equipped/Pending |
| Data Model / Dependencies | inventory_entries.equipped_slot, customization revision; F01/F11, skeleton mapping |
| UI Requirements / Technical Approach | U08/U09, slot labels, compatible filter; attach by socket ID |
| Edge Cases | Body variant clipping, slot occupied, full inventory unequip |
| Acceptance Criteria / Priority | AC13: 3 body × mọi outfit MVP qua sit/walk/sleep clips; P0 MVP |

### F14 — Character progression và profile

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | “Tôi muốn nhìn lại tiến bộ”; chapter, days, goals và unlocks |
| Preconditions | Character initialized, event progress eligible |
| Main Flow | Activity/quest outcome → progress ledger → threshold unlock → profile projection |
| Alternative Flow | Không đạt mục tiêu một ngày vẫn tiếp tục, recap gợi ý ngày sau |
| Game Rules / States | Không level scaling gây grind; chapter unlocked monotonic, choice flags có provenance |
| Data Model / Dependencies | player_progress, mission_progress, skills; F07/F16 |
| UI Requirements / Technical Approach | U09, timeline và mục tiêu; derive progress từ data + recorded unlocks |
| Edge Cases | Content adds chapter, replay old event, migration unlock missing |
| Acceptance Criteria / Priority | AC14: load giữ unlock, không giảm chapter bởi setting nhu cầu; P0 MVP |

### F15 — Schedule và hoạt động hằng ngày

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | “Tôi muốn biết nơi và lúc có hoạt động, vẫn tự chọn”; lịch phần 02 |
| Preconditions | Valid world day/clock/schedule version |
| Main Flow | Boundary event → đổi availability khu/NPC → U17 cập nhật → player tham gia hoặc bỏ qua |
| Alternative Flow | Missed meal có lựa chọn ăn bù; missed class hẹn ngày sau; reminder opt-out |
| Game Rules / States | Window arrivals, không hard-fail nhu cầu thấp; Upcoming/Open/Closing/Closed |
| Data Model / Dependencies | world_states.clock, schedule content, event overrides; F21/F26/F28 |
| UI Requirements / Technical Approach | U17/U06, current/next, ETA game minutes; boundary queue không poll mọi activity mỗi frame |
| Edge Cases | Sleep skip nhiều boundary, timezone đổi, reload đúng closing tick |
| Acceptance Criteria / Priority | AC15: fast-forward 8 giờ phát đúng boundaries một lần, schedule không theo OS clock; P0 slice |

### F16 — Skills

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | Tập trung, thể lực, giao tiếp; “Tôi muốn hoạt động mở cách tham gia mới.” |
| Preconditions | Eligible activity outcome có source/action ID |
| Main Flow | Complete activity → award bounded XP → cấp 1..5 → mở authored dialogue/activity |
| Alternative Flow | Accessibility auto-action vẫn XP, repeat action giảm XP sau cap mềm ngày |
| Game Rules / States | Level thresholds 0/100/250/450/700 XP khởi điểm; không yêu cầu max để xem kết thúc chính |
| Data Model / Dependencies | skills catalog, character_skills, reward ledger; F07/F14/F29 |
| UI Requirements / Technical Approach | U11 progress + unlock next; XP server/local authority, không client time claim |
| Edge Cases | Replayed finish, tuning thresholds migration, integer overflow |
| Acceptance Criteria / Priority | AC16: cùng outcome chỉ một XP award, đổi ngưỡng không mất XP tổng; P0 MVP |

### F17 — Achievements

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | “Tôi muốn ghi nhận hành trình mà không làm việc vô nghĩa”; 10 MVP, nội bộ game |
| Preconditions | Definition valid, source event verified theo trust mode |
| Main Flow | Event advances counter → threshold → unlock once → notification → profile |
| Alternative Flow | Offline local unlock đánh dấu local, không đẩy sang leaderboard trusted |
| Game Rules / States | Không achievement đòi bỏ accessibility, không reset khi đổi khó; Locked/Progress/Unlocked |
| Data Model / Dependencies | achievements, character_achievements; F14/reward source |
| UI Requirements / Technical Approach | U19/U18; reducers + unique character/achievement key |
| Edge Cases | Removed definition giữ lịch sử, spam notification sau load |
| Acceptance Criteria / Priority | AC17: 3 reload không re-notify/reward, migration giữ timestamp; P0 MVP |

### F18 — Save/Load local

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | “Tôi muốn dừng chơi và quay lại đúng tiến trình”; guest không cần tài khoản |
| Preconditions | Stable authority boundary, schema/content version known |
| Main Flow | Build DTO snapshot → validate → atomic IndexedDB generation → checksum → verify → mark saved; load validate/migrate → staged world → swap |
| Alternative Flow | 3 manual slots + 2 autosave generations; corrupt latest thử previous; export/import file với cảnh báo trust |
| Game Rules / States | Autosave mỗi 60 s thật đang chơi + quest/day boundary; Idle/Capturing/Writing/Saved/Failed; không unload handler là bảo đảm |
| Data Model / Dependencies | save DTO world/character/inventory/quest/NPC relationships/seed, revisions; F02/core domain; IndexedDB S34 |
| UI Requirements / Technical Approach | U20/U18, last success time, retry/export; checksum phát hiện lỗi không chống gian lận |
| Edge Cases | Quota/eviction/private mode/tab kill/schema mới, hai tab ghi; lock per lineage và CAS |
| Acceptance Criteria / Priority | AC18: 100 interrupted writes còn ít nhất một generation hợp lệ, load round-trip giữ domain digest; P0 slice |

### F19 — Auth và cloud save

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | “Tôi muốn chuyển thiết bị và biết khi có xung đột”; đăng nhập tùy chọn |
| Preconditions | Auth session valid, local snapshot stable, consent sync |
| Main Flow | Authenticate → list cloud revisions → compare lineage → upload save expected revision → transaction CAS → durable ack |
| Alternative Flow | Offline giữ pending local; conflict tạo local fork rồi người chơi chọn bản, không merge inventory tự động; guest import tạo untrusted cloud lineage |
| Game Rules / States | Không autosync đè bản mới; Guest/SignedIn/Syncing/Synced/Conflict/Offline |
| Data Model / Dependencies | Auth users/profiles/characters/game_saves; F18, API01–05, RLS |
| UI Requirements / Technical Approach | U02/U20/U25, progress/day/timestamp so sánh; refresh auth, server validation; cloud SP vẫn untrusted |
| Edge Cases | Account đổi giữa upload, expired token, logout pending, duplicate import |
| Acceptance Criteria / Priority | AC19: two-device CAS trả 409 và không mất cả hai bản; user B không đọc save A; P0 MVP |

### F20 — Settings, input và accessibility

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | “Tôi muốn tùy chỉnh hình/âm/phím, tránh chóng mặt và đọc rõ.” |
| Preconditions | UI available, defaults valid |
| Main Flow | Change draft → preview → apply → store preferences → reload confirms |
| Alternative Flow | Graphics không hỗ trợ bị disable có lý do; reset defaults theo nhóm, risky display change có revert timer |
| Game Rules / States | Audio preview không ghi game progress; remap conflict phải resolve; Default/Draft/Applied/Unsupported |
| Data Model / Dependencies | settings, local device profile vs account accessibility; renderer/audio/input |
| UI Requirements / Technical Approach | U21/U22/U23, subtitle size, reduced motion, hold/toggle, needs nhẹ, high contrast; validated settings schema |
| Edge Cases | Corrupt preference, GPU lost, no audio gesture, same key two conflicting actions |
| Acceptance Criteria / Priority | AC20: keyboard hoàn tất settings và trở game, unsupported preset không crash; P0 slice/MVP |

### F21 — Game time và day/night

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | “Tôi muốn ngày có nhịp và ánh sáng hợp thời điểm”; clock tách frame time |
| Preconditions | World ready, schedule và lighting data loaded |
| Main Flow | Fixed simulation ticks → advance game minutes → boundaries → sky/light/audio update presentation |
| Alternative Flow | SP pause giữ clock; sleep jumps qua boundary; MP không pause room |
| Game Rules / States | Day monotonic, 24h wrap increment day, 48/72 phút option; Morning/Day/Evening/Night |
| Data Model / Dependencies | world_states.day/minute/tick/time_scale, seed; F15/renderer |
| UI Requirements / Technical Approach | U06/U17, readable time + current period; lighting blend không trigger gameplay |
| Edge Cases | Negative elapsed, tab hidden, 23:59 rollover, clock scale đổi giữa ngày |
| Acceptance Criteria / Priority | AC21: cùng simulation ticks ở mọi render Hz cùng schedule digest; P0 slice |

### F22 — Energy và sleep

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | “Tôi muốn nghỉ có lợi và bỏ qua đêm”; không exhaustion death |
| Preconditions | Bed slot hoặc rest seat hợp lệ, chưa world transition |
| Main Flow | Choose wake time → reserve bed → sleep enter → advance domain boundaries → restore energy → wake at safe anchor |
| Alternative Flow | Cancel trước commit; nghỉ ngắn 1 giờ game; bed busy tìm slot khác |
| Game Rules / States | Needs rules đầu chương; awake/tired/sleeping/waking; không cấp sleep reward bằng đổi OS time |
| Data Model / Dependencies | progress.energy, sleep action, wake minute; F05/F15/F21/F18 |
| UI Requirements / Technical Approach | U16 sleep chooser, preview giờ/sự kiện sẽ bỏ qua; fast-forward event integration |
| Edge Cases | Sleep qua quest appointment, save mid-sleep, wake doorway occupied |
| Acceptance Criteria / Priority | AC22: ngủ 8h áp đúng nhu cầu/lịch, không duplicate event/reward, safe wake; P0 slice |

### F23 — Hunger và eating

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | “Tôi muốn bữa ăn là cơ hội gặp gỡ”; nhu cầu hỗ trợ nhịp xã hội |
| Preconditions | Food owned hoặc meal availability, seat/standing action valid |
| Main Flow | Nhận suất → chọn chỗ → eat → consume item once → +35 hunger → optional social event |
| Alternative Flow | Missed meal dùng suất dự phòng, skip animation accessible; full hunger vẫn có thể ngồi trò chuyện |
| Game Rules / States | Không tích trữ buff vô hạn, clamp 100; Fed/Hungry/Eating |
| Data Model / Dependencies | progress.hunger, inventory meal, daily meal claims; F11/F12/F15 |
| UI Requirements / Technical Approach | U06/U16, feedback không spam warning; commit item consume + need restore cùng action |
| Edge Cases | Disconnect sau ăn trước feedback, capacity full nhận khay, seat mất |
| Acceptance Criteria / Priority | AC23: cùng action không ăn/consume hai lần, bỏ bữa không softlock; P0 slice |

### F24 — Hygiene

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | “Tôi muốn chăm sóc bản thân nhanh, kín đáo”; wash và laundry |
| Preconditions | Sink/private slot valid; privacy transition ready |
| Main Flow | Reserve → fade/clip kín đáo → bounded hygiene gain → release → feedback |
| Alternative Flow | Full queue dùng wash nhanh gain nhỏ hơn, không bắt đợi lâu; skip visuals |
| Game Rules / States | Không khỏa thân, không humiliation mechanics; Clean/NeedsCare/Washing |
| Data Model / Dependencies | progress.hygiene, station reservation; F05/F15/L13 |
| UI Requirements / Technical Approach | U16/U06 nhẹ nhàng; action state điều khiển fade và commit |
| Edge Cases | Cancel fade, background tab, NPC chiếm exit |
| Acceptance Criteria / Priority | AC24: every exit release slot, hygiene clamp và action một lần; P0 MVP |

### F25 — Mood và cảm xúc

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | “Tôi muốn hoạt động và quan hệ phản ánh cảm xúc mà không mất quyền chơi.” |
| Preconditions | Authored emotional events, initialized baseline |
| Main Flow | Event → bounded mood delta → decay toward baseline → dialogue/animation expression projection |
| Alternative Flow | Hoạt động thư giãn sẵn có; tắt biểu cảm/camera effects, giữ thông tin bằng text |
| Game Rules / States | Player mood 0..100; NPC valence/arousal riêng; no psychiatric diagnosis/no forced loss of input; Low/Neutral/Positive |
| Data Model / Dependencies | progress.mood, NPC emotion aggregate, event causes; F08/F22/F23/F29 |
| UI Requirements / Technical Approach | U06/U09 qualitative label, recent cause; continuous decay dựa game elapsed |
| Edge Cases | Many events tick same time → bounded aggregate; reload không apply cause lại |
| Acceptance Criteria / Priority | AC25: mood thấp không khóa tuyến chính, repeated same event dedup; P0 MVP |

### F26 — NPC lịch, trí nhớ và phản ứng

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | “Tôi muốn NPC đang sống một ngày của họ”; AI phần 02 là dependency chi tiết |
| Preconditions | NPC definition, schedule/nav/slots available |
| Main Flow | Schedule/perception → utility goal → reserve/path → action → observe outcome → memory/relationship |
| Alternative Flow | Blocked route → wait/repath/fallback; NPC xa dùng zone-level simulation, vẫn giữ lịch |
| Game Rules / States | AI goal không đổi liên tục, memory cap 32 salient records, no omniscience; Scheduled/Travelling/Acting/Talking/Recovering |
| Data Model / Dependencies | npc runtime checkpoint, memories, relationships; F06/F08/F15/NavPort/PhysicsPort |
| UI Requirements / Technical Approach | U15 busy context; debug-only decision trace, không đưa score nội bộ vào HUD |
| Edge Cases | Two reservations, stale path worker result, player đứng chặn, day skip |
| Acceptance Criteria / Priority | AC26: 100 seeded days không orphan slot/quest blocker, witness test pass, AI budget PERF; P0 slice/MVP |

### F27 — Thời tiết và âm thanh môi trường

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | “Tôi muốn không gian có bầu không khí”; audio MVP, weather full |
| Preconditions | Zone acoustic/light metadata, user gesture bật audio |
| Main Flow | Zone/time/weather state → ambience layers → portal occlusion → mix; weather transition đổi schedule availability nếu authored |
| Alternative Flow | No audio support/muted dùng caption meaningful sounds; weather off chỉ cosmetic, không lợi thế |
| Game Rules / States | Clear/Overcast/LightRain, không flood/physics weather MVP; critical cue luôn có visual |
| Data Model / Dependencies | world weather seed/state, device audio settings; F15/F21/renderer/audio |
| UI Requirements / Technical Approach | U22/U18, weather transition 30–60 s thật đề xuất; voice pooling/priority và authored acoustic zones |
| Edge Cases | Audio suspended, device switch, sky texture load fail, rapid zone crossing |
| Acceptance Criteria / Priority | AC27: audio mute vẫn hoàn thành nhiệm vụ; rain không indoor leak rõ, voice cap; P0 audio/P1 weather |

### F28 — World state changes

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | “Tôi muốn thay đổi khu được giải thích và nhất quán”; cửa/lịch/đồ vật theo sự kiện |
| Preconditions | Valid event rule, transition không cắt critical action |
| Main Flow | Event request → validate occupancy/quest reachability → atomic door/nav/availability change → announce → save |
| Alternative Flow | Occupied doorway → blocked state và retry; critical route closed → alternative route hoặc hoãn |
| Game Rules / States | Không khóa player trong khu không có hoạt động/thoát; Open/Changing/Closed/Blocked |
| Data Model / Dependencies | world_states.interactables/overrides, navVersion; F05/F07/F10/NavPort |
| UI Requirements / Technical Approach | U13/U17/U18 reason và thời gian mở; commit collider/nav link cùng tick |
| Edge Cases | Save đang door changing, path cached, player standing threshold |
| Acceptance Criteria / Priority | AC28: không crush/clip và mọi active main quest có reachable route; P0 MVP |

### F29 — Hoạt động: đọc, tập, lao động

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | “Tôi muốn chọn cách phát triển khác nhau”; activity definition có duration, effects và slots |
| Preconditions | Activity unlocked, schedule open, compatible slot |
| Main Flow | Select activity → preview time/benefit → reserve → perform simple authored interaction → result → XP/needs/mood update |
| Alternative Flow | Auto-complete/toggle thay repeated presses; cancel partial gives no exploit reward; group variant full release |
| Game Rules / States | Read 30 min game +10 focus XP; exercise 30 min +10 fitness XP, −3 energy; help activity +10 communication XP. Values tuning [A], daily soft cap giảm farm |
| Data Model / Dependencies | content.activities, activity progress, reward ledger; F05/F16/F22/F25 |
| UI Requirements / Technical Approach | U16/U11, duration preview và cancel; generic bounded effect schema, no arbitrary scripts |
| Edge Cases | Schedule closes mid-action honor commit boundary, slot unload, needs reaches floor |
| Acceptance Criteria / Priority | AC29: 3 activities tạo kết quả khác nhau, replay/cancel không farm XP; P0 MVP (slice exercise) |

### F30 — Map và điều hướng

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | “Tôi muốn tìm nơi phù hợp mà vẫn tự khám phá”; map schematic hư cấu |
| Preconditions | Zone graph discovered; player valid zone |
| Main Flow | Open map → chọn known zone/quest → hiển thị route accessible → waypoint → walk |
| Alternative Flow | Closed route hiển thị lý do; undiscovered zone chỉ label hạn chế; no fast travel MVP |
| Game Rules / States | Không bản đồ cơ sở thật; route hints không reveal NPC secrets; Closed/Open/Routing/Unavailable |
| Data Model / Dependencies | progress.discovered_zones, zone graph, quest target; F07/F28/NavPort |
| UI Requirements / Technical Approach | U13/U06, keyboard zone list thay chỉ click map; logical graph route, không path từng triangle cho UI |
| Edge Cases | Door changed, target moves, player in transition |
| Acceptance Criteria / Priority | AC30: blocked door cập nhật route hint trong 1 s, keyboard chọn mọi known zone; P0 MVP |

### F31 — Pause, main menu và notifications

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | “Tôi muốn kiểm soát phiên và không bỏ lỡ tin quan trọng.” |
| Preconditions | Shell loaded; session state known |
| Main Flow | Esc pause SP → release input/audio duck → resume/save/settings/quit; domain event → dedup notification queue |
| Alternative Flow | MP menu ghi rõ world continues; critical save failure persistent, cosmetic notifications capped |
| Game Rules / States | Max 3 toasts, ≥4 s đọc hoặc history, không steal focus; Running/Paused/Quitting |
| Data Model / Dependencies | transient UI state + notification history bounded; F18/F20 |
| UI Requirements / Technical Approach | U04/U07/U18; focus restore, confirm quit chỉ khi unsaved changes có nguy cơ mất |
| Edge Cases | Esc trong nested dialog, quit during write, pointer lock mismatch |
| Acceptance Criteria / Priority | AC31: pause SP không đổi clock, resume không giữ phím cũ, save fail không báo success; P0 slice |

### F32 — Multiplayer lobby/session (mở rộng)

| Thành phần | Đặc tả |
|---|---|
| Description / User Story | “Tôi muốn vào cùng bạn, biết khu vực mạng và phục hồi khi rớt.” |
| Preconditions | Auth, matching protocol/content, game server healthy, trusted MP character |
| Main Flow | Create/join room → region/capacity check → ticket → authoritative baseline → ready → play → durable leave |
| Alternative Flow | Full/version mismatch offer room/update; disconnect resume ≤60 s window; không import local stats vào MP |
| Game Rules / States | 4-player gate rồi 8, private invites trước public; Lobby/Connecting/Syncing/Playing/Reconnecting/Ended |
| Data Model / Dependencies | sessions, members, tickets, world epoch/checkpoint; F19 + phần 02 MP + API07 |
| UI Requirements / Technical Approach | U24/U25 latency/region/version/reconnect; Colyseus WSS, AOI và authority |
| Edge Cases | Two-tab join, expired/reused ticket, host leaves, owner crash, DB commit failure |
| Acceptance Criteria / Priority | AC32: QA11–12 pass loss/reconnect/duplicate item attacks, no client-issued rewards; P2 |

## Nội dung nhiệm vụ slice cụ thể

| Quest | Story và objectives | Rules / reward / phục hồi |
|---|---|---|
| Q01 — Làm quen ngày mới | Nhận handbook từ bạn cùng phòng → đọc lịch → tới nhà ăn → hỏi mentor | Không bắt đúng giờ test; 20 focus XP, unlock Q02; handbook mất dùng journal copy |
| Q02 — Một chỗ ngồi | Nhận suất → chọn bàn có NPC → thoại về buổi tập → trả khay | 10 communication XP, trust mentor +5, mỗi stage ledger một lần; meal thay thế khi đến muộn |
| Q03 — Cùng đi một vòng | Gặp mentor ở sân → đi 3 anchors → chọn tập nhẹ hoặc nghỉ trò chuyện → recap | 10 fitness hoặc communication XP tương đương giá trị; nếu sân đóng chuyển buổi sau, không fail |

MVP thêm 7 quest: sắp sách, tìm chủ đề học, giúp phân loại đồ vải, tham gia nhóm đọc, hoàn thành mục tiêu ngủ, hướng dẫn người mới, chuẩn bị buổi sinh hoạt. Mỗi quest dùng schema F07, phải có graph objectives, localization, reward ledger, alternative path, QA fixtures và sign-off; chưa có thoại văn học cuối cùng trong hồ sơ này. Full 30 quest cần narrative production riêng theo WBS, không xem danh sách ý tưởng là nội dung đã hoàn thành.
