import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_GEMINI_MODEL, geminiProvider } from "./gemini";
import { mockProvider } from "./mock";

/**
 * AI 호출 추상화(PROJECT_SPEC.md 17.3). 서버에서만 불린다. API 키는 이 파일에서만 읽는다.
 * - ANTHROPIC_API_KEY가 없으면 null → 화면은 규칙 요약만 보여준다(비용 0).
 * - AI_PROVIDER=mock은 E2E용 모의 AI. Vercel 배포에서는 켜지지 않는다.
 */

export interface StructuredRequest {
  system: string;
  /** 신뢰할 수 없는 데이터는 구분 태그로 감싸서 넣는다. */
  input: string;
  toolName: string;
  toolDescription: string;
  /** 도구 입력 JSON Schema. 모델 출력은 이 모양으로만 받는다. */
  jsonSchema: Record<string, unknown>;
  maxOutputTokens: number;
  timeoutMs: number;
}

export interface AiProvider {
  /** fit_checks.ai_model에 남기는 이름 */
  model: string;
  /**
   * full: 후기 원문·옷 이름까지 보낸다(유료 API, 입력을 학습에 쓰지 않음).
   * minimal: 실측과 서버 계산값만 보낸다(무료 등급이 입력을 학습에 쓸 수 있는 경우).
   */
  privacy: "full" | "minimal";
  /** 도구 입력(JSON)을 그대로 돌려준다. 검증은 부르는 쪽이 한다. */
  generateStructured(req: StructuredRequest): Promise<unknown>;
}

export const DEFAULT_MODEL = "claude-haiku-4-5";

export class AiError extends Error {}

function anthropicProvider(apiKey: string, model: string): AiProvider {
  const client = new Anthropic({ apiKey, maxRetries: 1 });
  return {
    model,
    privacy: "full",
    async generateStructured(req) {
      const response = await client.messages.create(
        {
          model,
          max_tokens: req.maxOutputTokens,
          // 시스템 문구와 도구 정의는 요청마다 같아서 캐시 대상이다(모델 최소 길이를 넘을 때만 실제로 캐시된다).
          system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
          tools: [{ name: req.toolName, description: req.toolDescription, input_schema: req.jsonSchema as Anthropic.Tool.InputSchema }],
          tool_choice: { type: "tool", name: req.toolName },
          messages: [{ role: "user", content: req.input }],
        },
        { timeout: req.timeoutMs },
      );
      if (response.stop_reason === "max_tokens") throw new AiError("max_tokens");
      if (response.stop_reason === "refusal") throw new AiError("refusal");
      const block = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === req.toolName);
      if (!block) throw new AiError("no_tool_use");
      return block.input;
    },
  };
}

/**
 * 고르는 순서: 모의 AI(E2E) → GEMINI_API_KEY(무료 등급 Gemini Flash) → ANTHROPIC_API_KEY(Claude Haiku 4.5) → 없음(규칙 요약만).
 * 호출이 실패하거나 무료 한도(429)에 걸리면 부르는 쪽이 규칙 요약으로 돌아간다.
 */
export function getAiProvider(): AiProvider | null {
  if (process.env.FIT_AI_ENABLED === "0") return null;
  if (process.env.AI_PROVIDER === "mock" && !process.env.VERCEL) return mockProvider();
  const gemini = process.env.GEMINI_API_KEY?.trim();
  if (gemini) return geminiProvider(gemini, process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL);
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;
  return anthropicProvider(key, process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL);
}
