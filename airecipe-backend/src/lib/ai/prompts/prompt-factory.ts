/**
 * Prompt Factory (ADR-002) — 시스템 프롬프트 고정부와 사용자 변수부를 분리 생성.
 *
 * Provider 매트릭스:
 * - Claude (`buildSystemBlocks`): 고정부에 cache_control: ephemeral 부여 → 반복 호출 비용 절감(5분 TTL).
 *   구조화 출력은 tool use(emit_recipe)로 강제.
 * - Gemini (`buildSystemText`): 동일한 지침을 평문으로 반환. 구조화 출력은 responseSchema로 강제.
 *   Gemini cachedContents는 별도 API이며 YAGNI로 보류(세션 #3).
 *
 * 시스템 지침 본문(RECIPE_SYSTEM_INSTRUCTIONS)은 SSOT — 두 빌더가 공유하여 행동 일치를 보장한다.
 */
import type Anthropic from "@anthropic-ai/sdk";
import type { GenerateParams } from "@/lib/ai/ai-recipe-provider";

/**
 * 고정 시스템 지침 — 요리 도메인 규칙 + 출력 정책. 호출마다 동일하므로 Claude에서 캐싱한다.
 * 한국어 레시피를 기본으로 한다.
 *
 * SSOT 주의: 본문 변경은 양쪽 Provider 행동을 동시에 바꾼다. 출력 강제 문구(emit_recipe 도구
 * 호출 / JSON 응답)는 Provider별 어댑터에서 보강되며, 공통 본문은 의도적으로 도구명에 종속되지
 * 않게 유지한다.
 */
export const RECIPE_SYSTEM_INSTRUCTIONS = `당신은 전문 요리사이자 영양사입니다. 사용자가 입력한 요리 이름에 대해 정확하고 실용적인 레시피와 1인분 기준 영양 정보를 생성합니다.

규칙:
- 모든 텍스트는 한국어로 작성합니다.
- 재료는 한국 가정에서 구할 수 있는 것으로, 양과 단위를 명확히 합니다(예: g, ml, 큰술, 작은술, 개, 컵).
- 조리 순서는 1부터 시작하는 단계 번호로, 각 단계를 구체적으로 설명합니다.
- 난이도는 easy/medium/hard 중 하나로 정직하게 평가합니다.
- 영양 정보는 1인분 기준 추정치이며, 칼로리(kcal), 탄수화물·단백질·지방·식이섬유(g)를 숫자로 제시합니다.
- healthNote는 이 요리의 건강 측면을 1~2문장으로 간단히 설명합니다.
- tips는 맛/보관/대체 재료 등 실용 팁을 0개 이상 제공합니다(없으면 빈 배열).
- 입력이 요리가 아니거나 부적절하면, 가장 근접한 합리적 해석으로 일반적인 요리 레시피를 생성합니다.
- 반드시 emit_recipe 도구를 호출하여 구조화된 형태로만 응답합니다. 자유 텍스트로 레시피를 쓰지 마십시오.`;

/**
 * Claude 시스템 블록 — 고정부에 cache_control 부여.
 * Anthropic SDK의 system 파라미터(text 블록 배열) 형태로 반환한다.
 */
export function buildSystemBlocks(): Anthropic.Messages.TextBlockParam[] {
  return [
    {
      type: "text",
      text: RECIPE_SYSTEM_INSTRUCTIONS,
      cache_control: { type: "ephemeral" },
    },
  ];
}

/**
 * Gemini 시스템 지침 평문.
 * Gemini는 cachedContents가 별도 API이며 본 스프린트 범위 밖이므로 평문 한 덩어리로 사용한다.
 */
export function buildSystemText(): string {
  return RECIPE_SYSTEM_INSTRUCTIONS;
}

/** 사용자 변수부 — 요리 이름·인분. 캐싱하지 않는다. Provider 공통. */
export function buildUserPrompt(params: GenerateParams): string {
  return `요리 이름: ${params.dishName}\n인분: ${params.servings}인분\n\n위 요리의 레시피와 ${params.servings}인분을 기준으로 한 1인분 영양 정보를 생성해 emit_recipe 도구로 반환하세요.`;
}

/**
 * Kimi(OpenAI 호환) JSON 모드용 시스템 지침 (ADR-008 후속: Kimi 추가).
 *
 * RECIPE_SYSTEM_INSTRUCTIONS(SSOT)는 마지막 줄이 "emit_recipe 도구" 호출을 지시하지만,
 * OpenAI 호환 경로는 도구가 아닌 response_format: json_object로 출력을 강제한다.
 * json_object 모드는 스키마를 강제하지 않으므로 공통 본문에 JSON 형태 지시를 보강한다.
 * 형태의 SSOT는 GeneratedRecipe(=recipe-schema.ts zod) — 여기서는 키 목록만 재서술한다.
 */
export function buildSystemTextJson(): string {
  return `${RECIPE_SYSTEM_INSTRUCTIONS}

[출력 형식] 반드시 다음 키를 가진 단일 JSON 객체로만 응답하십시오. 코드 블록·설명 텍스트 없이 JSON만 출력합니다.
- dishName(string), description(string), servings(number), cookTimeMinutes(number)
- difficulty("easy"|"medium"|"hard")
- ingredients: [{ name(string), quantity(number), unit(string) }, ...] (1개 이상)
- steps: [{ order(number, 1부터), instruction(string) }, ...] (1개 이상)
- tips: string[] (없으면 빈 배열)
- nutrition: { calories(number), carbohydrates(number), protein(number), fat(number), fiber(number), healthNote(string) }`;
}

/** Kimi(OpenAI 호환) JSON 모드용 사용자 프롬프트 — 도구 언급 없이 JSON 출력만 지시. */
export function buildUserPromptJson(params: GenerateParams): string {
  return `요리 이름: ${params.dishName}\n인분: ${params.servings}인분\n\n위 요리의 레시피와 ${params.servings}인분을 기준으로 한 1인분 영양 정보를 위 [출력 형식]의 JSON 객체로 생성하세요.`;
}
