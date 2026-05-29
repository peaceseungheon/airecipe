/**
 * RecipeGenerationService — "레시피 생성" 유스케이스 Facade (ADR-002).
 * F1(레시피 생성) + F2(영양 분석)를 단일 진입점으로 묶는다.
 * AIRecipeProvider 추상에만 의존(DIP) — 구체 AI SDK(Gemini/Claude)를 모른다.
 *
 * 영양 분석은 현재 AI 생성과 한 번에 이뤄진다(GeneratedRecipe.nutrition).
 * 확장 지점(YAGNI): 영양 계산이 별도 경로가 되면 여기서 Strategy로 조합(ADR-002).
 */
import type {
  AIRecipeProvider,
  StreamHandlers,
} from "@/lib/ai/ai-recipe-provider";
import { AIProviderError } from "@/lib/ai/ai-recipe-provider";
import { ServiceError } from "@/services/service-error";
import type { GeneratedRecipe } from "@/types";

const DEFAULT_SERVINGS = 2;

export interface GenerateInput {
  dishName: string;
  servings?: number;
}

export class RecipeGenerationService {
  constructor(private readonly ai: AIRecipeProvider) {}

  /** 비스트리밍 생성. */
  async generate(input: GenerateInput): Promise<GeneratedRecipe> {
    try {
      return await this.ai.generateRecipe({
        dishName: input.dishName,
        servings: input.servings ?? DEFAULT_SERVINGS,
      });
    } catch (err) {
      throw this.toServiceError(err);
    }
  }

  /** 스트리밍 생성. 진행 델타는 handlers로, 최종 결과는 반환값으로. */
  async generateStream(
    input: GenerateInput,
    handlers: StreamHandlers,
  ): Promise<GeneratedRecipe> {
    try {
      return await this.ai.generateRecipeStream(
        {
          dishName: input.dishName,
          servings: input.servings ?? DEFAULT_SERVINGS,
        },
        handlers,
      );
    } catch (err) {
      throw this.toServiceError(err);
    }
  }

  /** AIProviderError → ServiceError(ApiErrorCode) 매핑. */
  private toServiceError(err: unknown): ServiceError {
    if (err instanceof AIProviderError) {
      const code = err.kind === "rate_limited" ? "AI_RATE_LIMITED" : "AI_PROVIDER_ERROR";
      return new ServiceError(code, err.message, err);
    }
    return new ServiceError(
      "INTERNAL_ERROR",
      "레시피 생성 중 오류가 발생했습니다.",
      err,
    );
  }
}
