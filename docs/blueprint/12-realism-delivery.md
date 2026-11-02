# 12 — Full Life: tích hợp, WBS, QA và nghiệm thu độ phủ

Revision1.1,02/11/2026. Bổ sung cho [07](07-delivery-qa.md) và [08](08-traceability.md), **không thay số liệu lịch sử baseline1.0 thành bằng chứng đã triển khai**. Đọc [audit09](09-realism-audit.md) trước khi dùng từ “đầy đủ/100%”.

## Definition of Complete cho hồ sơ và game

Hồ sơ đủ coverage khi F01–F60 đều có đặc tả, GAP01–28 có disposition, UI/data/tasks/tests liên kết, unsupported/deferred profiles được nêu rõ. Game chỉ đủ baseline khi feature được triển khai, test pass và review nội dung phù hợp profile đã chọn; tài liệu không làm tăng implementation completion. Nghiệm thu phần mềm còn yêu cầu PERF/security/DR/browser/accessibility ở07/08.

Không có thước đo “100% đời thực” độc lập jurisdiction. Báo cáo bắt buộc tách4 cột: `Documented`, `Implemented`, `Tested`, `RealismReviewed`. Baseline1.1 trong lần bàn giao này: Documented ở cấp đặc tả hệ thống; ba cột còn lại **chưa có evidence**, không tự điền tỷ lệ100. Độ chi tiết nội dung như toàn thoại/asset/quest scripts phải sản xuất theo task, không được coi placeholder IDs là nội dung hoàn thành.

## Scope và thứ tự tích hợp

1. Giữ technical validation và slice nhỏ để đo khả năng; bổ sung profile/rights/episode/needs constraints vào thiết kế foundation ngay, tránh data migration đắt.
2. MVP baseline1.0 vẫn có thể release nhỏ nếu gắn nhãn rõ, không được gọi “mô phỏng đầy đủ mọi chức năng”. Nếu muốn launch Full Life phải cộng WBS dưới và qua Gate L.
3. Phát triển custody/services/casework trước content economy/contact/care/programs; queue/calendar/canonical actions dùng chung, không xây7 hệ đặt lịch riêng.
4. Tích hợp transitions/end state sau stable property/account/bookings; migration/privacy QA xuyên suốt, không để cuối mới kiểm.
5. MP giữ P2 nhưng thêm test các domain mới với authority/private projection; effort MP cũ chỉ là base, cần reserve riêng cho các luồng này.

Full Life target:18 chức năng không gian L01–L18,60 NPC danh tính **tổng** như baseline thay vì thêm28 NPC luôn active,35 màn hình,60 feature IDs. Không tự tăng30 quest lên60 chỉ vì thêm28 hệ; có thể lồng vào30 quest, nhưng toàn hệ phải có repeatable scenario/hướng dẫn và failure flows. Functional support F59 không có nghĩa đã có toàn campaign thai sản/remand; supportedProfiles phải liệt kê ở content manifest và marketing.

## WBS bổ sung — T10-01 đến T10-12

Đây là **workstream xuyên Phase0–8**, không phải thêm Phase10 sau multiplayer. Mỗi row dùng PW=30 focus giờ như07. Ranges là estimate bottom-up sơ bộ của phần bổ sung, cần hiệu chỉnh sau research/spike; công mở rộng hệ thống không tính lại controller/engine cũ. Product/design, art/TA và backend/client/QA là roles, cần người thật tại kickoff.

| Task | Objective/scope + deliverables / technical requirements | Dependencies | Priority/role | Effort PW | Acceptance/test/exit |
|---|---|---|---|---|---|
| T10-01 |Profile registry/rightsFloor/source taxonomy, authenticity scenarios, jurisdiction/specialist research plan; record supported profiles, no claims from anecdote only |T00-01,09 audit |P0 trước Full Life foundation; design+research+product |3–5 |Profile immutable versioned, conflicting evidence logged, unsupported variants labeled; QA17/22, research sign-off or explicit fiction scope |
| T10-02 |F33–37 custody/admission/property/housing/orientation/routine, state/receipts và old-save initialization |T10-01,T01-01/04,T02-03 |P1-L gameplay+backend+design |4–6 |AC33–37, one bed/property conservation/skip-resume; QA17/21 |
| T10-03 |Shared services/calendar/booking/casework F43/44/60; private role capability, dedup/reassign/exemption |T10-01,T10-02 skeleton,T06-01 |P1-L backend+gameplay |4–7 |AC43/44/60, no orphan/double booking, owner scopes; QA18/20 |
| T10-04 |F38/39 account/ledger/quotes/orders/refunds/stock/essential fallback |T10-03,T03-01,T06-02 |P1-L backend+gameplay |4–7 |AC38/39,balanced journal/one delivery, QA19/21/security |
| T10-05 |F40–42 contact/mail/call/visit + F59 family functional plan, authored-only channels/cancel/no-show |T10-03,T02-02 |P1-L design+client+backend |4–6 |AC40–42/59, complete no-family route, specialist content publish gate; QA18/20/22 |
| T10-06 |F45/46/50/51/58 care/wellbeing/diet/privacy/cultural/accommodation constraint propagation |T10-03,T03-01 |P1-L gameplay+design+specialist review |4–7 |AC45/46/50/51/58,essential invariant, no private inference/leak; QA17/18/20/22 |
| T10-07 |F47/48/49 education units/work shifts/certificates/credits/free issue/laundry/grooming, linked XP |T10-03,T10-04,T10-06,T03-01 |P1-L gameplay+design+animator |3–5 |AC47–49, no double award, excused participation equivalence; QA18/19/22 |
| T10-08 |F52–55 conduct/property reviews/boundaries/maintenance + staff constraints, fake-reports/fallback cases |T10-03,T10-06,T04-03 |P1-L AI+design+backend |4–7 |AC52–55, independent review/essential fallback, no guilt by reputation; QA17/20/22 |
| T10-09 |F56/57 transfer/release saga, planning/packing/settlement/end states, rollback/resume |T10-02..08,T01-03,T06-02 |P1-L gameplay+backend+design |4–7 |AC56/57, one location/one settlement, failed-load compensation; QA21/23 |
| T10-10 |U26–35 +L15–18 assets/booking anchors, animations/accessible variants, authored content/localization |T10-01, respective domain contracts,T04-01 kits |P1-L UI+LD+art+TA+writer |5–8 |10 screen contracts/4 zone QC, read all error/empty flows, same performance envelope; QA14/16/22/24 |
| T10-11 |DB28–44/API09–13/save v2 migration,projection access,export/deletion/redaction,backward-compatible service contracts |T10-02..09 contracts,T06-01/02 |P1-L backend+security+QA |3–5 |All ownership/mode/world checks, v1 fixtures lossless, no truncation/lifetime duplicates; QA02/09/13/20/21 |
| T10-12 |Integrated100-day sim/multi-day UX/playtest/long-session/perf and Full Life evidence pack; MP extension regression fixtures |T10-02..11, T07 candidate; MP executes whenT09 ready |P1-L QA+all owners |5–8 |QA17–24+base mandatory checks, Gate L sign-off; no false100% claim |

T10-11 bắt đầu thiết kế schema trước domain implementation; dependency “contracts” không tạo vòng với T10-03. T10-10 làm song song theo domain readiness, không chờ toàn09 hoàn tất rồi mới vẽ UI. T10-12 gồm tạo fixtures SP/MP contracts; actual hosted MP chaos execution thuộc MP increment phía dưới.

### Effort và chi phí cập nhật

T10 total **47–78 PW** trước reserve. Full Life SP = base103–170 +47–78 = **150–248 PW**, tương đương4.500–7.440 focus giờ. Reserve25% và làm tròn lên = **188–310 PW** (5.640–9.300 focus giờ). Đây là scope delta đã lập kế hoạch, không phải lời hứa “thêm tài liệu nhưng timeline không đổi”. Slice33–54 và MVP base53–85 PW cũ chỉ đúng scope1.0; nếu đưa T10 modules vào MVP phải cộng selected work packages, không dùng con số cũ.

Theo rates giả định07, chi phí lao động Full Life với reserve: solo opportunity15–35USD/h →84,6k–325,5kUSD; indie25–50 →141k–465kUSD; studio60–120 →338,4k–1.116kUSD. Các mức này **không quote thị trường**, chưa assets/tools/legal/thuế/marketing/hạ tầng, và chưa tính campaign specialized mới. Capacity6PW/tuần giả định →32–52 tuần capacity-only; critical path/availability/research làm lịch thực dài hơn, chưa có deadline cam kết. Expert interviews/reviewer availability, license và childcare/remand specialist production phải có quote/reforecast riêng, không giả “đã bao gồm mọi thực tế”.

MP base20–35 PW không bao phủ đủ economy/privacy/transfer domains mới. Đề xuất increment **8–14 PW** cho room-safe durable finance/booking transitions4–7 và private projection/network/lifecycle chaos4–7. MP Full Life =28–49 PW trước reserve,35–62 PW sau reserve25% làm tròn. Những khoảng này cần T09-01 benchmark; không gọi là cost per player đã đo. Population/render budgets không tăng cùng feature count, có thể phục vụ service outcomes off-screen.

| Task MP delta | Deliverable / technical scope | Dependencies | Priority/role | Effort PW | Acceptance/test/exit |
|---|---|---|---|---|---|
| T09-05 |Room-safe service booking/finance/lifecycle durable commands, fenced async commits, private actor projection |T09-02/03,T10-03/04/09/11 |P2 network+backend |4–7 |QA18–21+23 trên4 người, no duplicated funds/items/booking and no room tick stall |
| T09-06 |Full Life4→8 player chaos/knowledge privacy/reconnect/transfer regression và capacity report |T09-04,T09-05,T10-12 fixtures |P2 network+security+QA |4–7 |QA11/12/20/21/23/24, host failure cannot reopen released episode or expose private cases |

Tổng WBS hiện có50 work packages:36 baseline +12 life +2 MP delta. Effort SP không cộng task MP; MP Full Life bao gồm4 task cũ và2 delta, không cộng lại T10 SP implementation hai lần.

## QA17–QA24 — test bổ sung

Mọi test dưới **chưa chạy**. QA01–16 tiếp tục áp dụng, đặc biệt security/DR không được thay bằng realism playtest. Fixtures dùng fictional accounts/identities, không PII/hồ sơ giam giữ thật.

| QA | Dữ liệu/phương pháp | Pass/fail có thể đo | Evidence/owner |
|---|---|---|---|
| QA17 |Policy/rights/profile: balance0,trust−100,conduct review,night,essential outage,support flags; matrix50 combinations |0 combination khóa food/water/basic hygiene/care/help request; unsupported profile bị chặn với explanation; remand không infer conviction |Matrix cases+domain snapshots; design+QA |
| QA18 |Calendar/service:100 seeded days×24 simulated NPC,care/visit/work conflicts,sleep skip8h/7days,staff handover |No exclusive overlap,capacity overflow,orphan handler; every due booking reaches valid terminal/rescheduled state; no invalid absence penalty; elapsed-time/order invariants |Seed/decision traces+max queue metrics; AI+QA |
| QA19 |Economy/item:1k generated allowance/order/refund/shift operations,100 last-stock races,disconnect after debit/delivery |Every batch balanced,no negative available,quantity conserved,one canonical outcome and no refund>original; essentials with zero balance; no arbitrary player credit |Ledger diff/invariant report; backend QA |
| QA20 |Privacy/RLS/knowledge: A/B/anon/staff roles/general NPC/service worker;care/legal/family/culture records and lobby/AOI |0 cross-owner/private-field leak; unauthorized service role denied; no logs/telemetry private payload; NPC knows only permitted public fact |HTTP/WSS/projection/log fixtures; security+AI QA |
| QA21 |Save/saga: kill at each transition stage,late response,replayed action,server epoch change,v1→v2,storage quota |Exactly1 current episode/location,one settlement,owned+stored items conserved,bookings/cases recover; original save preserved; no silent truncate; MP stale owner denied |Fault-injection graph+digest before/after; backend+QA |
| QA22 |Content/accessibility/authenticity: day1,no-money,low-literacy,mobility need,no-family,nonreligious,care optout,review decision |Every mandatory activity has equivalent supported path,skip no penalty,allegation≠proven,review route available; no real legal/medical promise; specialized content only after reviewer approval |Manual scripted cases +reviewer decisions, not fabricated interviews; content+QA |
| QA23 |Lifecycle: room move,external abstract transfer,destination failure,release with pending order/property dispute,post-ending reload |One transfer owner,source/destination compensations correct,no duplicate returned item/payment,released episode never resumes routine; user retains usable save |All staged exits/screenshots/durable revisions; client+backend QA |
| QA24 |Integrated performance: new service hub,meal/routine/case event burst,7day skip,10 zone cycles+2h,MP4/8 when ready |Same approved PERF01–21 budgets,main queue bounded,due events processed without lost rewards; no extra full-detail staff beyond tier cap,private projection bandwidth measured |Raw traces+versions/settings+before/after; performance QA |

### Scenario acceptance pack phải bàn giao

SC01 admission/new/skip/reload; SC02 property disputed/returned; SC03 unsupported housing need/fallback; SC04 night/routine valid exemption; SC05 zero funds/free basics; SC06 order quote stale/last stock/refund; SC07 letter delay/parcel retry; SC08 call/video caption-only; SC09 visit no-show/rebook; SC10 legal private appointment/status; SC11 request overdue/appeal/reassign; SC12 care/rest/excused work; SC13 wellbeing decline/neutral fallback; SC14 study waitlist/makeup/certificate; SC15 shift partial/credit once; SC16 laundry/replace/no stock; SC17 toilet/water/diet auto-manage; SC18 nonreligious/interpreter; SC19 accusation unproven/reversal; SC20 inspection receipt/dispute; SC21 boundary/help/no forced combat; SC22 fixture outage/fallback/drill; SC23 transfer load failure/resume; SC24 release settlement/ending; SC25 accommodation migration/private projection; SC26 family/no-family/specialist block; SC27 staff shift handover/capability; SC28 full100-day continuity/save graph. Mỗi SC có initial state, commands, expected state/messages, failure injection, QA/build evidence; không chỉ happy-path video.

## RTM bổ sung — mỗi gap có feature/task/test/data/UI

| Gap / feature | UI | Data | Task | AC / QA / scenario | Trạng thái |
|---|---|---|---|---|---|
| GAP01 / F33 |U26 |DB28 |T10-02 |AC33 /QA17/21 /SC01 |Designed |
| GAP02 / F34 |U27 |DB29 |T10-02 |AC34 /QA19/21 /SC02 |Designed |
| GAP03 / F35 |U26/34 |DB30 |T10-02 |AC35 /QA17/21 /SC03 |Designed |
| GAP04 / F36 |U14/26 |DB28/44 |T10-01/02 |AC36 /QA17/22 /SC01/10 |Designed |
| GAP05 / F37 |U17/18 |DB31/06 |T10-02/03 |AC37 /QA18 /SC04 |Designed |
| GAP06 / F38 |U28 |DB32/33 |T10-04 |AC38 /QA19 /SC05 |Designed |
| GAP07 / F39 |U28 |DB34 |T10-04 |AC39 /QA19/21 /SC06 |Designed |
| GAP08 / F40 |U29 |DB35/36 |T10-05 |AC40 /QA18/20 /SC07 |Designed |
| GAP09 / F41 |U29 |DB31/35/36 |T10-05 |AC41 /QA18/20 /SC08 |Designed |
| GAP10 / F42 |U29 |DB31/35/36 |T10-05 |AC42 /QA18/22 /SC09 |Designed |
| GAP11 / F43 |U26/30 |DB28/31/37 |T10-03 |AC43 /QA17/20 /SC10 |Designed |
| GAP12 / F44 |U30 |DB37 |T10-03 |AC44 /QA18/20 /SC11 |Designed |
| GAP13 / F45 |U31 |DB38/31 |T10-06 |AC45 /QA17/18/20 /SC12 |Designed |
| GAP14 / F46 |U31 |DB38 |T10-06 |AC46 /QA20/22 /SC13 |Designed |
| GAP15 / F47 |U32 |DB39 |T10-07 |AC47 /QA18/22 /SC14 |Designed |
| GAP16 / F48 |U32 |DB39/33 |T10-07 |AC48 /QA18/19 /SC15 |Designed |
| GAP17 / F49 |U27/31 |DB29/31/09 |T10-07 |AC49 /QA17/19 /SC16 |Designed |
| GAP18 / F50 |U31 |DB38/05 |T10-06 |AC50 /QA17/22 /SC17 |Designed |
| GAP19 / F51 |U31/32 |DB38/39/31 |T10-06 |AC51 /QA20/22 /SC18 |Designed |
| GAP20 / F52 |U33 |DB40/37 |T10-08 |AC52 /QA17/20/22 /SC19 |Designed |
| GAP21 / F53 |U27/33 |DB29/40 |T10-08 |AC53 /QA19/21/22 /SC20 |Designed |
| GAP22 / F54 |U15/30/31 |DB40/37/13 |T10-08 |AC54 /QA17/20/22 /SC21 |Designed |
| GAP23 / F55 |U17/30 |DB41/37 |T10-08 |AC55 /QA17/18/24 /SC22 |Designed |
| GAP24 / F56 |U34 |DB42/28/29/30 |T10-09 |AC56 /QA21/23 /SC23 |Designed |
| GAP25 / F57 |U35 |DB43/42/32 |T10-09 |AC57 /QA21/23 /SC24 |Designed |
| GAP26 / F58 |U31/23 |DB38 |T10-06 |AC58 /QA17/20/22 /SC25 |Designed |
| GAP27 / F59 |U29/31/35 |DB35/38/43 |T10-05 |AC59 /QA20/22 /SC26 |Designed; specialized campaign gated |
| GAP28 / F60 |U30/31 |DB44/31/37 |T10-03/08 |AC60 /QA18/20/24 /SC27/28 |Designed |

DB28–44,UI26–35,API09–13 cross-cutting tasks T10-10/11/12 áp dụng toàn ma trận, không lặp mỗi row. RTM F01–32 phần08 vẫn hiệu lực, compatibility regression mandatory. Phạm vi source gap đời sống không thay22 mục yêu cầu kỹ thuật gốc; thêm REQ-LIFE-01..28 tương ứng GAP01..28.

## Gate L — Full Life release acceptance

- [ ] Profile mục tiêu, legal status, unsupported variants và mức Interactive/Abstracted/Referenced công bố rõ; research review sign-off hoặc fiction disclaimer đúng thực tế evidence.
- [ ] F33–F60 có implementation evidence; AC33–60 và SC01–28 pass, không đánh dấu done từ tài liệu.
- [ ] Essential-access invariants và fair review/appeal pass cho mọi constraints matrix.
- [ ] Services capacity/time/queue/reassignment/absence precedence hợp lệ qua100-day sim và normal-speed playtest.
- [ ] Property/account/order/wage/transfer/settlement invariants, ledger audit và save v2 migrations pass.
- [ ] UI26–35/L15–18 QC, supported accommodations/locale/caption/no-family paths complete.
- [ ] Privacy và NPC knowledge không rò case/care/legal/culture/family data; owner-role RLS/grants verified.
- [ ] F56/F57 world transition/departure recovery và terminal states đúng, no double payout/returned items.
- [ ] QA17–24 pass và base QA/security/performance/DR gates phần08 còn pass.
- [ ] Effort/cost/release plan đã rebaseline theo evidence, không dùng lịch budget1.0 cho scope1.1.
- [ ] Marketing không gọi mô phỏng mọi nhà tù/luật thật “100%”; chỉ báo coverage/implementation/test/review theo baseline đã phê duyệt.

## Rủi ro và câu hỏi mở bổ sung

| ID | Rủi ro / chưa chốt | Owner / biện pháp / gate |
|---|---|---|
| R15 |Scope Full Life tăng47–78PW trước reserve, cao hơn kỳ vọng |Producer, cộng delta rõ, chọn MVP nhỏ trước nếu nguồn lực chưa đủ |
| R16 |Lẫn tiêu chuẩn đối xử với thực tế, hoặc UK example thành luật VN |Research/product, source taxonomy +jurisdiction review T10-01; fiction profile mặc định |
| R17 |Case/care/legal/family privacy bị rò vào AI/MP logs |Security+AI, capability filtering/owner projection và QA20 mandatory |
| R18 |Ledger/transition/care exemption làm mất đồ/phạt sai |Backend+design, invariant/fault injection QA17/19/21/23 |
| R19 |Sensitive portrayals/định kiến/specialist variants chưa review |Narrative/specialist, content publish gate, skip/equivalent paths, no unsupported claims |
| R20 |Save/bounded history không đủ512KiB hoặc due queue spikes |Engine+backend, estimate actual fixture and QA24, archive có integrity, no silent truncate |
| O16 |Chọn quốc gia/jurisdiction và loại cơ sở nào? Default fiction/adult/sentenced |Product trước T10-01 production profile; không cần chờ để hoàn tất hồ sơ |
| O17 |Nguồn authentic experience chưa có, full annex UN bị access errors |Research, retrieve authoritative texts/reviewer panel; record disagreement and evidence status |
| O18 |Remand/maternity/childcare campaign hay chỉ functional support? |Product+specialist, baseline functional support, specialized campaign unestimated until reviewed |
| O19 |Launch MVP1.0 hay Full Life1.1? |Producer trước commitment; không bỏ thầm28 hệ nếu dùng label Full Life |

## Audit hồ sơ revision1.1

Mục cần kiểm tự động sau chỉnh sửa: ID F01–60/UI U01–35/DB01–44/L01–18 không trùng; gap28/RTM28 đủ; every extension feature has AC/task/test/UI/data; local links/fences valid; WBS base36 + extension12 +MP delta2 =50 gói công việc; cộng47–78,150–248 và MP28–49 đúng. Audit cấu trúc không phải independent realism review hay runtime tests. Kết quả chạy thực được ghi trong phần08 sau khi kiểm.
