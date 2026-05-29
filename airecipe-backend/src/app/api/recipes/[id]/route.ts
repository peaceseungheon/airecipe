/**
 * GET    /api/recipes/[id] — 레시피 단건 조회 (인증, 계약 2.5 / ADR-004).
 * DELETE /api/recipes/[id] — 레시피 삭제 (인증, 계약 5).
 *
 * 단건 조회는 /recipe/[id] 딥링크·새로고침 진입을 지원(목록 캐시 의존 제거).
 * 소유자 격리(ADR-005): RLS(쿠키) 또는 애플리케이션 .eq(헤더) + user_id 스코프
 * → 미존재·타인 소유 모두 404 NOT_FOUND 로 수렴. 양 경로 동일.
 * 403 FORBIDDEN 은 Sprint 1 에서 발생하지 않는다(존재 은닉 + 격리 귀결).
 *
 * 인증은 ADR-010 `requireUser(request)` — 헤더 우선 · 쿠키 fallback.
 */
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { getRecipeService } from "@/lib/composition";
import { failFromError, ok } from "@/lib/api-response";
import { withCors, corsPreflightResponse } from "@/lib/cors";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: internalUserId, source } = await requireUser(request);
    const { id } = await params;

    const service = await getRecipeService(source);
    const recipe = await service.getById(internalUserId, id);
    return withCors(ok(recipe), request);
  } catch (err) {
    return withCors(failFromError(err), request);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: internalUserId, source } = await requireUser(request);
    const { id } = await params;

    const service = await getRecipeService(source);
    const deletedId = await service.delete(internalUserId, id);
    return withCors(ok({ id: deletedId }), request);
  } catch (err) {
    return withCors(failFromError(err), request);
  }
}

/** CORS preflight — ADR-010 D5. */
export const OPTIONS = corsPreflightResponse;
