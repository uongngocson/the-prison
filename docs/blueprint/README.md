# MASTER DEVELOPMENT BLUEPRINT

**REALISTIC 3D PRISON LIFE SIMULATOR — WEB EDITION**  
Bản 1.1 — 02/11/2026, Asia/Saigon — tài liệu thiết kế, chưa triển khai game.

## Cách đọc và trạng thái bàn giao

Bộ hồ sơ này là đề xuất thiết kế có thể chuyển thành backlog. Không chứa code game, migration thực thi, benchmark tự nhận hoặc cam kết hiệu năng. Quyết định engine là **có điều kiện**, phải qua Phase 0. Chỉ các khả năng có liên kết nguồn chính thức được coi là đã nghiên cứu; mọi con số gameplay, ngân sách và tải là giả định thiết kế. Chưa có phần cứng thử nghiệm, asset thực, báo giá nhân sự hoặc tài khoản cloud để xác nhận.

**Đọc bản mở rộng1.1 trước khi đánh giá độ đầy đủ đời sống:** [09 — audit thiếu sót](09-realism-audit.md) → [10 — 28 hệ thống bổ sung](10-prison-life-systems.md) → [11 — hợp đồng dữ liệu/UI/runtime](11-prison-life-contracts.md) → [12 — tích hợp, QA, effort và nghiệm thu](12-realism-delivery.md). Bản1.0 chưa bao phủ đủ hành trình giam giữ; bản1.1 mở baseline thành60 features,35 màn hình,18 không gian và44 bảng logical. Đây là độ phủ **đặc tả**, chưa phải game đã đáp ứng hoặc “100% mọi thực tế”.

| Phần | Nội dung | Người đọc chính |
|---|---|---|
| [01 — Nghiên cứu và quyết định](01-research.md) | Nguồn, phiên bản, ma trận công nghệ, ADR | Tech lead, product |
| [02 — Kiến trúc và runtime](02-architecture.md) | TDD, rendering, physics, animation, AI, networking | Kỹ sư |
| [03 — Thế giới và asset](03-world-assets.md) | GDD không gian, level, quy chuẩn sản xuất | Design, art |
| [04 — Gameplay](04-gameplay.md) | Đặc tả tính năng, luật, dữ liệu, nghiệm thu | Design, gameplay, QA |
| [05 — UI/UX](05-ui-ux.md) | Design system, màn hình, wireframe | UI/UX, frontend |
| [06 — Dữ liệu, API, bảo mật](06-data-api-security.md) | Schema, RLS, API, vận hành dữ liệu | Backend, security |
| [07 — Delivery và QA](07-delivery-qa.md) | Performance, kiểm thử, hạ tầng, WBS, chi phí, rủi ro | Producer, QA, DevOps |
| [08 — Truy vết và rà soát](08-traceability.md) | RTM, release checklist, thuật ngữ, câu hỏi mở | Toàn đội |
| [09 — Audit hiện thực và thiếu sót](09-realism-audit.md) | Nguồn đời sống,28 gaps,policy profile,giới hạn độ chân thực | Product, research, design |
| [10 — Full Life systems](10-prison-life-systems.md) | F33–60,tiếp nhận/tài sản/liên hệ/dịch vụ/care/học/vi phạm/chuyển/ra | Design, gameplay, QA |
| [11 — Full Life contracts](11-prison-life-contracts.md) | DB28–44,API09–13,U26–35,save v2/runtime/privacy | Backend, client, UI |
| [12 — Full Life delivery](12-realism-delivery.md) | WBS delta,QA17–24,scenario pack,RTM và Gate L | Producer, QA, toàn đội |

## Executive Summary

Xây dựng một game mô phỏng xã hội trong nhà tù **hư cấu**, góc nhìn thứ ba, ưu tiên desktop browser và single-player. Trải nghiệm chủ đạo: làm quen lịch sinh hoạt, chọn hoạt động, xây quan hệ và hoàn thành những mục tiêu cá nhân có ý nghĩa. Tính chân thực đến từ không gian, animation, âm thanh và phản ứng nhất quán; không dựa vào phạt đói, bạo lực bắt buộc hoặc tái tạo điểm yếu an ninh thật.

Đề xuất Babylon.js + TypeScript + Vite cho client, React cho UI, Rapier WASM sau adapter cho physics, Supabase cho Auth/PostgreSQL/Storage và Vercel cho web/client/API ngắn. Multiplayer tương lai dùng Colyseus trên container lâu dài, giữ quyền quyết định game state ở server. Babylon + Havok là phương án thay thế phải thử đối chứng; không chạy hai physics engine cùng lúc.

Ưu tiên chất lượng một khu chơi 20–30 phút trước khi xây toàn bộ nhà tù. Vertical slice gồm phòng giam, hành lang, sân, nhà ăn; 12 NPC, một ngày rút gọn và ba nhiệm vụ. MVP bổ sung thư viện, vệ sinh, 24 NPC mô phỏng, 10 nhiệm vụ và cloud save tùy chọn. Full release cơ sở1.0 đề xuất14 khu,60 NPC danh tính,30 nhiệm vụ. **Full Life1.1** thêm4 không gian dịch vụ và28 hệ thống đời sống, giữ60 NPC danh tính tổng/30 quest để tái sử dụng nội dung có chủ đích. Effort SP base103–170PW trở thành150–248PW trước reserve; không sử dụng ngân sách cũ như estimate toàn bản mở rộng. Chi tiết phần12; chưa là cam kết nội dung/hiệu năng/lịch phát hành.

## Product Vision

Ba trụ cột: **nếp sống có thể hiểu**, **quan hệ có trí nhớ**, **không gian có cảm giác hiện diện**. Một lựa chọn như giúp sắp sách phải tác động tới kỹ năng, lịch và quan hệ; NPC nhớ việc giúp đỡ, nhưng không biết sự kiện ngoài tầm quan sát. Mỗi ngày cho ít nhất hai lựa chọn tự nguyện và một nhịp nghỉ; người chơi có thể bỏ một hoạt động mà không mắc vòng thua kéo dài.

Vòng lặp: quan sát lịch → chọn mục tiêu → đi tới khu → tương tác/đối thoại → nhận phản hồi → nghỉ và lưu → mở lựa chọn ngày sau. Không đưa combat, vượt ngục, nền kinh tế tiền thật, UGC, voice chat hoặc LLM bắt buộc vào MVP. Các hệ thống này không cần cho ba trụ cột và làm tăng tải nội dung, moderation, animation và bảo mật.

## Project Goals & Constraints

| ID | Mục tiêu/giới hạn | Cách quyết định |
|---|---|---|
| G01 | Chất lượng hình ảnh thuyết phục ở không gian nhỏ | Art review + camera route chuẩn; không dùng nhãn AAA như tiêu chí pass |
| G02 | Điều khiển mượt, tương tác đáng tin | PERF01–04 và QA03 trong phần 07 |
| G03 | NPC có lịch, trí nhớ, phản hồi | F06/F08/F09/F26; test seed, trace quyết định |
| G04 | Tiến trình không mất, không ghi đè âm thầm | F18/F19, API save CAS và restore drill |
| G05 | Có đường nâng cấp multiplayer | Domain không phụ thuộc renderer; input command và server tick ngay từ đầu |
| G06 | Ưu tiên Supabase + Vercel trong vai trò phù hợp | ADR03, tách simulation khỏi database realtime |
| G07 | Phạm vi phù hợp nhân lực | Gate từng phase, ngân sách theo person-week, cắt scope trước tăng effect |
| G08 | Trải nghiệm tôn trọng người chơi | Subtitle, remap, giảm chuyển động, điều chỉnh nhu cầu; fiction review |

Đích hỗ trợ ban đầu: Windows/macOS desktop, bàn phím + chuột, WebGL2 và WASM, viewport tối thiểu 1280×720. Chrome/Edge/Firefox/Safari phải thử bản stable tại lúc phát hành và một bản trước trong khả năng cài được; không giả định mọi GPU hỗ trợ WebGPU. Mobile/tablet chỉ trang giới thiệu, tài khoản và thông báo yêu cầu thiết bị, chưa cam kết gameplay. Không có benchmark trong hồ sơ này.

## Mục lục thống nhất theo 37 hạng mục yêu cầu

| # | Hạng mục | Nơi đặc tả |
|---|---|---|
| 1–4 | Executive Summary; Product Vision; Goals & Constraints; Research Methodology | README; 01 |
| 5–8 | Technology Matrix; Stack; High-level Architecture; Detailed Architecture | 01; 02 |
| 9–10 | GDD; TDD | README + 03 + 04; 02 + 06 |
| 11–15 | World; Character; AI; Gameplay; UI/UX | 03; 02; 02; 04; 05 |
| 16–18 | Graphics; Physics; Asset Pipeline | 02; 02; 03 |
| 19–22 | Database; API; Multiplayer; Security | 06; 06; 02; 06 |
| 23–25 | Performance; QA; Deployment | 07 |
| 26–30 | Roadmap; WBS; Cost; Risks; Acceptance | 07 + 08 |
| 31–34 | MVP; Vertical Slice; Release Checklist; Future | 04 + 07 + 08 |
| 35–37 | References; Glossary; Assumptions & Open Questions | 01; 08; README + 08 |
| Bổ sung1.1 | Realism audit; lifecycle GDD/TDD; data/API/UI; QA/WBS/RTM mở rộng | 09–12, L15–18 tại03 |

Tài liệu chi tiết dùng ID F (feature), U (screen), L (level), T (task), QA (test), R (risk), ADR (quyết định). Các trường đặc tả chung được kế thừa có nêu rõ, giúp QA đọc một quy tắc nhất quán thay vì lặp lại khác nhau.
