/**
 * CORS 헬퍼 — ADR-010 D5.
 *
 * 미니앱(앱인토스) 호출용. 웹앱은 same-origin 이므로 본 헬퍼와 무관.
 * 응답 헤더 SSOT 는 미니앱 측 09-ENV-CONFIG §9.3.1 과 일치한다.
 *
 * 사용:
 *   import { withCors, corsPreflightResponse, buildCorsHeaders } from "@/lib/cors";
 *
 *   export async function GET(req: NextRequest) {
 *     return withCors(NextResponse.json({ data }), req);
 *   }
 *   export const OPTIONS = corsPreflightResponse;
 */
import { NextResponse } from "next/server";

/** Allow-Headers SSOT (미니앱 09-ENV-CONFIG §9.3.1). */
const ALLOW_HEADERS = "Content-Type, X-Toss-User-Id, Accept";
/** Allow-Methods SSOT. */
const ALLOW_METHODS = "GET, POST, PATCH, DELETE, OPTIONS";
/** Preflight 캐시 시간(초). */
const MAX_AGE = "600";
/** 환경변수 키. */
const ALLOWED_ORIGINS_ENV = "APPSINTOSS_ALLOWED_ORIGINS";

/**
 * 환경변수에서 화이트리스트 origin 목록을 파싱한다.
 *
 * 변수 미설정·빈값이면 빈 Set 반환(모든 cross-origin 거부 — 안전한 fallback).
 * 콤마 구분, 각 항목 trim.
 */
function getAllowedOrigins(): Set<string> {
  const raw = process.env[ALLOWED_ORIGINS_ENV];
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );
}

/**
 * 요청 origin 이 화이트리스트에 있으면 echo 할 값을, 아니면 null 을 반환.
 */
function matchedOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const allowed = getAllowedOrigins();
  return allowed.has(origin) ? origin : null;
}

/**
 * SSE 등 `Response` 생성 시 init.headers 에 직접 합치기 위한 헤더 객체.
 *
 * 화이트리스트 비매칭이면 빈 객체 반환(브라우저가 CORS 검사로 자동 차단).
 */
export function buildCorsHeaders(request: Request): Record<string, string> {
  const origin = matchedOrigin(request);
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Allow-Methods": ALLOW_METHODS,
    "Access-Control-Max-Age": MAX_AGE,
    "Access-Control-Allow-Credentials": "false",
    // 화이트리스트별 캐시 분리를 위한 Vary.
    Vary: "Origin",
  };
}

/**
 * 응답에 CORS 헤더를 부착해 반환한다.
 *
 * - 화이트리스트 origin → Allow-Origin echo + 표준 헤더.
 * - 비화이트리스트(또는 origin 부재) → 헤더 미부착(브라우저가 차단).
 *
 * 본문·status·기존 헤더는 보존한다.
 */
export function withCors<T extends NextResponse>(
  response: T,
  request: Request,
): T {
  const headers = buildCorsHeaders(request);
  for (const [name, value] of Object.entries(headers)) {
    response.headers.set(name, value);
  }
  return response;
}

/**
 * OPTIONS preflight 응답 빌더.
 *
 * - 화이트리스트 origin → 204 No Content + CORS 헤더 풀세트.
 * - 비화이트리스트 → 204 + 헤더 미부착(브라우저가 차단).
 *
 * Next.js 의 `export const OPTIONS = corsPreflightResponse;` 형태로 직접 export 가능.
 */
export function corsPreflightResponse(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(request),
  });
}
