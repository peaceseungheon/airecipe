/**
 * 요리 기록(cooking-log) 도메인·요청 타입 — 03-API-CONTRACT §3.8b.
 *
 * CookingLog: 응답 도메인 객체(camelCase, 내부 식별자 비노출).
 * CreateCookingLogRequest: POST /api/cooking-logs 요청 본문.
 * CookingLogListQuery: GET /api/cooking-logs 페이지네이션 쿼리.
 *
 * GeneratedRecipe는 ../types/recipe 정의 재사용 (recipes.ts와 동일 경로).
 */

import type { GeneratedRecipe } from './recipe';

export interface CookingLog {
  id: string;
  photoUrl: string;
  recipe: GeneratedRecipe;
  rating: number;
  review: string;
  createdAt: string;
}

export interface CreateCookingLogRequest {
  image: string;
  mimeType: string;
  recipe: GeneratedRecipe;
  sourceRecipeId?: string | null;
  rating: number;
  review: string;
}

export interface CookingLogListQuery {
  page?: number;
  pageSize?: number;
}
