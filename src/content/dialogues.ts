// Authored dialogue graphs (F06). Điều kiện/hiệu ứng là allowlist có kiểu — không thực thi script từ content.
import type { QuestState, SkillId, ZoneId } from '../domain/types';
import type { PredName } from './quests';

export type Cond =
  | { q: string; is: QuestState | QuestState[] }
  | { obj: [string, string] }
  | { flag: string; eq?: string | number | boolean }
  | { noFlag: string }
  | { trust: number }
  | { item: string }
  | { noItem: string }
  | { skill: [SkillId, number] }
  | { at: ZoneId | ZoneId[] }
  | { day: number }
  | { pred: PredName }
  | { notPred: PredName };

export type ActName =
  | 'borrowBook' | 'returnBooks' | 'binhFollow' | 'binhStop' | 'longDecline' | 'longGive' | 'longLeave' | 'longHelp' | 'longMediate'
  | 'requestRoomMove' | 'freeEssentials' | 'supportSession' | 'ackOrientation' | 'issueGloves';

export type Effect =
  | { flag: [string, string | number | boolean] }
  | { start: string }
  | { obj: [string, string] }
  | { choice: [string, string, string] }
  | { give: [string, number] }
  | { take: [string, number] }
  | { trust: number }
  | { respect: number }
  | { rep: [string, number] }
  | { xp: [SkillId, number] }
  | { mood: number }
  | { open: string }
  | { act: ActName; arg?: string };

export interface DChoice { id: string; text: string; cond?: Cond[]; effects?: Effect[]; next?: string; once?: 'ever' | 'day' }
export interface DNode { id: string; speaker?: 'npc' | 'player' | 'narrator'; text: string; choices?: DChoice[]; next?: string; effects?: Effect[] }
export interface DialogueGraph { id: string; entries: { cond?: Cond[]; node: string }[]; nodes: Record<string, DNode> }

const G: DialogueGraph[] = [];
function graph(id: string, entries: DialogueGraph['entries'], nodes: DNode[]) {
  G.push({ id, entries, nodes: Object.fromEntries(nodes.map((n) => [n.id, n])) });
}
const BYE: DChoice = { id: 'bye', text: 'Tạm biệt.' };

// ---------- Roommate Tư ----------
graph('res_tu', [
  { cond: [{ obj: ['Q01', 'o1'] }], node: 'q01' },
  { cond: [{ obj: ['S03', 'o3'] }, { item: 'uniform_clean' }], node: 's03' },
  { cond: [{ obj: ['S03', 'o3'] }], node: 's03_wait' },
  { node: 'chat' },
], [
  { id: 'q01', text: 'Ê, bạn mới hả? Mình là Tư, ở giường bên kia. Đây, sổ tay sinh hoạt — người ta để lại cho bạn.', effects: [{ give: ['handbook', 1] }], next: 'q01b' },
  { id: 'q01b', text: 'Lịch dán ở bảng gần cửa đó. Giờ ăn thì ra nhà ăn, ai cũng ngồi chung. Có Bác Hòa hay ngồi bàn gần cửa sổ, ông ấy chỉ cho người mới tận tình lắm.', choices: [
    { id: 'thanks', text: 'Cảm ơn Tư. Mình sẽ đi xem lịch.', effects: [{ obj: ['Q01', 'o1'] }, { trust: 5 }] },
    { id: 'ask', text: 'Ở đây mọi người có dễ gần không?', next: 'q01c' },
  ] },
  { id: 'q01c', text: 'Đa số thì dễ. Có vài người khó tính, cứ giữ khoảng cách là được. Có chuyện gì thì nói cán bộ khu ở, hoặc gửi đơn ở phòng hồ sơ.', choices: [
    { id: 'thanks2', text: 'Mình hiểu rồi, cảm ơn.', effects: [{ obj: ['Q01', 'o1'] }, { trust: 6 }] },
  ] },
  { id: 's03', text: 'Ủa, bộ đồ sạch cho mình hả? Trời, cảm ơn nha! Mấy bữa nay mình bận ca xưởng quá.', effects: [{ take: ['uniform_clean', 1] }, { obj: ['S03', 'o3'] }] },
  { id: 's03_wait', text: 'Cô Đào nói bạn đang lấy giúp mình bộ đồ sạch hả? Không gấp đâu.', choices: [BYE] },
  { id: 'chat', text: '{tuLine}', choices: [
    { id: 'home', text: 'Kể chuyện quê đi Tư.', next: 'home', once: 'day', effects: [{ trust: 2 }] },
    { id: 'tip', text: 'Có mẹo gì cho ngày mai không?', next: 'tip' },
    BYE,
  ] },
  { id: 'home', text: 'Quê mình có con sông, mùa nước lên cá về đầy. Ra ngoài mình sẽ mở một tiệm sửa xe nhỏ ven sông. Bạn thì sao?', choices: [
    { id: 'share', text: 'Mình chưa chắc, nhưng muốn học thêm nghề gì đó.', effects: [{ trust: 2 }], once: 'day' },
    BYE,
  ] },
  { id: 'tip', text: '{tip}', choices: [BYE] },
]);

// ---------- Mentor Bác Hòa ----------
graph('res_hoa', [
  { cond: [{ obj: ['Q01', 'o4'] }], node: 'q01' },
  { cond: [{ obj: ['Q02', 'o3'] }], node: 'q02' },
  { cond: [{ obj: ['Q03', 'o1'] }, { at: ['L04', 'L09'] }], node: 'q03a' },
  { cond: [{ obj: ['Q03', 'o1'] }], node: 'q03_where' },
  { cond: [{ obj: ['Q03', 'o5'] }], node: 'q03b' },
  { cond: [{ obj: ['S04', 'o3'] }], node: 's04' },
  { node: 'chat' },
], [
  { id: 'q01', text: 'À, cậu là người mới phòng 3. Tôi là Hòa. Ở đây lâu rồi nên biết chút ít. Ngày đầu cứ chậm thôi, xem lịch, ăn đúng bữa, ngủ đủ giấc.', choices: [
    { id: 'listen', text: 'Bác có lời khuyên gì cho người mới không ạ?', next: 'q01b' },
    { id: 'short', text: 'Cháu cảm ơn bác.', effects: [{ obj: ['Q01', 'o4'] }] },
  ] },
  { id: 'q01b', text: 'Tìm một việc cho đôi tay và một việc cho đầu óc. Thư viện, xưởng, sân tập... Và đừng ngại hỏi. Hỏi không phải là yếu.', effects: [{ obj: ['Q01', 'o4'] }, { trust: 3 }] },
  { id: 'q02', text: 'Ăn có vừa miệng không? Chiều nay tôi hay đi bộ vòng sân, cậu ra cùng không?', choices: [
    { id: 'yes', text: 'Dạ, chiều cháu ra sân cùng bác.', effects: [{ obj: ['Q02', 'o3'] }, { trust: 3 }] },
    { id: 'tired', text: 'Cháu hơi mệt, nhưng sẽ cố ra một chút.', effects: [{ obj: ['Q02', 'o3'] }, { respect: 2 }] },
  ] },
  { id: 'q03a', text: 'Đến rồi à. Ta đi qua mấy cái mốc sơn vàng quanh sân nhé, đi chậm thôi. Đi xong ghé lại tôi.', effects: [{ obj: ['Q03', 'o1'] }] },
  { id: 'q03_where', text: 'Chiều tôi ở sân. Nếu mưa thì ở phòng tập. Cậu ra đó gặp tôi nhé.', choices: [BYE] },
  { id: 'q03b', text: 'Một vòng rồi. Giờ cậu muốn tập thêm vài động tác giãn cơ, hay ngồi ghế đá nói chuyện chút?', choices: [
    { id: 'ex', text: 'Tập giãn cơ cùng bác.', effects: [{ choice: ['Q03', 'ending', 'exercise'] }, { obj: ['Q03', 'o5'] }], next: 'q03_ex' },
    { id: 'talk', text: 'Ngồi nói chuyện với bác.', effects: [{ choice: ['Q03', 'ending', 'talk'] }, { obj: ['Q03', 'o5'] }], next: 'q03_talk' },
  ] },
  { id: 'q03_ex', text: 'Hít sâu... thở ra... Thấy chưa, người nhẹ hẳn. Ngày mai cán bộ hồ sơ sẽ gọi cậu lập kế hoạch đấy, nghĩ trước xem muốn học hay làm gì.' },
  { id: 'q03_talk', text: 'Tôi từng nghĩ thời gian ở đây là thời gian mất đi. Giờ tôi nghĩ khác: mỗi ngày học được một điều thì nó không mất. Ngày mai cán bộ hồ sơ sẽ gọi cậu lập kế hoạch đấy.' },
  { id: 's04', text: 'Buổi đọc hôm nay vui chứ? Người ta nhớ những ai ngồi lại cùng mình.', effects: [{ obj: ['S04', 'o3'] }, { trust: 3 }] },
  { id: 'chat', text: '{hoaLine}', choices: [
    { id: 'advice', text: 'Bác cho cháu lời khuyên hôm nay.', next: 'advice', once: 'day', effects: [{ trust: 2 }, { mood: 2 }] },
    { id: 'group', text: 'Nhóm đọc gặp khi nào ạ?', next: 'group' },
    BYE,
  ] },
  { id: 'advice', text: '{wisdom}', choices: [BYE] },
  { id: 'group', text: 'Tối Thứ Ba, Thứ Năm, Thứ Bảy, bảy giờ ở thư viện. Cậu cứ đến, không cần đăng ký.', choices: [BYE] },
]);

// ---------- Newcomer Bình ----------
graph('res_binh', [
  { cond: [{ obj: ['S06', 'o1'] }], node: 's06a' },
  { cond: [{ obj: ['S06', 'o4'] }], node: 's06b' },
  { cond: [{ q: 'S06', is: 'active' }], node: 'follow' },
  { node: 'chat' },
], [
  { id: 's06a', text: 'Chào... Mình là Bình, mới đến hôm qua. Mình chưa biết chỗ tắm rửa với nhà ăn ở đâu...', choices: [
    { id: 'guide', text: 'Đi theo mình, mình dẫn đi.', effects: [{ obj: ['S06', 'o1'] }, { act: 'binhFollow' }, { trust: 3 }] },
    { id: 'later', text: 'Lát nữa mình quay lại dẫn bạn đi nhé.' },
  ] },
  { id: 'follow', text: 'Mình đi theo bạn nè. Bạn cứ đi trước.', choices: [
    { id: 'wait', text: 'Bạn đợi ở khu phòng ở nhé, lát mình quay lại.', effects: [{ act: 'binhStop' }] },
    { id: 'go', text: 'Đi tiếp nào.', effects: [{ act: 'binhFollow' }] },
  ] },
  { id: 's06b', text: 'Cảm ơn bạn nhiều lắm. Giờ mình thấy đỡ lạ lẫm rồi. Có gì mình cũng sẽ giúp lại người mới sau.', effects: [{ obj: ['S06', 'o4'] }, { act: 'binhStop' }] },
  { id: 'chat', text: '{name}: Mấy hôm nay mình quen dần rồi. {groupLine}', choices: [BYE] },
]);

// ---------- Long (F54 boundaries) ----------
graph('res_long', [
  { cond: [{ obj: ['S08', 'o1'] }], node: 'press' },
  { node: 'chat' },
], [
  { id: 'press', text: 'Ê, người mới. Có bánh quy hay mì gói không? Đưa đây một ít, coi như làm quen.', choices: [
    { id: 'decline', text: 'Không, đó là đồ của mình. Mình không đưa.', effects: [{ obj: ['S08', 'o1'] }, { act: 'longDecline' }], next: 'declined' },
    { id: 'give', text: '(Tự nguyện) Đây, mình chia một gói.', cond: [{ item: 'biscuits' }], effects: [{ obj: ['S08', 'o1'] }, { act: 'longGive' }], next: 'gave' },
    { id: 'leave', text: '(Rời đi, không trả lời)', effects: [{ obj: ['S08', 'o1'] }, { act: 'longLeave' }] },
    { id: 'help', text: 'Mình sẽ nói chuyện này với cán bộ khu ở.', effects: [{ obj: ['S08', 'o1'] }, { act: 'longHelp' }], next: 'help' },
  ] },
  { id: 'declined', text: 'Hừ... được thôi. (Long nhún vai rồi bỏ đi.)' },
  { id: 'gave', text: 'À... cảm ơn. (Long có vẻ bất ngờ.) Lần sau không cần đâu.' },
  { id: 'help', text: 'Thôi thôi, khỏi. Tôi đùa thôi mà.' },
  { id: 'chat', text: '{longLine}', choices: [
    { id: 'mediate', text: 'Mình muốn nói chuyện đàng hoàng với anh.', cond: [{ flag: 'long_mediation_offered' }, { noFlag: 'long_mediated' }], effects: [{ act: 'longMediate' }], next: 'mediated' },
    BYE,
  ] },
  { id: 'mediated', text: 'Ừ... hôm trước tôi hơi quá. Ở đây ai cũng căng thẳng. Coi như huề nhé.' },
]);

// ---------- Peer listener Quân ----------
graph('res_quan', [{ node: 'hi' }], [
  { id: 'hi', text: 'Chào bạn. Mình là Quân, có học khóa lắng nghe đồng đẳng. Nếu bạn muốn nói chuyện gì thì mình ở đây — không bắt buộc đâu.', choices: [
    { id: 'talk', text: 'Mình muốn nói chuyện một chút.', next: 'talk', once: 'day', effects: [{ act: 'supportSession', arg: 'peer' }] },
    { id: 'how', text: 'Có thể hẹn nói chuyện riêng ở đâu?', next: 'how' },
    { id: 'no', text: 'Cảm ơn, lúc khác nhé.' },
  ] },
  { id: 'talk', text: 'Mình nghe đây. (Hai người ngồi nói chuyện về những ngày đầu, về nỗi nhớ nhà. Quân chủ yếu lắng nghe.) Cảm ơn bạn đã chia sẻ. Khi nào cần cứ tìm mình.', choices: [BYE] },
  { id: 'how', text: 'Cô Linh ở Phòng yên tĩnh có lịch trò chuyện riêng. Hoặc vào mục Đời sống › Chăm sóc để đặt hẹn. Bạn có thể hủy bất cứ lúc nào.', choices: [BYE] },
]);

// ---------- Generic resident ----------
graph('res_generic', [
  { cond: [{ trust: 30 }], node: 'friend' },
  { node: 'greet' },
], [
  { id: 'greet', text: '{name}: {greeting}', choices: [
    { id: 'how', text: 'Dạo này thế nào?', next: 'how', once: 'day', effects: [{ trust: 1 }] },
    { id: 'tip', text: 'Có mẹo gì cho người mới không?', next: 'tip' },
    { id: 'help', text: 'Có việc gì mình giúp được không?', next: 'help', once: 'day', effects: [{ trust: 2 }, { xp: ['communication', 2] }] },
    BYE,
  ] },
  { id: 'friend', text: '{name}: Ồ, bạn đó hả! {groupLine}', choices: [
    { id: 'how', text: 'Dạo này thế nào?', next: 'how', once: 'day', effects: [{ trust: 1 }] },
    { id: 'tip', text: 'Có tin gì mới không?', next: 'tip' },
    BYE,
  ] },
  { id: 'how', text: '{groupLine}', choices: [BYE] },
  { id: 'tip', text: '{tip}', choices: [BYE] },
  { id: 'help', text: 'Cảm ơn nha. Thật ra chỉ cần có người hỏi thăm là vui rồi.', choices: [BYE] },
]);

// ---------- Staff ----------
function staffGraph(role: string, intro: string, services: DChoice[], extraEntries: DialogueGraph['entries'] = [], extraNodes: DNode[] = []) {
  graph(`staff_${role}`, [...extraEntries, { node: 'hi' }], [
    { id: 'hi', text: intro, choices: [...services, BYE] },
    ...extraNodes,
  ]);
}

staffGraph('intake', 'Chào bạn. Tôi phụ trách tiếp nhận. Bạn cần xem lại hồ sơ hành trình hay nội quy?', [
  { id: 'admission', text: 'Xem hồ sơ tiếp nhận của tôi.', effects: [{ open: 'admission' }] },
  { id: 'rules', text: 'Giải thích lại nội quy và quyền.', effects: [{ open: 'handbook' }, { act: 'ackOrientation' }] },
]);
staffGraph('residential', 'Cán bộ khu ở đây. Có việc gì cần không?', [
  { id: 'move', text: 'Tôi muốn xin đổi phòng.', effects: [{ act: 'requestRoomMove' }], next: 'move' },
  { id: 'safety', text: 'Tôi cảm thấy bị gây áp lực.', effects: [{ act: 'longHelp' }], next: 'safety' },
  { id: 'schedule', text: 'Cho tôi xem lịch sinh hoạt.', effects: [{ open: 'schedule' }] },
], [], [
  { id: 'move', text: 'Tôi đã ghi nhận yêu cầu, bạn theo dõi ở mục Đời sống › Yêu cầu. Khi có giường phù hợp sẽ báo chuẩn bị chuyển.', choices: [BYE] },
  { id: 'safety', text: 'Cảm ơn đã báo. Chúng tôi sẽ nói chuyện riêng với người liên quan và sắp xếp hòa giải. Bạn không bị ảnh hưởng gì vì đã lên tiếng.', choices: [BYE] },
]);
staffGraph('kitchen_supervisor', 'Bếp đang bận đấy. Cần gì nào?', [
  { id: 'help', text: 'Tôi muốn phụ bếp.', cond: [{ q: 'S12', is: ['locked', 'offered'] }], effects: [{ start: 'S12' }, { obj: ['S12', 'o1'] }], next: 'help' },
  { id: 'done', text: 'Tôi đã phụ sơ chế xong.', cond: [{ obj: ['S12', 'o3'] }], effects: [{ obj: ['S12', 'o3'] }], next: 'thanks' },
  { id: 'work', text: 'Tôi muốn đăng ký ca bếp hoặc khóa nấu ăn.', effects: [{ open: 'programs' }] },
], [], [
  { id: 'help', text: 'Tốt. Ra bàn sơ chế, rửa rau, xếp khay. Làm xong báo tôi.', choices: [BYE] },
  { id: 'thanks', text: 'Gọn gàng đấy. Muốn thì đăng ký ca bếp, tôi cần người cẩn thận.', choices: [BYE] },
]);
staffGraph('server', 'Chào bạn! Lấy suất ở quầy nhé. Bạn có chế độ ăn riêng không?', [
  { id: 'diet', text: 'Tôi muốn đổi chế độ ăn.', effects: [{ open: 'support' }] },
  { id: 'menu', text: 'Hôm nay có món gì?', next: 'menu' },
], [], [{ id: 'menu', text: '{menu}', choices: [BYE] }]);
staffGraph('librarian', 'Thư viện xin chào. Bạn muốn mượn hay trả sách?', [
  { id: 'job', text: 'Có việc gì tôi giúp được không?', cond: [{ q: 'S01', is: ['locked', 'offered'] }], effects: [{ start: 'S01' }, { obj: ['S01', 'o1'] }], next: 'job' },
  { id: 'jobdone', text: 'Tôi đã sắp xong các kệ.', cond: [{ obj: ['S01', 'o3'] }], effects: [{ obj: ['S01', 'o3'] }], next: 'thanks' },
  { id: 'b1', text: 'Mượn "Kỹ năng làm việc nhóm".', cond: [{ noItem: 'book_skills' }], effects: [{ act: 'borrowBook', arg: 'book_skills' }] },
  { id: 'b2', text: 'Mượn tiểu thuyết "Bến sông xa".', cond: [{ noItem: 'book_novel' }], effects: [{ act: 'borrowBook', arg: 'book_novel' }] },
  { id: 'b3', text: 'Mượn tập thơ "Mùa lúa".', cond: [{ noItem: 'book_poetry' }], effects: [{ act: 'borrowBook', arg: 'book_poetry' }] },
  { id: 'b4', text: 'Mượn "Lịch sử làng nghề".', cond: [{ noItem: 'book_history' }], effects: [{ act: 'borrowBook', arg: 'book_history' }] },
  { id: 'ret', text: 'Trả sách đã mượn.', cond: [{ pred: 'hasBook' }], effects: [{ act: 'returnBooks' }] },
], [], [
  { id: 'job', text: 'Ôi tốt quá. Mấy kệ bên phải bị xáo trộn sau giờ trả sách. Bạn sắp lại giúp nhé, xong báo tôi.', choices: [BYE] },
  { id: 'thanks', text: 'Cảm ơn bạn! Nhóm đọc tối nay chắc chắn sẽ thấy dễ tìm sách hơn.', choices: [BYE] },
]);
staffGraph('teacher', 'Chào bạn. Lớp có khóa đọc viết và mộc cơ bản. Bạn quan tâm gì?', [
  { id: 'topic', text: 'Thầy gợi ý giúp một chủ đề để tự học.', cond: [{ q: 'S02', is: ['locked', 'offered'] }], effects: [{ start: 'S02' }, { obj: ['S02', 'o1'] }], next: 'topic' },
  { id: 'share', text: 'Em đã đọc xong cuốn sách thầy gợi ý.', cond: [{ obj: ['S02', 'o4'] }], effects: [{ obj: ['S02', 'o4'] }], next: 'share' },
  { id: 'enroll', text: 'Xem các khóa học.', effects: [{ open: 'programs' }] },
], [], [
  { id: 'topic', text: 'Thử cuốn "Kỹ năng làm việc nhóm" ở thư viện. Đọc xong kể tôi nghe điều gì em thấy đáng nhớ.', choices: [BYE] },
  { id: 'share', text: 'Ồ, em nhớ phần lắng nghe trước khi phản bác à? Hay đấy. Tôi ghi nhận cho hồ sơ học tập của em.', choices: [BYE] },
]);
staffGraph('care', 'Phòng y tế đây. Bạn cần đặt lịch hẹn hay muốn nghỉ một chút?', [
  { id: 'care', text: 'Mở mục chăm sóc & nhu cầu.', effects: [{ open: 'support' }] },
  { id: 'sleep', text: 'Tôi khó ngủ mấy hôm nay.', next: 'sleep' },
], [], [{ id: 'sleep', text: 'Thử đi ngủ đúng giờ, tránh trà buổi tối. Nếu vẫn khó ngủ, đặt hẹn để chúng tôi lập kế hoạch nghỉ. Tôi không đưa ra chẩn đoán ở đây.', effects: [{ start: 'S05' }], choices: [BYE] }]);
staffGraph('laundry', 'Đổi đồ giặt hả? Mang đồ cần giặt tới quầy nhé.', [
  { id: 'job', text: 'Cô có cần giúp gì không?', cond: [{ q: 'S03', is: ['locked', 'offered'] }], effects: [{ start: 'S03' }, { obj: ['S03', 'o1'] }], next: 'job' },
  { id: 'free', text: 'Tôi cần khăn, xà phòng (cấp phát thiết yếu).', effects: [{ act: 'freeEssentials' }] },
], [], [{ id: 'job', text: 'Tư phòng 3 nhờ đổi bộ đồ mà chưa ghé được. Cháu đổi đồ ở quầy rồi mang giúp cậu ấy nhé.', effects: [{ give: ['uniform_worn', 1] }], choices: [BYE] }]);
staffGraph('production_lead', 'Kho và tổ sản xuất đây. Cần nhận việc, nhận dụng cụ hay bàn giao?', [
  { id: 'work', text: 'Xem bảng công việc.', effects: [{ open: 'work' }] },
  { id: 'tools', text: 'Nhận / trả dụng cụ.', effects: [{ open: 'work_tools' }] },
  { id: 'hand', text: 'Bàn giao và kết ca.', effects: [{ open: 'work_handover' }] },
  { id: 'safety', text: 'Nếu tôi mệt giữa ca thì sao?', next: 'rest' },
], [], [{ id: 'rest', text: 'Báo tôi, chuyển sang việc ngồi ở bàn phân loại. Không ai bị trừ suất ăn hay quyền lợi vì nghỉ.', choices: [BYE] }]);
staffGraph('workshop_supervisor', 'Xưởng làm việc theo ca. Bạn muốn nhận phân công không?', [
  { id: 'work', text: 'Mở bảng công việc (mộc, vườn, ao…).', effects: [{ open: 'work' }] },
  { id: 'programs', text: 'Xem điều khoản ca làm.', effects: [{ open: 'programs' }] },
  { id: 'gloves', text: 'Cho tôi xin găng tay lao động.', cond: [{ noItem: 'work_gloves' }], effects: [{ act: 'issueGloves' }] },
  { id: 'safety', text: 'Nếu tôi thấy việc nào không an toàn thì sao?', next: 'safety' },
], [], [{ id: 'safety', text: 'Dừng lại và báo tôi ngay. Không ai bị phạt vì dừng một việc không an toàn.', choices: [BYE] }]);
staffGraph('coach', 'Khởi động kỹ trước khi tập nhé!', [
  { id: 'group', text: 'Tôi muốn tập cùng nhóm.', cond: [{ q: 'S11', is: ['locked', 'offered'] }], effects: [{ start: 'S11' }, { obj: ['S11', 'o1'] }], next: 'group' },
  { id: 'tip', text: 'Cho tôi một lời khuyên tập luyện.', next: 'tip' },
], [], [
  { id: 'group', text: 'Tốt! Tập hai hiệp ở thảm hoặc xà, nhớ uống nước sau đó.', choices: [BYE] },
  { id: 'tip', text: 'Đừng tập khi quá mệt. Năng lượng thấp thì nghỉ, ngày mai tập tiếp.', choices: [BYE] },
]);
staffGraph('case_advisor', 'Chào bạn, tôi là Thu, cán bộ hồ sơ. Tôi có thể giúp gì?', [
  { id: 'cases', text: 'Gửi hoặc xem yêu cầu / kiến nghị.', effects: [{ open: 'cases' }] },
  { id: 'legal', text: 'Xem tình trạng hồ sơ hư cấu và đặt hẹn riêng.', effects: [{ open: 'cases' }] },
], [
  { cond: [{ obj: ['Q04', 'o1'] }], node: 'q04a' },
  { cond: [{ obj: ['Q04', 'o4'] }], node: 'q04b' },
], [
  { id: 'q04a', text: 'Bạn đã quen nhịp sống ở đây rồi. Giờ hãy chọn một việc dài hơi: một khóa học hoặc một ca làm. Bạn xem danh sách và đăng ký nhé — đổi ý sau cũng được.', effects: [{ obj: ['Q04', 'o1'] }], choices: [{ id: 'open', text: 'Mở danh sách khóa học & công việc.', effects: [{ open: 'programs' }] }, BYE] },
  { id: 'q04b', text: 'Tốt lắm. Tôi đã ghi nhận vào kế hoạch của bạn. Bước tiếp theo: giữ liên lạc với người thân. Chị Yến ở Góc liên lạc sẽ hướng dẫn.', effects: [{ obj: ['Q04', 'o4'] }], choices: [BYE] },
]);
staffGraph('reintegration', 'Tôi là Phong, cố vấn tái hòa nhập. Mình cùng lập kế hoạch cho sau này nhé.', [
  { id: 'plan', text: 'Mở kế hoạch rời cơ sở.', effects: [{ open: 'release' }] },
], [{ cond: [{ obj: ['Q06', 'o1'] }], node: 'q06' }], [
  { id: 'q06', text: 'Kế hoạch không cần hoàn hảo. Chọn những mục tiêu thực tế: nơi ở, việc làm, học tập, tài chính, liên lạc, hỗ trợ. Mốc xem xét theo câu chuyện sẽ đến; không có công thức “ngoan là được ra”.', effects: [{ obj: ['Q06', 'o1'] }], choices: [{ id: 'open', text: 'Mở kế hoạch.', effects: [{ open: 'release' }] }, BYE] },
]);
staffGraph('contact_clerk', 'Góc liên lạc xin chào. Gửi thư, hẹn gọi hay thăm gặp?', [
  { id: 'contact', text: 'Mở mục liên lạc.', effects: [{ open: 'contacts' }] },
]);
staffGraph('service_clerk', 'Quầy dịch vụ. Đặt hàng, nhận hàng hay cấp phát thiết yếu?', [
  { id: 'shop', text: 'Mở cửa hàng & tài khoản.', effects: [{ open: 'store' }] },
  { id: 'free', text: 'Tôi cần vật dụng thiết yếu (miễn phí).', effects: [{ act: 'freeEssentials' }] },
]);
staffGraph('visits', 'Phòng thăm gặp. Lịch hẹn được sắp ở Góc liên lạc.', [
  { id: 'contact', text: 'Xem lịch thăm gặp của tôi.', effects: [{ open: 'contacts' }] },
]);
staffGraph('maintenance', 'Chú Năm đây. Cái gì hỏng cứ báo chú.', [
  { id: 'report', text: 'Báo một thiết bị hỏng.', effects: [{ open: 'cases' }] },
], [{ cond: [{ obj: ['S09', 'o3'] }], node: 's09' }], [
  { id: 's09', text: 'Bồn rửa xong rồi đó, thay cái van là chạy. Cảm ơn cháu đã báo sớm.', effects: [{ obj: ['S09', 'o3'] }], choices: [BYE] },
]);
staffGraph('facilitator', 'Chào bạn, Phòng yên tĩnh luôn mở cho ai cần chút bình yên.', [
  { id: 'prep', text: 'Cô có cần giúp chuẩn bị buổi sinh hoạt không?', cond: [{ q: 'S07', is: ['locked', 'offered'] }], effects: [{ start: 'S07' }, { obj: ['S07', 'o1'] }], next: 'prep' },
  { id: 'support', text: 'Đặt hẹn trò chuyện hỗ trợ.', effects: [{ open: 'support' }] },
  { id: 'culture', text: 'Tôi muốn chọn tham gia / không tham gia sinh hoạt văn hóa.', effects: [{ open: 'support' }] },
], [], [{ id: 'prep', text: 'Cảm ơn! Trải giúp cô mấy tấm thảm nhé. Buổi tối ai muốn có thể ngồi lại — có cả giờ suy ngẫm không tôn giáo.', choices: [BYE] }]);
staffGraph('property_clerk', 'Kho tài sản ký gửi. Bạn muốn xem biên nhận?', [
  { id: 'receipts', text: 'Xem tài sản & biên nhận.', effects: [{ open: 'property' }] },
]);

export const DIALOGUES: Record<string, DialogueGraph> = Object.fromEntries(G.map((g) => [g.id, g]));

// ---------- Text pools for tokens (deterministic by day/npc) ----------
export const POOLS: Record<string, string[]> = {
  greeting: ['Chào. Ăn gì chưa?', 'Ừ, chào bạn.', 'Hôm nay trời {weather} ha.', 'Người mới phòng 3 phải không?', 'Chào nhé.'],
  tip: [
    'Đến nhà ăn sớm thì đỡ phải xếp hàng.',
    'Bồn rửa trong cùng nước mạnh nhất.',
    'Ai lỡ bữa thì xin suất dự phòng ở quầy, không ai bị bỏ đói đâu.',
    'Thư gửi đi mất chừng nửa ngày mới tới, hồi âm thì lâu hơn chút.',
    'Thiếu xà phòng thì xin ở quầy dịch vụ, miễn phí.',
    'Mệt quá thì xin hẹn phòng y tế, được nghỉ ca có lý do.',
    'Có gì thắc mắc về quyết định nào thì gửi đơn xem xét lại ở phòng hồ sơ.',
    'Thứ Bảy có lớp nấu ăn ở bếp, vui lắm.',
  ],
  readers: ['Mình đang đọc dở một cuốn hay lắm.', 'Tối nay nhóm đọc gặp nhau đó.', 'Thư viện mới có sách về nghề mộc.'],
  sports: ['Chiều nay ra sân chạy vài vòng không?', 'Chân hơi mỏi vì tập hôm qua.', 'Trời mưa thì vào phòng tập.'],
  kitchen: ['Bếp hôm nay nấu canh bí.', 'Dậy sớm phụ bếp quen rồi.', 'Chú Bảy khó tính mà dạy kỹ lắm.'],
  workshop: ['Xưởng đang đóng hàng gấp.', 'Đóng xong lô thùng là nghỉ.', 'Ca chiều nay mát hơn.'],
  quiet: ['Phòng yên tĩnh dễ chịu lắm.', 'Mình thích ngồi một mình chút.', 'Tối có giờ suy ngẫm đó.'],
  newcomers: ['Mọi thứ vẫn còn lạ lắm.', 'May có người chỉ đường.'],
  tuLine: ['Hôm nay ca xưởng mệt ghê. Bạn sao rồi?', 'Ngủ có ngon không? Mình ngáy hơi to, xin lỗi nha.', 'Nhớ trả sách đúng hạn, cô Mai nhắc đó.', 'Tối nay mình viết thư về nhà.'],
  hoaLine: ['Hôm nay thế nào rồi cậu?', 'Ngồi đây một chút đi.', 'Tôi vừa đọc xong một bài thơ hay.'],
  wisdom: ['Đừng so ngày của mình với ngày của người khác.', 'Viết ra những gì mình biết ơn, dù là chuyện nhỏ.', 'Khi giận, đi một vòng sân rồi hẵng nói.', 'Hỏi thăm người khác một câu, có khi mình cũng nhẹ lòng.'],
  longLine: ['Gì?', 'Đang bận.', 'Ừ.'],
};
