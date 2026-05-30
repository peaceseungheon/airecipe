/**
 * 추천(테마 기반 요리 5개) 도메인 zod 스키마 — enum·item·응답 + AI 재검증 (ADR-011 D-R1/D-R4).
 *
 * 미니앱 `airecipe-miniapp/src/lib/zod/recommendations.ts`와 1:1 미러다(순서·값·길이 동일).
 * 두 저장소 간 코드 import는 불가하므로 의도적 복제로 동기화하며, 변경 시 양쪽을 함께 갱신한다.
 *
 * AI 응답(items 배열)은 외부 입력이므로 경계에서 zod로 재검증한다 — 구조화 출력이 형태를
 * 강제하더라도 "정확히 5개"·길이 제약의 최종 보증은 서버 zod(.length(5))가 한다.
 */
import { z } from "zod";

// 미니앱 recommendations.ts와 1:1 (순서·값 동일) — D-R1
export const SITUATION_KEYS = [
  "lunch",
  "dinner",
  "midnight",
  "gathering",
  "solo",
  "special",
] as const;
export const WEATHER_KEYS = ["hot", "cold", "rainy", "sunny", "chilly"] as const;

export const situationKeySchema = z.enum(SITUATION_KEYS);
export const weatherKeySchema = z.enum(WEATHER_KEYS);
export type SituationKey = z.infer<typeof situationKeySchema>;
export type WeatherKey = z.infer<typeof weatherKeySchema>;

/** 테마 — 상황·날씨 중 최소 1축 필수(refine). */
export const recommendationThemeSchema = z
  .object({
    situation: situationKeySchema.optional(),
    weather: weatherKeySchema.optional(),
  })
  .refine((v) => v.situation !== undefined || v.weather !== undefined, {
    message: "상황 또는 날씨 중 최소 하나는 선택해야 합니다.",
  });
export type RecommendationTheme = z.infer<typeof recommendationThemeSchema>;

/** 추천 1건 — 요리명(60자) / 한 줄 설명(120자) / 태그(최대 5개, 각 16자). */
export const recommendationItemSchema = z.object({
  dishName: z.string().min(1).max(60),
  description: z.string().min(1).max(120),
  tags: z.array(z.string().min(1).max(16)).max(5),
});
export type RecommendationItem = z.infer<typeof recommendationItemSchema>;

// AI가 내는 부분(items만) — 정확히 5개 (D-R4)
export const recommendationItemsSchema = z
  .array(recommendationItemSchema)
  .length(5);

export const recommendationsMetaSchema = z.object({
  theme: recommendationThemeSchema,
  generatedAt: z.string(),
});

export const recommendationsResponseSchema = z.object({
  items: recommendationItemsSchema,
  meta: recommendationsMetaSchema,
});
export type RecommendationsResponse = z.infer<
  typeof recommendationsResponseSchema
>;

export interface RecommendationsRequest {
  theme: RecommendationTheme;
}

/**
 * AI 응답(items 배열, unknown)을 검증·파싱한다. recipe-schema.ts parseGeneratedRecipe 패턴.
 * 실패 시 throw — 어댑터가 AIProviderError("provider_error")로 변환한다.
 */
export function parseRecommendationItems(input: unknown): RecommendationItem[] {
  return recommendationItemsSchema.parse(input);
}
