/**
 * POST /api/recipes/generate — 레시피 생성 + 영양 분석 (계약 1).
 * 공개 엔드포인트(비로그인 허용). 저장하지 않음(id 없는 GeneratedRecipe 반환).
 *
 * Route는 얇게: 입력 검증 + stream 분기 + Service 호출 + 응답 변환만(SRP).
 * 로직은 RecipeGenerationService(Facade), AI는 그 뒤 어댑터에 격리.
 *
 * stream=false → JSON { data: GeneratedRecipe }.
 * stream=true  → SSE: meta → (text*) → recipe → done. 에러는 HTTP 200 + error 청크(계약 1.3).
 */
import type { NextRequest } from "next/server";
import { getRecipeGenerationService } from "@/lib/composition";
import { failFromError, ok } from "@/lib/api-response";
import { generateRequestSchema, parseOrThrow } from "@/lib/validation";
import { encodeSSE } from "@/lib/sse";
import { ServiceError } from "@/services/service-error";
import type { ApiErrorCode, StreamChunk } from "@/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failFromError(
      new ServiceError("VALIDATION_ERROR", "JSON 본문이 올바르지 않습니다."),
    );
  }

  let input: { dishName: string; servings?: number; stream?: boolean };
  try {
    input = parseOrThrow(generateRequestSchema, body);
  } catch (err) {
    return failFromError(err);
  }

  const service = getRecipeGenerationService();

  // ── 비스트리밍: JSON 응답 ──────────────────────────────
  if (!input.stream) {
    try {
      const recipe = await service.generate({
        dishName: input.dishName,
        servings: input.servings,
      });
      return ok(recipe);
    } catch (err) {
      return failFromError(err);
    }
  }

  // ── 스트리밍: SSE 응답 ─────────────────────────────────
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: StreamChunk) =>
        controller.enqueue(encoder.encode(encodeSSE(chunk)));

      try {
        send({ type: "meta", dishName: input.dishName });

        const recipe = await service.generateStream(
          { dishName: input.dishName, servings: input.servings },
          { onText: (delta) => send({ type: "text", delta }) },
        );

        send({ type: "recipe", recipe });
      } catch (err) {
        // 스트리밍 에러는 HTTP 200 + error 청크로 전달(계약 1.3).
        const { code, message } = toChunkError(err);
        send({ type: "error", error: { code, message } });
      } finally {
        send({ type: "done" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function toChunkError(err: unknown): { code: ApiErrorCode; message: string } {
  if (err instanceof ServiceError) {
    return { code: err.code, message: err.message };
  }
  return { code: "INTERNAL_ERROR", message: "레시피 생성 중 오류가 발생했습니다." };
}
