/**
 * 도메인 응답 검증 zod 스키마 — baseline §A.6 / 03-API-CONTRACT §3.2.3, §3.3.3
 *
 * generatedRecipeSchema: ingredients/steps 최소 1개 (03 §3.5.2 saveRecipeRequestSchema와 동일).
 * recipeSchema: generatedRecipeSchema.extend({ id, isFavorite, createdAt }).
 */

import { z } from 'zod';

export const difficultySchema = z.enum(['easy', 'medium', 'hard']);

export const ingredientSchema = z.object({
  name: z.string(),
  quantity: z.number(),
  unit: z.string(),
});

export const stepSchema = z.object({
  order: z.number().int(),
  instruction: z.string(),
});

export const nutritionSchema = z.object({
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
  servings: z.number().int(),
  cookTimeMinutes: z.number().int(),
  difficulty: difficultySchema,
  ingredients: z.array(ingredientSchema).min(1),
  steps: z.array(stepSchema).min(1),
  tips: z.array(z.string()),
  nutrition: nutritionSchema,
});

export const recipeSchema = generatedRecipeSchema.extend({
  id: z.string(),
  isFavorite: z.boolean(),
  createdAt: z.string(),
});
