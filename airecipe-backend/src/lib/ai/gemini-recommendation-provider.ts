/**
 * GeminiRecommendationProvider — AIRecommendationProvider의 Google Gen AI(@google/genai) 구현
 * (Adapter, ADR-011 D-R4). gemini-recipe-provider.ts 패턴을 복제·치환한다.
 *
 * 책임:
 * - responseMimeType: "application/json" + responseSchema 로 구조화 JSON 출력 강제
 *   → items 배열을 zod로 재검증(정확히 5개, parseRecommendationItems).
 * - 타임아웃(60s): SDK 옵션 미사용, AbortController로 일관 처리.
 * - 에러 매핑: ApiError.status === 429 → rate_limited, 그 외 SDK/네트워크 → provider_error.
 *
 * 어댑터 격리: `@google/genai` import는 본 파일에만 존재한다(DIP).
 */
import { ApiError, GoogleGenAI } from "@google/genai";
import type {
  AIRecommendationProvider,
  RecommendInput,
} from "@/lib/ai/ai-recommendation-provider";
import { AIProviderError } from "@/lib/ai/ai-recipe-provider";
import {
  buildRecommendSystemText,
  buildRecommendUserPrompt,
} from "@/lib/ai/prompts/recommendation-prompt-factory";
import { RECOMMENDATIONS_RESPONSE_SCHEMA } from "@/lib/ai/prompts/recommendation-response-schema";
import {
  parseRecommendationItems,
  type RecommendationItem,
} from "@/lib/ai/recommendation-schema";

const DEFAULT_MODEL = "gemini-3.1-flash-lite";
const MAX_OUTPUT_TOKENS = 2048;
const REQUEST_TIMEOUT_MS = 60_000;

export class GeminiRecommendationProvider implements AIRecommendationProvider {
  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(apiKey = process.env.GEMINI_API_KEY, model?: string) {
    if (!apiKey) {
      throw new AIProviderError(
        "provider_error",
        "GEMINI_API_KEY가 설정되지 않았습니다.",
      );
    }
    this.client = new GoogleGenAI({ apiKey });
    this.model = model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
  }

  async recommend(input: RecommendInput): Promise<RecommendationItem[]> {
    const { signal, cleanup } = createTimeoutSignal(REQUEST_TIMEOUT_MS);
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: buildRecommendUserPrompt(input),
        config: {
          systemInstruction: buildRecommendSystemText(),
          responseMimeType: "application/json",
          responseSchema: RECOMMENDATIONS_RESPONSE_SCHEMA,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          abortSignal: signal,
        },
      });
      // responseSchema 모드에서 response.text는 스키마와 일치하는 JSON 문자열이 보장된다.
      const text = response.text ?? "";
      return this.parseFinal(text);
    } catch (err) {
      throw this.toProviderError(err);
    } finally {
      cleanup();
    }
  }

  /** JSON 문자열을 items 배열로 파싱·재검증(정확히 5개). */
  private parseFinal(text: string): RecommendationItem[] {
    if (!text.trim()) {
      throw new AIProviderError(
        "provider_error",
        "AI가 빈 응답을 반환했습니다.",
      );
    }
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (cause) {
      throw new AIProviderError(
        "provider_error",
        "AI 응답을 JSON으로 파싱할 수 없습니다.",
        cause,
      );
    }
    try {
      return parseRecommendationItems((raw as { items?: unknown })?.items);
    } catch (cause) {
      throw new AIProviderError(
        "provider_error",
        "AI 추천 응답이 스키마와 일치하지 않습니다.",
        cause,
      );
    }
  }

  /** SDK 오류를 도메인 AIProviderError로 변환한다. */
  private toProviderError(err: unknown): AIProviderError {
    if (err instanceof AIProviderError) return err;
    if (err instanceof ApiError) {
      if (err.status === 429) {
        return new AIProviderError(
          "rate_limited",
          "AI 요청이 일시적으로 많습니다. 잠시 후 다시 시도해 주세요.",
          err,
        );
      }
      return new AIProviderError(
        "provider_error",
        "AI 추천 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        err,
      );
    }
    // AbortController 타임아웃(AbortError) 포함 — 일반 provider_error로 수렴.
    return new AIProviderError(
      "provider_error",
      "AI 추천 생성 중 알 수 없는 오류가 발생했습니다.",
      err,
    );
  }
}

/**
 * 60s 타임아웃용 AbortSignal 헬퍼.
 * SDK가 abortSignal을 받으므로 이를 통해 일관된 취소를 보장한다.
 */
function createTimeoutSignal(timeoutMs: number): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer),
  };
}
