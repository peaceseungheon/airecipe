/**
 * `requireUser(request)` — 인증 진입점 (ADR-010 D3, Facade 패턴).
 *
 * 헤더 우선 · 쿠키 fallback:
 *   1) `X-Toss-User-Id` 존재(비어있지 않음)
 *      → `resolveInternalUserId(hash)` 로 매핑(profiles upsert)
 *      → { id, source: 'header' }
 *   2) 헤더 없음 → 기존 Supabase 세션
 *      → { id: user.id, source: 'cookie', email }
 *   3) 둘 다 실패 → throw ServiceError('UNAUTHORIZED')
 *
 * Route Handler 입장에서 두 경로 분기는 보이지 않는다(OCP — 향후 경로 추가는 본 함수만 확장).
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveInternalUserId } from "@/lib/auth/toss-user-resolver";
import { ServiceError } from "@/services/service-error";
import type { InternalUser } from "@/types/user";

const TOSS_USER_ID_HEADER = "x-toss-user-id";

/**
 * 인증된 사용자를 반환한다. 미인증 시 `ServiceError('UNAUTHORIZED')` throw.
 *
 * 헤더 경로(미니앱)는 `profiles` 매핑을 통해 internal_user_id 를 얻는다 — RLS 우회.
 * 쿠키 경로(웹앱)는 기존 Supabase Auth 세션 그대로 — RLS 통과.
 */
export async function requireUser(request: Request): Promise<InternalUser> {
  // ── 헤더 경로 (미니앱) ───────────────────────────────────────
  const rawHeader = request.headers.get(TOSS_USER_ID_HEADER);
  if (rawHeader && rawHeader.trim().length > 0) {
    const internalUserId = await resolveInternalUserId(rawHeader);
    return { id: internalUserId, source: "header" };
  }

  // ── 쿠키 경로 (웹앱) ─────────────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ServiceError("UNAUTHORIZED", "로그인이 필요합니다.");
  }
  return {
    id: user.id,
    source: "cookie",
    email: user.email ?? undefined,
  };
}
