/**
 * Gemini 구조화 출력 스키마 (responseSchema) — 추천 items 형태 강제 (ADR-011 D-R4).
 * @google/genai의 Type/Schema로 정의한다. responseMimeType:"application/json"과 함께 사용.
 *
 * 주의: Gemini SchemaType에는 배열 고정 길이 강제가 없으므로 "정확히 5개"는
 * 프롬프트 + 서버 zod(.length(5))로 보증한다. 본 스키마는 보조 지시다.
 */
import { Type, type Schema } from "@google/genai";

export const RECOMMENDATIONS_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      description: "정확히 5개의 요리 추천",
      items: {
        type: Type.OBJECT,
        properties: {
          dishName: { type: Type.STRING, description: "한국어 요리명(60자 이내)" },
          description: {
            type: Type.STRING,
            description: "추천 이유 한 줄(120자 이내)",
          },
          tags: {
            type: Type.ARRAY,
            description: "키워드(최대 5개)",
            items: { type: Type.STRING },
          },
        },
        required: ["dishName", "description", "tags"],
        propertyOrdering: ["dishName", "description", "tags"],
      },
    },
  },
  required: ["items"],
  propertyOrdering: ["items"],
};
