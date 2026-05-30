/**
 * Recommendation Provider Factory (ADR-011 D-R3, ADR-008 패턴) —
 * AI_PROVIDER 환경변수로 구현체를 선택한다.
 *
 * - `AI_PROVIDER` 미설정 또는 "gemini" → GeminiRecommendationProvider (기본)
 * - `AI_PROVIDER=claude` → ClaudeRecommendationProvider (롤백 경로)
 * - 그 외 값 → AIProviderError 명시적 throw (silent fallback 금지)
 *
 * 싱글턴 캐싱은 본 Factory의 책임이 아니다 — composition.ts가 담당.
 */
import { AIProviderError } from "@/lib/ai/ai-recipe-provider";
import type { AIRecommendationProvider } from "@/lib/ai/ai-recommendation-provider";
import { GeminiRecommendationProvider } from "@/lib/ai/gemini-recommendation-provider";
import { ClaudeRecommendationProvider } from "@/lib/ai/claude-recommendation-provider";

const DEFAULT_PROVIDER = "gemini";

export function createAIRecommendationProvider(): AIRecommendationProvider {
  const raw = process.env.AI_PROVIDER?.trim();
  const kind: string = raw && raw.length > 0 ? raw : DEFAULT_PROVIDER;

  switch (kind) {
    case "gemini":
      return new GeminiRecommendationProvider();
    case "claude":
      return new ClaudeRecommendationProvider();
    default:
      throw new AIProviderError(
        "provider_error",
        `지원하지 않는 AI_PROVIDER: ${kind}. "gemini" 또는 "claude"만 허용됩니다.`,
      );
  }
}
