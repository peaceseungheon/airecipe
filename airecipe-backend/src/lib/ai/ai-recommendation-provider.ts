/**
 * AIRecommendationProvider — 테마 기반 요리 추천의 도메인 추상 (Adapter, ADR-011 D-R3).
 *
 * 레시피 생성(AIRecipeProvider)과 입출력이 완전히 다르므로(입력 theme·출력 items[5]),
 * ISP에 따라 별도 인터페이스로 분리한다. Service는 이 인터페이스에만 의존하고
 * 구체 SDK(@google/genai · @anthropic-ai/sdk)를 모른다(DIP).
 *
 * 구현체: GeminiRecommendationProvider(기본), ClaudeRecommendationProvider(롤백).
 * 선택은 Factory(`ai-recommendation-provider.factory.ts`)가 `AI_PROVIDER` 환경변수로 한다.
 *
 * 오류 분류는 기존 `AIProviderError`(@/lib/ai/ai-recipe-provider)를 재사용한다(신규 정의 금지).
 */
import type {
  RecommendationItem,
  RecommendationTheme,
} from "@/lib/ai/recommendation-schema";

export interface RecommendInput {
  theme: RecommendationTheme;
}

/** 추천 어댑터 추상 (ISP — 레시피 생성과 분리). 정확히 5개 검증된 items 반환. */
export interface AIRecommendationProvider {
  recommend(input: RecommendInput): Promise<RecommendationItem[]>;
}
