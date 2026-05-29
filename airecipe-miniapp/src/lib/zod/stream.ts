/**
 * SSE 청크 zod 스키마 — baseline §A.3 / 03-API-CONTRACT §3.2.4
 *
 * 5종 discriminated union by `type` (라인 209~214 표 그대로).
 * recipe 청크의 .recipe 필드는 generatedRecipeSchema 재사용 — 4자 정합 단언(03 §3.10 #9 + 04 §4.5.3).
 * error 청크의 .error.code는 apiErrorCodeSchema 재사용 (03 §3.1.2 enum 8종).
 *
 * 검증 정책 (baseline §C.3):
 * - 각 청크는 safeParse — 실패 시 sse-client가 디버그 로그 + 무시 (forward-compat).
 * - 예외 1: recipe 청크의 zod 실패는 fatal — AI 응답을 이해하지 못함 신호.
 * - 예외 2: error 청크 통과 시 ApiClientError로 throw (baseline §C.4).
 */

import { z } from 'zod';

import { apiErrorCodeSchema } from './api';
import { generatedRecipeSchema } from './recipe';

export const metaChunkSchema = z.object({
  type: z.literal('meta'),
  dishName: z.string(),
});

export const textChunkSchema = z.object({
  type: z.literal('text'),
  delta: z.string(),
});

export const recipeChunkSchema = z.object({
  type: z.literal('recipe'),
  recipe: generatedRecipeSchema,
});

export const errorChunkSchema = z.object({
  type: z.literal('error'),
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
  }),
});

export const doneChunkSchema = z.object({
  type: z.literal('done'),
});

export const streamChunkSchema = z.discriminatedUnion('type', [
  metaChunkSchema,
  textChunkSchema,
  recipeChunkSchema,
  errorChunkSchema,
  doneChunkSchema,
]);
