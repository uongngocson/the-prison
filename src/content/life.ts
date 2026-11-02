// Full Life content (09–11): policy profile, services, programs, contacts, letter topics. Tất cả là hư cấu [D].
import type { BookingKind, ZoneId } from '../domain/types';
import { hm } from '../domain/util';

export const POLICY_PROFILE = {
  id: 'fictional_adult_rehabilitation_v1',
  version: '1.1.0',
  hash: '9f1c0d3e5b7a2c4d6e8f0a1b3c5d7e9f1a2b4c6d8e0f2a4b6c8d0e2f4a6b8c0d',
  jurisdictionLabel: 'Mô hình hư cấu — không đại diện pháp luật hay cơ sở thật',
  fictional: true,
  legalStatusSupport: ['sentenced'] as const,
  adultOnly: true,
  rightsFloor: ['Nước uống & bữa ăn cơ bản', 'Vệ sinh thiết yếu', 'Liên hệ hỗ trợ', 'Chăm sóc thiết yếu', 'Gửi yêu cầu/kiến nghị'],
  reviewStatus: 'chưa được chuyên gia jurisdiction review',
};

export const ORIENTATION_TOPICS: { id: string; title: string; body: string }[] = [
  { id: 'routine', title: 'Nhịp sinh hoạt hằng ngày', body: 'Mỗi ngày có giờ ăn, điểm danh sáng/tối, thời gian lao động hoặc học tập, sân sinh hoạt và giờ yên tĩnh. Hầu hết hoạt động là tự chọn. Xem lịch bất kỳ lúc nào (phím K) hoặc ở các bảng lịch.' },
  { id: 'rights', title: 'Quyền tối thiểu (hư cấu)', body: 'Nước uống, bữa ăn cơ bản, vệ sinh thiết yếu, chăm sóc thiết yếu, liên hệ hỗ trợ và quyền gửi yêu cầu không bao giờ bị khóa bởi tiền, uy tín, kỷ luật hay cài đặt.' },
  { id: 'services', title: 'Dịch vụ & nơi hỏi giúp', body: 'Quầy dịch vụ (cấp phát, cửa hàng), Góc liên lạc (thư, gọi), Phòng y tế (hẹn chăm sóc), Hồ sơ & tư vấn (đơn yêu cầu, xem xét lại), Phòng yên tĩnh (hỗ trợ đồng đẳng).' },
  { id: 'property', title: 'Tài sản cá nhân', body: 'Đồ cá nhân không mang vào khu ở được ký gửi có biên nhận. Bạn có thể xem biên nhận, khiếu nại nếu thiếu và nhận lại khi rời cơ sở.' },
  { id: 'review', title: 'Sự việc & xem xét lại', body: 'Nếu có ghi nhận về một sự việc, bạn được biết dữ kiện, trình bày ý kiến và yêu cầu xem xét lại. Cáo buộc khác với kết luận. Không có hệ quả nào lấy đi quyền tối thiểu.' },
];

export interface ServiceDef { id: string; name: string; kind: BookingKind; zone: ZoneId; staffRole: string; capacity: number; windows: [number, number][]; durationMin: number; leadMin: number; privacy: 'public_service' | 'private'; fallback?: string; desc: string }
export const SERVICES: ServiceDef[] = [
  { id: 'call', name: 'Cuộc gọi giả lập', kind: 'call', zone: 'L16', staffRole: 'contact_clerk', capacity: 2, windows: [[hm(9), hm(11)], [hm(14), hm(16)], [hm(19), hm(21)]], durationMin: 20, leadMin: 60, privacy: 'private', fallback: 'letter', desc: 'Cuộc gọi chỉ phụ đề với liên hệ hư cấu đã được duyệt. Không nhập số thật, không cần micro/camera.' },
  { id: 'visit', name: 'Thăm gặp', kind: 'visit', zone: 'L12', staffRole: 'visits', capacity: 6, windows: [[hm(9), hm(11, 30)], [hm(14), hm(16, 30)]], durationMin: 45, leadMin: 24 * 60, privacy: 'private', fallback: 'letter', desc: 'Thăm gặp người thân hư cấu theo lịch hẹn. Có thể đổi lịch; nếu khách không tới sẽ có lựa chọn thay thế.' },
  { id: 'legal', name: 'Hẹn cố vấn hồ sơ', kind: 'legal', zone: 'L11', staffRole: 'case_advisor', capacity: 1, windows: [[hm(9), hm(11, 30)], [hm(14), hm(17)]], durationMin: 30, leadMin: 120, privacy: 'private', desc: 'Buổi hẹn riêng để hiểu tình trạng hồ sơ hư cấu và các mốc tiếp theo. Không phải tư vấn pháp lý thật.' },
  { id: 'care', name: 'Hẹn chăm sóc sức khỏe', kind: 'care', zone: 'L08', staffRole: 'care', capacity: 2, windows: [[hm(8), hm(11, 30)], [hm(13, 30), hm(17)]], durationMin: 30, leadMin: 60, privacy: 'private', desc: 'Hẹn với nhân viên chăm sóc. Không chẩn đoán thật; có thể nhận kế hoạch nghỉ và miễn trừ lao động.' },
  { id: 'support', name: 'Trò chuyện hỗ trợ', kind: 'support', zone: 'L17', staffRole: 'facilitator', capacity: 2, windows: [[hm(10), hm(12)], [hm(19), hm(21)]], durationMin: 30, leadMin: 30, privacy: 'private', desc: 'Trò chuyện riêng với người lắng nghe. Có thể từ chối hoặc bỏ qua bất cứ lúc nào.' },
  { id: 'laundry', name: 'Đổi đồ giặt', kind: 'laundry', zone: 'L13', staffRole: 'laundry', capacity: 4, windows: [[hm(7), hm(11)], [hm(14), hm(20)]], durationMin: 5, leadMin: 0, privacy: 'public_service', desc: 'Đổi bộ đồ cần giặt lấy bộ sạch.' },
  { id: 'culture', name: 'Sinh hoạt văn hóa / suy ngẫm', kind: 'culture', zone: 'L17', staffRole: 'facilitator', capacity: 8, windows: [[hm(19), hm(20, 30)]], durationMin: 45, leadMin: 0, privacy: 'public_service', desc: 'Buổi sinh hoạt tự chọn. Có lựa chọn suy ngẫm không tôn giáo tương đương.' },
];
export const SERVICE_BY_ID = Object.fromEntries(SERVICES.map((s) => [s.id, s]));

export interface ProgramDef { id: string; name: string; kind: 'study' | 'work'; zone: ZoneId; days: number[]; from: number; to: number; units: string[]; capacity: number; wagePerShift?: number; certificate?: string; supervisor: string; terms: string; xp: 'focus' | 'fitness' | 'communication'; supportVariant: string }
export const PROGRAMS: ProgramDef[] = [
  { id: 'literacy', name: 'Đọc viết nâng cao', kind: 'study', zone: 'L14', days: [0, 2, 4], from: hm(9), to: hm(10, 30), units: ['Đọc hiểu đoạn văn', 'Viết thư trình bày', 'Điền biểu mẫu', 'Đọc tin tức', 'Bài tổng kết'], capacity: 12, certificate: 'certificate_literacy', supervisor: 'khang', terms: '3 buổi/tuần, 5 bài. Buổi vắng có lý do được học bù.', xp: 'focus', supportVariant: 'Tài liệu chữ lớn và đọc to; bài tổng kết có thể trình bày miệng.' },
  { id: 'carpentry', name: 'Mộc cơ bản', kind: 'study', zone: 'L10', days: [1, 3], from: hm(14), to: hm(15, 30), units: ['An toàn xưởng', 'Đo và đánh dấu', 'Ghép mộng đơn giản', 'Hoàn thiện bề mặt'], capacity: 6, certificate: 'certificate_carpentry', supervisor: 'hanh', terms: '2 buổi/tuần, 4 bài thực hành an toàn.', xp: 'focus', supportVariant: 'Bàn làm việc thấp và thao tác tự động hoàn tất.' },
  { id: 'cooking', name: 'Nấu ăn tập thể', kind: 'study', zone: 'L06', days: [5], from: hm(9), to: hm(11), units: ['Vệ sinh bếp', 'Sơ chế', 'Lên thực đơn'], capacity: 4, certificate: 'certificate_cooking', supervisor: 'bay', terms: 'Sáng thứ Bảy, 3 bài.', xp: 'communication', supportVariant: 'Phân vai không cần đứng lâu.' },
  { id: 'work_workshop', name: 'Ca xưởng (phân loại & đóng gói)', kind: 'work', zone: 'L10', days: [0, 1, 2, 3, 4], from: hm(8, 30), to: hm(11, 30), units: [], capacity: 10, wagePerShift: 450, supervisor: 'hanh', terms: 'Thứ Hai–Sáu, 3 giờ/ca. Tín chỉ hư cấu ghi nhận một lần mỗi ca. Có thể nghỉ có lý do.', xp: 'focus', supportVariant: 'Nhiệm vụ ngồi, thao tác tự động.' },
  { id: 'work_kitchen', name: 'Ca bếp', kind: 'work', zone: 'L06', days: [0, 2, 4, 6], from: hm(9), to: hm(11), units: [], capacity: 4, wagePerShift: 380, supervisor: 'bay', terms: '4 ca/tuần, 2 giờ/ca.', xp: 'communication', supportVariant: 'Vai trò sắp xếp, không đứng bếp.' },
  { id: 'work_laundry', name: 'Ca giặt & cấp phát', kind: 'work', zone: 'L13', days: [1, 3, 5], from: hm(14), to: hm(16), units: [], capacity: 3, wagePerShift: 320, supervisor: 'dao', terms: '3 ca/tuần, 2 giờ/ca.', xp: 'communication', supportVariant: 'Gấp đồ tại bàn.' },
];
export const PROGRAM_BY_ID = Object.fromEntries(PROGRAMS.map((p) => [p.id, p]));

export const CONTACTS_BY_CONTEXT: Record<'family' | 'estranged' | 'none', { id: string; name: string; relation: 'family' | 'friend' | 'advisor' | 'peer' | 'mentor' | 'dependent'; channels: ('letter' | 'call' | 'visit' | 'legal')[] }[]> = {
  family: [
    { id: 'mother', name: 'Mẹ (bà Lan)', relation: 'family', channels: ['letter', 'call', 'visit'] },
    { id: 'sister', name: 'Em gái (Thảo)', relation: 'family', channels: ['letter', 'call', 'visit'] },
    { id: 'friend_minh', name: 'Bạn cũ (Minh)', relation: 'friend', channels: ['letter', 'call'] },
    { id: 'advisor_ext', name: 'Văn phòng tư vấn (hư cấu)', relation: 'advisor', channels: ['legal'] },
  ],
  estranged: [
    { id: 'aunt', name: 'Dì Hương', relation: 'family', channels: ['letter', 'call'] },
    { id: 'friend_minh', name: 'Bạn cũ (Minh)', relation: 'friend', channels: ['letter', 'call', 'visit'] },
    { id: 'advisor_ext', name: 'Văn phòng tư vấn (hư cấu)', relation: 'advisor', channels: ['legal'] },
  ],
  none: [
    { id: 'mentor_ext', name: 'Người cố vấn cộng đồng (anh Quang)', relation: 'mentor', channels: ['letter', 'call', 'visit'] },
    { id: 'friend_minh', name: 'Bạn cũ (Minh)', relation: 'friend', channels: ['letter', 'call'] },
    { id: 'advisor_ext', name: 'Văn phòng tư vấn (hư cấu)', relation: 'advisor', channels: ['legal'] },
  ],
};

export const LETTER_TOPICS: { id: string; label: string; reply: string; mood: number }[] = [
  { id: 'daily', label: 'Kể về một ngày ở đây', reply: 'Đọc thư con/em kể về bữa ăn và sân tập mà thấy yên tâm hơn. Ở nhà mọi người vẫn khỏe. Nhớ giữ sức nhé.', mood: 6 },
  { id: 'learning', label: 'Chia sẻ việc học / công việc', reply: 'Nghe tin đang học thêm thật mừng. Cứ từ từ, mỗi ngày một chút là được.', mood: 8 },
  { id: 'sorry', label: 'Viết lời xin lỗi và cảm ơn', reply: 'Thư làm mọi người xúc động. Những gì đã qua thì để nó qua, quan trọng là những ngày tới.', mood: 10 },
  { id: 'ask_news', label: 'Hỏi thăm tin tức gia đình / bạn bè', reply: 'Ở nhà mùa này mưa nhiều. Con mèo vẫn hay nằm chỗ cũ. Mọi người gửi lời hỏi thăm.', mood: 5 },
  { id: 'plans', label: 'Kể về dự định sau này', reply: 'Kế hoạch nghe hợp lý đó. Khi nào cần giúp chỗ ở hay việc làm thì cứ nói, mình cùng tính.', mood: 8 },
];

export const CALL_LINES: Record<string, string[]> = {
  mother: ['A lô, con đó hả? Mẹ nghe đây.', 'Ở nhà vẫn ổn, con đừng lo. Con ăn uống được không?', 'Ừ, cố lên con. Tuần sau mẹ gọi lại nhé.'],
  sister: ['Anh/chị ơi! Em đây.', 'Em mới đi làm chỗ mới, cũng vui. Mọi người nhắc anh/chị hoài.', 'Thôi hết giờ rồi, em gửi thư sau nhé!'],
  friend_minh: ['Ê, khỏe không? Lâu quá.', 'Tao vẫn chạy xe như cũ. Có gì cần cứ nhắn.', 'Giữ sức nhé, nói chuyện sau.'],
  aunt: ['Dì nghe nè.', 'Lâu rồi mới nói chuyện, dì cũng mừng. Chuyện cũ để từ từ.', 'Dì sẽ viết thư cho con.'],
  mentor_ext: ['Chào bạn, anh Quang đây.', 'Bên anh có chương trình hỗ trợ chỗ ở tạm và học nghề sau này.', 'Mình giữ liên lạc đều nhé.'],
};

export const VISIT_LINES: Record<string, string[]> = {
  mother: ['Mẹ mang theo lời hỏi thăm của cả xóm.', 'Trông con gầy hơn, nhưng mắt tươi hơn lần trước.', 'Lần sau mẹ sẽ đến nữa.'],
  sister: ['Em đến rồi đây! Đường hơi xa nhưng không sao.', 'Em kể chuyện nhà, chuyện công việc mới.', 'Hẹn gặp lần sau nha.'],
  friend_minh: ['Tao ghé thăm chút.', 'Ngoài kia nhiều thay đổi lắm, mà vẫn chờ mày.', 'Giữ sức nha.'],
  mentor_ext: ['Anh đến như đã hẹn.', 'Mình nói về các bước chuẩn bị chỗ ở và học nghề.', 'Hẹn buổi sau.'],
};

export const CASE_FACTS: Record<string, { label: string; category: 'property' | 'legal' | 'care' | 'safety' | 'accommodation' | 'maintenance' | 'discipline_review' | 'general'; role: string; responseDays: number; answer: string }[]> = {
  property: [{ label: 'Thiếu một món trong biên nhận tài sản', category: 'property', role: 'property_clerk', responseDays: 1, answer: 'Đã đối chiếu biên nhận gốc; món đồ được ghi đúng ở kho ký gửi. Biên nhận bổ sung đã được lập.' }],
  housing: [{ label: 'Xin đổi phòng ở', category: 'accommodation', role: 'residential', responseDays: 1, answer: 'Yêu cầu đổi phòng được chấp thuận khi có giường phù hợp. Bạn sẽ nhận thông báo chuẩn bị chuyển phòng.' }],
  general: [{ label: 'Hỏi về lịch sinh hoạt', category: 'general', role: 'case_advisor', responseDays: 1, answer: 'Lịch chi tiết có ở bảng lịch và Sổ tay. Bạn có thể đặt lịch hẹn riêng nếu cần giải thích thêm.' }],
  legal: [{ label: 'Hỏi tình trạng hồ sơ hư cấu', category: 'legal', role: 'case_advisor', responseDays: 2, answer: 'Hồ sơ của bạn đang ở giai đoạn thi hành bình thường. Mốc xem xét tiếp theo được ghi trong mục Hồ sơ.' }],
  safety: [{ label: 'Cảm thấy bị gây áp lực / không an toàn', category: 'safety', role: 'residential', responseDays: 0, answer: 'Yêu cầu được xử lý ngay. Cán bộ đã trao đổi riêng và sắp xếp hòa giải; bạn có thể xin đổi chỗ nếu cần.' }],
  care: [{ label: 'Cần được chăm sóc / nghỉ ngơi', category: 'care', role: 'care', responseDays: 0, answer: 'Đã sắp lịch hẹn chăm sóc sớm nhất. Đến phòng y tế theo giờ hẹn.' }],
  maintenance: [{ label: 'Báo thiết bị hỏng', category: 'maintenance', role: 'maintenance', responseDays: 1, answer: 'Đã ghi nhận và giao thợ bảo trì. Trong lúc chờ, hãy dùng thiết bị thay thế được chỉ dẫn.' }],
};

export const FUNCTIONAL_NEEDS: { id: string; label: string; effect: string }[] = [
  { id: 'mobility', label: 'Hạn chế vận động / cần đường đi ngắn', effect: 'Hoạt động có biến thể ngồi; hành động thao tác dài tự động hoàn tất; ưu tiên phòng gần lối đi.' },
  { id: 'sensory_hearing', label: 'Khó nghe', effect: 'Mọi thông báo luôn có phụ đề và chỉ báo hình ảnh.' },
  { id: 'sensory_vision', label: 'Khó nhìn chữ nhỏ', effect: 'Chữ lớn trong tài liệu lớp học; phụ đề cỡ lớn.' },
  { id: 'language', label: 'Cần ngôn ngữ đơn giản / thông dịch', effect: 'Văn bản dịch vụ dùng ngôn ngữ đơn giản; có hỗ trợ thông dịch khi hẹn.' },
  { id: 'rest', label: 'Cần nghỉ giữa các hoạt động', effect: 'Nhu cầu năng lượng giảm chậm hơn trong ca làm/học; được nghỉ giữa giờ.' },
];

export const DIETS: { id: 'regular' | 'vegetarian' | 'no_red_meat' | 'soft'; label: string }[] = [
  { id: 'regular', label: 'Thông thường' },
  { id: 'vegetarian', label: 'Ăn chay' },
  { id: 'no_red_meat', label: 'Không thịt đỏ' },
  { id: 'soft', label: 'Thức ăn mềm' },
];

export const MENU: Record<'breakfast' | 'lunch' | 'dinner', Record<string, string>> = {
  breakfast: { regular: 'Cháo thịt bằm, trứng luộc', vegetarian: 'Cháo nấm, đậu hũ', no_red_meat: 'Cháo gà, trứng luộc', soft: 'Cháo trắng, trứng hấp' },
  lunch: { regular: 'Cơm, cá kho, canh bí', vegetarian: 'Cơm, đậu hũ sốt cà, canh bí', no_red_meat: 'Cơm, cá kho, canh bí', soft: 'Cơm nát, cá hấp, canh bí' },
  dinner: { regular: 'Cơm, thịt kho, rau luộc', vegetarian: 'Cơm, nấm xào, rau luộc', no_red_meat: 'Cơm, gà luộc, rau luộc', soft: 'Cháo cá, rau nghiền' },
};

export const ENDINGS: Record<string, { title: string; text: string[] }> = {
  steady: {
    title: 'Một ngày mới',
    text: [
      'Buổi sáng cuối cùng, cánh cổng mở ra một con đường bình thường như bao con đường khác.',
      'Trong túi là biên nhận tài sản đã ký nhận đủ, một giấy ghi nhận khóa học và danh sách những việc cần làm tuần đầu.',
      'Không có gì được bảo đảm. Nhưng có những người đã hứa sẽ gọi lại, và có một kế hoạch để bắt đầu.',
    ],
  },
  partial: {
    title: 'Những bước đầu tiên',
    text: [
      'Kế hoạch còn dang dở, nhưng cố vấn đã chuyển liên hệ của một nhóm hỗ trợ cộng đồng hư cấu.',
      'Rời đi không phải là đích đến. Đó là lúc tự mình viết tiếp những trang sau.',
    ],
  },
};
