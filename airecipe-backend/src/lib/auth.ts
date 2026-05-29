/**
 * @deprecated ADR-010 도입으로 인해 본 모듈은 신 API(`@/lib/auth/require-user`) 로 위임된다.
 * 신규 코드는 `import { requireUser } from "@/lib/auth/require-user"` (또는 `@/lib/auth/index`)
 * 를 사용하라. 본 파일은 기존 caller 호환을 위해 일시 유지되며 Task #3 마무리 후
 * 호출자가 0이 되면 제거된다.
 *
 * 차이:
 *   - 신 API 는 `request: Request` 인자를 받아 헤더 경로(미니앱) 와 쿠키 경로(웹앱)
 *     를 분기한다(ADR-010 D3 — 헤더 우선 · 쿠키 fallback).
 *   - 본 레거시 API 는 인자 없이 쿠키 경로만 처리한다(웹앱 전용 호환 동작).
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ServiceError } from "@/services/service-error";

export interface AuthedUser {
  id: string;
  email: string;
}

/**
 * @deprecated 신 API(`@/lib/auth/require-user`)의 `requireUser(request)` 를 사용하라.
 * 본 함수는 쿠키 경로(웹앱) 만 지원한다. 미인증 시 throw(UNAUTHORIZED).
 */
export async function requireUser(): Promise<AuthedUser> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ServiceError("UNAUTHORIZED", "로그인이 필요합니다.");
  }
  return { id: user.id, email: user.email ?? "" };
}
