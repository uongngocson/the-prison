// Domain types — pure data, no engine/DOM/React imports (02: domain không import engine).
// Mọi state ở đây JSON-serializable để dùng trực tiếp làm save DTO (F18).

export const SCHEMA_VERSION = 3;
export const CONTENT_VERSION = 'nd-1.1.0';

export type NeedKey = 'energy' | 'hunger' | 'hygiene' | 'mood';
export type SkillId = 'focus' | 'fitness' | 'communication';
export type ZoneId =
  | 'L01' | 'L02' | 'L03' | 'L04' | 'L05' | 'L06' | 'L07' | 'L08' | 'L09'
  | 'L10' | 'L11' | 'L12' | 'L13' | 'L14' | 'L15' | 'L16' | 'L17' | 'L18'
  | 'L19' | 'L20' | 'L21' | 'L22' | 'L23' | 'L24' | 'L25' | 'L27' | 'L28';

export interface Vec3 { x: number; y: number; z: number }

export interface ItemStack { uid: string; itemId: string; qty: number; provenance?: string }
export type ContainerId = 'bag' | 'locker' | 'mailbox' | 'stored';

export interface Inventory {
  bag: (ItemStack | null)[];
  locker: (ItemStack | null)[];
  mailbox: ItemStack[];
  stored: ItemStack[]; // tài sản ký gửi (F34) — khác inventory dùng được
}

export interface Appearance { body: 'slim' | 'medium' | 'broad'; skin: number; hair: number; hairColor: number; outfit: number }

export interface CharacterInfo { id: string; name: string; appearance: Appearance; createdAtMinute: number }

export type PlayerMode = 'grounded' | 'moving' | 'crouched' | 'acting' | 'seated' | 'sleeping' | 'talking' | 'recovering';

export interface ActiveAction {
  actionId: string;
  verb: string;
  targetId: string;
  startMinute: number;
  durationMin: number;
  elapsedMin: number;
  committed: boolean;
  params?: Record<string, string | number | boolean>;
}

export interface PlayerState {
  pos: Vec3;
  yaw: number;
  zone: ZoneId;
  mode: PlayerMode;
  crouch: boolean;
  action: ActiveAction | null;
  seatedAt: string | null;
  lastSafe: Vec3;
}

export type QuestState = 'locked' | 'offered' | 'active' | 'ready' | 'completed' | 'abandoned';
export interface QuestProgress { state: QuestState; stage: number; done: Record<string, boolean>; choices: Record<string, string>; counts: Record<string, number>; acceptedAt?: number; completedAt?: number }

export interface RelationshipCause { minute: number; text: string; delta: number }
export interface Relationship { trust: number; respect: number; familiarity: number; known: boolean; recent: RelationshipCause[]; lastDayBonus: Record<string, number> }

export interface Memory { eventId: string; type: string; subject: string; minute: number; zone: ZoneId; salience: number; expires: number }

export type NpcActivity = 'idle' | 'walking' | 'acting' | 'sleeping' | 'talking' | 'seated' | 'eating' | 'exercising' | 'reading' | 'working' | 'queue'
  | 'fighting' | 'prone' | 'restrained' | 'responding';

export interface NpcRuntime {
  id: string;
  pos: Vec3;
  yaw: number;
  zone: ZoneId;
  path: Vec3[];
  pathZones: ZoneId[];
  goalZone: ZoneId;
  goalSlot: string | null;
  goalKey: string;
  activity: NpcActivity;
  blockedFor: number;
  nextThink: number; // tick
  valence: number; // 0..1
  arousal: number; // 0..1
  memories: Memory[];
  talkingWithPlayer: boolean;
  absent: boolean; // off-site/off-duty (staff abstraction F60)
}

export type DoorState = 'open' | 'closing' | 'closed' | 'blocked';
export interface DoorRuntime { state: DoorState; reason: string; reopenAt?: number }

export type Weather = 'clear' | 'overcast' | 'rain';

export interface DynamicEventRuntime { id: string; state: 'scheduled' | 'running' | 'resolved' | 'expired'; startMinute: number; endMinute: number; actors: string[]; zone: ZoneId }

export interface WorldState {
  weather: Weather;
  nextWeatherMinute: number;
  doors: Record<string, DoorRuntime>;
  brokenFixtures: Record<string, string>; // fixtureId -> incident id
  activeEvent: DynamicEventRuntime | null;
  eventCooldowns: Record<string, number>;
  reservations: Record<string, string>; // slotId -> owner (npc id | 'player')
  lastBoundary: number; // last processed schedule boundary minute index
  stock: Record<string, number>; // commissary stock
  stockResetWeek: number;
}

export interface NotificationEntry { id: string; minute: number; severity: 'info' | 'success' | 'warning' | 'error'; group: 'quest' | 'save' | 'social' | 'life' | 'system'; text: string; persistent?: boolean; read?: boolean }

// ---------- Full Life (F33–F60), save schema v2 lifeState ----------
export type LegalStatus = 'sentenced' | 'remand' | 'transfer_pending' | 'release_preparation';
export type EpisodeState = 'arrived' | 'orienting' | 'admitted' | 'transferring' | 'released' | 'archived';

export interface Episode {
  id: string;
  policyProfileId: string;
  policyVersion: string;
  legalStatus: LegalStatus;
  state: EpisodeState;
  arrivalMinute: number;
  closedMinute?: number;
  admissionSteps: Record<'identity' | 'orientation' | 'property' | 'support' | 'housing', boolean>;
  orientation: Record<string, 'unseen' | 'presented' | 'acknowledged'>;
  storyMilestones: Record<string, number>;
  familyContext: 'family' | 'estranged' | 'none';
  releaseEligibleDay: number;
}

export interface ReceiptLine { itemId: string; qty: number; from: string; to: string; reason: string }
export interface PropertyReceipt { id: string; kind: 'deposit' | 'issue' | 'inspect' | 'transfer' | 'return' | 'replace' | 'purchase'; state: 'stored' | 'issued' | 'returned' | 'disputed' | 'committed'; lines: ReceiptLine[]; minute: number; supersedes?: string; sourceActionId: string }

export interface HousingAssignment { id: string; zone: ZoneId; roomId: string; bedSlotId: string; state: 'reserved' | 'active' | 'moving' | 'ended'; startMinute: number; endMinute?: number; reason: string; transferId?: string }

export type BookingKind = 'routine' | 'call' | 'visit' | 'legal' | 'care' | 'support' | 'study' | 'work' | 'laundry' | 'culture';
export type BookingState = 'requested' | 'booked' | 'waiting' | 'active' | 'completed' | 'excused' | 'missed' | 'cancelled' | 'rescheduled';
export interface Booking { id: string; serviceId: string; kind: BookingKind; participant?: string; start: number; end: number; state: BookingState; reason?: string; outcome?: string; supersedes?: string; sourceActionId: string; zone: ZoneId }

export interface LedgerEntry { id: string; batchId: string; account: 'player' | 'clearing'; direction: 'debit' | 'credit'; amount: number; reason: string; sourceKey: string; minute: number; reverses?: string }
export interface FictionalAccount { state: 'open' | 'review' | 'settled'; balance: number; reserved: number; entries: LedgerEntry[]; sourceKeys: string[] }

export type OrderState = 'quoted' | 'reserved' | 'preparing' | 'ready' | 'delivered' | 'cancelled' | 'refunded';
export interface OrderLine { itemId: string; qty: number; unitPrice: number }
export interface Quote { id: string; lines: OrderLine[]; total: number; expiresMinute: number; catalogVersion: string }
export interface Order { id: string; quoteId: string; lines: OrderLine[]; total: number; state: OrderState; createdMinute: number; readyMinute: number; sourceActionId: string; history: string[] }

export interface Contact { id: string; nameKey: string; relation: 'family' | 'friend' | 'advisor' | 'peer' | 'mentor' | 'dependent'; channels: ('letter' | 'call' | 'visit' | 'legal')[]; state: 'known' | 'available' | 'unavailable' | 'archived' }
export interface Correspondence { id: string; contactId: string; channel: 'letter' | 'call' | 'visit' | 'legal'; direction: 'incoming' | 'outgoing'; topic: string; state: 'draft' | 'submitted' | 'processing' | 'delivered' | 'returned' | 'completed' | 'archived'; dueMinute?: number; read?: boolean; minute: number; replyTo?: string; bookingId?: string }

export type CaseCategory = 'property' | 'legal' | 'care' | 'safety' | 'accommodation' | 'maintenance' | 'discipline_review' | 'general';
export type CaseState = 'submitted' | 'acknowledged' | 'in_review' | 'answered' | 'appealed' | 'resolved' | 'withdrawn';
export interface DecisionRecord { minute: number; actorRole: string; text: string; state: CaseState }
export interface ServiceCase { id: string; category: CaseCategory; facts: string[]; state: CaseState; assignedRole: string; assignedActor?: string; dueMinute: number; history: DecisionRecord[]; parentCaseId?: string; incidentRef?: string; sourceActionId: string; response?: string; minute: number }

export interface SupportPlan { kind: 'functional' | 'care' | 'wellbeing' | 'diet' | 'privacy' | 'language' | 'cultural' | 'family'; state: 'offered' | 'active' | 'declined' | 'review_needed' | 'closed'; flags: string[]; nextReview?: number; restUntilMinute?: number }

export type EnrollmentState = 'available' | 'waitlisted' | 'enrolled' | 'in_progress' | 'paused' | 'excused' | 'completed' | 'withdrawn';
export interface Enrollment { programId: string; kind: 'study' | 'work' | 'culture'; state: EnrollmentState; completedUnits: string[]; attendance: { sessionKey: string; outcome: 'attended' | 'excused' | 'missed' | 'partial' }[]; certificateMinute?: number; credits: number }

export type IncidentState = 'reported' | 'notified' | 'in_review' | 'decided' | 'appealed' | 'overturned' | 'expired' | 'dismissed';
export interface IncidentReview { id: string; kind: 'conduct' | 'property' | 'social' | 'safeguarding'; ruleId: string; state: IncidentState; facts: { text: string; provenance: string; confidence: number }[]; responses: string[]; decision?: string; consequence?: { privilege: string; untilMinute: number }; history: DecisionRecord[]; canonicalKey: string; appealCaseId?: string; minute: number; dueMinute: number }

export interface FacilityIncident { id: string; zone: ZoneId; fixtureId?: string; kind: 'maintenance' | 'service_outage' | 'drill' | 'weather_override'; state: 'reported' | 'assigned' | 'unavailable' | 'workaround' | 'resolved'; affected: string[]; fallback: string; dueMinute: number; canonicalKey: string; reportedByPlayer: boolean; minute: number }

export interface LifecycleTransition { id: string; kind: 'room_move' | 'facility_transfer' | 'release'; state: 'proposed' | 'approved' | 'packing' | 'staged' | 'in_transit' | 'committed' | 'cancelled' | 'recovering'; fromAnchor: string; toAnchor: string; minute: number; committedMinute?: number; sourceActionId: string; packingConfirmed: boolean }

export interface ReintegrationPlan { state: 'planning' | 'review' | 'ready' | 'departed' | 'archived'; goals: Record<'housing' | 'work' | 'study' | 'finance' | 'contact' | 'support', string | null>; knownNextSteps: string[]; endingId?: string; settlementSourceKey?: string }

export interface StaffShiftRuntime { roleOnDuty: Record<string, string | null>; lastHandoverMinute: number }

export interface AttendanceRecord { key: string; minute: number; outcome: 'present' | 'exempt' | 'reconciled' | 'absent' }

export interface LifeState {
  profileRef: { id: string; version: string; hash: string };
  episode: Episode;
  receipts: PropertyReceipt[];
  housing: HousingAssignment[];
  bookings: Booking[];
  account: FictionalAccount;
  quotes: Quote[];
  orders: Order[];
  weeklyQuota: Record<string, number>;
  contacts: Contact[];
  correspondence: Correspondence[];
  cases: ServiceCase[];
  support: SupportPlan[];
  programs: Enrollment[];
  incidents: IncidentReview[];
  facility: FacilityIncident[];
  transitions: LifecycleTransition[];
  reintegration: ReintegrationPlan;
  staff: StaffShiftRuntime;
  attendance: AttendanceRecord[];
  issuedKit: { lastIssueDay: number; laundryCleanDay: number; groomedDay: number };
  diet: 'regular' | 'vegetarian' | 'no_red_meat' | 'soft';
  culturalOptIn: 'unset' | 'opted_in' | 'opted_out' | 'nonreligious';
  privileges: { recreationRestrictedUntil: number };
  sourceKeys: string[]; // canonical outcome keys for life domain (DB26 equivalent)
}

export interface GameStats { distanceWalked: number; mealsEaten: number; booksSorted: number; exercises: number; lettersSent: number; talks: number; helps: number; daysCompleted: number; sleeps: number; showers: number }

// ---------- CR-VN-01 custody (14/16): DB45–DB50 as snapshot aggregates ----------
export type ExperienceMode = 'fictional_life' | 'vn_custody';
export type PlacementGroup = 'A' | 'B' | 'review_required';
export type CustodyPhase = 'intake' | 'in_cell' | 'scheduled_movement' | 'authorized_activity' | 'returning' | 'night_confinement'
  | 'separate_housing' | 'disciplinary_confinement' | 'restrictive_housing' | 'care_transfer' | 'transfer_pending' | 'released';
export type StartSegment = 'intake' | 'midway' | 'discipline_demo' | 'separation_demo' | 'shu';

export interface JudgmentAmendment { version: number; minute: number; kind: 'reduction' | 'correction'; months: number; decisionRef: string; note: string; supersedes: number }
/** DB46 — bản án trong kịch bản (hư cấu). `declaredTermMonths` null khi chung thân. */
export interface Judgment {
  judgmentId: string;
  version: number;
  sentenceKind: 'term' | 'life';
  basis: 'single' | 'aggregate';
  declaredTermMonths: number | null;
  calendarStart: string; // YYYY-MM-DD — ngày lịch của Ngày 1 trong game
  creditedDays: number; // thời gian tạm giam trước đó được trừ (fixture)
  servedDaysAtStart: number; // đã chấp hành trước điểm bắt đầu (đoạn giữa)
  dangerousRecidivism: boolean;
  sourceEventId: string;
  amendments: JudgmentAmendment[];
  scenarioReleaseDate: string | null;
}
/** DB47 */
export interface ClassificationDecision { decisionId: string; group: PlacementGroup; reasonCode: string; judgmentVersion: number; issuerRole: string; validFromMinute: number; policyRef: string; supersedes: string | null }
/** DB48 */
export interface CustodyOrder {
  orderId: string;
  kind: 'discipline_confinement' | 'separation' | 'family_visit_restriction' | 'restrictive_housing';
  reasonCode: string;
  issuerRole: string;
  sourceDecisionId: string;
  state: 'proposed' | 'notified' | 'active' | 'suspended' | 'revoked' | 'expired' | 'completed';
  startMinute: number;
  reviewAtMinute: number | null;
  endMinute: number | null;
  roomId: string | null; // vị trí áp dụng (L21/L22)
  returnHousingRef: string | null;
  supersedes: string | null;
  note: string;
}
/** DB49 */
export interface MovementGrant { grantId: string; purpose: 'return' | 'booking' | 'program' | 'release' | 'escort'; destination: ZoneId; validFromMinute: number; validUntilMinute: number; state: 'active' | 'used' | 'expired' | 'revoked'; sourceKey: string }
/** DB50 */
export interface CustodyJournalEntry { eventId: string; canonicalSourceKey: string; kind: string; minute: number; revision: number; reasonCode: string; summary: string }
export interface CustodyState {
  mode: 'vn_custody';
  scenarioRef: { id: string; version: string; hash: string };
  presetId: string;
  startSegment: StartSegment;
  judgment: Judgment;
  classification: ClassificationDecision[];
  orders: CustodyOrder[];
  grants: MovementGrant[];
  phase: CustodyPhase;
  phaseSinceMinute: number;
  revision: number;
  journal: CustodyJournalEntry[];
  sourceKeys: string[];
  chapter: { state: 'active' | 'recap' | 'completed'; closedMinute: number | null };
  releaseState: 'serving' | 'release_due' | 'released';
  npcBeds: Record<string, string>;
  disciplineHistory: { minute: number; level: 'reprimand' | 'warning' | 'confinement'; incidentId: string }[];
  /** Biệt giam kiểu Mỹ (SHU): chương trình step-down 3 cấp. Thiếu = chưa từng vào SHU. */
  shu?: ShuState;
}
export interface ShuState {
  level: 1 | 2 | 3;
  levelSinceMinute: number;
  enteredMinute: number;
  /** Số lần vi phạm trong SHU (mỗi lần về lại cấp 1). */
  setbacks: number;
  /** Hoạt động ngoài buồng đã dùng (khóa ngày:loại) — chống lặp hiệu ứng. */
  done: string[];
}

export interface GameState {
  schemaVersion: number;
  experienceMode: ExperienceMode;
  custody: CustodyState | null;
  /** CR-LAB-01: module lao động (tùy chọn; save cũ thiếu → tạo khi tải, không gán ca). */
  labour?: LabourState;
  /** Xung đột đang diễn ra (căng thẳng → ẩu đả → báo động → khống chế → áp giải). null/thiếu = không có. */
  conflict?: ConflictState | null;
  /** Hồ sơ các vụ xung đột (điều tra, điều trần). */
  conflicts?: ConflictRecord[];
  /** Chế độ Cốt truyện: tạm giữ trong buồng SHU sau ẩu đả (chế độ Thụ án dùng lệnh custody). */
  hold?: HoldState | null;
  /** NPC đang bị giữ ở SHU sau ẩu đả. */
  npcHolds?: Record<string, { roomId: string; untilMinute: number }>;
  /** CR-TIME-01: lịch của save đã khớp lịch chung trực tuyến (tùy chọn; save cũ không có = chưa từng vào phòng). */
  online?: { dayShift: number; weekShift: number; clockVersion: number; syncedMinute: number };
  contentVersion: string;
  lineageId: string;
  generation: number;
  trustMode: 'sp_untrusted';
  seed: number;
  rngState: number;
  tick: number;
  minute: number; // absolute game minute since Day 1 00:00
  character: CharacterInfo;
  needs: Record<NeedKey, number>;
  needCauses: Record<NeedKey, string>;
  player: PlayerState;
  inventory: Inventory;
  equipped: { outfit: string | null; held: string | null };
  quests: Record<string, QuestProgress>;
  trackedQuest: string | null;
  rewardLedger: string[]; // canonical source keys (DB26)
  processedActions: string[]; // bounded recent actionIds (idempotency)
  skills: Record<SkillId, number>;
  dailyXp: { day: number; bySource: Record<string, number> };
  achievements: Record<string, { counter: number; unlockedAtMinute?: number; local: true }>;
  relationships: Record<string, Relationship>;
  reputation: Record<string, { value: number; lastCause: string }>;
  npcs: Record<string, NpcRuntime>;
  flags: Record<string, string | number | boolean>;
  tutorial: Record<string, 'unseen' | 'active' | 'done' | 'skipped'>;
  discoveredZones: ZoneId[];
  world: WorldState;
  notifications: NotificationEntry[];
  mealClaims: Record<string, boolean>; // `${day}:${meal}`
  stats: GameStats;
  chapter: number;
  life: LifeState;
  ended: boolean;
}

// ---------- Domain events (02: typed events, có ID/tick/entity) ----------
export type DomainEvent =
  | { type: 'interacted'; verb: string; targetId: string; zone: ZoneId }
  | { type: 'actionCompleted'; verb: string; targetId: string; zone: ZoneId; actionId: string }
  | { type: 'actionCancelled'; verb: string; reason: string }
  | { type: 'talked'; npcId: string }
  | { type: 'dialogueChoice'; npcId: string; nodeId: string; choiceId: string }
  | { type: 'enteredZone'; zone: ZoneId }
  | { type: 'itemAdded'; itemId: string; qty: number; container: ContainerId }
  | { type: 'itemRemoved'; itemId: string; qty: number }
  | { type: 'questUpdated'; questId: string; state: QuestState; objective?: string }
  | { type: 'xp'; skill: SkillId; amount: number; levelUp: boolean }
  | { type: 'achievement'; id: string }
  | { type: 'relationship'; npcId: string; delta: number; cause: string }
  | { type: 'boundary'; minute: number; label: string }
  | { type: 'dayStarted'; day: number }
  | { type: 'doorChanged'; doorId: string; state: DoorState; reason: string }
  | { type: 'weather'; weather: Weather }
  | { type: 'notify'; entry: NotificationEntry }
  | { type: 'subtitle'; speaker: string; text: string; durationMs?: number }
  | { type: 'flag'; key: string; value: string | number | boolean }
  | { type: 'needs'; cause: string }
  | { type: 'lifeUpdated'; domain: string }
  | { type: 'openScreen'; screen: string; params?: Record<string, string> }
  | { type: 'sound'; cue: string; caption?: string }
  | { type: 'ended'; endingId: string };

// ======================= CR-LAB-01 labour module (DB51–DB58, snapshot module v1) =======================
export type LabourAssignmentState = 'assigned' | 'active' | 'completed' | 'handed_over' | 'excused' | 'expired' | 'cancelled' | 'settled';
export interface LabourTask { id: string; label: string; done: boolean }
export interface LabourAssignment {
  id: string; workId: string; workVersion: number; day: number; window: 'am' | 'pm'; start: number; end: number;
  state: LabourAssignmentState; target: string; kitIssued: boolean; kitReturned: boolean; materialLeft: number;
  checkInMinute: number | null; tasks: LabourTask[]; batchIds: string[]; credit: number; reason?: string; rainFallback?: boolean; createdMinute: number;
}
export interface LabourTool { id: string; type: string; status: 'available' | 'issued' | 'returned' | 'review'; custodian: string | null; assignmentId: string | null }
export interface LabourPlot { id: string; stage: 'empty' | 'prepared' | 'sown' | 'seedling' | 'growing' | 'ready' | 'harvested'; cycleId: string; cycleNo: number; stageSince: number; growthMin: number; lastWatered: number; weededDay: number; caretaker: 'player' | 'team' | null }
export interface LabourPond { id: string; stage: 'growing' | 'harvest_ready' | 'harvest_pending_check' | 'restock_ready'; cohortNo: number; stockedMinute: number; feedDay: number; feeds: number; observedDay: number; loggedDay: number; careEvents: number; lastObservation: 'normal' | 'check' | null }
export interface LabourPatch { id: string; state: 'need_care' | 'weeded' | 'planted' | 'awaiting_check' | 'accepted'; since: number }
export interface LabourWoodOrder { id: string; stage: 'brief' | 'blank' | 'marked' | 'assembled' | 'finished' | 'awaiting_check' | 'rework' | 'accepted'; assignmentId: string | null; measure: string | null; assemble: string | null; failed: string[]; attempts: number }
export interface LabourBatch { id: string; kind: 'veg' | 'fish' | 'tray' | 'waste'; qty: number; unit: 'g' | 'count'; state: 'pending_check' | 'accepted' | 'held' | 'allocated'; destination: string; sourceKey: string; assignmentId: string | null; team: boolean; minute: number; reason?: string }
export interface LabourReceipt { id: string; minute: number; kind: 'assign' | 'change' | 'kit_issue' | 'kit_return' | 'qc' | 'handover' | 'settle'; text: string; assignmentId: string | null }
export interface LabourState {
  version: 1; revision: number;
  assignments: LabourAssignment[]; tools: LabourTool[]; plots: LabourPlot[]; pond: LabourPond; patches: LabourPatch[];
  orders: LabourWoodOrder[]; batches: LabourBatch[]; receipts: LabourReceipt[]; sourceKeys: string[];
  nurseryTrays: number; seedPacks: number; feedStock: number; cleanSpots: Record<string, number>; orientation: Record<string, boolean>;
}

export interface EmittedEvent { id: string; tick: number; minute: number; event: DomainEvent }

export interface CommandResult { ok: boolean; code?: string; message?: string }

// ---------- Xung đột / ẩu đả (CR-CONFLICT-01) ----------
export type ConflictPhase = 'tension' | 'brawl' | 'restrain' | 'escort';
export type ConflictChoice = 'leave' | 'calm' | 'call_staff' | 'shove' | 'strike' | 'block' | 'break_away' | 'comply';
export interface ConflictState {
  id: string;
  npcId: string;
  zone: ZoneId;
  pos: { x: number; z: number };
  phase: ConflictPhase;
  /** tick bắt đầu pha hiện tại (30 tick/giây thực, dừng khi tạm dừng) */
  phaseTick: number;
  startedMinute: number;
  /** Ai ra tay trước — người đầu tiên có hành vi thân thể (lời nói không tính). */
  initiator: 'player' | 'npc' | null;
  /** Ai mở đầu căng thẳng bằng lời. */
  provokedBy: 'player' | 'npc';
  line: string;
  playerStrikes: number;
  npcStrikes: number;
  blocks: number;
  escaped: boolean;
  alarm: boolean;
  complied: boolean;
  sprayed: boolean;
  responders: string[];
  nextNpcStrikeTick: number;
  log: string[];
  /** Loại đối thủ: NPC cục bộ (mặc định), người chơi thật (trực tuyến) hoặc bạn tù AI trực tuyến. */
  opp?: 'npc' | 'peer' | 'bot';
  peer?: { id: string; name: string; look: Appearance; outfit: number };
  /** Vị trí đối thủ trực tuyến (controller cập nhật mỗi khung) và tick thấy gần nhất. */
  oppPos?: { x: number; z: number };
  oppSeen?: number;
  /** Mốc thời gian (epoch ms) đòn đầu tiên của mỗi bên — xác định người khởi xướng giữa hai máy. */
  myFirstAt?: number;
  theirFirstAt?: number;
  calmMine?: boolean;
  calmTheirs?: boolean;
  lastBlockTick?: number;
}
export type ConflictVerdict = 'pending' | 'initiator' | 'mutual' | 'self_defense' | 'deescalated' | 'reported';
export interface ConflictRecord {
  id: string;
  minute: number;
  npcId: string;
  zone: ZoneId;
  initiator: 'player' | 'npc' | null;
  playerStrikes: number;
  npcStrikes: number;
  sprayed: boolean;
  verdict: ConflictVerdict;
  incidentId?: string;
  hearingAt?: number;
  /** Đối thủ là người chơi/bạn tù trực tuyến (tên hiển thị). */
  peerName?: string;
  reportNo: string;
}
export interface HoldState { roomId: string; untilMinute: number; reason: string; conflictId: string }