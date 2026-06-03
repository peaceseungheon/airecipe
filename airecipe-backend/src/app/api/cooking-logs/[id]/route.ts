/**
 * GET    /api/cooking-logs/[id] — 기록 단건 조회 (인증, 스펙 §6.3).
 * DELETE /api/cooking-logs/[id] — 기록 삭제 + R2 객체 제거 (인증, 스펙 §6.4).
 *
 * 소유자 격리(ADR-005): RLS(쿠키) 또는 애플리케이션 .eq(헤더) + user_id 스코프
 * → 미존재·타인 소유 모두 404 NOT_FOUND 로 수렴.
 *
 * 인증은 ADR-010 `requireUser(request)` — 헤더 우선 · 쿠키 fallback.
 * Next.js 16: 동적 세그먼트 `params` 는 Promise.
 */
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { getCookingLogService } from "@/lib/composition";
import { ok, failFromError } from "@/lib/api-response";
import { withCors, corsPreflightResponse } from "@/lib/cors";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: internalUserId, source } = await requireUser(request);
    const { id } = await params;
    const service = await getCookingLogService(source);
    const log = await service.get(internalUserId, id);
    return withCors(ok(log), request);
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
    const service = await getCookingLogService(source);
    const result = await service.delete(internalUserId, id);
    return withCors(ok(result), request);
  } catch (err) {
    return withCors(failFromError(err), request);
  }
}

/** CORS preflight — ADR-010 D5. */
export const OPTIONS = corsPreflightResponse;
