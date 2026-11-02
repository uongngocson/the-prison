import fs from 'node:fs';
import path from 'node:path';
const base='docs/blueprint/evidence/ui-existing-2026-11-02';
const c=JSON.parse(fs.readFileSync(base+'/coverage.json','utf8'));
const rows=[];
for(const m of c.manifests){for(const r of JSON.parse(fs.readFileSync(`${base}/${m.run}/results.json`,'utf8')).results)rows.push({...r,run:m.run});}
const ev=(id,device)=>{const r=rows.find(r=>r.id===id&&r.device===device&&r.evidence?.screenshot);return r?`[ảnh](evidence/ui-existing-2026-11-02/${r.run}/${r.evidence.screenshot}) · [JSON](evidence/ui-existing-2026-11-02/${r.run}/${r.evidence.details})`:'Xem case register';};
const fp='evidence/ui-existing-2026-11-02/followup-stable';
const follow=fs.existsSync(base+'/followup-stable/results.json')?JSON.parse(fs.readFileSync(base+'/followup-stable/results.json','utf8')).results:[];
const fLink=id=>{const r=follow.find(r=>r.id===id&&r.device==='phone-390');return r?`[ảnh](${fp}/${r.screenshot}) · [JSON](${fp}/results.json)`:'Chưa có kết quả follow-up';};
const md=`# 21 — Kết quả audit UI hiện có trên nhiều kích thước

Cập nhật tự động ${c.generatedAt}. Phạm vi [kế hoạch 20](20-existing-ui-test-plan.md): U01–U38 của commit **5491081cf5b3ea364c69ad7cca4e203c61b4b74a**. **Không kiểm phần lao động của tài liệu 18–19, U39–U44/F73–F84 đang được Claude phát triển.** Không sửa gameplay, source UI hoặc SQL trong đợt audit này.

## Kết quả có bằng chứng

${c.devices.length}/8 cấu hình đã hoàn tất. Tổng chính: **${c.stats.total} ca; ${c.stats.passed} pass, ${c.stats.failed} fail, ${c.stats.blocked} blocked**. Đây là kết quả assertion thô, chưa phải số lỗi ứng dụng. Ca fail vì timing/harness được phân loại bên dưới. ${c.devices.length<8?'**Đợt chạy vẫn chưa hoàn tất toàn bộ ma trận.**':'Đã chạy đủ ma trận tám cấu hình dự kiến.'}

| Cấu hình | Ca | Pass | Fail | Blocked |
|---|---:|---:|---:|---:|
${c.devices.map(d=>`| ${d.device} | ${d.total} | ${d.passed} | ${d.failed} | ${d.blocked} |`).join('\n')}

Quy tắc tổng hợp: mỗi thiết bị lấy lượt hoàn tất gần nhất có META-browser; không cộng trùng lượt retry. Các lượt partial/blocked và pilot giữ nguyên trong thư mục để điều tra. Lựa chọn run cụ thể, timestamp, hash spec và browser version có trong [coverage.json](evidence/ui-existing-2026-11-02/coverage.json). Tất cả ca chính và đường dẫn bằng chứng nằm ở [sổ bằng chứng](evidence/ui-existing-2026-11-02/README.md).

Độ phủ màn hình có evidence: **${c.screenCoverage.filter(s=>s.total).length}/38 mã UI**. Mẫu số này chỉ chứng minh mỗi mã có ít nhất một ca liên quan; không chứng minh đã thử mọi nút, mọi giá trị, mọi tổ hợp án/lịch/nhân vật hoặc mọi thiết bị.

Bằng chứng của tổng chính: **${c.evidenceCompleteness?.withScreenshot??0}/${c.stats.total} ca có ảnh, ${c.evidenceCompleteness?.withCaseJson??0}/${c.stats.total} ca có JSON chi tiết**. Nếu thiếu ảnh do screenshot timeout, danh sách nguyên nhân nằm ở evidenceCompleteness trong coverage.json; không gọi các ca đó là đã có đầy đủ ảnh.

## Lỗi đã tái hiện

Ưu tiên: P2 = cần sửa trước khi công bố hỗ trợ input/thiết bị liên quan; P3 = thiếu đường truy cập nội dung phụ. Đây là đánh giá QA cho baseline, không khẳng định source đang được Claude sửa vẫn còn lỗi.

| ID | Mức | Vấn đề và ảnh hưởng | Bằng chứng |
|---|---|---|---|
| UI-01 | P3 | Landing ở màn hẹp 390px không có đường mở modal Giới thiệu bằng nút đã có trên desktop. CSS ẩn các nút home-nav trừ nút cuối. Màn ghi công ở menu là một màn khác. | ${ev('S02-about','phone-390')} |
| UI-02 | P2 | Giao diện hẹp/ngắn của điện thoại ẩn lịch sử hội thoại; người dùng không mở lại phần thoại đã diễn ra như desktop. | ${ev('S52-dialogue','phone-390')} |
| UI-03 | P2 | ArrowRight đổi tab được chọn sang Quan hệ nhưng focus vẫn ở Nhân vật; focus bàn phím và tab đang chọn lệch nhau. | ${fLink('F02-tabs-arrow-focus')} |
| UI-04 | P2 | Quick menu khai báo modal nhưng không đưa focus vào khi mở và không giữ focus khi Tab qua nút cuối. | ${fLink('F03-quickmenu-focus')} |
| UI-05 | P2 | Cỡ chữ giao diện200% cập nhật cấu hình nhưng không tăng font tiêu đề/nhiều thành phần; trên phone cả tab/body mẫu vẫn giữ nguyên. | [JSON đo font](evidence/ui-existing-2026-11-02/text-scale/results.json) · [100%](evidence/ui-existing-2026-11-02/text-scale/phone-390-100.png) · [200%](evidence/ui-existing-2026-11-02/text-scale/phone-390-200.png) |

### UI-01: mở Giới thiệu ở màn hẹp

Tái hiện: Chrome, viewport 390×844, touch → landing → tìm nút Giới thiệu. Kỳ vọng có nút hoặc đường truy cập thay thế rõ ràng tới modal; thực tế nút không hiển thị/click được. Desktop cùng baseline mở được. Đối chiếu [Shell.tsx](../../src/ui/screens/Shell.tsx) và [styles.css](../../src/ui/styles.css): home-nav button:not(:last-child) bị display:none trong media query màn hẹp. Đề xuất đưa mục vào menu phụ hoặc giữ nút co gọn; nghiệm thu bằng cùng S02 trên 360/390 và desktop.

### UI-02: lịch sử hội thoại trên touch

Tái hiện: đã tiếp nhận → trò chuyện NPC → chọn một câu trả lời → mở lịch sử trong hộp thoại. Kỳ vọng xem được các lượt thoại; thực tế summary tồn tại nhưng bị CSS ẩn. [Hud.tsx](../../src/ui/screens/Hud.tsx) tạo details.dlg-hist, [styles.css](../../src/ui/styles.css) ẩn dlg-hist trong media query max-width640px hoặc max-height500px. Tablet dọc rộng hơn không thuộc cùng điều kiện. Đề xuất nút lịch sử gọn hoặc panel con có cuộn, không che lựa chọn. Nghiệm thu lịch sử mở/đóng, đọc được và không áp effect hội thoại lần nữa.

### UI-03: focus khi chuyển tab

Tái hiện độc lập trong follow-up: mở Hồ sơ → focus Nhân vật → ArrowRight. JSON ghi active=Nhân vật, selected=Quan hệ. Đề xuất trong [components.tsx](../../src/ui/components.tsx) chuyển cả focus và selection, dùng roving tabindex; kiểm ArrowLeft/Right/Home/End, Tab rời tablist và Shift+Tab quay lại. Đây là kiểm mẫu bàn phím, chưa thay audit NVDA.

### UI-04: focus trong quick menu

Tái hiện độc lập: mở quick menu → kiểm activeElement → focus nút cuối → Tab. Cả focusOnOpen và focusAfterTab đều false trong bằng chứng phone390. [MobileHud.tsx](../../src/ui/screens/MobileHud.tsx) có role=dialog/aria-modal nhưng không dùng cơ chế focus của Panel. Đề xuất dùng chung focus manager: focus đầu khi mở, Tab/Shift+Tab vòng trong modal, Escape đóng, trả focus về nút Menu. Cần nghiệm thu thêm với bàn phím Bluetooth trên thiết bị thật.

### UI-05: chữ giao diện không tăng đầy đủ

Tái hiện không cần vào game3D: mở Cài đặt → Trợ năng & lối chơi → đặt Cỡ chữ giao diện từ1 thành2. Ca độc lập [ui-text-scale.spec.mjs](../../tests/e2e/ui-text-scale.spec.mjs) đo computed font trước/sau và chụp ảnh. Phone390: tiêu đề17→17px, tab13→13px, body14→14px, dù CSS --ts=2. Phone ngang có cùng kết quả. Desktop: body/tab tăng16→32px nhưng tiêu đề22→22px, nút mẫu14→14px. Đề xuất thay các cỡ chữ cố định bằng token có nhân textScale/rem phù hợp; kiểm cuộn/tràn và nút đóng vẫn dùng được ở200%. Ca S45 trong suite chính chỉ kiểm thay cấu hình/contrast/motion, nên pass S45 không phủ lỗi đo font này.

Các liên kết source ở trên trỏ working tree để tiện sửa; căn cứ điều tra là snapshot commit được pin, do source hiện tại đang đổi trong quá trình Claude làm labour.

## Các fail chưa được kết luận là lỗi game

| Nhóm | Phân loại và xử lý |
|---|---|
| Khởi tạo desktop timeout ban đầu | Harness chờ 4,5 giây quá ngắn cho module/WebGL cold start. Đã tăng timeout setup và chạy retry; không dùng DEVICE-SETUP để kết luận UI hỏng. |
| Xuất file timeout/unhandled download promise | Harness từng tạo promise download có timeout mặc định ngắn và chỉ await sau click. Đã đổi Promise.all với timeout30 giây, giữ run bị dừng riêng. |
| S50b đọc state null/lúc loading | Oracle cũ chỉ chờ view được tạo, chưa chờ boot xong. Ca F01-valid-import-ready đã chờ screen=game, có session/view và booting=false; kiểm lại file hợp lệ có episode admitted và số dư được phục hồi. ${fLink('F01-valid-import-ready')} |
| S54 panel sau reload | Oracle cũ chờ view xuất hiện rồi đợi cố định650ms; view có trước lúc hoàn tất warm stage/restore UI. Một ca fail không đủ khẳng định mất state. Cần kiểm lại khi bootstrap hoàn tất và so sánh state/UI/camera; tham khảo thêm regression resume đã có, không đánh dấu toàn bộ persistence pass từ ảnh. |
| Chuỗi S57→S60 ở lượt trước | Fixture loading cũ giữ renderer cũ chạy trong khi luồng boot thật gọi teardown trước. Đã sửa fixture teardown và chạy lại; không dùng lỗi dây chuyền trong fixture cũ làm lỗi sản phẩm. |
| S66 gamepad | Main suite có kết quả dao động với giữ/phát nút giả lập. F04 kiểm lại giữ Start đã có lượt pass. Chưa chứng nhận tay cầm vật lý hoặc kết luận lỗi gamepad phổ quát. |
| Timeout click/fill hoặc fail khác | Giữ lỗi nguyên văn ở results và ảnh; chỉ nâng thành lỗi ứng dụng khi tái hiện được độc lập với readiness/timing. Không tự đổi toàn bộ fail thành pass. |

## Những gì đã thử và chưa chứng minh

Đã thao tác tạo nhân vật/chọn preset án/tiếp nhận; movement bàn phím hoặc CDP touch; mở panel, dùng/chuyển đồ, profile/quest/map/lịch/help; thư/đặt-hủy gọi/cửa hàng/yêu cầu/học tập/hỗ trợ; cài đặt/remap/200% text; save/load/export/import/reload; hội thoại/ngủ; hồ sơ/lịch/quyết định giam giữ. Mỗi case ghi method để tách user-flow với mở panel bằng fixture, seed dữ liệu và trạng thái tổng hợp. Loading lỗi, recovery, ending và lệnh giam giữ tổng hợp không chứng minh đã xảy ra các sự kiện ấy trong một hành trình chơi thật.

Tám cấu hình là Chrome/Edge cài trên Windows, viewport/touch/DPR giả lập; WebGL2 chạy SwiftShader với profile thấp được chọn qua UI. **Chưa có bằng chứng trên điện thoại/tablet thật, Safari/iOS/WebKit, Firefox, bàn phím ảo/IME, safe-area phần cứng, gamepad thật, NVDA, fullscreen thiết bị thật hoặc hiệu năng GPU thực.** Không dùng lượt này làm benchmark FPS hay chứng nhận WCAG.

Cloud auth/magic link/Supabase save CAS chưa kiểm với dịch vụ thật vì snapshot không có cấu hình và mọi request ngoài localhost bị chặn. Multiplayer U24 chỉ kiểm trạng thái chưa mở, không phải chơi cùng user khác. Chưa thử tất cả ảnh hưởng của từng mức án/độ dài án qua nhiều ngày, tất cả dialogue branch, mọi nhiệm vụ, cắt điện/browser crash, xóa save thật, mọi phương án thăm gặp/chăm sóc/điều chuyển hoặc hoàn tất journey thật tới ending.

## Bộ bàn giao và chạy lại

- [Spec chính](../../tests/e2e/ui-existing.spec.mjs), [spec follow-up](../../tests/e2e/ui-followup.spec.mjs).
- [Sổ ca và ảnh](evidence/ui-existing-2026-11-02/README.md), [kết quả tổng hợp](evidence/ui-existing-2026-11-02/coverage.json), [checksum file](evidence/ui-existing-2026-11-02/sha256.json).
- Mỗi run/thiết bị có PNG, JSON từng ca, trace.zip và log browser/console/network; panel dài có ảnh cuối vùng cuộn. File export chỉ là dữ liệu nhân vật test tổng hợp.
- Công cụ dựng sổ: [report-existing-ui.mjs](../../tests/e2e/report-existing-ui.mjs). Dựng ảnh tổng quan: [ui-contact-sheets.py](../../tests/e2e/ui-contact-sheets.py); PNG gốc là bằng chứng chi tiết, thumbnail chỉ để rà bố cục.

Chỉ có thể chốt đạt sau khi sửa lỗi đã xác nhận, chạy lại các ca bị ảnh hưởng, xử lý fail chưa phân loại và bổ sung các môi trường còn thiếu nếu sản phẩm cam kết hỗ trợ. Đợt này không ghi nhận sản phẩm đạt “100% mọi UI trên mọi thiết bị”.
`;
fs.writeFileSync('docs/blueprint/21-existing-ui-audit-results.md',md.replaceAll('\\`','`'));
console.log('Wrote audit report');
