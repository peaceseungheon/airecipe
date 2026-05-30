/**
 * API 응답 헬퍼 — 계약(0.1/0.2)의 래핑·에러 형식을 단일 위치로 강제한다.
 * 모든 Route Handler는 이 헬퍼로만 응답을 만든다(경계면 일관성).
 */
import { NextResponse } from "next/server";
import { ServiceError } from "@/services/service-error";
import type {
  ApiError,
  ApiErrorCode,
  ApiResponse,
  ApiListResponse,
  ListMeta,
} from "@/types";

/** ApiErrorCode → HTTP 상태 (계약 0.2 표). */
const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  AI_RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  AI_PROVIDER_ERROR: 502,
  DB_ERROR: 503,
};

/** 단건 성공 응답 { data }. */
export function ok<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ data }, { status });
}

/** 목록 성공 응답 { data, meta }. */
export function okList<T>(
  data: T[],
  meta: ListMeta,
): NextResponse<ApiListResponse<T>> {
  return NextResponse.json({ data, meta });
}

/** 에러 응답 { error: { code, message } } + 매핑된 HTTP 상태. */
export function fail(
  code: ApiErrorCode,
  message: string,
): NextResponse<ApiError> {
  return NextResponse.json(
    { error: { code, message } },
    { status: STATUS_BY_CODE[code] },
  );
}

/**
 * API 처리 중 발생한 오류를 서버 콘솔에 구조적으로 로깅한다.
 * 응답 변환(`failFromError`/SSE `toChunkError`)이 cause·스택을 버려 디버깅이 불가능하던
 * 문제를 해소하기 위한 단일 로깅 지점이다. 양쪽 경로에서 재사용한다.
 *
 * - 기대된 클라이언트 4xx(VALIDATION_ERROR 등)는 서버 결함이 아니므로 `console.warn` 1줄.
 * - 5xx·AI 오류(INTERNAL_ERROR/AI_PROVIDER_ERROR/AI_RATE_LIMITED/DB_ERROR)는 `console.error`로
 *   cause(원본 에러, Error면 스택 포함)까지 출력한다.
 * - 알 수 없는 throw는 원본 err(스택 포함)을 그대로 출력한다.
 *
 * `[api-error]` 접두사로 grep 가능하게 한다.
 */
export function logApiError(err: unknown): void {
  if (err instanceof ServiceError) {
    const is4xx = STATUS_BY_CODE[err.code] < 500;
    if (is4xx) {
      console.warn(`[api-error] ${err.code}: ${err.message}`);
      return;
    }
    console.error(`[api-error] ${err.code}: ${err.message}`, err.cause ?? err);
    return;
  }
  console.error("[api-error] INTERNAL_ERROR (unhandled):", err);
}

/**
 * 알 수 없는 throw를 계약 에러 응답으로 변환한다.
 * ServiceError는 자신의 code를, 그 외는 INTERNAL_ERROR로.
 * 변환 전에 `logApiError`로 원인을 서버 콘솔에 남긴다.
 */
export function failFromError(err: unknown): NextResponse<ApiError> {
  logApiError(err);
  if (err instanceof ServiceError) {
    return fail(err.code, err.message);
  }
  return fail("INTERNAL_ERROR", "서버 오류가 발생했습니다.");
}
