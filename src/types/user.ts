/**
 * 사용자 도메인 공유 타입.
 * Supabase Auth(auth.users) 기반. Sprint 1은 이메일+패스워드 인증.
 */

export interface User {
  id: string;
  email: string;
}

/**
 * SavedRecipe는 별도 엔티티가 아니라 user_id가 부여된 Recipe row이다.
 * 도메인 명확성을 위한 별칭 — recipe.ts의 Recipe를 참조.
 * (Sprint 1: 저장된 레시피 = Recipe with id)
 */
export type { Recipe as SavedRecipe } from "./recipe";
