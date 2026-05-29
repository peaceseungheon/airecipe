/**
 * Next.js proxy (구 middleware 컨벤션) — 매 요청 Supabase 세션 갱신 + 보호 페이지 가드.
 * Next.js 16에서 `middleware` 파일/함수 컨벤션이 deprecated되어 `proxy`로 전환(ADR-007).
 * 세부 로직은 src/lib/supabase/middleware.ts (updateSession).
 */
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // 정적 자산·이미지 최적화 경로를 제외한 모든 경로에 적용.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
