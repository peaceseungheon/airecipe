/**
 * emit_recipe tool 정의 — Claude tool use로 구조화 JSON 출력을 강제한다(ADR-002).
 *
 * CRITICAL: input_schema의 필드명은 GeneratedRecipe(src/types/recipe.ts)와 정확히 일치해야 한다.
 * 어긋나면 AI→DTO→UI 경계면 버그가 된다(계약서 6절 불변식 6, QA 검증 기준).
 */
import type Anthropic from "@anthropic-ai/sdk";

export const EMIT_RECIPE_TOOL_NAME = "emit_recipe";

export const emitRecipeTool: Anthropic.Messages.Tool = {
  name: EMIT_RECIPE_TOOL_NAME,
  description: "생성된 레시피와 1인분 기준 영양 정보를 구조화된 형태로 반환한다.",
  input_schema: {
    type: "object",
    properties: {
      dishName: { type: "string", description: "요리 이름" },
      description: { type: "string", description: "요리에 대한 한두 문장 소개" },
      servings: { type: "integer", description: "기준 인분 수" },
      cookTimeMinutes: { type: "integer", description: "예상 조리 시간(분)" },
      difficulty: {
        type: "string",
        enum: ["easy", "medium", "hard"],
        description: "조리 난이도",
      },
      ingredients: {
        type: "array",
        description: "재료 목록",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "재료명" },
            quantity: { type: "number", description: "수량(숫자)" },
            unit: { type: "string", description: "단위(g, ml, 큰술, 개 등)" },
          },
          required: ["name", "quantity", "unit"],
        },
      },
      steps: {
        type: "array",
        description: "조리 순서",
        items: {
          type: "object",
          properties: {
            order: { type: "integer", description: "단계 번호(1부터)" },
            instruction: { type: "string", description: "해당 단계 설명" },
          },
          required: ["order", "instruction"],
        },
      },
      tips: {
        type: "array",
        description: "요리 팁(없으면 빈 배열)",
        items: { type: "string" },
      },
      nutrition: {
        type: "object",
        description: "1인분 기준 영양 정보",
        properties: {
          calories: { type: "number", description: "칼로리(kcal)" },
          carbohydrates: { type: "number", description: "탄수화물(g)" },
          protein: { type: "number", description: "단백질(g)" },
          fat: { type: "number", description: "지방(g)" },
          fiber: { type: "number", description: "식이섬유(g)" },
          healthNote: { type: "string", description: "건강 포인트 1~2문장" },
        },
        required: [
          "calories",
          "carbohydrates",
          "protein",
          "fat",
          "fiber",
          "healthNote",
        ],
      },
    },
    required: [
      "dishName",
      "description",
      "servings",
      "cookTimeMinutes",
      "difficulty",
      "ingredients",
      "steps",
      "tips",
      "nutrition",
    ],
  },
};
