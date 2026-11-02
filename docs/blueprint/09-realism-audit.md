# 09 — Audit độ đầy đủ mô phỏng đời sống giam giữ

**CR-VN-01 / thiết kế 1.2:** [13](13-vietnam-custody-audit.md) cập nhật audit trên repository đã có code và nguồn Việt Nam; nhận định workspace chỉ có tài liệu bên dưới thuộc lần bàn giao cũ.

Revision 1.1, ngày kiểm tra nguồn 02/11/2026. Đọc cùng [gameplay bổ sung](10-prison-life-systems.md), [dữ liệu/UI bổ sung](11-prison-life-contracts.md) và [kế hoạch tích hợp/nghiệm thu](12-realism-delivery.md). Đây là audit **thiết kế**, không audit một game chạy được: workspace hiện chỉ có tài liệu.

## Kết luận kiểm tra bản 1.0

**Chưa đủ để gọi là mô phỏng đầy đủ đời sống trong tù.** Bản 1.0 có nền tảng runtime và vòng lặp xã hội, nhưng chủ yếu mô tả ăn/ngủ/tập/học/quan hệ. Các chức năng như thăm gặp, y tế, tiếp nhận và lao động xuất hiện ở level hoặc ý tưởng quest, chưa có đầy đủ vòng đời nghiệp vụ. Có tên phòng y tế không đồng nghĩa đã thiết kế chăm sóc; có inventory không đồng nghĩa có tài sản ký gửi; có reputation không thay quy trình xem xét vi phạm.

Không có mẫu số kiểm chứng cho “100% thực tế toàn thế giới”. Khác biệt pháp luật, người đang chờ xét xử/người thi hành án, cơ sở, giới, tuổi, điều kiện sức khỏe và thời kỳ khiến một tập luật không đại diện tất cả. Tài liệu quốc tế về đối xử không phải báo cáo rằng mọi cơ sở đang thực hiện đúng. Hướng dẫn chính phủ mô tả một jurisdiction cũng không phải dữ liệu trải nghiệm của mọi người.

Đích thay thế có thể nghiệm thu: **100% yêu cầu nằm trong baseline được chọn có ID, luồng chính/phụ, trạng thái, dữ liệu, UI, dependency, test và trạng thái triển khai rõ**. Đây là coverage tài liệu, hoàn toàn tách khỏi phần trăm code hoàn thành, phần trăm test pass và mức độ xác thực qua nghiên cứu người dùng. Không gán một phần trăm hiện thực giả chỉ từ số dòng tài liệu.

## Nghiên cứu đối chiếu — nguồn và giới hạn

Nguồn dưới phục vụ nhận diện mảng đời sống còn thiếu. Các thông số và luật game trong phần10–12 đều **[D] thiết kế hư cấu**, không suy diễn thành quy định thật. Không sao chép mức phạt, thời hạn ra tù hoặc định mức thăm gặp từ một nước vào game mặc định.

| Ref | Nguồn chính thức / phiên bản | Điều đã xác minh qua truy cập | Giới hạn sử dụng |
|---|---|---|---|
| RFS01 | [UN Mandate Registry: A/RES/70/175](https://mandates.un.org/mandate/A/RES/70/175), nghị quyết2015 | Registry xác nhận văn bản Nelson Mandela Rules và có liên kết văn bản nguồn | Trang registry beta; URL PDF UNODC thử trả404, docs.un.org trả403; chưa tuyên bố đã xác minh toàn bộ annex/rule-by-rule |
| RFS02 | [UN Mandate Registry: A/RES/65/229](https://mandates.un.org/mandate/A/RES/65/229?end_year=2010&start_year=2010),2010 | Xác nhận Bangkok Rules, đối tượng phụ nữ và nhu cầu liên quan gia đình/chăm sóc trong nội dung trích xuất | Fulltext extraction tự cảnh báo có thể thiếu; PDF/annex chưa đối chiếu bản gốc, không trích số rule chưa kiểm |
| RFS03 | [GOV.UK: Arriving at prison](https://www.gov.uk/life-in-prison), rolling | Có phỏng vấn/đánh giá ban đầu, hướng dẫn quyền/nội quy, ghi nhận và bảo quản tài sản | Một ví dụ jurisdiction, không quy trình phổ quát |
| RFS04 | [GOV.UK: Privileges and rights](https://www.gov.uk/life-in-prison/prisoner-privileges-and-rights), rolling | Phân biệt quyền, ưu đãi và xử lý vi phạm; quyền liên hệ luật sư/chăm sóc và bảo vệ khỏi bắt nạt | Không chuyển các mức phạt/định mức của trang thành luật gameplay |
| RFS05 | [GOV.UK: Healthcare](https://www.gov.uk/life-in-prison/healthcare-in-prison), rolling | Mô tả healthcare team, hỗ trợ chuyên biệt và chuyển điều trị ngoài cơ sở khi cần | Không dùng làm chẩn đoán/phác đồ game hoặc hướng dẫn y tế cho người thật |
| RFS06 | [GOV.UK: Vulnerable prisoners](https://www.gov.uk/life-in-prison/vulnerable-prisoners), rolling | Có hỗ trợ từ chuyên môn/case manager và peer listeners | Không coi mọi người có mood thấp là có bệnh; không mô phỏng phương thức tự gây hại |
| RFS07 | [GOV.UK: Pregnancy and childcare](https://www.gov.uk/life-in-prison/pregnancy-and-childcare-in-prison), rolling | Nhu cầu thai sản, trẻ phụ thuộc, quyết định hỗ trợ và bố trí có thể khác nhau | Dùng để nhận diện nhu cầu, không sao chép age limit/custody procedure vào fiction |
| RFS08 | [GOV.UK: Education and work](https://www.gov.uk/life-in-prison/education-and-work-in-prison), rolling | Có kế hoạch học, đào tạo và công việc trong cơ sở | Skill XP không tương đương bằng cấp ngoài đời; không khẳng định việc/thu nhập có ở mọi nơi |
| RFS09 | [GOV.UK: Letters/video/telephone](https://www.gov.uk/staying-in-touch-with-someone-in-prison/letters-and-telephone-calls), rolling | Có nhiều kênh liên lạc; thư thường và liên lạc pháp lý có cách đối xử khác | Không hứa tính bảo mật pháp lý giống nhau toàn cầu; thời lượng/quota game phải ghi là hư cấu |
| RFS10 | [GOV.UK: Visiting](https://www.gov.uk/staying-in-touch-with-someone-in-prison/visiting-someone-in-prison), rolling | Visit list/booking và hướng dẫn riêng từng cơ sở | Không suy ra một lịch chung cho mọi prison hoặc mọi legal status |
| RFS11 | [GOV.UK: Sending money](https://www.gov.uk/staying-in-touch-with-someone-in-prison/sending-money), rolling | Có tài khoản nhận/gửi tiền theo cơ chế được mô tả tại đó | Game chỉ dùng currency giả; không tích hợp gửi tiền/địa chỉ cơ sở thật |
| RFS12 | [GOV.UK: Banned items](https://www.gov.uk/staying-in-touch-with-someone-in-prison/banned-items), rolling | Vật phẩm được phép bị giới hạn theo quy tắc | Không biến thành hướng dẫn giấu, chế tạo hoặc vận chuyển đồ cấm |
| RFS13 | [GOV.UK: Before leaving prison](https://www.gov.uk/leaving-prison/before-someone-leaves-prison), rolling | Chuẩn bị ra ngoài gồm nơi ở, công việc và quản lý tài chính | Tài liệu game không tự tính ngày tha từ một công thức luật chưa xác minh |

**Khoảng trống nghiên cứu vẫn còn:** văn bản pháp luật Việt Nam/current jurisdiction chưa được chọn; chưa có interviews được đồng thuận với người có trải nghiệm giam giữ, thân nhân, nhân viên/cố vấn hay specialist reviewer; chưa có dữ liệu vận hành của cơ sở đại diện. Không lấy diễn đàn/tin giật gân làm bằng chứng phổ quát. Task T10-01 quy định nghiên cứu bổ sung này. Hồ sơ không tự nhận “chuẩn nhà tù Việt Nam”.

## Baseline mô phỏng và policy profile

Baseline mặc định `fictional_adult_rehabilitation_v1`: nhân vật người trưởng thành đã có tình trạng thi hành án hư cấu; cơ sở hư cấu tập trung sinh hoạt và hỗ trợ. Có profile dữ liệu phân biệt `sentenced`, `remand`, `transfer_pending`, `release_preparation`; profile remand cần nội dung riêng, không gán kết tội cho người chưa xét xử. MVP giữ profile sentenced đơn giản; Full Life Specification thêm các luồng của phần10. Không trộn profile law một cách âm thầm giữa session.

Policy profile phải có `id`, `version`, `jurisdictionLabel`, `fictional`, `legalStatusSupport`, `adultOnly`, `rightsFloor`, `dailyWindows`, `allowedItems`, `serviceWindows`, `reviewProcess`, `contactRules`, `workStudyRules`, `releaseStoryRules`, `sourceRefs`, `reviewedAt`, `reviewStatus`, `reviewerRole`. Publisher kiểm references và invariants, save pin profile version/hash. Đổi profile là migration/fork có preview khác biệt, không làm thay luật của phiên đang chơi. Chưa có review jurisdiction thì UI ghi **“Mô hình hư cấu”**.

`rightsFloor` trong game: nước/đồ ăn cơ bản, vệ sinh thiết yếu, liên hệ hỗ trợ, chăm sóc thiết yếu và khả năng gửi kiến nghị không được khóa bởi uy tín, tiền, level, kỷ luật hoặc setting accessibility. Đây là invariant thiết kế, không tuyên bố toàn bộ pháp luật thế giới có cùng cơ chế bảo đảm.

Ba mức mô phỏng: **Interactive** (người chơi thao tác và có hệ quả), **Abstracted** (diễn giải + state transition + tùy chọn bỏ qua thời gian), **Referenced** (handbook/narrative, không có subsystem). Một mảng chỉ Referenced không được ghi “implemented đầy đủ”. Những trải nghiệm khó chịu có thể được nhắc/giải quyết bằng hỗ trợ, không cần ép người chơi chịu đựng để chứng minh độ chân thực.

## Ma trận gap — đối chiếu bản1.0 và bổ sung1.1

| Gap | Mảng đời sống / thiếu sót trước đây | Đặc tả mới hoặc mở rộng | Mức đích |
|---|---|---|---|
| GAP01 |Tiếp nhận có intro, thiếu hồ sơ và legal status |F33 admission + policy pin |Interactive |
| GAP02 |Chưa có ký gửi/biên nhận/trả tài sản |F34 property custody |Interactive |
| GAP03 |Chưa phân phòng/theo nhu cầu/case review |F35 housing placement |Interactive |
| GAP04 |Nội quy chỉ là tooltip, thiếu quyền và xác nhận hiểu |F36 orientation/rights |Interactive |
| GAP05 |Lịch có hoạt động nhưng thiếu điểm danh, chờ, đêm |F37 roll call/night/routine |Abstracted + participation |
| GAP06 |Inventory không có tài khoản/earn/spend ledger |F38 fictional account |Interactive |
| GAP07 |Chưa có cửa hàng/đặt hàng/hoàn trả |F39 commissary |Interactive |
| GAP08 |Thư có ở story, thiếu gửi/nhận/trạng thái |F40 correspondence |Interactive authored |
| GAP09 |Chưa có phone/video scheduling |F41 contacts/calls |Interactive authored |
| GAP10 |L12 có phòng nhưng thiếu booking/cancel/missed visit |F42 visits |Interactive |
| GAP11 |Chưa có liên hệ pháp lý/riêng tư/procedural info |F43 legal access |Abstracted casework |
| GAP12 |Chưa có đơn yêu cầu/kiến nghị/khiếu nại/review |F44 service requests |Interactive |
| GAP13 |Y tế chỉ hồi mood/energy, thiếu care workflow |F45 care appointments |Abstracted care |
| GAP14 |Mood không thay được hỗ trợ tâm lý/đồng đẳng |F46 wellbeing/support |Interactive choice, abstracted care |
| GAP15 |Học chỉ XP, thiếu enrollment/attendance/completion |F47 education plan |Interactive |
| GAP16 |Lao động chưa có ca/phân công/nghỉ/credit outcome |F48 work assignments |Interactive |
| GAP17 |Vệ sinh có action nhưng thiếu cấp phát/vật tư/đồ vải/cắt tóc |F49 supplies/laundry/grooming |Interactive + optional abstraction |
| GAP18 |Thiếu uống nước/toilet/dietary preferences |F50 hydration/privacy/diet |Interactive nhẹ + abstraction |
| GAP19 |Chưa có tín ngưỡng/ngôn ngữ/ngày lễ/văn hóa |F51 cultural/spiritual access |Interactive optional |
| GAP20 |Reputation không phải record vi phạm/quyết định/kháng nghị |F52 fair discipline |Abstracted adjudication |
| GAP21 |World changes chưa có kiểm kê/kiểm tra đồ vật có biên nhận |F53 inspection/property review |Abstracted, no evasion mechanics |
| GAP22 |Conflict chỉ thoại ngắn, chưa hỗ trợ người bị bắt nạt |F54 social boundaries/safeguarding |Interactive non-graphic |
| GAP23 |Chưa có báo hỏng/mất tiện ích/diễn tập/an toàn |F55 maintenance/emergency response |Abstracted + simple cooperative actions |
| GAP24 |Chưa chuyển khu/chuyển cơ sở giữ dữ liệu |F56 transfers |Interactive packing + abstraction |
| GAP25 |Chưa có kế hoạch chuẩn bị rời cơ sở/end state |F57 release/reintegration |Interactive checklist + authored ending |
| GAP26 |Accessibility chủ yếu UI, chưa accommodation trong mô phỏng |F58 individual accommodation |Interactive + policy invariant |
| GAP27 |Chưa có gia đình/người phụ thuộc/nhu cầu riêng dài hạn |F59 family/care planning |Abstracted, specialist review |
| GAP28 |NPC một loại schedule, thiếu vai trò nhân viên/availability/case ownership |F60 staff/services model |Simulated availability |

Mảng đã có ở bản1.0 và giữ: F04 movement, F05 interaction, F06 dialogue, F08 relations, F09 groups, F10 events, F11/12 items, F18/19 saves, F20 accessibility UI, F21 day/night, F22–25 basic needs, F26 NPC AI, F27 sound/weather, F29 recreation, F30 map, F32 MP. Những tính năng mới phải sử dụng các hệ này, không tạo clock/reward/inventory thứ hai.

## Những mặt thực tế không được bỏ qua nhưng cần cách biểu diễn riêng

| Chủ đề | Cách phản ánh trong game | Giới hạn/điều kiện |
|---|---|---|
| Buồn chán, chờ, thiếu riêng tư, xa người thân |Lựa chọn hoạt động tĩnh, thư/call bị đổi lịch, room boundaries, recap cảm xúc |Không ép đợi hàng giờ thật, có skip/assist; source qualitative review còn cần |
| Thiếu nhân sự, đông người, dịch vụ gián đoạn |Capacity/queue/service hours với fallback và giải thích |Không tăng skinned NPC vô hạn; không trình bày mọi prison đều như nhau |
| Phân biệt đối xử/đối xử thiếu công bằng |Authored story tùy chọn, quyền yêu cầu review, cơ chế hỗ trợ, consent và skip |Không thưởng lạm dụng hoặc biến stereotype thành AI heuristic |
| Bạo lực, cưỡng ép, đồ cấm, nợ và mất an toàn |Narrative cảnh báo không đồ họa, tìm hỗ trợ/đặt ranh giới/mediation, ghi nhận sự kiện |Không hệ chế tạo/giấu đồ/điểm yếu an ninh; combat không phải điều kiện Full Life baseline |
| Tự gây hại, khủng hoảng hoặc tử vong |Hỗ trợ chuyên môn/narrative off-screen có review, bỏ qua chủ đề |Không phương thức, không scoring, không health diagnosis qua mood; không tự thêm hotline thật trong fiction |
| Thai sản, trẻ em, người cao tuổi, khuyết tật |Individual accommodations, family care và dịch vụ phù hợp; trẻ không playable inmate |Nội dung chuyên biệt phải specialist review; chưa mở rộng detention trẻ vị thành niên |
| Thủ tục pháp lý, mức án, tha có điều kiện |Hồ sơ và mốc hư cấu, thông tin dịch vụ, eligibility authored |Không tự tính kết quả luật thật; không gắn “ngoan = chắc được tha” |
| Môi trường cơ sở thật |Không gian/capacity/role có tính thuyết phục |Không copy layout, lịch tuần tra, cơ chế khóa hoặc điểm mù cơ sở thật |

Đây là disposition có ghi rõ cho các chủ đề thực tế, không tuyên bố đã có implementation. Không cần mô phỏng gây hại chi tiết để có game sống động.

## Phương pháp xác minh độ chân thực tiếp theo

T10-01 lập source register theo jurisdiction và loại cơ sở; mỗi claim phải phân loại normative rule / official procedure / lived experience / game abstraction. Người review ít nhất bao phủ góc nhìn người từng bị giam giữ, thân nhân và nhân viên/chuyên gia độc lập nếu có điều kiện, tự nguyện và có thù lao phù hợp; không thu hồ sơ cá nhân/tội danh thật. Ghi điểm bất đồng thay vì ép thành một “sự thật nhà tù”. Không phỏng vấn người đang bị giam qua kênh trái phép hoặc thu thông tin vận hành nhạy cảm.

Review theo scenario cụ thể: ngày đầu, bỏ lỡ bữa ăn, không có tiền, cần hỗ trợ, thư chậm, đơn không được giải quyết, vi phạm bị hiểu nhầm, thay phòng, nghỉ ốm, chuẩn bị về. Mỗi reviewer đánh dấu plausible / jurisdiction-specific / inaccurate / harmful framing / insufficient evidence. Chỉ đưa claim vào bản được công bố sau chỉnh sửa và record decision. Không có interview nào được thực hiện trong lần bổ sung tài liệu này.
