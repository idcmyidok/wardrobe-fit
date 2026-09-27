import "server-only";
import { AiError, type AiProvider, type StructuredRequest } from "./provider";

/**
 * Google Gemini(무료 등급) 요약 제공자. REST(generateContent)를 직접 부른다.
 * 무료 등급은 입력을 Google 제품 개선에 쓸 수 있어 privacy "minimal"(실측·계산값만)로 보낸다.
 * 한도 초과(429)나 오류면 AiError를 던지고, 부르는 쪽이 규칙 요약으로 돌아간다.
 */

export const DEFAULT_GEMINI_MODEL = "gemini-flash-lite-latest";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

async function call(apiKey: string, model: string, body: unknown, timeoutMs: number) {
  const res = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  return res;
}

function textOf(json: unknown): string {
  const parts = (json as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? "").join("");
}

export function geminiProvider(apiKey: string, model: string): AiProvider {
  return {
    model,
    privacy: "minimal",
    async generateStructured(req: StructuredRequest) {
      const base = {
        contents: [{ role: "user", parts: [{ text: req.input }] }],
        generationConfig: { maxOutputTokens: req.maxOutputTokens, temperature: 0.2, responseMimeType: "application/json" },
      };
      const system = `${req.system}\n\n출력은 ${req.toolName} 도구 대신 아래 JSON Schema에 맞는 JSON 하나로만 답하세요.`;
      // 1차: JSON Schema로 출력 모양을 강제한다. 스키마를 받지 않는 모델이면(400) 스키마를 지시문에 넣어 한 번 더.
      let res = await call(
        apiKey,
        model,
        { ...base, systemInstruction: { parts: [{ text: system }] }, generationConfig: { ...base.generationConfig, responseJsonSchema: req.jsonSchema } },
        req.timeoutMs,
      );
      if (res.status === 400) {
        res = await call(
          apiKey,
          model,
          { ...base, systemInstruction: { parts: [{ text: `${system}\n${JSON.stringify(req.jsonSchema)}` }] } },
          req.timeoutMs,
        );
      }
      if (res.status === 429) throw new AiError("quota");
      if (!res.ok) throw new AiError(`http_${res.status}`);
      const text = textOf(await res.json()).trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
      try {
        return JSON.parse(text);
      } catch {
        throw new AiError("invalid_json");
      }
    },
  };
}
