# 01 — Research Methodology, Technology Evaluation & References

**Revision1.1:** sổ nguồn đời sống giam giữ RFS01–13, tình trạng truy cập tài liệu quốc tế và giới hạn jurisdiction nằm tại [09 — realism audit](09-realism-audit.md). S01–35 dưới đây chỉ là nghiên cứu công nghệ, không bằng chứng game mô phỏng đầy đủ đời sống thật.

## Phương pháp và độ tin cậy

Ngày truy cập nguồn: **02/11/2026**. Đọc tài liệu chính thức, đối chiếu trang chi tiết khi kết quả tìm kiếm mâu thuẫn; không lấy snippet cũ làm bằng chứng cuối cùng. Phân biệt **[V]** khả năng được tài liệu mô tả, **[D]** quyết định đề xuất, **[A]** giả định, **[U]** chưa kiểm chứng. Có khả năng API, beta và quota thay đổi sau ngày này. Không có benchmark độc lập được áp dụng cho scene dự án; không nội suy FPS từ demo quảng bá.

Phiên bản tài liệu không đồng nghĩa phiên bản package đã khóa. Workspace ban đầu trống, chưa có lockfile. Khi khởi động Phase 0, ghi exact semver, commit, lockfile hash, browser build, OS, driver và WASM hash vào manifest thử nghiệm. Không ghi một bản là “latest” nếu chưa đọc release tương ứng. Với trang rolling không hiện version, bảng dưới ghi rõ thay vì tự đặt số phiên bản.

## Sổ nguồn chính thức và đánh giá công nghệ

Mỗi hàng bao gồm khả năng, giới hạn, độ ổn định/tương thích và lý do chọn/loại. Các nhận xét phù hợp là đánh giá thiết kế, không phải kết quả đo. Tất cả link đã mở trừ những hàng ghi lỗi.

| Ref | Công nghệ / phiên bản thực sự đã đọc | Khả năng, ưu điểm và giới hạn | Kết luận phù hợp |
|---|---|---|---|
| S01 | [Babylon.js specifications](https://www.babylonjs.com/specifications/), rolling, không hiện semver | [V] Scene, PBR, animation, WebGL/WebGPU, tooling và physics integration. [D] Bộ tích hợp giảm công nối module; scene graph vẫn phải quản lý lifetime/CPU. Feature presence không bảo đảm cùng chi phí trên hai backend. | Chọn có điều kiện; WebGL2 baseline, benchmark trước khóa version |
| S02 | [Three WebGPURenderer manual](https://threejs.org/manual/pages/webgpurenderer), rolling | [V] WebGPU có fallback WebGL2; renderer còn experimental; custom shader và post-processing cũ cần chuyển node/TSL. [D] Linh hoạt nhưng tăng chi phí game framework. | Đối thủ Phase 0, không chọn mặc định vì renderer mới |
| S03 | [Three WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer), rolling | [V] Renderer WebGL; [D] pipeline quen thuộc, tự lắp navigation, physics, gameplay và tooling. | Phương án dự phòng nếu đội giàu Three |
| S04 | [R3F scaling](https://r3f.docs.pmnd.rs/advanced/scaling-performance), rolling | [V] React renderer cho Three, instancing và demand rendering; [D] demand không phù hợp thế giới luôn di chuyển. React scheduling không thay simulation tick. | Không thêm R3F vào Babylon; cân nhắc cùng Three nếu đổi engine |
| S05 | [PlayCanvas Graphics](https://developer.playcanvas.com/user-manual/graphics/), rolling | [V] PBR, WebGL2, WebGPU beta, fallback và null backend. [D] Editor workflow tốt; custom authoring/hosting và quota editor cần đánh giá riêng. | Shortlist nếu đội art cần editor cộng tác |
| S06 | [Unity Web technical limitations](https://docs.unity.com/en-us/engine/6000.0/manual/platform-specific/webgl/intro/technical-overview), **6000.0** | [V] Web platform có giới hạn runtime/browser. [D] Editor/animation mạnh nhưng tải WASM, bộ nhớ và tích hợp web cần spike riêng; không lấy feature desktop làm feature web. | Không chọn cho đội TypeScript; xem lại nếu có team Unity/asset sẵn |
| S07 | [Godot Web Export](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html), stable rolling, trang nêu Godot 4 | [V] WASM + WebGL2, C# Godot 4 chưa export web; có single-thread từ 4.3, threading cần isolation. [D] Editor nhẹ, pipeline web graphics phải thử. | Không chọn ở phạm vi fidelity/TS này, không phủ nhận khả năng làm game |
| S08 | [WebGL2 Khronos](https://registry.khronos.org/webgl/specs/latest/2.0/), 2.0 editor draft hiển thị 30/06/2026 | [V] API dựa GLES3. [D] Baseline trưởng thành, không có compute model như WebGPU; phải probe extensions/limits. | Baseline client |
| S09 | [WebGPU W3C](https://www.w3.org/TR/webgpu/), CR Draft **15/09/2026**; [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API), rolling | [V] Graphics/compute API, yêu cầu môi trường và hỗ trợ tùy browser/device. [D] Giảm overhead trong workload phù hợp, không bảo đảm tăng FPS scene GPU-bound. | Optional sau kiểm thử parity, không yêu cầu bắt buộc |
| S10 | [Rapier determinism](https://rapier.rs/docs/user_guides/javascript/determinism/), JS guide **0.21**; [controller](https://rapier.rs/docs/user_guides/javascript/character_controller/) | [V] Kinematic controller; determinism WASM với cùng version, initial state và insertion order, input deterministic. [D] Adapter Babylon cần tự làm, đổi lại dùng headless chung dễ hơn. | Chọn có điều kiện cho client/server, không suy ra toàn game deterministic |
| S11 | [Babylon Havok plugin](https://doc.babylonjs.com/features/featuresDeepDive/physics/havokPlugin/), rolling | [V] WASM Havok và plugin là hai module; SIMD, license được trang mô tả MIT. [D] Integration trực tiếp lợi cho controller/ragdoll. Headless và deployment server phải kiểm chứng; review license artifact thực tế. | Đối chứng Rapier; chỉ chọn nếu giảm công tích hợp và qua server spike |
| S12 | [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html), rolling | [V] Static type system; [D] tốt cho shared contracts, không thay runtime validation. | Chọn strict, schema validate biên I/O |
| S13 | [React external store](https://react.dev/reference/react/useSyncExternalStore), trang hiển thị **19.3** | [V] Subscribe external state; [D] phù hợp menu/HUD snapshot, không lưu transforms theo frame trong component state. | Chọn cho UI |
| S14 | [Next server/client components](https://nextjs.org/docs/app/getting-started/server-and-client-components), rolling | [V] Phân tách server/client component. [D] SEO/admin hợp lý, server render không chạy engine GPU. | Tùy chọn website/admin sau MVP; game Vite riêng |
| S15 | [Vite features](https://vite.dev/guide/features), rolling, không khóa semver | [V] Build/dev và worker support. [D] client static ít phụ thuộc request server. | Chọn game bundler, pin Phase 0 |
| S16 | [Zustand repository](https://github.com/pmndrs/zustand), main rolling | [V] Store/selectors; [D] HUD snapshot nhỏ, không source of truth simulation. Trang docs cũ trả 404, đã đọc repo thay thế. | Chọn UI state; có thể thay external store thuần nếu không cần |
| S17 | [MDN Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers), rolling | [V] Worker trao đổi message, không thao tác DOM trực tiếp. [D] Dùng decode/path planning; chi phí copy phải đo. | Worker có chọn lọc, không bắt buộc SharedArrayBuffer |
| S18 | [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), hosted rolling | [V] PostgreSQL policy, service credentials có quyền vượt RLS. [D] policy không thay invariant transaction và kiểm soát service. | Chọn persistence, deny by default |
| S19 | [Auth JWT](https://supabase.com/docs/guides/auth/jwts), hosted rolling | [V] JWT identity/verification; [D] verify signature/issuer/audience/expiry ở backend, cache JWKS có rotation. | Chọn Auth; không tự làm password database |
| S20 | [Realtime limits](https://supabase.com/docs/guides/realtime/limits); [authorization settings](https://supabase.com/docs/guides/realtime/settings), hosted rolling | [V] Có quota connections, messages, joins, payload; vượt tải có thể bị disconnect. [D] Presence/lobby hợp lý; không có physics simulation, tick authority hay reconciliation tự động. | Không dùng làm game loop; không nhầm connection scale với simulation scale |
| S21 | [Storage access](https://supabase.com/docs/guides/storage/security/access-control), rolling | [V] Kiểm soát Storage qua policy. [D] public versioned assets và private save objects tách bucket. Signed URL không ngăn sao chép asset đã tải. | Chọn nếu egress model phù hợp |
| S22 | [Edge Functions limits](https://supabase.com/docs/guides/functions/limits), hosted rolling | [V] Có giới hạn bộ nhớ, CPU và wall time. [D] Hợp webhook/API ngắn; không giả định được process simulation vô hạn. | Chỉ dùng tác vụ gần DB cần thiết, tránh trùng Vercel API |
| S23 | [Vercel WebSockets KB](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections), WebSocket **public beta** | [V] Trang hiện tại hỗ trợ WebSocket với Fluid Compute; connection đóng theo max duration, reconnect có thể vào instance khác. [D] Không chọn làm owner simulation lâu dài; state continuity/migration tạo công vận hành. | Vercel web/CDN/API; không tuyên bố “Vercel không có WebSocket” |
| S24 | [Vercel Functions limits](https://vercel.com/docs/functions/limitations), rolling | [V] Runtime/request limits tùy plan. [D] Save payload nhỏ; upload lớn trực tiếp object storage qua cấp quyền. | Cần rà lại quota và plan trước triển khai |
| S25 | [Colyseus docs](https://docs.colyseus.io/), **v0.18** | [V] Node multiplayer rooms, state sync, tutorials prediction. [D] Không tự có anti-cheat/movement prediction đúng cho game; shared TS hợp stack. | Chọn multiplayer sau gate; tự xây AOI/physics validation |
| S26 | [Nakama authoritative](https://heroiclabs.com/docs/nakama/concepts/multiplayer/authoritative/), rolling | [V] Server-authoritative match loop. [D] backend game đầy đủ nhưng chồng identity/storage với Supabase, tích hợp runtime cần spike. | Thay thế nếu social/matchmaking quy mô lớn thành trọng tâm |
| S27 | [glTF specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html), trang hiển thị **2.0.1** | [V] Scene/material/animation format. [D] GLB interchange, gameplay metadata giữ schema riêng; extension support phải test trên loader. | Chọn asset runtime |
| S28 | [Blender manual glTF](https://docs.blender.org/manual/en/4.5/addons/import_export/scene_gltf2.html), URL nhánh **4.5**, **chưa đọc được: HTTP 402** | [U] Không xác nhận tùy chọn exporter cụ thể. [D] Blender là tool authoring đề xuất; cần artist test export tại Phase 0. | Chọn có điều kiện, không coi URL là bằng chứng đã kiểm chứng exporter |
| S29 | [glTF Transform](https://gltf-transform.dev/), rolling | [V] Công cụ xử lý glTF. [D] dùng kiểm kê, prune/dedup, pipeline nén có report. | Chọn pipeline offline |
| S30 | [meshoptimizer](https://github.com/zeux/meshoptimizer), main rolling | [V] Optimize/compress mesh. [D] ưu tiên Meshopt để thử decode/load; không khẳng định nhỏ/nhanh hơn mọi asset. | Chọn ứng viên mặc định sau A/B |
| S31 | [Draco](https://google.github.io/draco/), rolling | [V] Nén geometry; [D] so tải + decode + resident size với Meshopt, không bật cả hai trên cùng primitive. | Thay thế theo asset |
| S32 | [KTX Software](https://github.com/KhronosGroup/KTX-Software), main rolling | [V] KTX tooling; [D] KTX2/Basis cho GPU texture pipeline, transcode theo capability. | Chọn sau so normal-map artifacts |
| S33 | [glTF Validator](https://github.com/KhronosGroup/glTF-Validator), main rolling | [V] Validate glTF; [D] không kiểm tra gameplay colliders/license/art direction. | Bắt buộc kèm custom lint |
| S34 | [IndexedDB MDN](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API), rolling | [V] Browser structured storage. [D] local save atomic nhưng eviction/quota cần UX và export. | Chọn local guest save |
| S35 | [WCAG 2.2](https://www.w3.org/TR/WCAG22/), recommendation hiển thị **12/12/2024** | [V] Chuẩn accessibility; [D] nhắm UI AA, không tự nhận game 3D hoàn toàn đạt WCAG. | Keyboard/focus/contrast và audit riêng |

Recast navigation website không truy cập được qua công cụ; chưa xác minh binding JS cụ thể. Quyết định [D]: offline navmesh + adapter path query; T00-03 phải chọn/pin binding và kiểm tra door links, license, worker/server parity. Không dùng sự tồn tại navigation trong engine làm bằng chứng dynamic obstacle avoidance đã hoàn thiện.

## Ma trận đánh giá graphics

Ký hiệu: **N** có nền tảng engine/tài liệu; **I** cần tích hợp/authoring; **P** tùy pipeline/version cần spike; **—** không thuộc tầng đó. Đây là đánh giá năng lực và công tích hợp, không phải xếp hạng tốc độ. S01–S09 là bằng chứng nền tảng; các effect cụ thể không được coi production-ready trước T00-02.

| Tiêu chí | Babylon | Three | R3F | PlayCanvas | Unity Web | Godot Web | WebGL2 / WebGPU trực tiếp |
|---|---|---|---|---|---|---|---|
| PBR, HDR/tone/color | N | N | Theo Three | N | P theo pipeline | P Compatibility | I / I |
| GI | Bake/probe I | Bake/probe I | Theo Three | Bake I | Baked P | Baked P | I / I, compute không phải GI sẵn |
| Realtime shadow | N; budget atlas | N; budget | Theo Three | N | P | P | I / I |
| AO / SSR | P postprocess | P addons/node | Theo Three | P effects | P pipeline | P web renderer | I / I |
| Postprocess | N, kiểm parity | Hai stack renderer | Theo Three | N | P, không dùng native feature mặc định | P | I / I |
| Fog/volumetric | Fog N, volumetric P | Fog N, volumetric I | Theo Three | P | P | P | I / I |
| Texture streaming | I manifest/residency | I | Suspense không thay residency | Asset loading N, residency I | P web memory | P | I / I |
| Instancing | N | N | N wrapper | N | P batching | P | API / API |
| Animation/skinning | N | N | Theo Three | N | Editor mạnh, web P | Editor N, web P | I / I |
| Shader pipeline | Engine/material tools | GLSL hoặc TSL theo renderer | Theo Three | Engine shaders | Pipeline chọn web | Compatibility | GLSL / WGSL |
| Draw/memory | Tools N, dispose I | Tools N, dispose I | Lifecycle cần kiểm | Tools N | Profiler + heap web P | Profiler + export P | Toàn bộ I |
| World lớn | Chia cell/LOD I | Chia cell/LOD I | Không tự giải quyết | Streaming I | Chunk I | Chunk I | Tự xây |
| CPU/GPU bottleneck | Phải profile scene | Phải profile | Thêm React pitfalls | Phải profile | Phải profile WASM và render | Phải profile | Toàn bộ tự profile |
| Bảo trì dự án này | Trung bình | Trung bình–cao do glue | Cao nếu gameplay buộc React | Trung bình, editor trade-off | Cao nếu team TS | Cao nếu team TS | Rất cao |

Không cần realtime GI, SSR hoặc volumetric cao cấp để đạt hình ảnh tốt. [D] ưu tiên baked indirect light, reflection probes, contact AO vừa đủ, vật liệu chuẩn, directional shadow chọn lọc và art direction. SSR mất dữ liệu ngoài màn hình; fog không tự thành volumetric shadow; tone mapping không sửa texture màu sai. Texture streaming ở đây là chia bundle/LOD và residency do dự án quản lý, chưa hứa sparse virtual texturing.

## Phương pháp lựa chọn có điều kiện

Trọng số [A]: độ phù hợp hệ thống game 25%, tương thích 20%, công tích hợp 20%, tooling/art 15%, bảo trì 10%, headless/shared TS 10%. T00-02 chấm 1–5 sau cùng scene, asset, camera và chất lượng. Chưa có điểm thực nghiệm nên **không tạo tổng điểm giả**. Shortlist Babylon và Three; PlayCanvas thay Three nếu art workflow là nút thắt. Native-focused engine chỉ thắng nếu năng lực đội hiện có bù được chi phí web.

## Recommended Stack và Architecture Decision Records

| ADR | Quyết định [D] | Phương án khác / trade-off | Điều kiện xem lại |
|---|---|---|---|
| ADR01 | Babylon WebGL2 mặc định; WebGPU opt-in sau parity | Three linh hoạt nhưng cần game glue; PlayCanvas có editor; Unity/Godot hợp đội chuyên engine | Không đạt PERF ở L02/L04 sau tối ưu hợp lý hoặc artist workflow quá chậm |
| ADR02 | Rapier qua PhysicsPort, fixed step; Babylon chỉ render | Havok tích hợp ít công hơn; Rapier cần bridge transforms/debug | Havok thắng controller+headless spike hoặc Rapier integration vượt 2 person-weeks dự phòng |
| ADR03 | Vercel web/API + Supabase data + container game server | Functions WebSocket beta vẫn cần state continuity và room ownership ngoài request | Có bằng chứng dịch vụ managed đảm bảo tick/lifetime/cost của workload |
| ADR04 | Vite game SPA, React HUD; Next tùy chọn marketing/admin | Một Next app đơn giản deploy nhưng tăng ràng buộc lifecycle; hai app tăng release coordination | MVP không cần SEO/admin thì chỉ Vite shell |
| ADR05 | Local authoritative single-player và command boundary chung | Tạo server ngay tăng chi phí; client-only tùy tiện khó nâng cấp | Multiplayer trở thành yêu cầu launch thì chuyển server authority trước content |
| ADR06 | Colyseus room-owned simulation; WSS | Nakama có backend rộng nhưng chồng Supabase; WebRTC cần signaling/STUN/TURN, khó authority | Match/social requirements thay đổi hoặc head-of-line WSS không đạt test |
| ADR07 | FSM + utility + behavior tasks, không LLM ở loop | BT thuần nhiều nhánh; LLM khó bảo đảm latency/continuity | LLM chỉ thử hội thoại tùy chọn sau budget/moderation gate |
| ADR08 | Domain modular, component data rõ; chưa generic ECS framework | ECS đầy đủ có lợi số entity lớn nhưng tăng authoring/tooling cost | CPU profiling chứng minh iteration/layout là bottleneck |

## Backlog kiểm chứng nghiên cứu

T00-01 khóa package/tool versions và license; T00-02 renderer cùng fidelity; T00-03 controller/navmesh headless; T00-04 giới hạn cloud và đo save tải; T00-05 export Blender, compression và cold load. Không có access account nên chưa xác minh region/plan/egress thực tế. Nguồn còn thiếu rõ ràng: exporter Blender, binding navigation, compatibility trên GPU mục tiêu, báo giá license asset, telemetry SDK và synthetic load framework. Phần 07 quy định cách đóng các mục này trước khi phê duyệt foundation.
