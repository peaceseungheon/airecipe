/**
 * 추천 도메인 응답 검증 zod 스키마 — Phase 6 / 03-API-CONTRACT §3.8 / ADR-016 D44~D46.
 *
 * recommendationThemeSchema: situation/weather 최소 1개(refine).
 * recommendationItemSchema: dishName max 60, description max 120, tags max 5(각 max 16).
 * recommendationsResponseSchema: items 정확히 5개(D46 length(5)).
 */

import { z } from 'zod';

export const SITUATION_KEYS = ['lunch', 'dinner', 'midnight', 'gathering', 'solo', 'special'] as const;
export const WEATHER_KEYS = ['hot', 'cold', 'rainy', 'sunny', 'chilly'] as const;

export const situationKeySchema = z.enum(SITUATION_KEYS);
export const weatherKeySchema = z.enum(WEATHER_KEYS);

export type SituationKey = z.infer<typeof situationKeySchema>;
export type WeatherKey = z.infer<typeof weatherKeySchema>;

export const recommendationThemeSchema = z
  .object({
    situation: situationKeySchema.optional(),
    weather: weatherKeySchema.optional(),
  })
  .refine(
    (v) => v.situation !== undefined || v.weather !== undefined,
    { message: '테마를 하나 이상 선택해주세요.' },
  );

export type RecommendationTheme = z.infer<typeof recommendationThemeSchema>;

export const recommendationItemSchema = z.object({
  dishName: z.string().min(1).max(60),
  description: z.string().min(1).max(120),
  tags: z.array(z.string().min(1).max(16)).max(5),
});

export type RecommendationItem = z.infer<typeof recommendationItemSchema>;

export const recommendationsMetaSchema = z.object({
  theme: recommendationThemeSchema,
  generatedAt: z.string(),
});

export const recommendationsResponseSchema = z.object({
  items: z.array(recommendationItemSchema).length(5),
  meta: recommendationsMetaSchema,
});

export type RecommendationsResponse = z.infer<typeof recommendationsResponseSchema>;
