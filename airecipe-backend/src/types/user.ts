/**
 * 사용자 도메인 공유 타입.
 * - Supabase Auth(auth.users) 기반 웹앱 사용자: `User`(레거시, 쿠키 경로).
 * - 인증 경로 병존(ADR-010) 도입 후 백엔드 내부에서 사용하는 통일 식별자: `InternalUser`.
 */

export interface User {
  id: string;
  email: string;
}

/**
 * 인증 출처. ADR-010 D3 헤더 우선 · 쿠키 fallback.
 * - `cookie`: 기존 Supabase Auth 세션(웹앱).
 * - `header`: `X-Toss-User-Id` 헤더 경로(미니앱).
 */
export type AuthSource = "cookie" | "header";

/**
 * 백엔드 내부 식별자 — `requireUser(request)`(ADR-010)의 반환 타입.
 * `id`는 `recipes.user_id`와 동일 도메인(uuid).
 * - 쿠키 경로: `auth.users.id`.
 * - 헤더 경로: `profiles.internal_user_id`.
 */
export interface InternalUser {
  id: string;
  source: AuthSource;
  email?: string;
}

/**
 * SavedRecipe는 별도 엔티티가 아니라 user_id가 부여된 Recipe row이다.
 * 도메인 명확성을 위한 별칭 — recipe.ts의 Recipe를 참조.
 * (Sprint 1: 저장된 레시피 = Recipe with id)
 */
export type { Recipe as SavedRecipe } from "./recipe";
