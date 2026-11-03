// AI gateway — kiểu dữ liệu dùng chung (không phụ thuộc nhà cung cấp, không phụ thuộc game).

export type Role = 'system' | 'user' | 'assistant';
export interface ChatMessage { role: Role; content: string }

export interface ChatRequest {
  messages: ChatMessage[];
  /** Giới hạn token trả lời. */
  maxTokens?: number;
  temperature?: number;
  /** Ép trả JSON (response_format json_object) khi model hỗ trợ. */
  json?: boolean;
  /** Chỉ dùng các model có nhãn này (vd. 'chat', 'fast'). Mặc định 'chat'. */
  capability?: ModelCapability;
  /** Model ưu tiên thử trước (nếu đang khỏe). */
  prefer?: string;
}

export type ModelCapability = 'chat' | 'fast' | 'reasoning' | 'guard';

export interface ModelSpec {
  id: string;
  provider: 'groq';
  capabilities: ModelCapability[];
  /** Thứ tự ưu tiên (nhỏ = thử trước). */
  priority: number;
  contextWindow: number;
  /** Hạn mức gói hiện tại (tham khảo để tránh gọi khi sắp hết). */
  limits?: { requestsPerDay?: number; tokensPerMinute?: number };
  /** Model suy luận: cách giấu phần suy nghĩ để không ăn hết max_tokens (đo thực tế: gpt-oss trả rỗng nếu không đặt). */
  reasoning?: 'effort' | 'format';
}

export interface Usage { promptTokens: number; completionTokens: number; totalTokens: number }

export interface ChatResult {
  text: string;
  model: string;
  usage?: Usage;
  latencyMs: number;
  /** Các lần thử trước khi thành công (để giám sát/gỡ lỗi). */
  attempts: AttemptTrace[];
}

export interface AttemptTrace { model: string; ok: boolean; ms: number; error?: AIErrorKind; status?: number; skipped?: 'circuit_open' | 'context_too_small' | 'rate_budget' }

/** Phân loại lỗi để quyết định: chuyển model, có tính là “model hỏng” không, có dừng hẳn không. */
export type AIErrorKind =
  | 'rate_limited'      // 429 — chuyển model, mở mạch tới khi hết thời gian chờ
  | 'server'            // 5xx — chuyển model, tính lỗi
  | 'timeout'           // quá hạn — chuyển model, tính lỗi
  | 'network'           // mất mạng — chuyển model, tính lỗi
  | 'context_length'    // prompt quá dài cho model này — chuyển model, KHÔNG tính lỗi
  | 'model_unavailable' // model bị gỡ/không tồn tại — chuyển model, mở mạch lâu
  | 'bad_request'       // lỗi yêu cầu (sẽ lỗi ở mọi model) — dừng
  | 'auth'              // sai key — dừng (mọi model đều lỗi)
  | 'empty'             // trả lời rỗng — chuyển model, tính lỗi
  | 'all_failed';       // đã thử hết

export class AIError extends Error {
  constructor(public kind: AIErrorKind, message: string, public status?: number, public retryAfterMs?: number, public attempts: AttemptTrace[] = []) {
    super(message);
    this.name = 'AIError';
  }
  /** Lỗi có nên thử model khác không. */
  get failover(): boolean { return !['bad_request', 'auth'].includes(this.kind); }
  /** Lỗi có phản ánh sức khỏe của model không (để mạch đếm). */
  get countsAsFailure(): boolean { return ['server', 'timeout', 'network', 'empty', 'rate_limited', 'model_unavailable'].includes(this.kind); }
}

/** Một nhà cung cấp chỉ cần thực thi một lời gọi tới một model cụ thể. */
export interface ChatProvider {
  complete(model: ModelSpec, req: ChatRequest, signal: AbortSignal): Promise<Omit<ChatResult, 'attempts' | 'latencyMs'> & { rate?: RateSnapshot }>;
}

/** Hạn mức còn lại đọc từ header phản hồi. */
export interface RateSnapshot { remainingRequests?: number; remainingTokens?: number; resetTokensMs?: number; resetRequestsMs?: number }
