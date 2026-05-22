/**
 * GET  /api/recipes — 내 레시피 목록 (인증, 계약 2).
 * POST /api/recipes — 레시피 저장 (인증, 계약 3).
 *
 * Route는 얇게: 인증 + 검증 + Service 호출 + 응답 래핑(SRP).
 */
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { getRecipeService } from "@/lib/composition";
import { failFromError, ok, okList } from "@/lib/api-response";
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
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const query = parseOrThrow(listQuerySchema, {
      favorite: searchParams.get("favorite") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
    });

    const service = await getRecipeService();
    const { recipes, total } = await service.list(user.id, {
      favoriteOnly: query.favorite,
      page: query.page,
      pageSize: query.pageSize,
    });

    return okList(recipes, {
      total,
      page: query.page,
      pageSize: query.pageSize,
    });
  } catch (err) {
    return failFromError(err);
  }
}

/** POST — GeneratedRecipe 저장. 201 + 저장된 Recipe. */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ServiceError("VALIDATION_ERROR", "JSON 본문이 올바르지 않습니다.");
    }
    const { recipe } = parseOrThrow(saveRecipeRequestSchema, body);

    const service = await getRecipeService();
    const saved = await service.save(user.id, recipe);
    return ok(saved, 201);
  } catch (err) {
    return failFromError(err);
  }
}
