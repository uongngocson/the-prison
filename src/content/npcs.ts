// 60 NPC danh tính (DB24 equivalent). Cư dân và nhân viên hư cấu; không gán tội danh hay chỉ số theo ngoại hình.
import type { Appearance, ZoneId } from '../domain/types';
import { hash32 } from '../domain/util';

export type NpcRole = 'resident' | 'staff';
export type ResidentGroup = 'readers' | 'sports' | 'kitchen' | 'workshop' | 'quiet' | 'newcomers';
export type StaffRole =
  | 'intake' | 'residential' | 'kitchen_supervisor' | 'server' | 'librarian' | 'teacher' | 'care' | 'laundry'
  | 'workshop_supervisor' | 'coach' | 'case_advisor' | 'reintegration' | 'contact_clerk' | 'service_clerk'
  | 'visits' | 'maintenance' | 'facilitator' | 'property_clerk';

export interface NpcDef {
  id: string;
  name: string;
  role: NpcRole;
  group?: ResidentGroup;
  staffRole?: StaffRole;
  post?: string; // staff slot id
  shift?: 'day' | 'late' | 'night';
  bed?: string; // resident bed prop id
  dialogue: string;
  title: string; // short descriptor shown after met
  appearance: Appearance;
  sociable: number; // 0..1 personality
  bio: string;
}

function look(id: string, staff: boolean): Appearance {
  const h = hash32(id);
  return {
    body: (['slim', 'medium', 'broad'] as const)[h % 3],
    skin: (h >>> 3) % 5,
    hair: (h >>> 6) % 4,
    hairColor: (h >>> 9) % 4,
    outfit: staff ? 3 : (h >>> 12) % 3,
  };
}

const staff: [string, string, StaffRole, string, 'day' | 'late' | 'night', string, string][] = [
  ['tam', 'Cán bộ Tâm', 'intake', 'L01_staff_0', 'day', 'Cán bộ tiếp nhận', 'Hướng dẫn người mới các bước đầu tiên, nói chậm và rõ.'],
  ['luc', 'Cán bộ Lực', 'residential', 'L02', 'day', 'Cán bộ khu ở (ca ngày)', 'Phụ trách khu phòng ở ca ngày, điểm danh và nhắc lịch.'],
  ['van', 'Cán bộ Vân', 'residential', 'L02', 'night', 'Cán bộ khu ở (ca đêm)', 'Trực khu ở ban đêm, tiếp nhận yêu cầu khẩn.'],
  ['bay', 'Chú Bảy', 'kitchen_supervisor', 'L06_staff_0', 'day', 'Phụ trách bếp', 'Đầu bếp lâu năm, khó tính về vệ sinh nhưng tốt bụng.'],
  ['tai', 'Anh Tài', 'server', 'L05_staff_0', 'day', 'Nhân viên nhà ăn', 'Phát suất ăn, luôn nhớ ai ăn chay.'],
  ['nga', 'Chị Nga', 'server', 'L05_staff_1', 'day', 'Nhân viên nhà ăn', 'Nhanh tay, hay hỏi thăm.'],
  ['mai', 'Cô Mai', 'librarian', 'L07_staff_0', 'day', 'Thủ thư', 'Quản lý thư viện, tổ chức nhóm đọc sách.'],
  ['khang', 'Thầy Khang', 'teacher', 'L14_staff_0', 'day', 'Giáo viên', 'Dạy lớp đọc viết và kỹ năng làm việc.'],
  ['ngoc', 'Chị Ngọc', 'care', 'L08_staff_0', 'day', 'Nhân viên chăm sóc sức khỏe', 'Tiếp nhận yêu cầu chăm sóc, sắp lịch hẹn và kế hoạch nghỉ.'],
  ['dao', 'Cô Đào', 'laundry', 'L13_staff_0', 'day', 'Phụ trách giặt & cấp phát', 'Đổi đồ giặt, cấp khăn, xà phòng.'],
  ['hanh', 'Chị Hạnh', 'workshop_supervisor', 'L10_staff_0', 'day', 'Phụ trách xưởng', 'Phân ca, hướng dẫn an toàn và ghi nhận công việc.'],
  ['duy', 'Anh Duy', 'coach', 'L09_staff_0', 'day', 'Hướng dẫn thể chất', 'Tổ chức buổi tập nhóm, nhắc nghỉ khi mệt.'],
  ['thu', 'Cô Thu', 'case_advisor', 'L11_staff_0', 'day', 'Cán bộ hồ sơ', 'Tiếp nhận đơn, giải thích quy trình, hẹn xem xét lại.'],
  ['phong', 'Anh Phong', 'reintegration', 'L18_staff_0', 'day', 'Cố vấn tái hòa nhập', 'Cùng lập kế hoạch nơi ở, việc làm, học tập sau khi rời cơ sở.'],
  ['yen', 'Chị Yến', 'contact_clerk', 'L16_staff_0', 'day', 'Phụ trách liên lạc', 'Nhận thư, sắp lịch gọi và thăm gặp.'],
  ['loc', 'Anh Lộc', 'service_clerk', 'L15_staff_0', 'day', 'Phụ trách quầy dịch vụ', 'Cửa hàng nội bộ, cấp phát thiết yếu, biên nhận.'],
  ['hieu', 'Cán bộ Hiếu', 'visits', 'L12_staff_0', 'day', 'Phụ trách thăm gặp', 'Đón khách thăm, giữ trật tự phòng gặp.'],
  ['nam', 'Chú Năm', 'maintenance', 'L03', 'day', 'Thợ bảo trì', 'Sửa vòi nước, bóng đèn, cửa kẹt.'],
  ['linh', 'Cô Linh', 'facilitator', 'L17_staff_0', 'day', 'Điều phối sinh hoạt văn hóa', 'Tổ chức giờ yên tĩnh, nhóm trò chuyện, sinh hoạt văn hóa tự chọn.'],
  ['hoa_s', 'Anh Hòa Bình', 'property_clerk', 'L18_staff_1', 'day', 'Phụ trách tài sản', 'Lưu giữ và hoàn trả tài sản ký gửi.'],
];

// Residents — 40 người. Một số có vai trò cốt truyện.
const residents: [string, string, ResidentGroup, string, number, string][] = [
  ['tu', 'Tư', 'workshop', 'Bạn cùng phòng', 0.8, 'Bạn cùng phòng, nói nhiều, thích kể chuyện quê.'],
  ['hoa', 'Bác Hòa', 'readers', 'Người hướng dẫn', 0.9, 'Người lớn tuổi điềm đạm, hay giúp người mới làm quen.'],
  ['binh', 'Bình', 'newcomers', 'Người mới đến', 0.4, 'Đến sau bạn vài ngày, còn bỡ ngỡ.'],
  ['quan', 'Quân', 'quiet', 'Người lắng nghe đồng đẳng', 0.7, 'Đã học khóa hỗ trợ đồng đẳng, sẵn lòng lắng nghe.'],
  ['long', 'Long', 'sports', 'Người hay gây áp lực', 0.3, 'Hay đòi người khác đồ ăn vặt; đôi khi gây khó chịu.'],
  ['kien', 'Kiên', 'sports', 'Nhóm thể thao', 0.7, 'Thích chạy bộ quanh sân.'],
  ['duc', 'Minh Đức', 'readers', 'Nhóm đọc sách', 0.6, 'Thích thơ, viết thư rất dài.'],
  ['son', 'Sang', 'kitchen', 'Tổ bếp', 0.5, 'Làm bếp giỏi, ít nói.'],
];
const residentNames = ['Phúc', 'Lâm', 'Hải', 'Tuấn', 'Trí', 'Vinh', 'Khoa', 'Toàn', 'Nhân', 'Thịnh', 'Hưng', 'Tín', 'Lợi', 'Đạt', 'Thắng', 'Hậu', 'Cường', 'Tâm Anh', 'Hiển', 'Nghĩa', 'Tú', 'Bảo', 'Thông', 'Duy Anh', 'Khải', 'Lực Em', 'Huy', 'Tường', 'Thái', 'Mạnh', 'Định', 'Châu'];
const groups: ResidentGroup[] = ['readers', 'sports', 'kitchen', 'workshop', 'quiet', 'workshop', 'sports', 'readers'];
residentNames.forEach((n, i) => residents.push([`r${i + 1}`, n, groups[i % groups.length], groupTitle(groups[i % groups.length]), 0.3 + ((i * 37) % 60) / 100, 'Cư dân trong khu ở.']));

function groupTitle(g: ResidentGroup) {
  return { readers: 'Nhóm đọc sách', sports: 'Nhóm thể thao', kitchen: 'Tổ bếp', workshop: 'Tổ xưởng', quiet: 'Nhóm sinh hoạt yên tĩnh', newcomers: 'Người mới' }[g];
}

export const PLAYER_BED = 'cell_3_bed_a';
export const ROOMMATE_BED = 'cell_3_bed_b';

/** Beds: all cell beds except player's, assigned deterministically. */
function allBeds(): string[] {
  const out: string[] = [];
  for (let c = 1; c <= 8; c++) out.push(`cell_${c}_bed_a`, `cell_${c}_bed_b`);
  return out;
}

export const NPCS: NpcDef[] = [];
for (const [id, name, role, post, shift, title, bio] of staff) {
  NPCS.push({ id, name, role: 'staff', staffRole: role, post, shift, dialogue: `staff_${role}`, title, appearance: look(id, true), sociable: 0.6, bio });
}
{
  const beds = allBeds().filter((b) => b !== PLAYER_BED && b !== ROOMMATE_BED && b !== 'cell_7_bed_b' && b !== 'cell_8_bed_b');
  let bi = 0;
  for (const [id, name, group, title, soc, bio] of residents) {
    let bed: string | undefined;
    if (id === 'tu') bed = ROOMMATE_BED;
    else if (id === 'binh') bed = 'cell_8_bed_b'; // đến ngày 3
    else {
      bed = beds[bi++]; // 16 beds total; extra residents housed in other wing (off-screen abstraction)
    }
    NPCS.push({ id, name, role: 'resident', group, bed, dialogue: `res_${id}`, title, appearance: look(id, false), sociable: soc, bio });
  }
}

export const NPC_BY_ID: Record<string, NpcDef> = Object.fromEntries(NPCS.map((n) => [n.id, n]));
export const GROUP_LABEL: Record<string, string> = {
  readers: 'Nhóm đọc sách', sports: 'Nhóm thể thao', kitchen: 'Tổ bếp', workshop: 'Tổ xưởng', quiet: 'Nhóm yên tĩnh', newcomers: 'Người mới', community: 'Cộng đồng khu ở',
};

/** Residents without a bed in L02 sleep in an off-screen wing (zone-level simulation, F26 alt flow). */
export const OFFSITE_WING: ZoneId = 'L02';
