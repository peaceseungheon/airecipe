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
 * 알 수 없는 throw를 계약 에러 응답으로 변환한다.
 * ServiceError는 자신의 code를, 그 외는 INTERNAL_ERROR로.
 */
export function failFromError(err: unknown): NextResponse<ApiError> {
  if (err instanceof ServiceError) {
    return fail(err.code, err.message);
  }
  return fail("INTERNAL_ERROR", "서버 오류가 발생했습니다.");
}
