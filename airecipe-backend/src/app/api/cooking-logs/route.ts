/**
 * GET  /api/cooking-logs — 내 요리 기록 목록 (인증, 스펙 §6.2). 역순 + meta.
 * POST /api/cooking-logs — 요리 기록 생성 (인증, 스펙 §6.1). 201 + CookingLog.
 *
 * 인증은 ADR-010 `requireUser(request)` — 헤더 우선 · 쿠키 fallback.
 * Route 는 얇게: 인증 + 검증 + Service 호출 + 응답 래핑(SRP).
 * R2 업로드/presign 은 Service(CookingLogService) 뒤로 격리.
 */
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { getCookingLogService } from "@/lib/composition";
import { ok, okList, failFromError } from "@/lib/api-response";
import { withCors, corsPreflightResponse } from "@/lib/cors";
import {
  createCookingLogRequestSchema,
  cookingLogListQuerySchema,
  parseOrThrow,
} from "@/lib/validation";
import { ServiceError } from "@/services/service-error";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { id: internalUserId, source } = await requireUser(request);
    const { searchParams } = new URL(request.url);
    const query = parseOrThrow(cookingLogListQuerySchema, {
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
    });
    const service = await getCookingLogService(source);
    const { logs, total } = await service.list(internalUserId, {
      page: query.page,
      pageSize: query.pageSize,
    });
    return withCors(
      okList(logs, { total, page: query.page, pageSize: query.pageSize }),
      request,
    );
  } catch (err) {
    return withCors(failFromError(err), request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { id: internalUserId, source } = await requireUser(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ServiceError("VALIDATION_ERROR", "JSON 본문이 올바르지 않습니다.");
    }
    const input = parseOrThrow(createCookingLogRequestSchema, body);
    const service = await getCookingLogService(source);
    const created = await service.create(internalUserId, input);
    return withCors(ok(created, 201), request);
  } catch (err) {
    return withCors(failFromError(err), request);
  }
}

/** CORS preflight — ADR-010 D5. */
export const OPTIONS = corsPreflightResponse;
