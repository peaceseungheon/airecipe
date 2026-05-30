/**
 * AI Provider Factory (ADR-002) — AI_PROVIDER 환경변수로 구현체를 선택한다.
 *
 * 책임:
 * - 단일 환경변수 스위치(`AI_PROVIDER`)로 Provider 교체. OCP: 새 Provider 추가 시 분기 한 줄만 추가.
 * - 모델·키 등 Provider 고유 설정은 각 어댑터의 생성자가 자체 환경변수로 읽는다(SRP).
 * - 싱글턴 캐싱은 본 Factory의 책임이 아니다 — composition.ts가 담당.
 *
 * 매트릭스(ADR-008 후속, 2026-05-30: Kimi 추가 + 기본 전환):
 * - `AI_PROVIDER` 미설정 또는 "kimi" → KimiRecipeProvider (기본)
 * - `AI_PROVIDER=gemini` → GeminiRecipeProvider (롤백 경로, 보존)
 * - `AI_PROVIDER=claude` → ClaudeRecipeProvider (롤백 경로, 보존)
 * - 그 외 값 → AIProviderError 명시적 throw (silent fallback 금지)
 */
import { AIProviderError, type AIRecipeProvider } from "@/lib/ai/ai-recipe-provider";
import { ClaudeRecipeProvider } from "@/lib/ai/claude-recipe-provider";
import { GeminiRecipeProvider } from "@/lib/ai/gemini-recipe-provider";
import { KimiRecipeProvider } from "@/lib/ai/kimi-recipe-provider";

export type AIProviderKind = "gemini" | "claude" | "kimi";

const DEFAULT_PROVIDER: AIProviderKind = "kimi";

/**
 * 환경변수 기반 Provider 조립.
 * Composition Root에서만 호출한다.
 */
export function createAIRecipeProvider(): AIRecipeProvider {
  const raw = process.env.AI_PROVIDER?.trim();
  const kind: string = raw && raw.length > 0 ? raw : DEFAULT_PROVIDER;

  switch (kind) {
    case "kimi":
      return new KimiRecipeProvider();
    case "gemini":
      return new GeminiRecipeProvider();
    case "claude":
      return new ClaudeRecipeProvider();
    default:
      throw new AIProviderError(
        "provider_error",
        `지원하지 않는 AI_PROVIDER: ${kind}. "gemini" | "claude" | "kimi"만 허용됩니다.`,
      );
  }
}
