/**
 * 6 엔드포인트 호출 함수 — Phase 1 baseline §A.5 / Phase 2 baseline §A.2 / 03 §3.2~3.7.
 *
 * 각 함수는 apiFetch를 한 번 호출하고 응답 zod 스키마를 적용한 뒤 .data를 unwrap한다 (Phase 1 baseline §C.4).
 * tossUserId는 보호 5개 엔드포인트에 필수. POST /api/recipes/generate는 공개로 생략 가능 (03 §3.2.1).
 *
 * 401 자동 재시도가 필요하면 refreshTossUserId를 함께 전달한다 (05 §5.4).
 *
 * Phase 2: generateRecipeStream 신규 (SSE) + GenerateOptions에 signal 옵션 추가.
 * SSE 어댑터는 src/services/sse-client.ts에 단일 격리 (apiFetch 우회 — ADR-010 D5 비스트리밍 한정).
 */

import {
  apiListResponseSchema,
  apiResponseSchema,
} from '../lib/zod/api';
import { generatedRecipeSchema, recipeSchema } from '../lib/zod/recipe';
import { recommendationsResponseSchema } from '../lib/zod/recommendations';
import type {
  DeleteRecipeResponse,
  GenerateRecipeRequest,
  GetRecipeResponse,
  RecipeListQuery,
  RecipeListResponse,
  RecommendationsRequest,
  RecommendationsResponse,
  SaveRecipeRequest,
  StreamChunk,
  ToggleFavoriteRequest,
} from '../types/api';
import type { GeneratedRecipe, Recipe } from '../types/recipe';

import { apiFetch } from './api-client';
import { streamRecipe } from './sse-client';
import { z } from 'zod';

export interface AuthedCallOptions {
  tossUserId: string;
  refreshTossUserId?: () => Promise<string>;
}

export interface GenerateOptions {
  /** 보내도 무시되지만, 미니앱 측 호출 형식 통일을 위해 옵션 수용. */
  tossUserId?: string;
  /** 호출 측이 주입. abort 시 fetch가 throw → 호출 측 catch에서 signal.aborted로 식별. */
  signal?: AbortSignal;
}

const deleteResponseSchema = apiResponseSchema(z.object({ id: z.string() }));

/**
 * POST /api/recipes/generate (stream:false) — 공개, 단일 JSON 응답.
 * Phase 2 baseline §A.2 — 비스트리밍 경로 유지 (08 §8.6 폴백·테스트용).
 * signal 옵션 전달 — apiFetch가 fetch에 그대로 주입.
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
      signal: options.signal,
    },
  );
  return wrapped.data;
}

/**
 * POST /api/recipes/generate (stream:true) — 공개, SSE 스트림.
 * Phase 2 baseline §A.2 / §C.1~C.4 — sse-client.ts의 streamRecipe Facade.
 *
 * AsyncGenerator<StreamChunk>로 노출 — 호출 측은 `for await`로 소비.
 * error 청크는 sse-client에서 ApiClientError로 변환 throw (단일 에러 경로).
 *
 * 호출 패턴(useRecipeGenerate 훅):
 * ```ts
 * try {
 *   for await (const chunk of generateRecipeStream(req, { signal })) {
 *     handleChunk(chunk);
 *   }
 * } catch (err) {
 *   if (signal.aborted) return;
 *   // ApiClientError → 사용자 메시지 매핑
 * }
 * ```
 */
export function generateRecipeStream(
  req: GenerateRecipeRequest,
  options: GenerateOptions = {},
): AsyncGenerator<StreamChunk> {
  return streamRecipe(req, {
    signal: options.signal,
    tossUserId: options.tossUserId,
  });
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

/**
 * POST /api/recommendations — 보호, 비-stream. Phase 6 / 03 §3.8 / ADR-016 D44~D48.
 * 정확히 5개 items + meta(theme echo + generatedAt ISO).
 * AbortController는 signal 옵션으로 전달 — apiFetch가 fetch에 주입.
 */
export interface RecommendationsCallOptions extends AuthedCallOptions {
  signal?: AbortSignal;
}

export async function getRecommendations(
  req: RecommendationsRequest,
  auth: RecommendationsCallOptions,
): Promise<RecommendationsResponse['data']> {
  const wrapped = await apiFetch(
    '/api/recommendations',
    apiResponseSchema(recommendationsResponseSchema),
    {
      method: 'POST',
      body: req,
      tossUserId: auth.tossUserId,
      refreshTossUserId: auth.refreshTossUserId,
      signal: auth.signal,
    },
  );
  return wrapped.data;
}
