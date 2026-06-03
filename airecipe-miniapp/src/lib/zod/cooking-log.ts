/**
 * 요리 기록(cooking-log) 응답·요청 zod 스키마 — 03-API-CONTRACT §3.8b.
 *
 * cookingLogSchema: 응답 CookingLog 검증. recipe는 generatedRecipeSchema 재사용(스냅샷).
 * createCookingLogRequestSchema: 생성 요청 검증 — image(base64 data URI)/mime/rating(1..5)/review(trim 후 비어있지 않음).
 *
 * 내부 식별자(user_id/photo_path/source_recipe_id)는 응답에 비노출 (§3.8b.1).
 */

import { z } from 'zod';

import { generatedRecipeSchema } from './recipe';

export const cookingLogSchema = z.object({
  id: z.string(),
  photoUrl: z.string(),
  recipe: generatedRecipeSchema,
  rating: z.number().int().min(1).max(5),
  review: z.string(),
  createdAt: z.string(),
});

export const createCookingLogRequestSchema = z.object({
  image: z.string().regex(/^data:image\//),
  mimeType: z.string().regex(/^image\//),
  recipe: generatedRecipeSchema,
  sourceRecipeId: z.string().nullable().optional(),
  rating: z.number().int().min(1).max(5),
  review: z.string().trim().min(1).max(1000),
});

export type CookingLogSchema = z.infer<typeof cookingLogSchema>;
export type CreateCookingLogRequestSchema = z.infer<
  typeof createCookingLogRequestSchema
>;
