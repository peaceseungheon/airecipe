/**
 * Claude tool 정의 (emit_recommendations) — tool use로 구조화 JSON 출력을 강제한다 (ADR-011 D-R4).
 *
 * 주의: "정확히 5개"의 최종 보증은 서버 zod(.length(5))가 한다. 본 도구 스키마는 보조 지시다.
 */
import type Anthropic from "@anthropic-ai/sdk";

export const EMIT_RECOMMENDATIONS_TOOL_NAME = "emit_recommendations";

export const emitRecommendationsTool: Anthropic.Messages.Tool = {
  name: EMIT_RECOMMENDATIONS_TOOL_NAME,
  description: "테마에 어울리는 요리 추천 5개를 구조화된 형태로 반환한다.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        description: "정확히 5개의 요리 추천",
        items: {
          type: "object",
          properties: {
            dishName: { type: "string", description: "한국어 요리명(60자 이내)" },
            description: {
              type: "string",
              description: "추천 이유 한 줄(120자 이내)",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "키워드(최대 5개)",
            },
          },
          required: ["dishName", "description", "tags"],
        },
      },
    },
    required: ["items"],
  },
};
