/**
 * Toss userId hash → internal uuid 매핑 어댑터 (ADR-010 D1/D3, Adapter 패턴).
 *
 * `X-Toss-User-Id` 헤더 값(평문 hex hash, 신뢰 모델 ADR-010 D6)을 받아
 * `profiles` 테이블에 UPSERT 한 후 `internal_user_id` 를 반환한다.
 *
 * 동작:
 *   - 행 존재 → 기존 internal_user_id 반환.
 *   - 행 미존재 → INSERT(internal_user_id 자동 생성) 후 반환.
 *
 * 본 모듈은 service-role 클라이언트를 사용한다(`profiles` RLS 차단을 우회).
 */
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { ServiceError } from "@/services/service-error";

const PROFILES_TABLE = "profiles";

/**
 * Toss userId hash 형식 정규화·검증.
 * 신뢰 모델(ADR-010 D6) 하에서 강한 검증은 하지 않지만, 명백히 빈 값은 거부.
 */
function normalizeTossUserId(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new ServiceError(
      "UNAUTHORIZED",
      "Toss 사용자 식별자가 비어 있습니다.",
    );
  }
  return trimmed;
}

/**
 * Toss userId hash → internal_user_id(uuid).
 *
 * @param tossUserIdHash `X-Toss-User-Id` 헤더 원본 값.
 * @returns internal_user_id (uuid string).
 * @throws ServiceError('UNAUTHORIZED') hash 가 빈 문자열·공백.
 * @throws ServiceError('INTERNAL_ERROR') Supabase 오류.
 */
export async function resolveInternalUserId(
  tossUserIdHash: string,
): Promise<string> {
  const tossUserId = normalizeTossUserId(tossUserIdHash);
  const db = createSupabaseServiceRoleClient();

  // Step 1: 빠른 경로 — 이미 매핑이 있으면 그대로 반환.
  const existing = await db
    .from(PROFILES_TABLE)
    .select("internal_user_id")
    .eq("toss_user_id", tossUserId)
    .maybeSingle();

  if (existing.error) {
    throw new ServiceError(
      "INTERNAL_ERROR",
      "사용자 매핑 조회에 실패했습니다.",
    );
  }
  if (existing.data?.internal_user_id) {
    return existing.data.internal_user_id as string;
  }

  // Step 2: 신규 매핑 INSERT. 경합으로 인한 중복은 onConflict 로 흡수.
  const inserted = await db
    .from(PROFILES_TABLE)
    .upsert(
      { toss_user_id: tossUserId },
      { onConflict: "toss_user_id", ignoreDuplicates: false },
    )
    .select("internal_user_id")
    .single();

  if (inserted.error || !inserted.data) {
    throw new ServiceError(
      "INTERNAL_ERROR",
      "사용자 매핑 생성에 실패했습니다.",
    );
  }
  return inserted.data.internal_user_id as string;
}
