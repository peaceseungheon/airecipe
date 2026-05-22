/**
 * GET    /api/recipes/[id] — 레시피 단건 조회 (인증, 계약 2.5 / ADR-004).
 * DELETE /api/recipes/[id] — 레시피 삭제 (인증, 계약 5).
 *
 * 단건 조회는 /recipe/[id] 딥링크·새로고침 진입을 지원(목록 캐시 의존 제거).
 * 소유자 격리(ADR-005): RLS + user_id 스코프 → 미존재·타인 소유 모두 404 NOT_FOUND로 수렴.
 * 403 FORBIDDEN은 Sprint 1에서 발생하지 않는다(존재 은닉 + RLS 격리 귀결).
 */
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { getRecipeService } from "@/lib/composition";
import { failFromError, ok } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const service = await getRecipeService();
    const recipe = await service.getById(user.id, id);
    return ok(recipe);
  } catch (err) {
    return failFromError(err);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const service = await getRecipeService();
    const deletedId = await service.delete(user.id, id);
    return ok({ id: deletedId });
  } catch (err) {
    return failFromError(err);
  }
}
