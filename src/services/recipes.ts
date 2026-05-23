/**
 * 6 엔드포인트 호출 함수 — baseline §A.5 / 03-API-CONTRACT §3.2~3.7.
 *
 * 각 함수는 apiFetch를 한 번 호출하고 응답 zod 스키마를 적용한 뒤 .data를 unwrap한다 (baseline §C.4).
 * tossUserId는 보호 5개 엔드포인트에 필수. POST /api/recipes/generate는 공개로 생략 가능 (03 §3.2.1).
 *
 * 401 자동 재시도가 필요하면 refreshTossUserId를 함께 전달한다 (05 §5.4).
 */

import {
  apiListResponseSchema,
  apiResponseSchema,
} from '../lib/zod/api';
import { generatedRecipeSchema, recipeSchema } from '../lib/zod/recipe';
import type {
  DeleteRecipeResponse,
  GenerateRecipeRequest,
  GetRecipeResponse,
  RecipeListQuery,
  RecipeListResponse,
  SaveRecipeRequest,
  ToggleFavoriteRequest,
} from '../types/api';
import type { GeneratedRecipe, Recipe } from '../types/recipe';

import { apiFetch } from './api-client';
import { z } from 'zod';

export interface AuthedCallOptions {
  tossUserId: string;
  refreshTossUserId?: () => Promise<string>;
}

export interface GenerateOptions {
  /** 보내도 무시되지만, 미니앱 측 호출 형식 통일을 위해 옵션 수용. */
  tossUserId?: string;
}

const deleteResponseSchema = apiResponseSchema(z.object({ id: z.string() }));

/**
 * POST /api/recipes/generate — 공개. baseline은 Phase 1에서 비스트리밍(stream:false)만 구현 (§A.5 주석).
 */
export async function generateRecipe(
  req: GenerateRecipeRequest,
  options: GenerateOptions = {},
): Promise<GeneratedRecipe> {
  const body: GenerateRecipeRequest = { ...req, stream: false };
  const wrapped = await apiFetch(
    '/api/recipes/generate',
    apiResponseSchema(generatedRecipeSchema),
    {
      method: 'POST',
      body,
      tossUserId: options.tossUserId,
    },
  );
  return wrapped.data;
}

/**
 * GET /api/recipes — 보호. 본인 목록 조회.
 * 03 §3.3.3: 빈 목록도 200 + { data: [], meta }.
 */
export async function listRecipes(
  query: RecipeListQuery,
  auth: AuthedCallOptions,
): Promise<RecipeListResponse> {
  return apiFetch('/api/recipes', apiListResponseSchema(recipeSchema), {
    method: 'GET',
    query: {
      favorite: query.favorite,
      page: query.page,
      pageSize: query.pageSize,
    },
    tossUserId: auth.tossUserId,
    refreshTossUserId: auth.refreshTossUserId,
  });
}

/**
 * GET /api/recipes/[id] — 보호. 03 §3.4.4: 없음·잘못된 id·타인 소유 모두 404로 수렴 (ADR-005).
 */
export async function getRecipe(
  id: string,
  auth: AuthedCallOptions,
): Promise<Recipe> {
  const wrapped: GetRecipeResponse = await apiFetch(
    `/api/recipes/${encodeURIComponent(id)}`,
    apiResponseSchema(recipeSchema),
    {
      method: 'GET',
      tossUserId: auth.tossUserId,
      refreshTossUserId: auth.refreshTossUserId,
    },
  );
  return wrapped.data;
}

/**
 * POST /api/recipes — 보호. 03 §3.5.3: 201 + { data: Recipe }.
 */
export async function saveRecipe(
  req: SaveRecipeRequest,
  auth: AuthedCallOptions,
): Promise<Recipe> {
  const wrapped = await apiFetch(
    '/api/recipes',
    apiResponseSchema(recipeSchema),
    {
      method: 'POST',
      body: req,
      tossUserId: auth.tossUserId,
      refreshTossUserId: auth.refreshTossUserId,
    },
  );
  return wrapped.data;
}

/**
 * PATCH /api/recipes/[id]/favorite — 보호, 멱등 (토글 아님).
 * 03 §3.6.2: { isFavorite: boolean } 목표 값을 명시.
 */
export async function toggleFavorite(
  id: string,
  req: ToggleFavoriteRequest,
  auth: AuthedCallOptions,
): Promise<Recipe> {
  const wrapped = await apiFetch(
    `/api/recipes/${encodeURIComponent(id)}/favorite`,
    apiResponseSchema(recipeSchema),
    {
      method: 'PATCH',
      body: req,
      tossUserId: auth.tossUserId,
      refreshTossUserId: auth.refreshTossUserId,
    },
  );
  return wrapped.data;
}

/**
 * DELETE /api/recipes/[id] — 보호. 03 §3.7.3: 204 아니라 200 + { data: { id } }.
 */
export async function deleteRecipe(
  id: string,
  auth: AuthedCallOptions,
): Promise<DeleteRecipeResponse['data']> {
  const wrapped = await apiFetch(
    `/api/recipes/${encodeURIComponent(id)}`,
    deleteResponseSchema,
    {
      method: 'DELETE',
      tossUserId: auth.tossUserId,
      refreshTossUserId: auth.refreshTossUserId,
    },
  );
  return wrapped.data;
}
