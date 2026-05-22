/**
 * GeneratedRecipe 런타임 검증 스키마 (zod).
 * AI 응답은 외부 입력이므로 경계에서 검증한다 — tool use가 형태를 강제하더라도
 * 누락/타입 오류를 신뢰하지 않고 파싱 단계에서 확인한다(ai-recipe-integration 원칙).
 *
 * 이 스키마의 형태는 GeneratedRecipe(src/types/recipe.ts)와 일치한다.
 */
import { z } from "zod";
import type { GeneratedRecipe } from "@/types";

const ingredientSchema = z.object({
  name: z.string(),
  quantity: z.number(),
  unit: z.string(),
});

const stepSchema = z.object({
  order: z.number(),
  instruction: z.string(),
});

const nutritionSchema = z.object({
  calories: z.number(),
  carbohydrates: z.number(),
  protein: z.number(),
  fat: z.number(),
  fiber: z.number(),
  healthNote: z.string(),
});

export const generatedRecipeSchema = z.object({
  dishName: z.string(),
  description: z.string(),
  servings: z.number(),
  cookTimeMinutes: z.number(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  ingredients: z.array(ingredientSchema).min(1),
  steps: z.array(stepSchema).min(1),
  tips: z.array(z.string()),
  nutrition: nutritionSchema,
});

/**
 * AI tool 입력(unknown)을 GeneratedRecipe로 검증·파싱한다.
 * 실패 시 throw — 어댑터가 AIProviderError(provider_error)로 변환한다.
 */
export function parseGeneratedRecipe(input: unknown): GeneratedRecipe {
  return generatedRecipeSchema.parse(input);
}
