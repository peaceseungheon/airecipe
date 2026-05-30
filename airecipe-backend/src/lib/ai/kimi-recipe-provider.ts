/**
 * KimiRecipeProvider — AIRecipeProvider의 Moonshot AI(Kimi, OpenAI 호환) 구현
 * (Adapter, ADR-008 후속: Kimi 추가). gemini/claude 어댑터 패턴을 그대로 미러링한다.
 *
 * 책임:
 * - response_format: { type: "json_object" } + 프롬프트로 GeneratedRecipe 형태 강제
 *   → 누적 텍스트를 1회 JSON.parse → parseGeneratedRecipe(zod) 검증.
 * - 스트리밍(generateRecipeStream): stream: true 로 chunk.choices[0].delta.content 델타를
 *   handlers.onText로 흘려보내고(gemini의 meta→text*→recipe→done 시맨틱과 동일), 누적 후 최종 파싱.
 * - 타임아웃(60s): SDK timeout 옵션. 에러 매핑: status === 429 → rate_limited, 그 외 → provider_error.
 *
 * Moonshot은 OpenAI 호환 API(`baseURL: https://api.moonshot.ai/v1`)를 공식 지원하므로
 * 공식 `openai` SDK를 어댑터로 사용한다(gemini=@google/genai, claude=@anthropic-ai/sdk와 일관).
 *
 * 어댑터 격리: `openai` import는 본 파일에만 존재한다 — 외부 계층은 AIRecipeProvider만 안다(DIP).
 */
import OpenAI from "openai";
import type {
  AIRecipeProvider,
  GenerateParams,
  StreamHandlers,
} from "@/lib/ai/ai-recipe-provider";
import { AIProviderError } from "@/lib/ai/ai-recipe-provider";
import {
  buildSystemTextJson,
  buildUserPromptJson,
} from "@/lib/ai/prompts/prompt-factory";
import { parseGeneratedRecipe } from "@/lib/ai/recipe-schema";
import type { GeneratedRecipe } from "@/types";

const DEFAULT_MODEL = "kimi-k2";
const DEFAULT_BASE_URL = "https://api.moonshot.ai/v1";
const MAX_TOKENS = 2048;
const REQUEST_TIMEOUT_MS = 60_000;

export class KimiRecipeProvider implements AIRecipeProvider {
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

  async generateRecipe(params: GenerateParams): Promise<GeneratedRecipe> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: MAX_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSystemTextJson() },
          { role: "user", content: buildUserPromptJson(params) },
        ],
      });
      const text = completion.choices[0]?.message?.content ?? "";
      return this.parseFinal(text);
    } catch (err) {
      throw this.toProviderError(err);
    }
  }

  async generateRecipeStream(
    params: GenerateParams,
    handlers: StreamHandlers,
  ): Promise<GeneratedRecipe> {
    try {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: MAX_TOKENS,
        response_format: { type: "json_object" },
        stream: true,
        messages: [
          { role: "system", content: buildSystemTextJson() },
          { role: "user", content: buildUserPromptJson(params) },
        ],
      });

      // 누적 텍스트 — json_object 모드에서 delta.content는 부분 JSON 문자열로 흐른다.
      // onText는 raw 델타를 그대로 전달하고(gemini와 동일), 최종 파싱은 누적 후 1회만 수행한다.
      let accumulated = "";
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        if (delta) {
          accumulated += delta;
          handlers.onText?.(delta);
        }
      }
      return this.parseFinal(accumulated);
    } catch (err) {
      throw this.toProviderError(err);
    }
  }

  /** 누적된 JSON 문자열을 GeneratedRecipe로 파싱·검증. */
  private parseFinal(text: string): GeneratedRecipe {
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
      return parseGeneratedRecipe(raw);
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
        "AI 레시피 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        err,
      );
    }
    // 타임아웃(APIConnectionTimeoutError) 포함 — 일반 provider_error로 수렴.
    return new AIProviderError(
      "provider_error",
      "AI 레시피 생성 중 알 수 없는 오류가 발생했습니다.",
      err,
    );
  }
}
