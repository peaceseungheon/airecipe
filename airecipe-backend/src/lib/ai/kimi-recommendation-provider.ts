/**
 * KimiRecommendationProvider — AIRecommendationProvider의 Moonshot AI(Kimi, OpenAI 호환) 구현
 * (Adapter, ADR-008 후속: Kimi 추가). gemini/claude-recommendation-provider 패턴을 복제·치환한다.
 *
 * 책임:
 * - response_format: { type: "json_object" } + 프롬프트로 { items: [...] } 형태 강제
 *   → items 배열을 zod로 재검증(정확히 5개, parseRecommendationItems).
 * - 타임아웃(60s): SDK timeout 옵션. 에러 매핑: status === 429 → rate_limited, 그 외 → provider_error.
 *
 * 어댑터 격리: `openai` import는 본 파일에만 존재한다(DIP).
 */
import OpenAI from "openai";
import type {
  AIRecommendationProvider,
  RecommendInput,
} from "@/lib/ai/ai-recommendation-provider";
import { AIProviderError } from "@/lib/ai/ai-recipe-provider";
import {
  buildRecommendSystemTextJson,
  buildRecommendUserPrompt,
} from "@/lib/ai/prompts/recommendation-prompt-factory";
import {
  parseRecommendationItems,
  type RecommendationItem,
} from "@/lib/ai/recommendation-schema";

const DEFAULT_MODEL = "kimi-k2";
const DEFAULT_BASE_URL = "https://api.moonshot.ai/v1";
const MAX_TOKENS = 2048;
const REQUEST_TIMEOUT_MS = 60_000;

export class KimiRecommendationProvider implements AIRecommendationProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(apiKey = process.env.KIMI_API_KEY, model?: string) {
    if (!apiKey) {
      throw new AIProviderError(
        "provider_error",
        "KIMI_API_KEY가 설정되지 않았습니다.",
      );
    }
    this.client = new OpenAI({
      apiKey,
      baseURL: process.env.KIMI_BASE_URL ?? DEFAULT_BASE_URL,
      timeout: REQUEST_TIMEOUT_MS,
    });
    this.model = model ?? process.env.KIMI_MODEL ?? DEFAULT_MODEL;
  }

  async recommend(input: RecommendInput): Promise<RecommendationItem[]> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: MAX_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildRecommendSystemTextJson() },
          { role: "user", content: buildRecommendUserPrompt(input) },
        ],
      });
      const text = completion.choices[0]?.message?.content ?? "";
      return this.parseFinal(text);
    } catch (err) {
      throw this.toProviderError(err);
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
    if (err instanceof OpenAI.APIError) {
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
    // 타임아웃(APIConnectionTimeoutError) 포함 — 일반 provider_error로 수렴.
    return new AIProviderError(
      "provider_error",
      "AI 추천 생성 중 알 수 없는 오류가 발생했습니다.",
      err,
    );
  }
}
