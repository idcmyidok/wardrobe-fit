import "server-only";
import { AiError, type AiProvider, type StructuredRequest } from "./provider";

/**
 * Google Gemini(무료 등급) 요약 제공자. REST(generateContent)를 직접 부른다.
 * 무료 등급은 입력을 Google 제품 개선에 쓸 수 있어 privacy "minimal"(실측·계산값만)로 보낸다.
 * 한도 초과(429)나 오류면 AiError를 던지고, 부르는 쪽이 규칙 요약으로 돌아간다.
 */

export const DEFAULT_GEMINI_MODEL = "gemini-flash-lite-latest";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
/**
 * "-latest" 별칭은 생각(thinking) 모델로 바뀔 수 있다. 생각 토큰도 출력 한도에 들어가서
 * 한도가 작으면 JSON이 중간에 잘린다(invalid_json). 생각은 끄고, 한도는 넉넉히 둔다(무료 등급이라 비용 없음).
 */
const MIN_OUTPUT_TOKENS = 8192;

async function call(apiKey: string, model: string, body: unknown, timeoutMs: number) {
  return fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

interface GeminiResponse {
  candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
  promptFeedback?: { blockReason?: string };
}

/** 생각(thought) 부분은 빼고 답 텍스트만 */
const textOf = (json: GeminiResponse) =>
  (json.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("");

/** 코드 블록이나 앞뒤 설명이 붙어도 JSON 객체 부분만 꺼낸다. */
export function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  try {
    return JSON.parse(t);
  } catch {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(t.slice(start, end + 1));
      } catch {}
    }
    throw new AiError("invalid_json");
  }
}

export function geminiProvider(apiKey: string, model: string): AiProvider {
  return {
    model,
    privacy: "minimal",
    async generateStructured(req: StructuredRequest) {
      const system = `${req.system}\n\n출력은 ${req.toolName} 도구 대신 아래 JSON Schema에 맞는 JSON 하나로만 답하세요.`;
      const generationConfig = { maxOutputTokens: Math.max(req.maxOutputTokens, MIN_OUTPUT_TOKENS), responseMimeType: "application/json" };
      const contents = [{ role: "user", parts: [{ text: req.input }] }];
      // 모델이 받지 않는 설정이면(400) 하나씩 빼고 다시: 생각 끄기 → JSON Schema 강제 → 지시문에 스키마.
      const attempts = [
        { contents, systemInstruction: { parts: [{ text: system }] }, generationConfig: { ...generationConfig, responseJsonSchema: req.jsonSchema, thinkingConfig: { thinkingBudget: 0 } } },
        { contents, systemInstruction: { parts: [{ text: system }] }, generationConfig: { ...generationConfig, responseJsonSchema: req.jsonSchema } },
        { contents, systemInstruction: { parts: [{ text: `${system}\n${JSON.stringify(req.jsonSchema)}` }] }, generationConfig },
      ];
      const deadline = Date.now() + req.timeoutMs;
      let res: Response | null = null;
      let used = 0;
      for (; used < attempts.length; used++) {
        res = await call(apiKey, model, attempts[used], Math.max(1000, deadline - Date.now()));
        if (res.status !== 400) break;
      }
      // 잠깐 붐비는 경우(500·503)는 남은 시간 안에서 한 번만 다시.
      if (res && (res.status === 500 || res.status === 503) && deadline - Date.now() > 3000) {
        res = await call(apiKey, model, attempts[used], deadline - Date.now());
      }
      if (!res) throw new AiError("no_response");
      if (res.status === 429) throw new AiError("quota");
      if (!res.ok) throw new AiError(`http_${res.status}`);
      const json = (await res.json()) as GeminiResponse;
      if (json.promptFeedback?.blockReason) throw new AiError(`blocked_${json.promptFeedback.blockReason}`);
      const finish = json.candidates?.[0]?.finishReason;
      if (finish === "MAX_TOKENS") throw new AiError("max_tokens");
      if (finish && finish !== "STOP") throw new AiError(`finish_${finish}`);
      return extractJson(textOf(json));
    },
  };
}
