/**
 * 요청 경계 검증 스키마 (zod) — 계약의 요청 타입을 런타임에 강제한다.
 * 경계에서만 검증하고 통과 후 내부는 타입을 신뢰한다(아키텍처 원칙).
 * 검증 실패는 ServiceError(VALIDATION_ERROR)로 변환한다.
 */
import { z } from "zod";
import { ServiceError } from "@/services/service-error";
import { recommendationThemeSchema } from "@/lib/ai/recommendation-schema";
import { generatedRecipeSchema } from "@/lib/ai/recipe-schema";

// POST /api/recipes/generate
export const generateRequestSchema = z.object({
  dishName: z.string().trim().min(1, "요리 이름을 입력하세요.").max(100),
  servings: z.number().int().min(1).max(20).optional(),
  stream: z.boolean().optional(),
});

// POST /api/recipes (저장)
export const saveRecipeRequestSchema = z.object({
  recipe: generatedRecipeSchema,
});

// PATCH /api/recipes/[id]/favorite
export const toggleFavoriteRequestSchema = z.object({
  isFavorite: z.boolean(),
});

// POST /api/recommendations — 테마 기반 요리 추천 요청 (ADR-011)
export const recommendationsRequestSchema = z.object({
  theme: recommendationThemeSchema,
});

// GET /api/recipes 쿼리 (문자열 → 의미 타입 강제 변환)
// favorite: z.coerce.boolean()는 "false"도 true로 오인하므로 enum 사용(ADR-006).
// pageSize: 상한 50은 거부(400)가 아니라 clamp(50으로 캡)한다(ADR-006). 비숫자/음수/0은 400.
export const listQuerySchema = z.object({
  favorite: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .default(20)
    .transform((n) => Math.min(n, 50)),
});

/**
 * zod 파싱을 수행하고 실패 시 ServiceError(VALIDATION_ERROR)로 변환한다.
 * Route는 try/catch로 받아 failFromError로 응답한다.
 */
export function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new ServiceError(
      "VALIDATION_ERROR",
      first?.message ?? "요청 형식이 올바르지 않습니다.",
    );
  }
  return result.data;
}
