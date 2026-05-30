/**
 * API 계약 타입 (SSOT) — 백엔드 응답/프론트 소비 공유.
 * 계약 문서: _workspace/01_architect_api_contract.md
 *
 * 규약:
 * - 모든 성공 응답은 { data, meta? }로 래핑. 프론트는 .data를 unwrap.
 * - 모든 에러는 { error: { code, message } }.
 */

import type { GeneratedRecipe, Recipe } from "./recipe";

// ── 공통 래퍼 ────────────────────────────────────────────────

/** 단건 성공 응답 래퍼 */
export interface ApiResponse<T> {
  data: T;
}

/** 목록 성공 응답 래퍼 */
export interface ApiListResponse<T> {
  data: T[];
  meta: ListMeta;
}

export interface ListMeta {
  total: number;
  page: number;
  pageSize: number;
}

/**
 * 통일 에러 코드 (계약 0.2).
 * FORBIDDEN은 Sprint 1에서 발생하지 않는다 — 소유권 위반은 RLS 격리로 NOT_FOUND에
 * 수렴한다(존재 은닉, ADR-005). 향후 공유 레시피 등 명시적 권한 거부에 대비해 코드만 예약.
 */
export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN" // 예약 (Sprint 1 미사용, ADR-005)
  | "NOT_FOUND"
  | "AI_RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "AI_PROVIDER_ERROR"
  | "DB_ERROR";

/** 통일 에러 형식 */
export interface ApiError {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

// ── POST /api/recipes/generate ───────────────────────────────

export interface GenerateRecipeRequest {
  dishName: string;
  servings?: number;
  stream?: boolean;
}

/** 비스트리밍 응답 */
export type GenerateRecipeResponse = ApiResponse<GeneratedRecipe>;

/** 스트리밍 SSE 청크 (discriminated union by "type") */
export type StreamChunk =
  | { type: "meta"; dishName: string }
  | { type: "text"; delta: string }
  | { type: "recipe"; recipe: GeneratedRecipe }
  | { type: "error"; error: { code: ApiErrorCode; message: string } }
  | { type: "done" };

// ── GET /api/recipes ─────────────────────────────────────────

/**
 * GET /api/recipes 쿼리 파라미터의 *파싱 후* 의미 타입.
 * 와이어 형식은 모두 string("true"/"false", "2")이다. 백엔드 GET route가
 * 경계에서 coercion+검증(zod 권장)하여 이 타입으로 변환할 책임을 진다.
 * 프론트는 이 타입으로 쿼리스트링을 구성하되 URLSearchParams로 string 직렬화한다.
 */
export interface ListRecipesQuery {
  favorite?: boolean;
  page?: number;
  pageSize?: number;
}

export type RecipeListResponse = ApiListResponse<Recipe>;

// ── GET /api/recipes/[id] ────────────────────────────────────

/** 단건 조회 (딥링크/새로고침 지원). 목록의 Recipe와 동일 shape */
export type GetRecipeResponse = ApiResponse<Recipe>;

// ── POST /api/recipes ────────────────────────────────────────

export interface SaveRecipeRequest {
  recipe: GeneratedRecipe;
}

export type SaveRecipeResponse = ApiResponse<Recipe>;

// ── PATCH /api/recipes/[id]/favorite ─────────────────────────

/** 토글 아님 — 목표 값 명시(멱등) */
export interface ToggleFavoriteRequest {
  isFavorite: boolean;
}

export type ToggleFavoriteResponse = ApiResponse<Recipe>;

// ── DELETE /api/recipes/[id] ─────────────────────────────────

export type DeleteRecipeResponse = ApiResponse<{ id: string }>;

// ── POST /api/recommendations (ADR-011) ──────────────────────
// 추천 도메인 타입을 계약 SSOT로 re-export (런타임 zod는 lib/ai/recommendation-schema.ts).
import type { RecommendationsResponse } from "@/lib/ai/recommendation-schema";

export type {
  RecommendationsRequest,
  RecommendationsResponse,
  RecommendationItem,
  RecommendationTheme,
  SituationKey,
  WeatherKey,
} from "@/lib/ai/recommendation-schema";

/** 추천 성공 응답 래퍼 별칭. */
export type RecommendationsApiResponse = ApiResponse<RecommendationsResponse>;
