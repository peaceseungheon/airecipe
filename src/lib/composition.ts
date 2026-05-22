/**
 * Composition Root — 의존성 조립 단일 위치.
 * Route Handler는 구체 구현을 직접 생성하지 않고 여기서 조립된 Service를 받는다.
 * (DIP: 조립은 한 곳, 사용처는 추상에만 의존.)
 *
 * Repository는 요청별 Supabase 클라이언트(세션 쿠키 기반 RLS)를 필요로 하므로
 * 요청 시점에 생성한다. AI Provider는 무상태이므로 모듈 싱글턴으로 재사용한다.
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAIRecipeProvider } from "@/lib/ai/ai-recipe-provider.factory";
import { SupabaseRecipeRepository } from "@/repositories/supabase-recipe.repository";
import { RecipeGenerationService } from "@/services/recipe-generation.service";
import { RecipeService } from "@/services/recipe.service";

/**
 * AI Provider는 무상태 → 싱글턴.
 * - 지연 생성: 키/환경변수 없을 때 import만으로 throw하지 않도록 첫 호출 시 조립.
 * - Provider 선택은 Factory(AI_PROVIDER) — composition은 추상에만 의존(DIP).
 */
let _generationService: RecipeGenerationService | null = null;

export function getRecipeGenerationService(): RecipeGenerationService {
  if (!_generationService) {
    _generationService = new RecipeGenerationService(createAIRecipeProvider());
  }
  return _generationService;
}

/** 영속성 Service는 요청별 세션 클라이언트로 조립한다(RLS 적용). */
export async function getRecipeService(): Promise<RecipeService> {
  const supabase = await createSupabaseServerClient();
  return new RecipeService(new SupabaseRecipeRepository(supabase));
}
