// Item catalog (DB08 equivalent) — immutable per content version. Không có vật cấm/chế tạo.
export type ItemType = 'food' | 'book' | 'hygiene' | 'clothing' | 'stationery' | 'personal' | 'quest' | 'tool' | 'cosmetic' | 'document';
export type ItemAction = 'eat' | 'read' | 'equip' | 'use' | 'drop';

export interface ItemDef {
  id: string;
  name: string;
  type: ItemType;
  icon: string;
  stack: number;
  questBound?: boolean;
  actions: ItemAction[];
  effects?: Partial<Record<'hunger' | 'energy' | 'hygiene' | 'mood', number>>;
  price?: number; // commissary minor units (tín chỉ hư cấu ×100)
  essential?: boolean; // thuộc rightsFloor — có đường miễn phí
  personal?: boolean; // tài sản cá nhân ký gửi khi tiếp nhận
  equipSlot?: 'outfit' | 'held';
  desc: string;
}

export const ITEMS: ItemDef[] = [
  { id: 'handbook', name: 'Sổ tay sinh hoạt', type: 'document', icon: '📘', stack: 1, actions: ['read'], desc: 'Lịch, quyền, cách nhờ hỗ trợ · mất thì xem bản sao ở Sổ tay (H).' },
  { id: 'meal_tray', name: 'Khay suất ăn', type: 'food', icon: '🍱', stack: 1, actions: ['eat'], effects: { hunger: 35, mood: 3 }, desc: 'Suất ăn theo bữa. Ăn tại bàn để gặp gỡ mọi người.' },
  { id: 'spare_meal', name: 'Suất dự phòng', type: 'food', icon: '🥪', stack: 2, actions: ['eat'], effects: { hunger: 25 }, essential: true, desc: 'Bánh mì và trái cây cho người lỡ bữa. Miễn phí.' },
  { id: 'fruit', name: 'Trái cây', type: 'food', icon: '🍌', stack: 5, actions: ['eat'], effects: { hunger: 8, mood: 2 }, price: 150, desc: 'Một quả chuối chín.' },
  { id: 'biscuits', name: 'Bánh quy', type: 'food', icon: '🍪', stack: 5, actions: ['eat'], effects: { hunger: 12, mood: 2 }, price: 250, desc: 'Gói bánh quy nhỏ từ cửa hàng nội bộ.' },
  { id: 'noodles', name: 'Mì gói', type: 'food', icon: '🍜', stack: 5, actions: ['eat'], effects: { hunger: 20 }, price: 300, desc: 'Ăn thêm buổi tối.' },
  { id: 'tea', name: 'Gói trà', type: 'food', icon: '🍵', stack: 10, actions: ['eat'], effects: { mood: 5 }, price: 200, desc: 'Một tách trà ấm giúp thư giãn.' },
  { id: 'book_novel', name: 'Tiểu thuyết "Bến sông xa"', type: 'book', icon: '📕', stack: 1, actions: ['read', 'drop'], desc: 'Sách thư viện. Trả lại quầy thủ thư khi đọc xong.' },
  { id: 'book_skills', name: 'Sách "Kỹ năng làm việc nhóm"', type: 'book', icon: '📗', stack: 1, actions: ['read', 'drop'], desc: 'Sách thư viện, nằm trong danh mục học tập.' },
  { id: 'book_poetry', name: 'Tập thơ "Mùa lúa"', type: 'book', icon: '📙', stack: 1, actions: ['read', 'drop'], desc: 'Sách thư viện.' },
  { id: 'book_history', name: 'Sách "Lịch sử làng nghề"', type: 'book', icon: '📓', stack: 1, actions: ['read', 'drop'], desc: 'Sách thư viện.' },
  { id: 'lost_book', name: 'Cuốn sách thất lạc', type: 'quest', icon: '📒', stack: 1, questBound: true, actions: [], desc: 'Cuốn sách của nhóm đọc, cần trả cho thủ thư.' },
  { id: 'towel', name: 'Khăn tắm', type: 'hygiene', icon: '🧺', stack: 1, actions: ['drop'], essential: true, desc: 'Được cấp phát. Đổi khăn sạch tại quầy giặt.' },
  { id: 'soap', name: 'Xà phòng', type: 'hygiene', icon: '🧼', stack: 3, actions: ['drop'], essential: true, price: 100, desc: 'Vật dụng vệ sinh thiết yếu — có thể nhận miễn phí tại quầy dịch vụ.' },
  { id: 'toothbrush', name: 'Bàn chải & kem', type: 'hygiene', icon: '🪥', stack: 1, actions: ['drop'], essential: true, desc: 'Được cấp phát khi tiếp nhận.' },
  { id: 'uniform_clean', name: 'Bộ đồ sạch', type: 'clothing', icon: '👕', stack: 2, actions: ['equip', 'drop'], essential: true, equipSlot: 'outfit', desc: 'Bộ đồng phục sạch.' },
  { id: 'uniform_worn', name: 'Bộ đồ cần giặt', type: 'clothing', icon: '🧦', stack: 3, actions: ['drop'], desc: 'Mang tới quầy giặt để đổi bộ sạch.' },
  { id: 'blanket', name: 'Chăn', type: 'clothing', icon: '🛏️', stack: 1, actions: ['drop'], essential: true, desc: 'Chăn được cấp phát.' },
  { id: 'notebook', name: 'Vở ghi', type: 'stationery', icon: '📔', stack: 3, actions: ['drop'], price: 120, desc: 'Ghi chép bài học.' },
  { id: 'pen', name: 'Bút bi', type: 'stationery', icon: '🖊️', stack: 3, actions: ['drop'], price: 50, desc: 'Viết thư và ghi bài.' },
  { id: 'envelope', name: 'Phong bì & tem', type: 'stationery', icon: '✉️', stack: 5, actions: ['drop'], price: 80, essential: true, desc: 'Gửi thư. Mỗi tuần có 2 phong bì miễn phí.' },
  { id: 'sport_shirt', name: 'Áo thể thao', type: 'cosmetic', icon: '🎽', stack: 1, actions: ['equip', 'drop'], price: 900, equipSlot: 'outfit', desc: 'Trang phục tập luyện (chỉ thẩm mỹ).' },
  { id: 'cardigan', name: 'Áo khoác len', type: 'cosmetic', icon: '🧥', stack: 1, actions: ['equip', 'drop'], price: 1200, equipSlot: 'outfit', desc: 'Áo khoác ấm (chỉ thẩm mỹ).' },
  { id: 'work_gloves', name: 'Găng tay lao động', type: 'tool', icon: '🧤', stack: 1, actions: ['drop'], desc: 'Được cấp khi nhận phân công xưởng.' },
  { id: 'certificate_literacy', name: 'Giấy ghi nhận: Đọc viết nâng cao', type: 'document', icon: '📜', stack: 1, questBound: true, actions: [], desc: 'Giấy ghi nhận trong game, không phải chứng chỉ thật.' },
  { id: 'certificate_carpentry', name: 'Giấy ghi nhận: Mộc cơ bản', type: 'document', icon: '📜', stack: 1, questBound: true, actions: [], desc: 'Giấy ghi nhận trong game, không phải chứng chỉ thật.' },
  { id: 'certificate_cooking', name: 'Giấy ghi nhận: Nấu ăn tập thể', type: 'document', icon: '📜', stack: 1, questBound: true, actions: [], desc: 'Giấy ghi nhận trong game, không phải chứng chỉ thật.' },
  { id: 'photo', name: 'Ảnh gia đình', type: 'personal', icon: '🖼️', stack: 1, personal: true, actions: [], desc: 'Tài sản cá nhân. Được phép giữ trong phòng.' },
  { id: 'wallet', name: 'Ví cá nhân', type: 'personal', icon: '👛', stack: 1, personal: true, actions: [], desc: 'Tài sản cá nhân, ký gửi khi tiếp nhận.' },
  { id: 'watch', name: 'Đồng hồ đeo tay', type: 'personal', icon: '⌚', stack: 1, personal: true, actions: [], desc: 'Tài sản cá nhân, ký gửi khi tiếp nhận.' },
  { id: 'street_clothes', name: 'Quần áo thường', type: 'personal', icon: '👖', stack: 1, personal: true, actions: [], desc: 'Tài sản cá nhân, ký gửi và trả lại khi rời cơ sở.' },
  { id: 'keyring', name: 'Chùm chìa khóa nhà', type: 'personal', icon: '🔑', stack: 1, personal: true, actions: [], desc: 'Tài sản cá nhân, ký gửi.' },
];

export const ITEM_BY_ID: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
export const LIBRARY_BOOKS = ['book_novel', 'book_skills', 'book_poetry', 'book_history'];
export const PERSONAL_ITEMS_ON_ARRIVAL: { itemId: string; keep: boolean }[] = [
  { itemId: 'photo', keep: true },
  { itemId: 'wallet', keep: false },
  { itemId: 'watch', keep: false },
  { itemId: 'street_clothes', keep: false },
  { itemId: 'keyring', keep: false },
];
export const STARTER_KIT: [string, number][] = [
  ['towel', 1], ['soap', 2], ['toothbrush', 1], ['uniform_clean', 1], ['blanket', 1], ['envelope', 2],
];
