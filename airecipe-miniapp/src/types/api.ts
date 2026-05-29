/**
 * API 공통 응답·에러·요청·응답·스트림 타입 — baseline §A.1 / 03-API-CONTRACT §3.1.*, §3.2~3.7
 *
 * 단언 (03 §3.10):
 * - 모든 성공 응답은 { data, meta? }로 래핑. 배열 직접 반환 없음.
 * - 모든 에러는 { error: { code, message } } shape. 미니앱은 error.code로 분기 (HTTP 상태 분기 금지).
 * - 응답 키는 camelCase. userId 키 없음. snake_case 누출 없음.
 * - GeneratedRecipe(미저장) ≠ Recipe(저장됨, id 포함).
 */

import type { GeneratedRecipe, Recipe } from './recipe';

// ─── 공통 래핑 (03 §3.1.1) ────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
}

export interface ApiListResponse<T> {
  data: T[];
  meta: ListMeta;
}

export interface ListMeta {
  total: number;
  page: number;
  pageSize: number;
}

// ─── 에러 (03 §3.1.2) ───────────────────────────────────────────────────────

/**
 * FORBIDDEN은 ADR-005에 의해 Sprint 1에서 미발생 (404로 수렴).
 * 코드에는 포함하되 미니앱이 분기 매핑을 만들지 않는다 (03 §3.10 #7).
 */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'AI_RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'AI_PROVIDER_ERROR'
  | 'DB_ERROR';

export interface ApiError {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

// ─── POST /api/recipes/generate (03 §3.2) ──────────────────────────────────

export interface GenerateRecipeRequest {
  dishName: string;
  servings?: number;
  stream?: boolean;
}

export type GenerateRecipeResponse = ApiResponse<GeneratedRecipe>;

// ─── GET /api/recipes (03 §3.3) ────────────────────────────────────────────

export interface RecipeListQuery {
  favorite?: boolean;
  page?: number;
  pageSize?: number;
}

export type RecipeListResponse = ApiListResponse<Recipe>;

// ─── GET /api/recipes/[id] (03 §3.4) ───────────────────────────────────────

export type GetRecipeResponse = ApiResponse<Recipe>;

// ─── POST /api/recipes (03 §3.5) ───────────────────────────────────────────

export interface SaveRecipeRequest {
  recipe: GeneratedRecipe;
}

export type SaveRecipeResponse = ApiResponse<Recipe>;

// ─── PATCH /api/recipes/[id]/favorite (03 §3.6) ────────────────────────────

export interface ToggleFavoriteRequest {
  isFavorite: boolean;
}

export type ToggleFavoriteResponse = ApiResponse<Recipe>;

// ─── DELETE /api/recipes/[id] (03 §3.7) ────────────────────────────────────

export type DeleteRecipeResponse = ApiResponse<{ id: string }>;

// ─── POST /api/recommendations (03 §3.8) — Phase 6 ─────────────────────────

import type {
  RecommendationTheme,
  RecommendationsResponse as RecommendationsResponseInner,
} from '../lib/zod/recommendations';

export type {
  RecommendationItem,
  RecommendationTheme,
} from '../lib/zod/recommendations';

export interface RecommendationsRequest {
  theme: RecommendationTheme;
}

export type RecommendationsResponse = ApiResponse<RecommendationsResponseInner>;

// ─── 스트리밍 청크 (03 §3.2.4) — Phase 1은 타입만 ──────────────────────────

export type StreamChunk =
  | { type: 'meta'; dishName: string }
  | { type: 'text'; delta: string }
  | { type: 'recipe'; recipe: GeneratedRecipe }
  | { type: 'error'; error: { code: ApiErrorCode; message: string } }
  | { type: 'done' };
