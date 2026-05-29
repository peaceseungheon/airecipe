/**
 * AIRecipeProvider — AI 레시피 생성/영양 분석의 도메인 추상 (Adapter 패턴, ADR-002).
 * Service는 이 인터페이스에만 의존하고 구체 SDK(Anthropic/Google Gen AI)를 모른다 (DIP).
 *
 * 구현체:
 * - GeminiRecipeProvider (기본, 세션 #3부터): @google/genai 어댑터
 * - ClaudeRecipeProvider (롤백, 비활성 보존): @anthropic-ai/sdk 어댑터
 * Provider 선택은 Factory(`ai-recipe-provider.factory.ts`)가 `AI_PROVIDER` 환경변수로 한다.
 * 테스트에서는 Fake 주입.
 */
import type { GeneratedRecipe } from "@/types";

export interface GenerateParams {
  dishName: string;
  servings: number;
}

/** 스트리밍 진행 콜백. Route가 SSE(StreamChunk)로 변환한다. */
export interface StreamHandlers {
  /** 진행 중 텍스트 델타 (선택적 UX 표시용). */
  onText?: (delta: string) => void;
}

/**
 * AI 제공자 추상. 레시피 생성 + 영양 분석을 단일 호출로 반환한다
 * (영양은 GeneratedRecipe.nutrition에 포함 — F2는 생성과 함께 분석).
 *
 * 확장 지점(YAGNI): Sprint 2에서 영양 계산 경로가 둘 이상이 되면
 * analyzeNutrition을 Strategy로 분리한다 (ADR-002).
 */
export interface AIRecipeProvider {
  /** 비스트리밍 생성: 완성된 GeneratedRecipe 반환. */
  generateRecipe(params: GenerateParams): Promise<GeneratedRecipe>;

  /**
   * 스트리밍 생성: 진행 델타를 handlers로 흘리고, 최종 GeneratedRecipe를 반환.
   * Route는 반환된 최종 결과를 `recipe` 청크로, 델타를 `text` 청크로 변환한다.
   */
  generateRecipeStream(
    params: GenerateParams,
    handlers: StreamHandlers,
  ): Promise<GeneratedRecipe>;
}

/** AI 제공자 오류 분류 — Service가 ApiErrorCode로 매핑한다. */
export type AIErrorKind = "rate_limited" | "provider_error";

export class AIProviderError extends Error {
  constructor(
    public readonly kind: AIErrorKind,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}
