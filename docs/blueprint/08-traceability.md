# 08 — Requirements Traceability, Acceptance & Self Review

**CR-VN-01 / thiết kế 1.2:** RTM F61–F72 và baseline mục tiêu 72F/38U/22L/50DB/17API tại [17](17-custody-delivery-qa.md). Các audit cũ giữ như lịch sử, không mô tả code hiện tại.

**Revision1.1:** RTM phần này giữ baseline kỹ thuật ban đầu F01–32/U01–25/L01–14/DB01–27. [12 — Full Life delivery](12-realism-delivery.md) bổ sung REQ-LIFE-01–28/GAP01–28, F33–60/U26–35/DB28–44 và Gate L; L15–18 ở03. Audit1.0 dưới là ghi nhận lịch sử, không phải tổng count hiện tại. Mọi tuyên bố “full” phải đọc cả hai RTM và phân biệt documented/implemented/tested/realism-reviewed.

## Trạng thái và quy tắc truy vết

**Designed** nghĩa đã có đặc tả; không đồng nghĩa implemented/tested/accepted. Trong hồ sơ này tất cả implementation và test evidence đều **chưa có**. Tên QA/AC là kế hoạch nghiệm thu. Owner roles cần gán người thật tại kickoff. Mỗi issue phát triển phải chứa requirement ID, F/U/L/DB hoặc ADR liên quan, task cha, QA và link evidence; không đóng chỉ bằng screenshot happy-path.

## Requirements Traceability Matrix — theo toàn bộ 22 mục brief

| Req | Yêu cầu nguồn | Thiết kế / deliverable | Roadmap | Kiểm thử/nghiệm thu | Trạng thái |
|---|---|---|---|---|---|
| REQ01 |17 vai trò, tài liệu trước code |README scope + role ownership WBS; không code game |T00–T09 |Review hồ sơ, chỉ Markdown |Designed |
| REQ02 |3D fidelity,world,animation,AI,gameplay,day,quests,physics,save,MP,UI,smooth |README G01–08;02–07 |T00..T08,T09 riêng |AC01–32,PERF01–21 |Designed, measurements pending |
| REQ03.1 |Three/Babylon/R3F/WebGL2/WebGPU/PlayCanvas/Unity/Godot, rendering criteria |01 S01–11,matrix,ADR01/02;02 graphics |T00-02/03/05,T05-01 |QA06/07/08 |Conditional selection |
| REQ03.2 |TS/React/Next/Vite/Zustand/workers/loading/cache |01 S12–17;02 ownership + worker/jobs + assets |T01-01/03/04 |QA01/06/08 |Designed |
| REQ03.3 |Supabase PostgreSQL/Auth/RLS/Realtime/Storage/Edge, Vercel/CDN/hybrid |01 S18–26/ADR03;02 architecture;06 API/data |T00-04,T06,T09 |QA02/09/10/15 |Designed; account quotas pending |
| REQ04 |14 khu,15 trường mỗi khu,fiction/security boundary |03 L01–L14 + common level contract |T02-01,T03-03,T04-01 |QA03/07/16 |Designed; blockouts pending |
| REQ05 |Controller/camera/actions/face/blend/IK/ragdoll/customize/equip, FSM/net/LOD |02 character+animation;04 F01/04/05/12/13 |T01-02/04,T03-03,T05-02,T09-03 |QA03/07/11,AC04/05/13 |MVP/advanced split explicit |
| REQ06 |AI schedule/BT/FSM/utility/nav/context/memory/relations/emotion/groups/budget/LLM |02 NPC architecture;04 F06/08/09/25/26 |T00-03,T02-02,T04-03 |QA04/08,AC26 |Designed; LLM deferred P3 |
| REQ07.1 |Core gameplay, all required feature fields |04 F01–F20/F29–F32,C0 contract |T02/03/06 |AC01–20/29–32 |Designed |
| REQ07.2 |Simulation needs/day/audio/weather/events/schedules/environment |04 F10/F15/F21–F28;02 runtime |T02-02,T03-01,T04-02,T05-03 |QA01/04/05,AC21–28 |Designed; balance untested |
| REQ08 |All screens,14 fields,design system,wireframes |05 U01–U25,C-UI,tokens,flow/wireframes |T02-03,T03-04,T09-03 |QA14,UI01–25 |Document wireframes; no Figma artifact claimed |
| REQ09.1 |Rapier/Havok/fixed step/queries/trigger/determinism/net prediction |01 S10/11;02 physics/MP |T00-03,T01-02,T09 |QA03/11/12 |Conditional physics choice |
| REQ09.2 |FPS/frame/CPU/GPU/memory/draw/tri/load/network/input/shader/longtask/GC/tiers/auto |07 PERF01–21,benchmark protocol |T00-02,T05-01,T07-01 |QA08/11,raw traces required |Targets only |
| REQ10 |Blender/glTF/PBR/UV/bake/LOD/compression/naming/export/version/CDN/QC |03 asset pipeline;01 S27–33 |T00-05,T01-03,T02-01,T04-01 |QA07/08/16 |Blender exporter retrieval unresolved |
| REQ11 |SP→MP authority,WSS/WebRTC/Colyseus/Nakama/rooms/AOI/reconnect/anti-cheat/persist/scale |02 MP +01 ADR05/06;06 API06/07 |T00-03,T09-01..04 |QA11/12/09/10 |P2, no scale claim |
| REQ12.1 |Users/profiles/characters/customization/progress/world/inventory/items/missions/relations/skills/achievement/settings/saves/events/session/audit |06 DB01–27,ERD,policy templates |T00-04,T06-01/02,T09-02 |QA02/13 |Logical design, no migrations applied |
| REQ12.2 |Types/null/default/keys/index/constraint/relationships/RLS/access/API validation/errors/auth/idempotency/concurrency/migrations |06 dictionary B/O/V+R templates,API01–08,migration strategy |T06-01/02,T09-02 |QA02/09/13 |Managed Auth internals await introspection |
| REQ13 |Security/reliability/privacy/backup/monitor/incidents |06 threats/recovery;07 deployment/runbooks |T06-02..04,T08 |QA09/10/15 |Designed; policy/DR evidence pending |
| REQ14 |Modular/ECS/data-oriented/bus/DI/scenes/assets/layers/state/types/tests/folders/deps/dataflow |02 components/folders/loop/ADR08 |T01-01..04 |QA01/08,dependency lint |Designed |
| REQ15 |Phases0–9,objective/scope/deliverables/WBS/deps/priority/technical/effort/role/AC/tests/risks/exit |07 phase descriptions +36 tasks |T00–T09 |Phase gates below |Designed, estimates assumptions |
| REQ16 |Unit/integration/gameplay/browser/graphics/physics/AI/perf/load/save/MP/security/accessibility/E2E/long/device |07 QA01–16,fixture/bug workflow |T00 harness,T02-04,T07,T09-04 |Evidence per test category |No tests run on game |
| REQ17 |Solo/indie/studio,effort/cost/infra/assets/ops/risk/tradeoffs,MVP/slice/full/vision |07 model/ranges/formulas;04 scope |Gate budgets atT00/T02/T03/T09 |Reforecast using actual velocity/quotes |No live vendor quotes |
| REQ18 |Official research/version/date/support/pros/cons/limits/stability/compat/fit/reason |01 source ledger S01–35,method and unknowns |T00-01..05 |Version manifest + unresolved-source closure |Retrieved refs documented; rolling not pinned |
| REQ19 |37 document sections +12 reusable diagrams |README index;diagram registry below |Doc review then implementation |Coverage checklist |Covered in document set |
| REQ20 |15 quality rules |Self-review below,ADR/perf/RTM/status discipline |Every gate |Reviewer evidence, no silent unknowns |Planning reviewed, runtime unverified |
| REQ21 |12-step sequence research→compare→design→spec→roadmap→QA→review→assemble |01 before recommendations;02–08 |Completed planning sequence |Read linked files and audit outputs |Planning complete with declared validation work |
| REQ22 |No game code,feasible high-detail research blueprint,Supabase+Vercel preference |README+01ADR03+all docs |No implementation in this delivery |Files are documentation only |Satisfied |

## Feature → design → task → test matrix

| Feature | UI / Data / technical dependency | Task | Acceptance / QA |
|---|---|---|---|
| F01 |U03;DB03/04;rig/content |T03-03,T03-04 |AC01;QA07/14 |
| F02 |U04/05/06;DB05/06/19 |T02-03 |AC02;QA05/13 |
| F03 |U06/14/16;DB05;input |T03-02 |AC03;QA05/14 |
| F04 |U06/23;PhysicsPort/Input/Camera |T01-02 |AC04;QA03/08 |
| F05 |U16;slot/action state+nav+physics |T01-04 |AC05;QA01/03/04 |
| F06 |U15;DB12/13/24;dialogue graph |T02-02,T03-02 |AC06;QA04/16 |
| F07 |U06/12;DB11/12/26 |T02-02,T03-02,T04-02 |AC07;QA01/05/16 |
| F08 |U10/15;DB13,NPC memory |T03-02,T04-03 |AC08;QA04/13 |
| F09 |U10;DB05 reputation |T04-03 |AC09;QA01/04 |
| F10 |U17/18;DB06 events |T02-02,T04-02 |AC10;QA04/16 |
| F11 |U08;DB07/08/09/26 |T03-01 |AC11;QA01/02 |
| F12 |U08/16;DB09/10/26 |T01-04,T03-01 |AC12;QA01/03/12 |
| F13 |U08/09;DB04/09 |T03-03,T05-02 |AC13;QA07/16 |
| F14 |U09;DB05 |T03-01/02 |AC14;QA01/13 |
| F15 |U06/17;DB06+schedule content |T02-02,T04-02 |AC15;QA01/04 |
| F16 |U11;DB14/15/26 |T03-01 |AC16;QA01/13 |
| F17 |U18/19;DB16/17 |T03-01 |AC17;QA01/13 |
| F18 |U20/25;IndexedDB/save DTO |T02-03 |AC18;QA13 |
| F19 |U02/20/25;DB01/02/19/25 |T06-01 |AC19;QA02/09/13 |
| F20 |U21/22/23;DB18+local device prefs |T03-04,T05-01/03 |AC20;QA06/14 |
| F21 |U06/17;clock+DB06 |T01-01,T02-02 |AC21;QA01/07 |
| F22 |U16;DB05/06+bed slots |T02-02,T03-01 |AC22;QA01/03/13 |
| F23 |U06/16;DB05/09/26 |T03-01 |AC23;QA01/05 |
| F24 |U06/16;DB05+L13 |T03-01,T03-03 |AC24;QA03/05 |
| F25 |U06/09;DB05+NPC aggregate |T03-01,T04-03 |AC25;QA01/04 |
| F26 |U15;DB06/13/24;NavPort |T02-02,T04-03 |AC26;QA04/08 |
| F27 |U18/22;DB06;renderer/audio |T05-03 |AC27;QA06/07/14 |
| F28 |U13/17/18;DB06/navVersion |T04-02,T03-01 |AC28;QA03/04/13 |
| F29 |U11/16;activity content+DB15/26 |T03-01,T04-02 |AC29;QA01/05 |
| F30 |U06/13;DB05/06;zone graph |T03-04 |AC30;QA04/14 |
| F31 |U04/07/18;UI transient +save |T02-03,T03-04 |AC31;QA06/13/14 |
| F32 |U24/25;DB21/22/26/27 |T09-01..04 |AC32;QA11/12 |

## UI/world coverage matrix

| Artifact group | Producer task | Checks |
|---|---|---|
| U01/02/03/09/10/11/13/14/19/21/22/23 complete |T03-04 +T06-01 +T05 |UI IDs individual in05,QA14/06 |
| U04/05/06/07/08/12/15/16/17/18/20 first version |T02-03,completeT03-04 |UI IDs,QA05/13/14 |
| U24/U25 MP recovery |T09-03 |UI24/25,QA11/12 |
| U25 SP recovery |T02-03,T06-01 |UI25,QA06/13 |
| L02/03/04/05 |T02-01 |15-field contract03,QA03/07/08 |
| L07/13 |T03-03 |15-field contract03,QA03/07/14 |
| L01/06/08/09/10/11/12/14 |T04-01 |15-field contract03,QA03/04/07/16 |

## Diagram registry — 12 loại được yêu cầu

| Loại | Nơi có sơ đồ tái sử dụng |
|---|---|
| System Architecture |02 High-level System Architecture |
| Component Diagram |02 Component Diagram / Ports |
| Game Runtime Architecture |02 Game runtime ownership/data flow |
| Gameplay State Diagram |02 Character stateDiagram +04 feature states |
| NPC Behavior Diagram |02 utility/schedule→reservation/path/action flow |
| Sequence Diagram |06 save sequence |
| ERD |06 data relationships |
| Deployment Diagram |07 environment/deployment |
| Data Flow Diagram |02 HID→command→state→render/HUD/save |
| Game Loop Diagram |02 fixed-step loop |
| Multiplayer Synchronization |02 MP sequence prediction/authority/durable ack |
| UI Screen Flow |05 U01→menu→load→HUD→overlays |

Các sơ đồ Mermaid cần render check trong renderer của đội ở kickoff; trong lần bàn giao này đã kiểm fence/cấu trúc văn bản, chưa có Mermaid renderer để chứng nhận hình render. Wireframe text có thể dựng lại trong design tool.

## Kết quả audit tài liệu lần bàn giao 02/11/2026

Đã chạy kiểm tra tự động trên file thực trong workspace: 9 file Markdown; đủ và liên tục F01–F32, U01–U25, L01–L14; 36 task WBS không trùng ID; mọi feature có hàng truy vết; bảng feature/screen/zone đạt số hàng đặc tả tương ứng; liên kết file nội bộ tồn tại; code fences đóng đủ. Đã cộng lại effort theo từng task: SP Phase0–8 =103–170 PW, MP Phase9 =20–35 PW, khớp phần07. Đã sửa tham chiếu tutorial về U14 và số lượng WBS trong RTM. Workspace chỉ có tài liệu Markdown, không có source game được tạo.

Audit này xác nhận cấu trúc và các phép cộng của hồ sơ; không xác nhận runtime, chất lượng art, tính đúng của implementation RLS/API hay hiệu năng. 11 khối Mermaid phục vụ 12 loại sơ đồ (runtime/dataflow dùng chung flow), chưa render bằng công cụ Mermaid. Những gate bên dưới vẫn giữ trạng thái chưa nghiệm thu.

## Acceptance gates và production release checklist

### Gate A — Research complete / Foundation approval

- [ ] T00-01..05 có evidence, exact versions/licenses/tooling/nav binding được khóa.
- [ ] Có máy thực, raw engine/physics/asset benchmark, không chỉ demo screenshots.
- [ ] ADR01/02 có quyết định và điều kiện fallback; PERF targets được điều chỉnh minh bạch nếu không đạt.
- [ ] RLS/cross-user/CAS/save spike pass; cloud limits/region/plan được xác nhận tại tài khoản thật.
- [ ] Blender export/animation/normal/color workflow đã thử, đóng lỗi nguồn S28.

### Gate B — Vertical Slice

- [ ] 4 zones/12 NPC/3 quests chạy từ new game tới recap,20–30 phút có ý nghĩa qua playtest.
- [ ] WASD/camera/interaction/animation/queue hoạt động, không progression blockers.
- [ ] Local interrupted save/reload pass; guest không buộc auth.
- [ ] Worst-case meal/yard route đạt approved medium/low target, art quality approved cùng settings.
- [ ] Usability/accessibility baseline đạt, scope MVP được định giá lại bằng throughput thực.

### Gate C — MVP

- [ ] 6 zones,24 NPC,10 quests,3 skills,20 item types,10 achievements có definitions/QA/license.
- [ ] Toàn AC P0 và U01–U23 pass, không missing flow/error state.
- [ ] Auth/cloud optional, trust mode immutable; user isolation,409 fork,offline sync và export hoạt động.
- [ ] Needs được test không gây nuisance/grind; skipped activities có đường thay thế.
- [ ] Devices/browsers hỗ trợ được công bố dựa trên kết quả thật; unsupported path rõ.

### Gate D — Full SP production release

- [ ] Nếu phát hành với phạm vi/label **Full Life1.1**, phải qua thêm Gate L tại [12](12-realism-delivery.md); Gate D baseline1.0 riêng không chứng minh28 mảng đời sống bổ sung đã hoàn tất.
- [ ] 14 khu/60 NPC identities/30 quests nếu giữ full scope; mọi thay scope có quyết định rõ.
- [ ] Không còn S0/S1; S2 có owner/rationale/deadline nếu chấp nhận.
- [ ] QA01–10 và13–16 có build/content/device evidence, mandatory security/privacy gates không bypass.
- [ ] PERF approved targets pass trên route/long session; memory/cold load/context recovery được đo.
- [ ] Schema/RLS/migrations và previous save/content compatibility pass.
- [ ] DB + object backups/restore drill đạt RPO/RTO đã thỏa thuận, failure runbooks có người chịu trách nhiệm.
- [ ] Staging/production secrets tách, service key không trong bundle; redaction/CSP/consent/export/delete verified.
- [ ] Asset/font/audio/license ledger và narrative/rating/localization review hoàn tất.
- [ ] CDN headers/cache/version rollout/rollback rehearsed; production smoke và observation window khỏe.
- [ ] Support, incident escalation, cost caps và monitoring dashboard đã bàn giao.

### Gate E — MP pilot và expansion

- [ ] 4 người pass tick/network/authority/chaos/security gates trước khi thử8.
- [ ] No trusted SP import, no client reward/pose authority, duplicate item race và stale owner bị chặn.
- [ ] Region/hosting quote, capacity envelope, egress/ops budget và on-call được xác minh.
- [ ] Reconnect/ticket/version mismatch/drain/server crash có UX và evidence; không hứa migration zero downtime chưa test.
- [ ] QA11/12 pass; room cap chỉ tăng sau benchmark, không coi CCU cloud connection limit là số người mô phỏng được.

Các checkbox **cố ý chưa đánh dấu** vì đây là điều kiện cho triển khai tương lai, không kết quả đã đạt.

## Self review theo 15 quy tắc chất lượng

| Rule | Cách đáp ứng trong hồ sơ | Giới hạn còn lại |
|---|---|---|
|01 No generic |Feature/screen/zone/data contracts với ID và failure flows |Nội dung thoại cuối/asset thực chưa sản xuất |
|02 Research before recommendation |01 so sánh và nguồn trước ADR |Sources rolling phải pin lại tại kickoff |
|03 Production planning |WBS,criteria,roles,API/schema,tests |Issue/subtask implementation sẽ tách sau spike |
|04 Dependencies |Ports/feature deps/WBS và RTM |Actual build dependency graph chưa tồn tại |
|05 No unrealistic promises |Mọi FPS/CCU/time/cost ghi targets/assumptions |Chưa benchmark để cam kết |
|06 Performance first |Budgets cho renderer/AI/physics/UI/assets/net |Cần cảnh benchmark thật |
|07 Scalable practical |SP first,modular,room-owned MP,no early generic ECS |MP vẫn cần work packages riêng |
|08 Priorities |P0/P1/P2/P3,slice/MVP/full split |User chưa xác nhận launch scope |
|09 Traceability |REQ→F/U/L/DB→T→AC/QA |Chưa test evidence links vì chưa code |
|10 No silent omissions |Unknowns và defer list phía dưới |Managed Auth internals/exporter chưa xác minh |
|11 Trade-offs |ADR01–08,render/physics/AI/net comparisons |Giá trị chấm điểm chưa có dữ liệu |
|12 Consistency |Một stack đề xuất,một authority model,C0/C-UI/DB templates |Requires implementation review khi version thay đổi |
|13 Validated information |[V]/[D]/[A]/[U],links/date/version/error ledger |Không coi đọc docs là chạy thử |
|14 Complete coverage |22-section RTM,37-item index,feature/screen/world maps |Full content writing phải task riêng |
|15 Self review |Table này + automated doc audit + manual cross-check |Chưa thay independent production/security sign-off |

## Future Expansion Strategy

1. Sau MVP: test retention bằng trải nghiệm/feedback tự nguyện trước thêm grind, mở zones và quest depth theo content budget.
2. Sau SP release ổn định: 4-player private co-op pilot, room-per-world, tách character trusted. Không chuyển mọi NPC/action lên mạng bằng cách broadcast database changes.
3. Khi room8 đã qua gate: thêm social/matchmaking nếu cần, xem lại Colyseus vs Nakama và region operations; không nối rooms thành MMO nếu chưa có thiết kế world ownership mới.
4. LLM optional chỉ sau quality/cost/privacy/moderation experiment; authored story truth và reward vẫn deterministic authority.
5. Mobile/touch/controller/first-person/native wrappers là product scope mới, cần riêng input, thermal/memory, asset budget và QA; không hứa responsive website là mobile game.

## Glossary

| Term | Nghĩa trong dự án |
|---|---|
| Authority | Nơi duy nhất chấp nhận command và thay đổi gameplay state |
| Snapshot/checkpoint | Trạng thái có schema/version tại một tick; network snapshot không nhất thiết durable |
| CAS / revision | Compare-and-swap: chỉ cập nhật nếu revision đang bằng bản client biết |
| Idempotency | Gửi lại cùng intent chỉ tạo một kết quả bền vững |
| Epoch/fencing token | Thế hệ owner; chặn server cũ tiếp tục ghi sau khi mất quyền |
| AOI/interest management | Chỉ đồng bộ phần thế giới liên quan tới player |
| Prediction | Client dự đoán movement để phản hồi nhanh; không cấp reward |
| Interpolation | Dựng pose giữa hai snapshots để chuyển động mượt |
| Reconciliation | Sửa dự đoán theo authority rồi replay input chưa ack |
| Fixed timestep | Simulation bước thời gian cố định độc lập render FPS |
| PBR/ORM | Material theo vật lý; occlusion/roughness/metallic packed map |
| GI/probes/lightmaps | Indirect light; điểm lấy mẫu phản chiếu/ánh sáng; texture baked illumination |
| LOD/AI LOD | Giảm chi tiết hình/nhịp tính AI theo mức liên quan, không thay kết quả thiết yếu |
| Navmesh | Vùng di chuyển hợp lệ và liên kết; không tự giải quyết mọi crowd deadlock |
| RLS | PostgreSQL row-level access policy; không thay server gameplay validation |
| GLB/KTX2 | Binary glTF scene; texture container/transcode pipeline |
| ECS | Entity/component/system; ở đây dùng component data modular trước framework ECS đầy đủ |
| p95/p99 |95%/99% mẫu không vượt giá trị đó; cần sample/window rõ |
| RPO/RTO | Mức mất dữ liệu/thời gian phục hồi mục tiêu khi sự cố |
| PW |30 giờ focus/người, đơn vị effort; không đồng nghĩa calendar week |
| Vertical slice | Lát cắt nhỏ chứng minh chất lượng tích hợp |
| MVP | Sản phẩm nhỏ nhất có vòng lặp và độ tin cậy đủ cho người dùng mục tiêu |
| Untrusted SP | Save client có thể sửa, không được biến thành tiến trình MP cạnh tranh |

## Assumptions & Open Questions / phần chưa thể xác minh

Không cần trả lời các câu này để đọc hồ sơ; đề xuất mặc định cho phép Phase0 bắt đầu khi có yêu cầu triển khai. Những quyết định ảnh hưởng tài chính/rating/launch phải được product owner chốt trước phase liên quan.

| ID | Giả định mặc định / vấn đề | Người chốt và hạn | Ảnh hưởng nếu khác |
|---|---|---|---|
| O01 |Desktop SP first,keyboard/mouse,fictional setting; MP sau release |Product trướcT00 |Mobile/MP launch đổi architecture,test và budget |
| O02 |8-role indie reference,effective capacity6 PW/tuần; chưa có team thật |Producer sauT00 |Re-estimate schedule và scope; không hứa lịch theo capacity giả |
| O03 |MVP6 zones/24 NPC/10 quests,3 skills,20 types |Design sau slice |Content count/animation/asset cost thay đổi |
| O04 |Chưa có target GPU/browser builds/máy đo |Tech+QA T00-01 |PERF gates và supported list còn provisional |
| O05 |Chưa khóa engine/physics/nav binding/exact package semver |Tech T00-02/03 |ADR có điều kiện, có thể đổi stack trước foundation |
| O06 |Blender docs HTTP402,exporter UI và glTF bake settings chưa xác minh |TA T00-05 |Chưa production approve pipeline; cần mở docs/installed exporter và test file |
| O07 |Chưa có Supabase/Vercel account/plan/region/Postgres version |Backend T00-04 |Quotas/backup/egress/pricing phải kiểm account thật |
| O08 |Chưa có vendor container/load result/CCU thực tế |Network T09-01 |Không có claim rooms/node hoặc dollar/player |
| O09 |Asset licenses và các báo giá mua/thuê chưa có |Art+producer trướcT02 |Chi phí allowance không phải quote |
| O10 |Rating,age/country distribution,privacy/retention và monetization chưa chốt |Product/legal trướcMVP public |Có thể cần content/consent/ops changes; không tự áp luật chưa nghiên cứu |
| O11 |No open player chat/voice/UGC/payments MVP |Product trướcMVP |Nếu thêm cần moderation,abuse,privacy,payment design riêng |
| O12 |No LLM model choice/cost/latency claims |Product+AI P3 |Cần experiment và nguồn giá mới khi lựa chọn |
| O13 |30 full quests là target sản xuất; chưa có toàn thoại/script/3D/wireframe Figma |Narrative/art/design T04 |Hồ sơ đặc tả schema/flows/tasks, không thay tài sản sáng tạo cuối |
| O14 |Full release budget kit-based,không bespoke AAA asset toàn bộ |Producer sau art slice |Nếu đổi fidelity,ước lượng lại cả art/TA/QA,không giữ giá cũ |
| O15 |Ops/SLO/RPO/RTO chỉ targets,chưa drill |Ops T06-04 |Không launch khi chưa có evidence và người chịu trách nhiệm |

Coverage giới hạn có chủ đích: không có SQL migration/source game, benchmark đã chạy, file Figma, asset GLB thật, business/legal policy cuối hoặc bảng giá cloud đã báo. Chúng được chuyển thành task/gate có owner thay vì bị bỏ qua. Bộ blueprint đủ để bắt đầu **technical validation**, rồi cập nhật bằng evidence trước production commitment.

## Audit thực chạy revision1.1 — 02/11/2026

Sau khi bổ sung09–12 và cập nhật các file liên quan, đã chạy kiểm tra cấu trúc trên toàn13 file Markdown:

- F01–F60, U01–U35, L01–L18, DB01–DB44 liên tục, không trùng ID định nghĩa.
- Bảng đặc tả feature/screen/zone có đủ hàng trường theo template;28 feature mới có AC và28 hàng GAP→feature→UI/data/task/QA/scenario.
- 50 task WBS có ID duy nhất; base36 +life12 +MP delta2. Tổng SP Full Life150–248PW, MP28–49PW; reserve25% làm tròn lên188–310 và35–62PW khớp phép cộng.
- Liên kết file nội bộ tồn tại, code fences đóng đủ; tất cả file workspace vẫn là Markdown, chưa tạo code game.

Đây là kết quả **audit cấu trúc tài liệu và số học**. Chưa chạy test gameplay/API/RLS/performance, chưa render các sơ đồ Mermaid bằng renderer, chưa phỏng vấn chuyên gia/người có trải nghiệm, chưa xác minh toàn bộ annex quốc tế hoặc một jurisdiction cụ thể. Vì vậy không đánh dấu implementation/test/realism review là đã đạt100%. Các thiếu sót nghiên cứu và chuyên biệt có disposition/owner tại09 và12, không bị xóa khỏi phạm vi theo dõi.
