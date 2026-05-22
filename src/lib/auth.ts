/**
 * 인증 헬퍼 — 보호된 Route Handler에서 세션 사용자를 확인한다(계약 0.3).
 * 미인증이면 ServiceError(UNAUTHORIZED)를 throw하여 Route가 401로 변환한다.
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ServiceError } from "@/services/service-error";

export interface AuthedUser {
  id: string;
  email: string;
}

/** 현재 세션 사용자를 반환. 미인증 시 throw(UNAUTHORIZED). */
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
