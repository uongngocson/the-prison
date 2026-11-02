// Interaction verbs (F05/F12/F22–F24/F29/F49/F50) — availability + atomic commit once per actionId.
import type { GameState, ZoneId } from './types';
import type { PropDef } from '../content/world';
import { CELL_ROOMS, CUSTODY_ROOMS, ZONE_BY_ID } from '../content/world';
import { homeBed, homeRoom, isVN } from './custody';
import { type Ctx, addItem, adjustRep, awardXp, changeNeed, countItem, notify, removeItem } from './core';
import { ITEM_BY_ID, LIBRARY_BOOKS } from '../content/items';
import { MEALS, ROLL_CALLS } from '../content/schedule';
import { MENU, PROGRAMS, CALL_LINES, VISIT_LINES } from '../content/life';
import { activeBookingAt, attendSession, careRestActive, collectOrders, completeBooking, currentBed, freeEssentials, laundryExchange, releaseEligible, reportFault, sessionNow } from './life';
import { dayOf, minuteOfDay, hm, fmtClock } from './util';

export interface VerbOption { verb: string; label: string; duration: number; enabled: boolean; reason?: string; instant?: boolean; screen?: string }

export function zoneOpen(s: GameState, zone: ZoneId): boolean {
  const d = s.world.doors[`door_${zone}`];
  return !d || d.state === 'open' || d.state === 'closing';
}
export function currentMeal(s: GameState) {
  const m = minuteOfDay(s.minute);
  return MEALS.find((x) => m >= x.from && m < x.to) ?? null;
}
function lastMissedMeal(s: GameState) {
  const m = minuteOfDay(s.minute);
  const day = dayOf(s.minute);
  const past = MEALS.filter((x) => x.to <= m);
  const last = past[past.length - 1];
  if (!last) return null;
  if (s.mealClaims[`${day}:${last.id}`]) return null;
  if (s.mealClaims[`${day}:${last.id}:spare`]) return null;
  return last;
}
const foods = ['meal_tray', 'spare_meal', 'noodles', 'biscuits', 'fruit'];
function hasFood(s: GameState) { return foods.some((f) => countItem(s, f, ['bag', 'mailbox']) > 0); }
function hasBook(s: GameState) { return LIBRARY_BOOKS.some((b) => countItem(s, b, ['bag']) > 0); }
function ownLocker(s: GameState): string | null {
  if (isVN(s)) return homeRoom(s)?.locker ?? null;
  const bed = currentBed(s);
  return CELL_ROOMS.find((c) => bed && c.beds.includes(bed))?.locker ?? CUSTODY_ROOMS.find((c) => bed && c.beds.includes(bed))?.locker ?? null;
}
const ACT = (verb: string, label: string, duration: number, enabled = true, reason?: string): VerbOption => ({ verb, label, duration, enabled, reason });
const OPEN = (verb: string, label: string, screen: string): VerbOption => ({ verb, label, duration: 0, enabled: true, instant: true, screen });

export function verbsFor(s: GameState, p: PropDef, autoComplete: boolean): VerbOption[] {
  const out: VerbOption[] = [];
  const m = minuteOfDay(s.minute);
  const broken = !!s.world.brokenFixtures[p.id];
  if (broken) return [{ verb: 'report_fault', label: 'Báo hỏng', duration: 1, enabled: !s.flags.fault_reported, reason: s.flags.fault_reported ? 'Đã báo — đang chờ sửa' : undefined, instant: true }];
  const isSession = (zone: ZoneId, kind: 'study' | 'work') => s.life.programs.some((e) => ['enrolled', 'in_progress'].includes(e.state) && PROGRAMS.find((p2) => p2.id === e.programId && p2.zone === zone && p2.kind === kind) && sessionNow(s, e.programId));
  switch (p.kind) {
    case 'bed': {
      const own = (isVN(s) ? homeBed(s) : currentBed(s)) === p.id;
      out.push(ACT('sleep', 'Ngủ', 0, own, own ? undefined : 'Không phải giường của bạn'));
      out.push(ACT('rest', 'Nghỉ ngắn (1 giờ)', 60, own, own ? undefined : 'Không phải giường của bạn'));
      if (own && hasBook(s)) out.push(ACT('read', 'Đọc sách', 30));
      break;
    }
    case 'locker':
      if (p.id === ownLocker(s)) out.push(OPEN('open_locker', 'Mở tủ cá nhân', 'inventory'));
      else out.push(ACT('noop', 'Tủ của người khác', 0, false, 'Chỉ mở tủ của bạn'));
      break;
    case 'chair': case 'bench': case 'desk':
      if (p.id === 'case_desk' || p.id === 'advisor_desk') {
        const b = activeBookingAt(s, 'legal', 'L11');
        if (b) out.push(ACT('legal_meeting', 'Vào buổi hẹn cố vấn', 30));
        out.push(OPEN('cases', 'Đơn yêu cầu & hồ sơ', 'cases'));
        break;
      }
      if (p.id === 'care_desk') {
        const b = activeBookingAt(s, 'care', 'L08');
        if (b) out.push(ACT('care_appointment', 'Vào buổi hẹn chăm sóc', 30));
        out.push(OPEN('support', 'Chăm sóc & nhu cầu', 'support'));
        break;
      }
      if (p.id === 'reintegration_desk') {
        out.push(OPEN('release', 'Kế hoạch tái hòa nhập', 'release'));
        if (releaseEligible(s)) out.push(OPEN('depart', 'Xác nhận rời cơ sở', 'release'));
        break;
      }
      if (p.id === 'property_return_desk') { out.push(OPEN('property', 'Tài sản & biên nhận', 'property')); break; }
      if (p.id === 'teacher_desk') { out.push(OPEN('programs', 'Khóa học & công việc', 'programs')); break; }
      if (p.zone === 'L14') {
        const sess = isSession('L14', 'study');
        out.push(ACT('attend_class', 'Học buổi lớp', 45, !!sess, sess ? undefined : 'Không có buổi học bạn đã đăng ký lúc này'));
        if (hasBook(s)) out.push(ACT('read', 'Tự học với sách', 30));
        break;
      }
      out.push(ACT('sit', 'Ngồi', 0));
      if (hasBook(s)) out.push(ACT('read', 'Đọc sách', 30));
      break;
    case 'table':
      if (p.zone === 'L07') { out.push(ACT('read', 'Đọc tại bàn', 30)); break; }
      out.push(ACT('eat', 'Ăn', autoComplete ? 5 : 20, hasFood(s), hasFood(s) ? undefined : 'Cần suất ăn — nhận ở quầy nhà ăn'));
      out.push(ACT('sit', 'Ngồi', 0));
      if (hasBook(s) && p.zone === 'L02') out.push(ACT('read', 'Đọc sách', 30));
      break;
    case 'counter':
      if (p.id === 'meal_counter') {
        const meal = currentMeal(s);
        const claimed = meal ? !!s.mealClaims[`${dayOf(s.minute)}:${meal.id}`] : false;
        if (meal) out.push(ACT('take_meal', `Nhận ${meal.label.toLowerCase()} — ${MENU[meal.id][s.life.diet]}`, 3, !claimed, claimed ? 'Đã nhận suất bữa này' : undefined));
        const missed = lastMissedMeal(s);
        out.push(ACT('take_spare_meal', 'Xin suất dự phòng', 2, !meal && !!missed, meal ? 'Đang trong giờ ăn — nhận suất chính' : missed ? undefined : 'Không lỡ bữa nào gần đây'));
      } else if (p.id === 'intake_desk') out.push(OPEN('admission', 'Hồ sơ tiếp nhận', 'admission'));
      else if (p.id === 'library_desk') {
        out.push(OPEN('library', 'Mượn / trả sách', 'library'));
      } else if (p.id === 'service_counter') {
        const ready = s.life.orders.some((o) => o.state === 'ready');
        if (ready) out.push(ACT('collect_orders', 'Nhận hàng đã đặt', 2));
        out.push(OPEN('store', 'Cửa hàng & tài khoản', 'store'));
        out.push(ACT('essentials', 'Nhận vật dụng thiết yếu (miễn phí)', 2));
      }
      break;
    case 'sink': out.push(ACT('wash', 'Rửa mặt, đánh răng', 10)); break;
    case 'shower': out.push(ACT('shower', 'Tắm (riêng tư)', autoComplete ? 8 : 20)); break;
    case 'toilet': out.push(ACT('use_toilet', 'Đi vệ sinh', 5)); break;
    case 'water': out.push(ACT('drink', 'Uống nước', 2)); break;
    case 'shelf':
      if (p.zone === 'L07') out.push(ACT('sort_books', 'Sắp xếp kệ sách', 30, zoneOpen(s, 'L07')));
      break;
    case 'board': {
      const map: Record<string, [string, string]> = {
        board_schedule_L02: ['view_schedule', 'schedule'], board_schedule_L03: ['view_schedule', 'schedule'], board_yard: ['view_schedule', 'schedule'],
        board_handbook: ['read_rules', 'handbook'], board_news: ['read_news', 'news'], board_catalog: ['view_catalog', 'store'],
        board_menu: ['read_menu', 'menu'], board_shift: ['view_programs', 'programs'], board_study: ['view_programs', 'programs'], board_kitchen: ['view_programs', 'programs'],
        board_cases: ['view_cases', 'cases'], board_visits: ['view_contacts', 'contacts'], board_contact: ['view_contacts', 'contacts'],
        board_achievements: ['view_achievements', 'achievements'], board_quiet: ['view_support', 'support'],
        board_schedule_L19: ['view_schedule', 'schedule'], board_schedule_L20: ['view_schedule', 'schedule'], board_rules_L21: ['view_custody', 'custody'], board_rules_L22: ['view_custody', 'custody'],
      };
      const [verb, screen] = map[p.id] ?? ['read_board', 'news'];
      out.push({ verb, label: verb === 'view_schedule' ? 'Xem lịch sinh hoạt' : `Đọc: ${p.label}`, duration: 0, enabled: true, instant: true, screen });
      break;
    }
    case 'bar': case 'mat': {
      const zoneOk = zoneOpen(s, p.zone) && !(p.zone === 'L04' && s.world.weather === 'rain');
      // F52: hệ quả chỉ chạm tới đặc quyền tùy chọn (giải trí buổi tối), không bao giờ tới quyền tối thiểu
      const restricted = s.life.privileges.recreationRestrictedUntil > s.minute && m >= hm(19);
      const reason = !zoneOk ? 'Khu đang đóng' : restricted ? 'Tạm hạn chế giải trí buổi tối (xem Đời sống › Sự việc, có thể xin xem xét lại)' : s.needs.energy < 8 ? 'Quá mệt — hãy nghỉ trước' : undefined;
      out.push(ACT('exercise', 'Tập luyện', autoComplete ? 10 : 30, zoneOk && !restricted && s.needs.energy >= 8, reason));
      break;
    }
    case 'quiet_mat': {
      out.push(ACT('quiet_time', 'Ngồi yên tĩnh', 30));
      if (s.quests.S07?.state === 'active') out.push(ACT('arrange', 'Trải thảm', 10));
      const cult = m >= hm(19) && m < hm(20, 30);
      if (cult) out.push(ACT('culture_session', s.life.culturalOptIn === 'nonreligious' ? 'Tham gia giờ suy ngẫm' : 'Tham gia sinh hoạt văn hóa', 45, s.life.culturalOptIn !== 'opted_out', s.life.culturalOptIn === 'opted_out' ? 'Bạn đã chọn không tham gia (đổi ở mục Chăm sóc)' : undefined));
      break;
    }
    case 'workbench': case 'prep': {
      const zone = p.zone;
      const work = isSession(zone, 'work');
      const study = isSession(zone, 'study');
      if (work) out.push(ACT('work_shift', careRestActive(s) ? 'Làm ca (bạn đang được miễn trừ)' : 'Làm ca (60 phút)', 60));
      if (study) out.push(ACT('attend_class', 'Học thực hành', 45));
      out.push(ACT('help', zone === 'L06' ? 'Phụ sơ chế' : 'Giúp phân loại', 30, zoneOpen(s, zone), zoneOpen(s, zone) ? undefined : 'Khu đang đóng'));
      break;
    }
    case 'laundry':
      out.push(ACT('laundry_exchange', 'Đổi đồ giặt', 5));
      if (isSession('L13', 'work')) out.push(ACT('work_shift', 'Làm ca giặt (60 phút)', 60));
      out.push(ACT('essentials', 'Nhận khăn/xà phòng thiết yếu', 2));
      break;
    case 'barber': {
      const ok = dayOf(s.minute) - s.life.issuedKit.groomedDay >= 3;
      out.push(ACT('grooming', 'Cắt tóc, cạo râu', 15, ok, ok ? undefined : 'Có thể làm lại sau vài ngày'));
      break;
    }
    case 'phone': {
      const b = activeBookingAt(s, 'call', 'L16');
      out.push(ACT('call', b ? 'Bắt đầu cuộc gọi đã hẹn' : 'Gọi (cần đặt lịch)', 20, !!b, b ? undefined : 'Chưa có lịch gọi lúc này — đặt ở Bàn thư từ'));
      break;
    }
    case 'mail_desk': out.push(OPEN('letters', 'Thư từ & đặt lịch liên lạc', 'contacts')); break;
    case 'visit_table': {
      const b = activeBookingAt(s, 'visit', 'L12');
      out.push(ACT('visit', b ? 'Bắt đầu buổi thăm gặp' : 'Thăm gặp (cần đặt lịch)', 45, !!b, b ? undefined : 'Chưa có lịch thăm gặp lúc này'));
      break;
    }
    case 'medbed': {
      const ok = careRestActive(s) || !!activeBookingAt(s, 'care', 'L08');
      out.push(ACT('rest_care', 'Nghỉ phục hồi (1 giờ)', 60, ok, ok ? undefined : 'Cần lịch hẹn hoặc kế hoạch chăm sóc'));
      break;
    }
    case 'track': out.push({ verb: 'touch_track', label: 'Chạm mốc đi bộ', duration: 0, enabled: true, instant: true }); break;
    case 'tray_return': out.push(ACT('return_tray', 'Trả khay', 1, !!s.flags.tray_out, s.flags.tray_out ? undefined : 'Không có khay cần trả')); break;
    case 'muster': {
      const rc = ROLL_CALLS.find((r) => m >= r.at - 10 && m < r.end);
      out.push({ verb: 'muster', label: rc ? `Có mặt — ${rc.label}` : 'Điểm tập trung (điểm danh 06:30 & 21:30)', duration: 0, enabled: true, instant: true });
      break;
    }
  }
  return out;
}

/** Duration in game minutes may depend on context (booking end). */
export function commitAction(ctx: Ctx, verb: string, p: PropDef | null, actionId: string, params: Record<string, string | number | boolean> = {}): string | null {
  const s = ctx.s;
  const day = dayOf(s.minute);
  const zone = s.player.zone;
  let msg: string | null = null;
  switch (verb) {
    case 'rest': changeNeed(ctx, 'energy', 10, 'Nghỉ ngắn'); break;
    case 'sleep': {
      const hours = Number(params.hours ?? 0);
      if (hours >= 7 && (isVN(s) ? homeBed(s) : currentBed(s)) === p?.id) s.flags.slept_well = true;
      s.stats.sleeps++;
      break;
    }
    case 'eat': {
      const food = foods.find((f) => countItem(s, f, ['bag']) > 0) ?? foods.find((f) => countItem(s, f, ['mailbox']) > 0);
      if (!food) return 'Không còn đồ ăn.';
      removeItem(ctx, food, 1, countItem(s, food, ['bag']) ? ['bag'] : ['mailbox']);
      const ef = ITEM_BY_ID[food].effects ?? {};
      for (const [k, v] of Object.entries(ef)) changeNeed(ctx, k as 'hunger', v as number, `Ăn ${ITEM_BY_ID[food].name.toLowerCase()}`);
      if (food === 'meal_tray') s.flags.tray_out = true;
      if (food === 'meal_tray' || food === 'spare_meal') s.stats.mealsEaten++;
      const company = Object.values(s.npcs).filter((n) => !n.absent && n.zone === zone && (n.activity === 'eating' || n.activity === 'seated') && Math.hypot(n.pos.x - s.player.pos.x, n.pos.z - s.player.pos.z) < 4);
      if (company.length) { changeNeed(ctx, 'mood', 3, 'Ăn cùng mọi người'); for (const n of company.slice(0, 2)) ctx.emit({ type: 'relationship', npcId: n.id, delta: 0, cause: 'ăn cùng bàn' }); }
      msg = company.length ? `Bạn ăn cùng ${company.length} người.` : null;
      break;
    }
    case 'take_meal': {
      const meal = currentMeal(s);
      if (!meal) return 'Ngoài giờ ăn.';
      const key = `${day}:${meal.id}`;
      if (s.mealClaims[key]) return 'Bạn đã nhận suất bữa này.';
      s.mealClaims[key] = true;
      addItem(ctx, 'meal_tray', 1, { overflow: 'mailbox', provenance: `meal:${key}` });
      s.flags.got_meal = true;
      msg = `${meal.label}: ${MENU[meal.id][s.life.diet]}.`;
      break;
    }
    case 'take_spare_meal': {
      const missed = lastMissedMeal(s);
      if (!missed) return 'Không có bữa bị lỡ.';
      s.mealClaims[`${day}:${missed.id}:spare`] = true;
      addItem(ctx, 'spare_meal', 1, { overflow: 'mailbox', provenance: 'spare' });
      s.flags.got_meal = true;
      msg = 'Bạn nhận suất dự phòng (bánh mì, trái cây).';
      break;
    }
    case 'return_tray': s.flags.tray_out = false; s.stats.helps++; break;
    case 'wash': {
      changeNeed(ctx, 'hygiene', 25, 'Rửa mặt');
      const due = s.flags.toilet_wash_due as number | undefined;
      if (due !== undefined && s.minute - due <= 30) { changeNeed(ctx, 'hygiene', 5, 'Rửa tay sau khi đi vệ sinh'); delete s.flags.toilet_wash_due; msg = 'Đã rửa tay sạch sẽ sau khi đi vệ sinh.'; }
      break;
    }
    case 'shower': changeNeed(ctx, 'hygiene', 60, 'Tắm'); changeNeed(ctx, 'mood', 3, 'Tắm'); s.stats.showers++; break;
    case 'use_toilet': changeNeed(ctx, 'mood', 2, 'Đi vệ sinh — nhẹ người'); s.flags.toilet_wash_due = s.minute; msg = 'Xả nước xong. Nhớ rửa tay ở bồn rửa nhé.'; break;
    case 'drink': changeNeed(ctx, 'mood', 1, 'Uống nước'); changeNeed(ctx, 'hunger', 2); s.flags.hydrated_day = day; break;
    case 'read': {
      const n = ((s.flags[`reads:${day}`] as number) ?? 0) + 1;
      s.flags[`reads:${day}`] = n;
      s.flags.reads = ((s.flags.reads as number) ?? 0) + 1;
      awardXp(ctx, 'focus', n <= 3 ? 10 : 3, `read:${actionId}`);
      changeNeed(ctx, 'mood', 4, 'Đọc sách');
      changeNeed(ctx, 'energy', -2);
      break;
    }
    case 'sort_books':
      awardXp(ctx, 'focus', 5, `sort:${actionId}`); awardXp(ctx, 'communication', 5, `sort_c:${actionId}`);
      s.stats.booksSorted++; s.stats.helps++;
      adjustRep(ctx, 'readers', 2, 'Sắp xếp thư viện');
      break;
    case 'exercise':
      awardXp(ctx, 'fitness', 10, `ex:${actionId}`);
      changeNeed(ctx, 'energy', -3, 'Tập luyện'); changeNeed(ctx, 'mood', 5, 'Tập luyện'); changeNeed(ctx, 'hygiene', -5, 'Tập luyện');
      s.stats.exercises++;
      break;
    case 'help':
      awardXp(ctx, 'communication', 10, `help:${actionId}`);
      changeNeed(ctx, 'energy', -3);
      s.stats.helps++;
      adjustRep(ctx, zone === 'L06' ? 'kitchen' : 'workshop', 2, 'Giúp việc chung');
      break;
    case 'work_shift': {
      if (careRestActive(s)) return 'Bạn đang trong kế hoạch nghỉ — ca làm được miễn trừ, không cần làm.';
      msg = attendSession(ctx, zone, 60) ?? 'Không có ca làm lúc này.';
      changeNeed(ctx, 'energy', -4, 'Làm ca'); changeNeed(ctx, 'hygiene', -3);
      break;
    }
    case 'attend_class': msg = attendSession(ctx, zone, 45) ?? 'Không có buổi học lúc này.'; changeNeed(ctx, 'energy', -2); break;
    case 'quiet_time': changeNeed(ctx, 'mood', 8, 'Giờ yên tĩnh'); changeNeed(ctx, 'energy', 3); break;
    case 'culture_session':
      changeNeed(ctx, 'mood', 10, 'Sinh hoạt văn hóa'); awardXp(ctx, 'communication', 5, `culture:${day}`);
      ctx.emit({ type: 'actionCompleted', verb: 'quiet_time', targetId: p?.id ?? '', zone, actionId: `${actionId}_q` });
      break;
    case 'arrange': s.stats.helps++; break;
    case 'grooming': changeNeed(ctx, 'mood', 4, 'Chải chuốt'); changeNeed(ctx, 'hygiene', 5); s.life.issuedKit.groomedDay = day; break;
    case 'laundry_exchange': msg = laundryExchange(ctx); break;
    case 'collect_orders': msg = collectOrders(ctx) ? null : 'Không có đơn sẵn sàng.'; break;
    case 'essentials': msg = freeEssentials(ctx); break;
    case 'report_fault': if (p) msg = reportFault(ctx, p.id); break;
    case 'rest_care': changeNeed(ctx, 'energy', 15, 'Nghỉ phục hồi'); changeNeed(ctx, 'mood', 3); break;
    case 'call': case 'visit': case 'legal_meeting': case 'care_appointment': {
      const kind = verb === 'call' ? 'call' : verb === 'visit' ? 'visit' : verb === 'legal_meeting' ? 'legal' : 'care';
      const b = activeBookingAt(s, kind, zone, true);
      if (!b) return 'Không còn lịch hẹn hợp lệ.';
      const lines = kind === 'call' ? CALL_LINES[b.participant ?? ''] ?? ['...'] : kind === 'visit' ? VISIT_LINES[b.participant ?? ''] ?? ['...'] : kind === 'legal'
        ? ['Cố vấn: Hồ sơ của bạn đang ở giai đoạn thi hành bình thường (hư cấu).', 'Cố vấn: Mốc xem xét tiếp theo theo câu chuyện là từ Ngày 7. Không có công thức “ngoan là được ra”.', 'Cố vấn: Bạn có thể gửi yêu cầu bất kỳ lúc nào; thông tin buổi hẹn là riêng tư.']
        : ['Nhân viên y tế: Mình trao đổi một chút về giấc ngủ và năng lượng nhé.', 'Nhân viên y tế: Tôi không đưa ra chẩn đoán. Tôi đề xuất kế hoạch nghỉ 24 giờ và hẹn xem lại.', 'Nhân viên y tế: Ca làm/lớp học trong thời gian nghỉ được miễn trừ.'];
      completeBooking(ctx, b, kind === 'call' || kind === 'visit' ? 'Cuộc trò chuyện ấm áp' : 'Đã trao đổi');
      ctx.emit({ type: 'openScreen', screen: 'scene', params: { title: kind === 'call' ? 'Cuộc gọi (chỉ phụ đề)' : kind === 'visit' ? 'Thăm gặp' : kind === 'legal' ? 'Buổi hẹn cố vấn (riêng tư)' : 'Buổi hẹn chăm sóc (riêng tư)', lines: lines.join('\n') } });
      break;
    }
    case 'touch_track': break;
  }
  ctx.emit({ type: 'actionCompleted', verb, targetId: p?.id ?? '', zone, actionId });
  return msg;
}


export function needHint(s: GameState): string | null {
  if (s.needs.hunger < 25) return currentMeal(s) ? 'Bạn đói — đang giờ ăn ở Nhà ăn.' : 'Bạn đói — xin suất dự phòng ở quầy Nhà ăn.';
  if (s.needs.energy < 25) return 'Bạn mệt — nghỉ trên giường hoặc ngủ sớm.';
  if (s.needs.hygiene < 25) return 'Nên tắm rửa ở khu Vệ sinh & giặt.';
  return null;
}
export function zoneHoursLabel(zone: ZoneId): string {
  const h = ZONE_BY_ID[zone].hours;
  return h ? `${fmtClock(h[0])}–${fmtClock(h[1])}` : 'Luôn mở';
}
