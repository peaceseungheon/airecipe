/**
 * ClaudeRecommendationProvider — AIRecommendationProvider의 Anthropic SDK 구현
 * (Adapter, ADR-011 D-R4). claude-recipe-provider.ts 패턴을 복제·치환한다.
 *
 * 책임:
 * - tool use(emit_recommendations)로 구조화 JSON 강제 → items 배열을 zod로 재검증(정확히 5개).
 * - 시스템 프롬프트 고정부 캐싱(recommendation-prompt-factory) → 비용 절감.
 * - 재시도(SDK maxRetries: 429/5xx 지수 백오프) + 타임아웃 → 어댑터 계층 책임.
 *
 * Service는 이 구현을 모르고 AIRecommendationProvider 인터페이스에만 의존한다(DIP).
 */
import Anthropic from "@anthropic-ai/sdk";
import type {
  AIRecommendationProvider,
  RecommendInput,
} from "@/lib/ai/ai-recommendation-provider";
import { AIProviderError } from "@/lib/ai/ai-recipe-provider";
import {
  buildRecommendSystemBlocks,
  buildRecommendUserPrompt,
} from "@/lib/ai/prompts/recommendation-prompt-factory";
import {
  EMIT_RECOMMENDATIONS_TOOL_NAME,
  emitRecommendationsTool,
} from "@/lib/ai/prompts/recommendation-tool-schema";
import {
  parseRecommendationItems,
  type RecommendationItem,
} from "@/lib/ai/recommendation-schema";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 2048;
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 2; // 429/5xx 지수 백오프 (SDK 내장)

export class ClaudeRecommendationProvider implements AIRecommendationProvider {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(apiKey = process.env.ANTHROPIC_API_KEY, model?: string) {
    if (!apiKey) {
      throw new AIProviderError(
        "provider_error",
        "ANTHROPIC_API_KEY가 설정되지 않았습니다.",
      );
    }
    this.client = new Anthropic({
      apiKey,
      maxRetries: MAX_RETRIES,
      timeout: REQUEST_TIMEOUT_MS,
    });
    this.model = model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  }

  async recommend(input: RecommendInput): Promise<RecommendationItem[]> {
    try {
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: MAX_TOKENS,
        system: buildRecommendSystemBlocks(),
        tools: [emitRecommendationsTool],
        tool_choice: { type: "tool", name: EMIT_RECOMMENDATIONS_TOOL_NAME },
        messages: [{ role: "user", content: buildRecommendUserPrompt(input) }],
      });
      return this.extractItems(message.content);
    } catch (err) {
      throw this.toProviderError(err);
    }
  }

  /** tool_use 블록에서 emit_recommendations 입력을 찾아 items 배열로 검증·파싱한다. */
  private extractItems(
    content: Anthropic.Messages.ContentBlock[],
  ): RecommendationItem[] {
    const toolUse = content.find(
      (block): block is Anthropic.Messages.ToolUseBlock =>
        block.type === "tool_use" &&
        block.name === EMIT_RECOMMENDATIONS_TOOL_NAME,
    );
    if (!toolUse) {
      throw new AIProviderError(
        "provider_error",
        "AI가 구조화된 추천(emit_recommendations)을 반환하지 않았습니다.",
      );
    }
    try {
      return parseRecommendationItems(
        (toolUse.input as { items?: unknown })?.items,
      );
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
    if (err instanceof Anthropic.APIError) {
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
    return new AIProviderError(
      "provider_error",
      "AI 추천 생성 중 알 수 없는 오류가 발생했습니다.",
      err,
    );
  }
}
