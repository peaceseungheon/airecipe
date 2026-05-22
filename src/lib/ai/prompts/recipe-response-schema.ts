/**
 * Gemini responseSchema for GeneratedRecipe — 구조화 JSON 출력 강제(ADR-002).
 *
 * 책임: Gemini `responseMimeType: "application/json"` + `responseSchema`로 구조를 강제한다.
 * Claude의 `emit_recipe` tool input_schema(recipe-tool-schema.ts)와 동일한 구조의
 * Provider별 표현이며, 둘 다 SSOT인 `GeneratedRecipe`(src/types/recipe.ts) 및
 * `generatedRecipeSchema`(zod, recipe-schema.ts)와 1:1로 일치해야 한다.
 *
 * CRITICAL: 필드명·필수 여부가 GeneratedRecipe와 어긋나면 AI→DTO→UI 경계면 버그가 된다.
 * 본 스키마 변경 시 recipe-tool-schema.ts, recipe-schema.ts와 함께 갱신할 것.
 */
import { Type, type Schema } from "@google/genai";

export const RECIPE_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    dishName: { type: Type.STRING, description: "요리 이름" },
    description: { type: Type.STRING, description: "요리에 대한 한두 문장 소개" },
    servings: { type: Type.INTEGER, description: "기준 인분 수" },
    cookTimeMinutes: { type: Type.INTEGER, description: "예상 조리 시간(분)" },
    difficulty: {
      type: Type.STRING,
      enum: ["easy", "medium", "hard"],
      description: "조리 난이도",
    },
    ingredients: {
      type: Type.ARRAY,
      description: "재료 목록",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "재료명" },
          quantity: { type: Type.NUMBER, description: "수량(숫자)" },
          unit: { type: Type.STRING, description: "단위(g, ml, 큰술, 개 등)" },
        },
        required: ["name", "quantity", "unit"],
        propertyOrdering: ["name", "quantity", "unit"],
      },
    },
    steps: {
      type: Type.ARRAY,
      description: "조리 순서",
      items: {
        type: Type.OBJECT,
        properties: {
          order: { type: Type.INTEGER, description: "단계 번호(1부터)" },
          instruction: { type: Type.STRING, description: "해당 단계 설명" },
        },
        required: ["order", "instruction"],
        propertyOrdering: ["order", "instruction"],
      },
    },
    tips: {
      type: Type.ARRAY,
      description: "요리 팁(없으면 빈 배열)",
      items: { type: Type.STRING },
    },
    nutrition: {
      type: Type.OBJECT,
      description: "1인분 기준 영양 정보",
      properties: {
        calories: { type: Type.NUMBER, description: "칼로리(kcal)" },
        carbohydrates: { type: Type.NUMBER, description: "탄수화물(g)" },
        protein: { type: Type.NUMBER, description: "단백질(g)" },
        fat: { type: Type.NUMBER, description: "지방(g)" },
        fiber: { type: Type.NUMBER, description: "식이섬유(g)" },
        healthNote: { type: Type.STRING, description: "건강 포인트 1~2문장" },
      },
      required: [
        "calories",
        "carbohydrates",
        "protein",
        "fat",
        "fiber",
        "healthNote",
      ],
      propertyOrdering: [
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
  propertyOrdering: [
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
};
