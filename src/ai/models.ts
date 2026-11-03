// Danh mục model Groq (kiểm tra thật 03/11/2026: tất cả trả lời OK; hạn mức đọc từ header x-ratelimit-*).
// Thứ tự priority = thứ tự chuyển đổi khi lỗi. Thêm/bớt model chỉ cần sửa file này.
import type { ModelSpec } from './types';

export const GROQ_MODELS: ModelSpec[] = [
  { id: 'openai/gpt-oss-120b', provider: 'groq', capabilities: ['chat', 'reasoning'], priority: 1, contextWindow: 131072, limits: { requestsPerDay: 1000, tokensPerMinute: 8000 }, reasoning: 'effort' },
  { id: 'qwen/qwen3.8-27b', provider: 'groq', capabilities: ['chat', 'fast'], priority: 2, contextWindow: 131072, limits: { requestsPerDay: 1000, tokensPerMinute: 8000 }, reasoning: 'format' },
  { id: 'openai/gpt-oss-20b', provider: 'groq', capabilities: ['chat', 'fast'], priority: 3, contextWindow: 131072, limits: { requestsPerDay: 1000, tokensPerMinute: 8000 }, reasoning: 'effort' },
  // safeguard: model phân loại an toàn theo chính sách; chỉ dùng làm phương án chat cuối cùng
  { id: 'openai/gpt-oss-safeguard-20b', provider: 'groq', capabilities: ['chat'], priority: 9, contextWindow: 131072, limits: { requestsPerDay: 1000, tokensPerMinute: 2000 }, reasoning: 'effort' },
  // prompt-guard: KHÔNG phải model chat — trả về điểm xác suất prompt injection (0…1)
  { id: 'meta-llama/llama-prompt-guard-2-86m', provider: 'groq', capabilities: ['guard'], priority: 1, contextWindow: 512, limits: { requestsPerDay: 14400, tokensPerMinute: 15000 } },
  { id: 'meta-llama/llama-prompt-guard-2-22m', provider: 'groq', capabilities: ['guard'], priority: 2, contextWindow: 512, limits: { requestsPerDay: 14400, tokensPerMinute: 15000 } },
];
