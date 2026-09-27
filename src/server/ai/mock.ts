import "server-only";
import type { AiProvider } from "./provider";

/**
 * E2E용 모의 AI(AI_PROVIDER=mock, Vercel 밖에서만). 입력의 <analysis>와 후기로 정해진 답을 만든다.
 * 서버 검증이 막아야 하는 답(없는 옷 id, 지어낸 인용, 없는 숫자)도 일부러 섞는다.
 * 제품명에 "AI실패"가 있으면 오류를 내 실패 화면을 확인한다.
 */
export function mockProvider(): AiProvider {
  return {
    model: "mock-fit",
    privacy: "full",
    async generateStructured({ input }) {
      if (input.includes("AI실패")) throw new Error("mock failure");
      const analysis = JSON.parse(/<analysis>([\s\S]*?)<\/analysis>/.exec(input)?.[1] ?? "{}") as {
        sizes?: Array<{ sizeLabel: string; serverSummary: string; dimensions: Array<{ dimension: string; anchors: Array<{ garment_id: string }> }> }>;
      };
      const review = /<user_review garment_id="([^"]+)">([^<]*)<\/user_review>/.exec(input);
      const sizes = analysis.sizes ?? [];
      return {
        perSize: sizes.map((s) => {
          const anchored = s.dimensions.find((d) => d.anchors.length);
          return {
            sizeLabel: s.sizeLabel,
            overallFit: `AI 요약: ${s.serverSummary}`,
            dimensionNotes: anchored
              ? [{ dimension: anchored.dimension, note: "후기에 적은 느낌과 비슷할 수 있습니다.", citedGarmentIds: [anchored.anchors[0].garment_id, "not-a-garment"] }]
              : [],
          };
        }),
        reviewEvidence: [
          ...(review ? [{ garmentId: review[1], quote: review[2].slice(0, 12), relevance: "이 옷의 후기가 판단 근거입니다." }] : []),
          { garmentId: "00000000-0000-4000-8000-000000000000", quote: "지어낸 후기", relevance: "없는 옷" },
        ],
        cautions: ["어깨가 99.9cm로 넓습니다.", "비교한 옷이 적으면 참고용으로 봐 주세요."],
        sizeRecommendationNote: sizes.length > 1 ? "치수별 비교를 보고 골라 주세요." : null,
      };
    },
  };
}
