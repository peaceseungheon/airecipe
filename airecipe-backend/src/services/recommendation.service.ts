/**
 * RecommendationService — 테마 기반 요리 추천 유스케이스 오케스트레이션 (ADR-011).
 *
 * 책임:
 * - AIRecommendationProvider에 추천(items 5개)을 위임한다.
 * - meta(theme echo + generatedAt)를 서버에서 조립한다(AI는 items만 생성).
 * - AIProviderError를 ApiErrorCode(ServiceError)로 매핑한다(경계 변환).
 * Route는 이 서비스에만 의존하고 AI 구현을 모른다.
 *
 * SRP: HTTP/CORS 변환은 Route, AI 호출은 Provider, 유스케이스+meta 조립은 본 서비스.
 * recipe-generation.service.ts의 toServiceError와 동일 매핑(일관성).
 */
import type {
  AIRecommendationProvider,
  RecommendInput,
} from "@/lib/ai/ai-recommendation-provider";
import { AIProviderError } from "@/lib/ai/ai-recipe-provider";
import { ServiceError } from "@/services/service-error";
import type { RecommendationsResponse } from "@/lib/ai/recommendation-schema";

export class RecommendationService {
  constructor(private readonly ai: AIRecommendationProvider) {}

  async recommend(input: RecommendInput): Promise<RecommendationsResponse> {
    try {
      const items = await this.ai.recommend(input); // 정확히 5개(검증됨)
      return {
        items,
        meta: { theme: input.theme, generatedAt: new Date().toISOString() },
      };
    } catch (err) {
      throw this.toServiceError(err);
    }
  }

  private toServiceError(err: unknown): ServiceError {
    if (err instanceof AIProviderError) {
      const code =
        err.kind === "rate_limited" ? "AI_RATE_LIMITED" : "AI_PROVIDER_ERROR";
      return new ServiceError(code, err.message, err);
    }
    return new ServiceError(
      "INTERNAL_ERROR",
      "추천 생성 중 오류가 발생했습니다.",
      err,
    );
  }
}
