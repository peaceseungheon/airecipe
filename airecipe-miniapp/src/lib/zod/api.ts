/**
 * 공통 응답·에러 zod 스키마 — baseline §A.6 / 03-API-CONTRACT §3.1.1, §3.1.2
 *
 * apiResponseSchema / apiListResponseSchema는 raw 래핑 응답에 적용한다 (baseline §C.4).
 * unwrap 전에 검증해야 래핑 자체 위반(03 §3.10 #1)을 잡을 수 있다.
 */

import { z } from 'zod';

export const apiErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'AI_RATE_LIMITED',
  'INTERNAL_ERROR',
  'AI_PROVIDER_ERROR',
  'DB_ERROR',
]);

export const apiErrorSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
  }),
});

export const listMetaSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export function apiResponseSchema<T extends z.ZodType>(inner: T) {
  return z.object({ data: inner });
}

export function apiListResponseSchema<T extends z.ZodType>(inner: T) {
  return z.object({
    data: z.array(inner),
    meta: listMetaSchema,
  });
}
