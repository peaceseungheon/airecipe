/**
 * 요리 기록(cooking-logs) 엔드포인트 호출 함수 — 03-API-CONTRACT §3.8b.
 *
 * recipes.ts 패턴 미러: apiFetch 1회 호출 + 응답 zod 검증 + .data unwrap.
 * 4 엔드포인트 모두 보호 — tossUserId 필수, 401 자동 재시도(refreshTossUserId 주입).
 *
 * - 생성  POST   /api/cooking-logs        → 201 { data: CookingLog }
 * - 목록  GET    /api/cooking-logs        → 200 { data: CookingLog[], meta }
 * - 상세  GET    /api/cooking-logs/[id]   → 200 { data: CookingLog }
 * - 삭제  DELETE /api/cooking-logs/[id]   → 200 { data: { id } }
 */

import { z } from 'zod';

import { apiListResponseSchema, apiResponseSchema } from '../lib/zod/api';
import { cookingLogSchema } from '../lib/zod/cooking-log';
import type { CookingLogListResponse } from '../types/api';
import type {
  CookingLog,
  CookingLogListQuery,
  CreateCookingLogRequest,
} from '../types/cooking-log';

import { apiFetch } from './api-client';
import type { AuthedCallOptions } from './recipes';

const deleteResponseSchema = apiResponseSchema(z.object({ id: z.string() }));

/**
 * POST /api/cooking-logs — 보호. 03 §3.8b.2: 201 + { data: CookingLog }.
 * base64 data URI 1장 + 레시피 스냅샷 + 별점 + 소감.
 */
export async function createCookingLog(
  req: CreateCookingLogRequest,
  auth: AuthedCallOptions,
): Promise<CookingLog> {
  const wrapped = await apiFetch(
    '/api/cooking-logs',
    apiResponseSchema(cookingLogSchema),
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
 * GET /api/cooking-logs — 보호. 03 §3.8b.3: 빈 목록도 200 + { data: [], meta }.
 * raw { data, meta } 보존 (meta.pageSize 신뢰 — ADR-006).
 */
export async function listCookingLogs(
  query: CookingLogListQuery,
  auth: AuthedCallOptions,
): Promise<CookingLogListResponse> {
  return apiFetch('/api/cooking-logs', apiListResponseSchema(cookingLogSchema), {
    method: 'GET',
    query: {
      page: query.page,
      pageSize: query.pageSize,
    },
    tossUserId: auth.tossUserId,
    refreshTossUserId: auth.refreshTossUserId,
  });
}

/**
 * GET /api/cooking-logs/[id] — 보호. 03 §3.8b.4: 없음·타인 소유 모두 404 (ADR-005 통일).
 */
export async function getCookingLog(
  id: string,
  auth: AuthedCallOptions,
): Promise<CookingLog> {
  const wrapped = await apiFetch(
    `/api/cooking-logs/${encodeURIComponent(id)}`,
    apiResponseSchema(cookingLogSchema),
    {
      method: 'GET',
      tossUserId: auth.tossUserId,
      refreshTossUserId: auth.refreshTossUserId,
    },
  );
  return wrapped.data;
}

/**
 * DELETE /api/cooking-logs/[id] — 보호. 03 §3.8b.5: 204 아니라 200 + { data: { id } }.
 */
export async function deleteCookingLog(
  id: string,
  auth: AuthedCallOptions,
): Promise<{ id: string }> {
  const wrapped = await apiFetch(
    `/api/cooking-logs/${encodeURIComponent(id)}`,
    deleteResponseSchema,
    {
      method: 'DELETE',
      tossUserId: auth.tossUserId,
      refreshTossUserId: auth.refreshTossUserId,
    },
  );
  return wrapped.data;
}
