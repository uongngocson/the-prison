// Quest definitions (DB11 equivalent). Objectives tuần tự; reward ledger key unique theo quest.
import type { SkillId, ZoneId } from '../domain/types';

export type PredName =
  | 'releaseEligible' | 'hasLetterReply' | 'enrolledAny' | 'attendedAnySession' | 'sleptWell' | 'wageReceived'
  | 'planGoals3' | 'faultReported' | 'faultResolved' | 'hasBook' | 'admitted' | 'isRaining' | 'notRaining'
  | 'hasCertificate' | 'callDone' | 'longResolved' | 'binhArrived' | 'cultureSessionNow' | 'readingGroupNow' | 'storyMilestone' | 'chapterClosed';

export type Match =
  | { talk: string }
  | { act: string; zone?: ZoneId; target?: string; count?: number }
  | { zone: ZoneId }
  | { flag: string }
  | { item: string }
  | { pred: PredName };

export interface Reward { xp?: [SkillId, number][]; items?: [string, number][]; trust?: [string, number][]; rep?: [string, number][]; mood?: number; credits?: number; chapter?: number }

export interface QuestDef {
  id: string;
  kind: 'main' | 'side';
  title: string;
  summary: string;
  giver: string;
  autoStart?: { afterQuest?: string; day?: number; flag?: string };
  objectives: { id: string; text: string; match: Match; where?: ZoneId; npc?: string }[];
  reward: Reward;
  rewardByChoice?: { key: string; map: Record<string, Reward> };
  recap: string;
  alternative: string; // đường phục hồi khi lỡ hẹn/thiếu item (F07)
  abandonable: boolean;
}

export const QUESTS: QuestDef[] = [
  {
    id: 'Q01', kind: 'main', title: 'Làm quen ngày mới', giver: 'tu',
    summary: 'Ngày đầu ở khu phòng ở. Tìm hiểu lịch sinh hoạt và gặp người hướng dẫn.',
    autoStart: { flag: 'admission_complete' },
    objectives: [
      { id: 'o1', text: 'Nói chuyện với Tư — bạn cùng phòng', match: { talk: 'tu' }, where: 'L02', npc: 'tu' },
      { id: 'o2', text: 'Xem bảng lịch sinh hoạt', match: { act: 'view_schedule' }, where: 'L02' },
      { id: 'o3', text: 'Đi tới Nhà ăn', match: { zone: 'L05' }, where: 'L05' },
      { id: 'o4', text: 'Hỏi chuyện Bác Hòa', match: { talk: 'hoa' }, npc: 'hoa' },
    ],
    reward: { xp: [['focus', 20]], trust: [['hoa', 5]] },
    recap: 'Bạn đã biết lịch sinh hoạt, đường tới nhà ăn và làm quen Bác Hòa.',
    alternative: 'Nếu mất Sổ tay, bản sao luôn có trong mục Sổ tay (H). Không cần đúng giờ để hoàn thành.',
    abandonable: false,
  },
  {
    id: 'Q02', kind: 'main', title: 'Một chỗ ngồi', giver: 'hoa', autoStart: { afterQuest: 'Q01' },
    summary: 'Bữa ăn là dịp gặp gỡ. Nhận suất, ngồi cùng mọi người và trò chuyện.',
    objectives: [
      { id: 'o1', text: 'Nhận suất ăn ở quầy (hoặc suất dự phòng)', match: { flag: 'got_meal' }, where: 'L05' },
      { id: 'o2', text: 'Ngồi ăn tại một bàn trong nhà ăn', match: { act: 'eat', zone: 'L05' }, where: 'L05' },
      { id: 'o3', text: 'Trò chuyện với Bác Hòa về buổi tập chiều', match: { talk: 'hoa' }, npc: 'hoa' },
      { id: 'o4', text: 'Trả khay', match: { act: 'return_tray' }, where: 'L05' },
    ],
    reward: { xp: [['communication', 10]], trust: [['hoa', 5]], rep: [['community', 3]] },
    recap: 'Bạn đã có một bữa ăn cùng mọi người và hẹn Bác Hòa ra sân.',
    alternative: 'Đến muộn vẫn có suất dự phòng tại quầy. Không cần đúng bữa nào cụ thể.',
    abandonable: false,
  },
  {
    id: 'Q03', kind: 'main', title: 'Cùng đi một vòng', giver: 'hoa', autoStart: { afterQuest: 'Q02' },
    summary: 'Bác Hòa rủ đi bộ quanh sân. Đi qua các mốc và chọn cách kết thúc buổi chiều.',
    objectives: [
      { id: 'o1', text: 'Gặp Bác Hòa ở Sân sinh hoạt (hoặc Phòng tập khi mưa)', match: { talk: 'hoa' }, npc: 'hoa' },
      { id: 'o2', text: 'Đi qua mốc đi bộ 1', match: { act: 'touch_track', target: 'track_0' }, where: 'L04' },
      { id: 'o3', text: 'Đi qua mốc đi bộ 2', match: { act: 'touch_track', target: 'track_1' }, where: 'L04' },
      { id: 'o4', text: 'Đi qua mốc đi bộ 3', match: { act: 'touch_track', target: 'track_2' }, where: 'L04' },
      { id: 'o5', text: 'Chọn: tập nhẹ hoặc ngồi trò chuyện với Bác Hòa', match: { talk: 'hoa' }, npc: 'hoa' },
    ],
    reward: { trust: [['hoa', 5]] },
    rewardByChoice: { key: 'ending', map: { exercise: { xp: [['fitness', 10]], mood: 5 }, talk: { xp: [['communication', 10]], mood: 5 } } },
    recap: 'Một vòng sân và một cuộc trò chuyện. Ngày mai sẽ có những lựa chọn mới.',
    alternative: 'Nếu sân đóng hoặc trời mưa, gặp Bác Hòa ở Phòng tập; các mốc được tính ở đó.',
    abandonable: false,
  },
  {
    id: 'Q04', kind: 'main', title: 'Một kế hoạch cho mình', giver: 'thu', autoStart: { afterQuest: 'Q03' },
    summary: 'Cán bộ hồ sơ mời bạn lập kế hoạch học tập hoặc công việc.',
    objectives: [
      { id: 'o1', text: 'Gặp Cô Thu ở Hồ sơ & tư vấn', match: { talk: 'thu' }, where: 'L11', npc: 'thu' },
      { id: 'o2', text: 'Đăng ký một khóa học hoặc ca làm (mục Đời sống › Học tập/Công việc)', match: { pred: 'enrolledAny' } },
      { id: 'o3', text: 'Tham dự một buổi học hoặc ca làm', match: { pred: 'attendedAnySession' } },
      { id: 'o4', text: 'Báo lại với Cô Thu', match: { talk: 'thu' }, npc: 'thu' },
    ],
    reward: { xp: [['focus', 15]], chapter: 2, credits: 500 },
    recap: 'Bạn đã có một kế hoạch tuần và bắt đầu thực hiện.',
    alternative: 'Có thể chọn khóa học thay vì công việc. Buổi vắng có lý do được học bù.',
    abandonable: false,
  },
  {
    id: 'Q05', kind: 'main', title: 'Giữ liên lạc', giver: 'yen', autoStart: { afterQuest: 'Q04' },
    summary: 'Viết thư cho một người liên hệ và chờ hồi âm.',
    objectives: [
      { id: 'o1', text: 'Gửi một lá thư tại Góc liên lạc', match: { act: 'send_letter' }, where: 'L16' },
      { id: 'o2', text: 'Chờ và đọc thư hồi âm (mục Đời sống › Liên lạc)', match: { pred: 'hasLetterReply' } },
      { id: 'o3', text: 'Thực hiện một cuộc gọi đã hẹn', match: { pred: 'callDone' }, where: 'L16' },
    ],
    reward: { xp: [['communication', 10]], mood: 8 },
    recap: 'Những lá thư và cuộc gọi giúp khoảng cách bớt xa.',
    alternative: 'Nếu cuộc gọi bị đổi lịch, đặt lại lịch hoặc gửi thêm thư — nhiệm vụ không thất bại.',
    abandonable: false,
  },
  {
    id: 'Q06', kind: 'main', title: 'Hướng về phía trước', giver: 'phong', autoStart: { afterQuest: 'Q05' },
    summary: 'Lập kế hoạch tái hòa nhập cùng cố vấn và chuẩn bị cho ngày rời cơ sở.',
    objectives: [
      { id: 'o1', text: 'Gặp Anh Phong ở Hướng nghiệp & chuẩn bị ra', match: { talk: 'phong' }, where: 'L18', npc: 'phong' },
      { id: 'o2', text: 'Chọn ít nhất 3 mục tiêu kế hoạch (nơi ở, việc làm, học tập...)', match: { pred: 'planGoals3' } },
      { id: 'o3', text: 'Chờ mốc xem xét theo câu chuyện (Ngày 7 trở đi)', match: { pred: 'storyMilestone' } },
      { id: 'o4', text: 'Xác nhận tại bàn kế hoạch (rời cơ sở, hoặc kết thúc chương nếu vẫn còn án)', match: { pred: 'chapterClosed' }, where: 'L18' },
    ],
    reward: { chapter: 3 },
    recap: 'Hành trình khép lại với một kế hoạch cho những ngày tiếp theo.',
    alternative: 'Kế hoạch thiếu mục tiêu vẫn có hỗ trợ; không cần kỹ năng tối đa hay tiền.',
    abandonable: false,
  },
  // ---------- Side quests ----------
  {
    id: 'S01', kind: 'side', title: 'Sắp sách', giver: 'mai',
    summary: 'Thư viện cần người sắp lại các kệ sách sau giờ trả.',
    objectives: [
      { id: 'o1', text: 'Nhận việc từ Cô Mai', match: { talk: 'mai' }, where: 'L07', npc: 'mai' },
      { id: 'o2', text: 'Sắp xếp kệ sách (2 lần)', match: { act: 'sort_books', count: 2 }, where: 'L07' },
      { id: 'o3', text: 'Báo lại với Cô Mai', match: { talk: 'mai' }, npc: 'mai' },
    ],
    reward: { xp: [['focus', 10], ['communication', 5]], trust: [['mai', 8]], rep: [['readers', 5]] },
    recap: 'Kệ sách gọn gàng hơn, và thủ thư nhớ sự giúp đỡ của bạn.',
    alternative: 'Có thể làm vào bất kỳ giờ thư viện mở cửa nào.', abandonable: true,
  },
  {
    id: 'S02', kind: 'side', title: 'Tìm chủ đề học', giver: 'khang',
    summary: 'Thầy Khang gợi ý tìm một cuốn sách về kỹ năng làm việc nhóm.',
    objectives: [
      { id: 'o1', text: 'Nói chuyện với Thầy Khang', match: { talk: 'khang' }, where: 'L14', npc: 'khang' },
      { id: 'o2', text: 'Mượn "Kỹ năng làm việc nhóm" ở thư viện', match: { item: 'book_skills' }, where: 'L07' },
      { id: 'o3', text: 'Đọc sách (ở bàn đọc hoặc giường)', match: { act: 'read' } },
      { id: 'o4', text: 'Chia sẻ với Thầy Khang', match: { talk: 'khang' }, npc: 'khang' },
    ],
    reward: { xp: [['focus', 15]], trust: [['khang', 6]] },
    recap: 'Bạn đã có chủ đề học riêng cho tuần này.',
    alternative: 'Nếu sách đang được mượn, thủ thư có bản thay thế.', abandonable: true,
  },
  {
    id: 'S03', kind: 'side', title: 'Đồ vải sạch', giver: 'dao',
    summary: 'Đổi đồ giặt và mang một bộ sạch cho Tư.',
    objectives: [
      { id: 'o1', text: 'Nói chuyện với Cô Đào ở quầy giặt', match: { talk: 'dao' }, where: 'L13', npc: 'dao' },
      { id: 'o2', text: 'Đổi đồ tại quầy giặt', match: { act: 'laundry_exchange' }, where: 'L13' },
      { id: 'o3', text: 'Đưa bộ đồ sạch cho Tư', match: { talk: 'tu' }, npc: 'tu' },
    ],
    reward: { xp: [['communication', 10]], trust: [['tu', 6], ['dao', 4]] },
    recap: 'Một việc nhỏ nhưng Tư rất cảm kích.',
    alternative: 'Nếu hết đồ sạch, Cô Đào cấp bộ thay thế.', abandonable: true,
  },
  {
    id: 'S04', kind: 'side', title: 'Nhóm đọc sách', giver: 'hoa',
    summary: 'Nhóm đọc gặp nhau buổi tối ở thư viện (Thứ Ba, Thứ Năm, Thứ Bảy).',
    autoStart: { afterQuest: 'Q03' },
    objectives: [
      { id: 'o1', text: 'Đến thư viện trong giờ nhóm đọc (19:00–20:30)', match: { pred: 'readingGroupNow' }, where: 'L07' },
      { id: 'o2', text: 'Đọc cùng nhóm tại bàn đọc', match: { act: 'read', zone: 'L07' }, where: 'L07' },
      { id: 'o3', text: 'Trò chuyện với Bác Hòa sau buổi đọc', match: { talk: 'hoa' }, npc: 'hoa' },
    ],
    reward: { xp: [['communication', 10], ['focus', 5]], rep: [['readers', 10]], mood: 6 },
    recap: 'Bạn đã trở thành một gương mặt quen của nhóm đọc.',
    alternative: 'Lỡ buổi thì đợi buổi kế tiếp; không thất bại.', abandonable: true,
  },
  {
    id: 'S05', kind: 'side', title: 'Một giấc ngủ đủ', giver: 'ngoc', autoStart: { day: 2 },
    summary: 'Ngủ đủ giấc giúp mọi việc dễ dàng hơn.',
    objectives: [{ id: 'o1', text: 'Ngủ ít nhất 7 giờ trên giường của mình', match: { pred: 'sleptWell' }, where: 'L02' }],
    reward: { xp: [['fitness', 5]], mood: 5 },
    recap: 'Một đêm ngon giấc.', alternative: 'Nghỉ ngắn không tính, nhưng không bị phạt.', abandonable: true,
  },
  {
    id: 'S06', kind: 'side', title: 'Hướng dẫn người mới', giver: 'binh', autoStart: { day: 3 },
    summary: 'Bình vừa đến. Dẫn Bình đi xem khu vệ sinh và nhà ăn.',
    objectives: [
      { id: 'o1', text: 'Chào Bình ở khu phòng ở', match: { talk: 'binh' }, where: 'L02', npc: 'binh' },
      { id: 'o2', text: 'Dẫn Bình tới Vệ sinh & giặt', match: { flag: 'binh_saw_L13' }, where: 'L13' },
      { id: 'o3', text: 'Dẫn Bình tới Nhà ăn', match: { flag: 'binh_saw_L05' }, where: 'L05' },
      { id: 'o4', text: 'Nói chuyện với Bình', match: { talk: 'binh' }, npc: 'binh' },
    ],
    reward: { xp: [['communication', 15]], trust: [['binh', 10]], rep: [['newcomers', 10], ['community', 5]] },
    recap: 'Bình đã bớt bỡ ngỡ nhờ bạn.', alternative: 'Bình đợi ở khu phòng ở nếu bạn bận.', abandonable: true,
  },
  {
    id: 'S07', kind: 'side', title: 'Chuẩn bị buổi sinh hoạt', giver: 'linh',
    summary: 'Cô Linh cần người sắp xếp phòng yên tĩnh cho buổi sinh hoạt tối.',
    objectives: [
      { id: 'o1', text: 'Nói chuyện với Cô Linh ở Phòng yên tĩnh', match: { talk: 'linh' }, where: 'L17', npc: 'linh' },
      { id: 'o2', text: 'Trải thảm (2 lần)', match: { act: 'arrange', count: 2 }, where: 'L17' },
      { id: 'o3', text: 'Tham gia buổi sinh hoạt hoặc giờ yên tĩnh', match: { act: 'quiet_time', zone: 'L17' }, where: 'L17' },
    ],
    reward: { xp: [['communication', 10]], trust: [['linh', 8]], mood: 6 },
    recap: 'Buổi sinh hoạt diễn ra nhẹ nhàng.', alternative: 'Có thể chọn giờ suy ngẫm không tôn giáo.', abandonable: true,
  },
  {
    id: 'S08', kind: 'side', title: 'Không cần đôi co', giver: 'long', autoStart: { day: 2 },
    summary: 'Long đòi bạn đưa đồ ăn vặt. Bạn có thể từ chối, rời đi hoặc nhờ hỗ trợ.',
    objectives: [
      { id: 'o1', text: 'Gặp Long (anh ta tìm bạn ở hành lang hoặc sân)', match: { talk: 'long' }, npc: 'long' },
      { id: 'o2', text: 'Giải quyết theo cách của bạn (từ chối / nhờ cán bộ / hòa giải)', match: { pred: 'longResolved' } },
    ],
    reward: { xp: [['communication', 10]], mood: 3 },
    recap: 'Bạn đã đặt ranh giới mà không cần xung đột.', alternative: 'Luôn có thể nhờ cán bộ khu ở hoặc gửi yêu cầu an toàn.', abandonable: false,
  },
  {
    id: 'S09', kind: 'side', title: 'Báo hỏng', giver: 'nam', autoStart: { day: 2 },
    summary: 'Một bồn rửa ở khu vệ sinh bị hỏng. Báo cho bảo trì.',
    objectives: [
      { id: 'o1', text: 'Báo hỏng bồn rửa (tương tác tại thiết bị hỏng)', match: { pred: 'faultReported' }, where: 'L13' },
      { id: 'o2', text: 'Chờ sửa xong', match: { pred: 'faultResolved' } },
      { id: 'o3', text: 'Cảm ơn Chú Năm', match: { talk: 'nam' }, npc: 'nam' },
    ],
    reward: { xp: [['communication', 5]], trust: [['nam', 8]], rep: [['community', 5]] },
    recap: 'Bồn rửa đã hoạt động lại.', alternative: 'Trong lúc chờ, dùng bồn rửa khác.', abandonable: true,
  },
  {
    id: 'S10', kind: 'side', title: 'Ca làm đầu tiên', giver: 'hanh',
    summary: 'Hoàn thành một ca làm và xem bảng kê tài khoản.',
    autoStart: { afterQuest: 'Q04' },
    objectives: [
      { id: 'o1', text: 'Hoàn thành trọn một ca làm', match: { pred: 'wageReceived' } },
      { id: 'o2', text: 'Xem bảng kê tài khoản (Đời sống › Tài khoản)', match: { flag: 'viewed_statement' } },
    ],
    reward: { xp: [['focus', 10]] },
    recap: 'Công việc được ghi nhận rõ ràng.', alternative: 'Nghỉ có lý do không bị phạt; nhận ca sau.', abandonable: true,
  },
  {
    id: 'S11', kind: 'side', title: 'Tập cùng nhóm', giver: 'duy',
    summary: 'Anh Duy rủ tham gia buổi tập nhóm buổi chiều.',
    objectives: [
      { id: 'o1', text: 'Nói chuyện với Anh Duy', match: { talk: 'duy' }, npc: 'duy' },
      { id: 'o2', text: 'Tập luyện 2 lần (sân hoặc phòng tập)', match: { act: 'exercise', count: 2 } },
      { id: 'o3', text: 'Uống nước sau khi tập', match: { act: 'drink' } },
    ],
    reward: { xp: [['fitness', 15]], trust: [['duy', 6]], rep: [['sports', 8]] },
    recap: 'Cơ thể mỏi nhưng tinh thần nhẹ nhõm.', alternative: 'Bật “hoàn tất tự động” nếu không muốn thao tác lặp.', abandonable: true,
  },
  {
    id: 'S12', kind: 'side', title: 'Chiếc thìa của bếp', giver: 'bay',
    summary: 'Chú Bảy cần người phụ bếp một buổi.',
    objectives: [
      { id: 'o1', text: 'Nói chuyện với Chú Bảy ở Nhà bếp', match: { talk: 'bay' }, where: 'L06', npc: 'bay' },
      { id: 'o2', text: 'Phụ sơ chế tại bàn bếp', match: { act: 'help', zone: 'L06' }, where: 'L06' },
      { id: 'o3', text: 'Báo lại với Chú Bảy', match: { talk: 'bay' }, npc: 'bay' },
    ],
    reward: { xp: [['communication', 10]], trust: [['bay', 8]], rep: [['kitchen', 8]] },
    recap: 'Món canh hôm nay có phần công sức của bạn.', alternative: 'Có thể giúp vào giờ bếp mở bất kỳ ngày nào.', abandonable: true,
  },
];

export const QUEST_BY_ID: Record<string, QuestDef> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

export interface AchievementDef { id: string; title: string; desc: string; counter: string; target: number; hidden?: boolean }
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_day', title: 'Ngày đầu tiên', desc: 'Hoàn thành ngày đầu tiên.', counter: 'daysCompleted', target: 1 },
  { id: 'week', title: 'Một tuần', desc: 'Sống qua 7 ngày.', counter: 'daysCompleted', target: 7 },
  { id: 'well_fed', title: 'Bữa cơm chung', desc: 'Ăn 10 bữa.', counter: 'mealsEaten', target: 10 },
  { id: 'bookworm', title: 'Mọt sách', desc: 'Đọc sách 5 lần.', counter: 'reads', target: 5 },
  { id: 'helper', title: 'Bàn tay giúp đỡ', desc: 'Giúp đỡ hoạt động chung 5 lần.', counter: 'helps', target: 5 },
  { id: 'fit', title: 'Bền bỉ', desc: 'Tập luyện 10 lần.', counter: 'exercises', target: 10 },
  { id: 'social', title: 'Người quen', desc: 'Trò chuyện với 10 người khác nhau.', counter: 'uniqueTalks', target: 10 },
  { id: 'letters', title: 'Nét chữ', desc: 'Gửi 3 lá thư.', counter: 'lettersSent', target: 3 },
  { id: 'certificate', title: 'Hoàn thành khóa học', desc: 'Nhận một giấy ghi nhận khóa học.', counter: 'certificates', target: 1 },
  { id: 'trusted', title: 'Được tin cậy', desc: 'Đạt độ tin cậy 50 với một người.', counter: 'maxTrust', target: 50 },
  { id: 'walker', title: 'Người đi bộ', desc: 'Đi bộ tổng cộng 2 km.', counter: 'distanceWalked', target: 2000 },
  { id: 'new_day', title: 'Một ngày mới', desc: 'Hoàn thành hành trình chính.', counter: 'mainDone', target: 1, hidden: true },
];
