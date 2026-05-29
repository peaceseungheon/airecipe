/**
 * PATCH /api/recipes/[id]/favorite — 즐겨찾기 설정 (인증, 계약 4).
 * 토글 아님 — 목표 값(isFavorite)을 명시(멱등). 200 + 갱신된 Recipe.
 *
 * 인증은 ADR-010 `requireUser(request)` — 헤더 우선 · 쿠키 fallback.
 */
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { getRecipeService } from "@/lib/composition";
import { failFromError, ok } from "@/lib/api-response";
import { withCors, corsPreflightResponse } from "@/lib/cors";
import { toggleFavoriteRequestSchema, parseOrThrow } from "@/lib/validation";
import { ServiceError } from "@/services/service-error";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: internalUserId, source } = await requireUser(request);
    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ServiceError("VALIDATION_ERROR", "JSON 본문이 올바르지 않습니다.");
    }
    const { isFavorite } = parseOrThrow(toggleFavoriteRequestSchema, body);

    const service = await getRecipeService(source);
    const updated = await service.setFavorite(internalUserId, id, isFavorite);
    return withCors(ok(updated), request);
  } catch (err) {
    return withCors(failFromError(err), request);
  }
}

/** CORS preflight — ADR-010 D5. */
export const OPTIONS = corsPreflightResponse;
