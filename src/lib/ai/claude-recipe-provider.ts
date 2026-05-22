/**
 * ClaudeRecipeProvider — AIRecipeProvider의 Anthropic SDK 구현 (Adapter, ADR-002).
 *
 * 책임:
 * - tool use(emit_recipe)로 구조화 JSON 강제 → GeneratedRecipe로 파싱·검증.
 * - 시스템 프롬프트 고정부 캐싱(prompt-factory) → 비용 절감.
 * - 재시도(SDK maxRetries: 429/5xx 지수 백오프) + 타임아웃 → 어댑터 계층 책임.
 * - 스트리밍: text 델타를 handlers.onText로 노출, 최종 tool 입력을 GeneratedRecipe로 반환.
 *
 * Service는 이 구현을 모르고 AIRecipeProvider 인터페이스에만 의존한다(DIP).
 */
import Anthropic from "@anthropic-ai/sdk";
import type {
  AIRecipeProvider,
  GenerateParams,
  StreamHandlers,
} from "@/lib/ai/ai-recipe-provider";
import { AIProviderError } from "@/lib/ai/ai-recipe-provider";
import {
  buildSystemBlocks,
  buildUserPrompt,
} from "@/lib/ai/prompts/prompt-factory";
import {
  EMIT_RECIPE_TOOL_NAME,
  emitRecipeTool,
} from "@/lib/ai/prompts/recipe-tool-schema";
import { parseGeneratedRecipe } from "@/lib/ai/recipe-schema";
import type { GeneratedRecipe } from "@/types";

const DEFAULT_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 2048;
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 2; // 429/5xx 지수 백오프 (SDK 내장)

export class ClaudeRecipeProvider implements AIRecipeProvider {
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

  async generateRecipe(params: GenerateParams): Promise<GeneratedRecipe> {
    try {
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: MAX_TOKENS,
        system: buildSystemBlocks(),
        tools: [emitRecipeTool],
        tool_choice: { type: "tool", name: EMIT_RECIPE_TOOL_NAME },
        messages: [{ role: "user", content: buildUserPrompt(params) }],
      });
      return this.extractRecipe(message.content);
    } catch (err) {
      throw this.toProviderError(err);
    }
  }

  async generateRecipeStream(
    params: GenerateParams,
    handlers: StreamHandlers,
  ): Promise<GeneratedRecipe> {
    try {
      const stream = this.client.messages.stream({
        model: this.model,
        max_tokens: MAX_TOKENS,
        system: buildSystemBlocks(),
        tools: [emitRecipeTool],
        tool_choice: { type: "tool", name: EMIT_RECIPE_TOOL_NAME },
        messages: [{ role: "user", content: buildUserPrompt(params) }],
      });

      // 텍스트 델타를 UX용으로 노출(tool 강제 모드에서는 비어 있을 수 있음 — 선택적).
      if (handlers.onText) {
        stream.on("text", (delta) => handlers.onText!(delta));
      }

      const message = await stream.finalMessage();
      return this.extractRecipe(message.content);
    } catch (err) {
      throw this.toProviderError(err);
    }
  }

  /** tool_use 블록에서 emit_recipe 입력을 찾아 GeneratedRecipe로 검증·파싱한다. */
  private extractRecipe(content: Anthropic.Messages.ContentBlock[]): GeneratedRecipe {
    const toolUse = content.find(
      (block): block is Anthropic.Messages.ToolUseBlock =>
        block.type === "tool_use" && block.name === EMIT_RECIPE_TOOL_NAME,
    );
    if (!toolUse) {
      throw new AIProviderError(
        "provider_error",
        "AI가 구조화된 레시피(emit_recipe)를 반환하지 않았습니다.",
      );
    }
    try {
      return parseGeneratedRecipe(toolUse.input);
    } catch (cause) {
      throw new AIProviderError(
        "provider_error",
        "AI 응답이 레시피 스키마와 일치하지 않습니다.",
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
        "AI 레시피 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        err,
      );
    }
    return new AIProviderError(
      "provider_error",
      "AI 레시피 생성 중 알 수 없는 오류가 발생했습니다.",
      err,
    );
  }
}
