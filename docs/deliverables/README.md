# Bàn giao CR-LAB-01 — khu lao động và học nghề

Ngày 02/11/2026. Tài liệu thiết kế 1.3, không phải bản cập nhật gameplay.

- [Bản Word — Labour-Rehabilitation-BA-1.3.docx](Labour-Rehabilitation-BA-1.3.docx)
- [Bản PDF xem trước — 27 trang](Labour-Rehabilitation-BA-1.3.pdf)
- [Đặc tả BA nguồn](../blueprint/18-labour-rehabilitation-spec.md)
- [UI/art direction và sáu concept](../blueprint/19-labour-ui-art-direction.md)
- [Trang tổng hợp sáu mockup đã xuất qua Word](previews/gallery-review.png)
- [Manifest phiên bản và checksum](Labour-Rehabilitation-BA-1.3.manifest.json)

## Phạm vi

20 nhóm công việc W01–20; bốn nghề chính rau/cá/vườn/mộc; 12 features F73–84; sáu screen contracts U39–44; sáu không gian L23–28 và nâng cấp L10; DB51–58/API18–20; T12-01–08; QA33–38/LAB-SC01–20. Phân biệt học nghề, sản xuất và phục vụ sinh hoạt chung; quy trình từ phân công/nhận dụng cụ đến kiểm nhận/bàn giao/tổng kết, cùng quyền di chuyển và save/resume.

## Kiểm tra thực hiện

- DOCX mở được bằng Microsoft Word ở chế độ ẩn, repaginate và xuất PDF thành công; bản cuối 27 trang, 21 bảng, sáu ảnh được nhúng (ảnh bìa tái sử dụng ảnh vườn).
- Kiểm ZIP CRC, parse các XML trong DOCX và đọc lại bằng python-docx; heading, table header lặp, hyperlinks, alt text và số trang có trong cấu trúc.
- Kiểm chuỗi ID mới, link file nội bộ, fences và encoding Việt; không phát hiện lỗi ở lần kiểm cuối.
- Đã xem sáu PNG gốc, mẫu trang nội dung PDF và gallery sáu trang ngang. Đã sửa hiện tượng caption tràn sang trang riêng trước bản cuối.
- Quét bounding boxes chữ trên tất cả 27 trang PDF: không có text span ngoài biên trang; không trang gần rỗng. Đây là kiểm tra layout, không khẳng định đã đọc duyệt từng dòng toàn bộ trang bằng mắt.
- Checksum source/DOCX/PDF và trạng thái validation nằm trong manifest. Link Markdown nội bộ trong Word là đường tương đối trong bộ hồ sơ; nguồn web chính thức giữ URL gốc.

Không chạy npm build/test vì không sửa game. Không thêm tính năng labour vào source, SQL hoặc Supabase. Không push Git. Những thay đổi implementation custody đang có được giữ nguyên.

Chưa có asset 3D production, animation rig hoàn chỉnh, benchmark thiết bị, kiểm thử UI runtime, specialist/legal review hoặc nghiên cứu thực địa. Mọi số liệu nghề/kinh tế/gameplay và bố cục mockup đều là thiết kế minh họa; nguồn thực tế và giới hạn nằm trong phần 18.
