/**
 * POST /api/recommendations — 테마(상황·날씨) 기반 요리 5개 추천 (인증, ADR-011).
 *
 * 보호 엔드포인트(옵션 P, X-Toss-User-Id). AI 호출 + 서버 zod 5개 강제. 비-stream JSON.
 * 미니앱 03-API-CONTRACT §3.8 + ADR-016 계약에 정렬. 응답에 CORS 헤더 부착.
 *
 * SRP: HTTP/CORS/인증/검증/응답 래핑만 담당. AI 호출·meta 조립은 서비스/Provider에 위임.
 */
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { getRecommendationService } from "@/lib/composition";
import { failFromError, ok } from "@/lib/api-response";
import { withCors, corsPreflightResponse } from "@/lib/cors";
import { recommendationsRequestSchema, parseOrThrow } from "@/lib/validation";
import { ServiceError } from "@/services/service-error";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    // D-R5: 미인증 → ServiceError("UNAUTHORIZED") → 401. 반환값 미사용(무상태, D-R8).
    await requireUser(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ServiceError("VALIDATION_ERROR", "JSON 본문이 올바르지 않습니다.");
    }
    const { theme } = parseOrThrow(recommendationsRequestSchema, body);

    const service = getRecommendationService();
    const result = await service.recommend({ theme }); // { items, meta }
    return withCors(ok(result), request); // 200 { data: { items, meta } }
  } catch (err) {
    return withCors(failFromError(err), request);
  }
}

export const OPTIONS = corsPreflightResponse;
