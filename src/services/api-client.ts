/**
 * api-client — 모든 백엔드 호출의 단일 fetch 래퍼.
 * baseline §A.4 / 03-API-CONTRACT §3.1, §3.9 / 05-AUTH §5.2.2, §5.4
 *
 * SRP: HTTP I/O + 헤더 부착 + 401 재시도 + zod 검증의 단일 책임.
 * 도메인별 호출은 src/services/recipes.ts.
 *
 * 단언 (CLAUDE.md §3): 직접 fetch 호출은 본 파일 한 곳만.
 */

import { z } from 'zod';

import { apiErrorSchema } from '../lib/zod/api';
import type { ApiError, ApiErrorCode } from '../types/api';

const HEADER_TOSS_USER_ID = 'X-Toss-User-Id';

/**
 * baseline §A.4: import.meta.env.API_BASE_URL — 09 §9.4.2 SSOT.
 * 빌드 시점 plugin-env 인라인. runtime process.env 금지.
 */
const API_BASE_URL: string = import.meta.env.API_BASE_URL;

export interface ApiFetchInit {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** 보호 엔드포인트 호출 시 전달. 공개 엔드포인트는 생략. */
  tossUserId?: string;
  /**
   * 401 자동 재시도용. 호출 시 새 hash를 반환해야 한다.
   * 미제공 시 401 재시도하지 않음 (05 §5.4 경계 조건 #3).
   */
  refreshTossUserId?: () => Promise<string>;
  /**
   * Phase 2 baseline §A.2 — 호출 측 abort를 fetch로 전달.
   * abort 시 fetch가 throw → catch 분류는 호출 측이 signal.aborted로 식별 (08 §8.4.1).
   */
  signal?: AbortSignal;
}

/**
 * 미니앱이 throw하는 에러의 단일 형식. baseline §A.4 + 03 §3.1.2.
 * 호출부는 error.code로 분기 (HTTP 상태 기반 분기 금지).
 */
export class ApiClientError extends Error implements ApiError {
  readonly error: ApiError['error'];

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ApiClientError';
    this.error = { code, message };
  }
}

/**
 * raw 래핑 응답(`{ data, meta? }`)을 반환한다. unwrap은 호출부에서 수행 (baseline §C.4).
 * zod 검증을 raw 응답에 적용해야 래핑 자체 위반(03 §3.10 #1)을 잡을 수 있다.
 *
 * 401: refreshTossUserId가 주어지면 식별자 재발급 후 1회 재시도. 재귀 깊이 1 (05 §5.4).
 *
 * 응답 schema는 호출부가 결정 (apiResponseSchema(domainSchema) 등).
 */
export async function apiFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  init: ApiFetchInit = {},
): Promise<T> {
  return apiFetchInternal(path, schema, init, true);
}

async function apiFetchInternal<T>(
  path: string,
  schema: z.ZodType<T>,
  init: ApiFetchInit,
  allowRetry: boolean,
): Promise<T> {
  const url = buildUrl(path, init.query);
  const headers = new Headers();
  headers.set('Accept', 'application/json');

  if (init.tossUserId !== undefined) {
    headers.set(HEADER_TOSS_USER_ID, init.tossUserId);
  }

  let bodyString: string | undefined;
  if (init.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    bodyString = JSON.stringify(init.body);
  }

  let res: Response;
  try {
    const fetchInit: RequestInit = {
      method: init.method ?? 'GET',
      headers,
      body: bodyString,
      // baseline §D.3 — RN globals.d.ts AbortSignal vs ESNext lib union TS2769.
      // 런타임 동일 객체, TS nominal만 차이. Phase 3 또는 ADR-011 시 정식 해소.
      signal: init.signal as RequestInit['signal'],
    };
    res = await fetch(url, fetchInit);
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      throw err;
    }
    throw new ApiClientError('INTERNAL_ERROR', '네트워크에 연결할 수 없어요.');
  }

  if (res.status === 401 && allowRetry && init.refreshTossUserId) {
    const newHash = await init.refreshTossUserId();
    return apiFetchInternal(
      path,
      schema,
      { ...init, tossUserId: newHash },
      false,
    );
  }

  if (!res.ok) {
    throw await toApiClientError(res);
  }

  const raw = await res.json().catch(() => undefined);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiClientError(
      'INTERNAL_ERROR',
      '서버 응답 형식이 올바르지 않아요.',
    );
  }
  return parsed.data;
}

function buildUrl(
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
): string {
  const base = `${API_BASE_URL}${path}`;
  if (!query) return base;
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    usp.append(key, String(value));
  }
  const qs = usp.toString();
  return qs ? `${base}?${qs}` : base;
}

async function toApiClientError(res: Response): Promise<ApiClientError> {
  const raw = await res.json().catch(() => undefined);
  const parsed = apiErrorSchema.safeParse(raw);
  if (parsed.success) {
    return new ApiClientError(parsed.data.error.code, parsed.data.error.message);
  }
  return new ApiClientError('INTERNAL_ERROR', '네트워크 오류가 발생했어요.');
}
