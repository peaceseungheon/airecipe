/**
 * Composition Root — 의존성 조립 단일 위치.
 * Route Handler 는 구체 구현을 직접 생성하지 않고 여기서 조립된 Service 를 받는다.
 * (DIP: 조립은 한 곳, 사용처는 추상에만 의존.)
 *
 * Repository 는 요청별 Supabase 클라이언트를 필요로 한다 — 두 종류:
 *   - 쿠키 클라이언트(`createSupabaseServerClient`) → 웹앱(쿠키 경로), RLS 통과.
 *   - service-role 클라이언트(`createSupabaseServiceRoleClient`) → 미니앱(헤더 경로),
 *     RLS 우회 + 애플리케이션 레이어 격리(repository `.eq('user_id', ...)`).
 *
 * 분기 정책 — ADR-010 §4 옵션 C (client 주입):
 *   `getRecipeService(source)` 가 source 에 따라 적절한 클라이언트를 선택해
 *   Repository 에 주입한다. Route 는 `requireUser(req)` 반환의 `source` 만 전달.
 *
 * AI Provider 는 무상태이므로 모듈 싱글턴으로 재사용한다.
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { createAIRecipeProvider } from "@/lib/ai/ai-recipe-provider.factory";
import { SupabaseRecipeRepository } from "@/repositories/supabase-recipe.repository";
import { RecipeGenerationService } from "@/services/recipe-generation.service";
import { RecipeService } from "@/services/recipe.service";
import { createAIRecommendationProvider } from "@/lib/ai/ai-recommendation-provider.factory";
import { RecommendationService } from "@/services/recommendation.service";
import type { AuthSource } from "@/types/user";

/**
 * AI Provider 는 무상태 → 싱글턴.
 * - 지연 생성: 키/환경변수 없을 때 import 만으로 throw 하지 않도록 첫 호출 시 조립.
 * - Provider 선택은 Factory(AI_PROVIDER) — composition 은 추상에만 의존(DIP).
 */
let _generationService: RecipeGenerationService | null = null;
let _recommendationService: RecommendationService | null = null;

export function getRecipeGenerationService(): RecipeGenerationService {
  if (!_generationService) {
    _generationService = new RecipeGenerationService(createAIRecipeProvider());
  }
  return _generationService;
}

/**
 * 영속성 Service 를 조립한다.
 *
 * - `source = 'cookie'` (웹앱, 기본): 요청별 쿠키 클라이언트 → RLS 적용.
 * - `source = 'header'` (미니앱): service-role 싱글턴 → RLS 우회 + 앱 레이어 격리.
 *
 * `source` 미지정 시 'cookie' 로 동작(기존 호출자 호환).
 */
export async function getRecipeService(
  source: AuthSource = "cookie",
): Promise<RecipeService> {
  const supabase =
    source === "header"
      ? createSupabaseServiceRoleClient()
      : await createSupabaseServerClient();
  return new RecipeService(new SupabaseRecipeRepository(supabase));
}

/** 추천 — 테마 기반 요리 추천 서비스 (AI Provider 주입, ADR-011). 무상태 → 싱글턴. */
export function getRecommendationService(): RecommendationService {
  if (!_recommendationService) {
    _recommendationService = new RecommendationService(
      createAIRecommendationProvider(),
    );
  }
  return _recommendationService;
}
