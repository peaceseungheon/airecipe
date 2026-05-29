/**
 * GET  /api/recipes — 내 레시피 목록 (인증, 계약 2).
 * POST /api/recipes — 레시피 저장 (인증, 계약 3).
 *
 * 인증은 ADR-010 `requireUser(request)` — 헤더 우선 · 쿠키 fallback.
 * 응답에는 CORS 헤더(미니앱 cross-origin) 부착. 웹앱은 same-origin 이라 무영향.
 *
 * Route 는 얇게: 인증 + 검증 + Service 호출 + 응답 래핑(SRP).
 */
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { getRecipeService } from "@/lib/composition";
import { failFromError, ok, okList } from "@/lib/api-response";
import { withCors, corsPreflightResponse } from "@/lib/cors";
import {
  listQuerySchema,
  saveRecipeRequestSchema,
  parseOrThrow,
} from "@/lib/validation";
import { ServiceError } from "@/services/service-error";

export const runtime = "nodejs";

/** GET — 목록 (favorite/page/pageSize 쿼리). 빈 목록도 200 + meta. */
export async function GET(request: NextRequest) {
  try {
    const { id: internalUserId, source } = await requireUser(request);
    const { searchParams } = new URL(request.url);
    const query = parseOrThrow(listQuerySchema, {
      favorite: searchParams.get("favorite") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
    });

    const service = await getRecipeService(source);
    const { recipes, total } = await service.list(internalUserId, {
      favoriteOnly: query.favorite,
      page: query.page,
      pageSize: query.pageSize,
    });

    return withCors(
      okList(recipes, {
        total,
        page: query.page,
        pageSize: query.pageSize,
      }),
      request,
    );
  } catch (err) {
    return withCors(failFromError(err), request);
  }
}

/** POST — GeneratedRecipe 저장. 201 + 저장된 Recipe. */
export async function POST(request: NextRequest) {
  try {
    const { id: internalUserId, source } = await requireUser(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ServiceError("VALIDATION_ERROR", "JSON 본문이 올바르지 않습니다.");
    }
    const { recipe } = parseOrThrow(saveRecipeRequestSchema, body);

    const service = await getRecipeService(source);
    const saved = await service.save(internalUserId, recipe);
    return withCors(ok(saved, 201), request);
  } catch (err) {
    return withCors(failFromError(err), request);
  }
}

/** CORS preflight — ADR-010 D5. */
export const OPTIONS = corsPreflightResponse;
