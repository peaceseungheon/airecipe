/**
 * Prompt Factory (ADR-002) — 시스템 프롬프트 고정부(캐싱 대상)와 사용자 변수부를 분리 생성.
 * 고정부에 cache_control: ephemeral 을 붙여 반복 호출 비용을 절감한다(5분 TTL).
 */
import type Anthropic from "@anthropic-ai/sdk";
import type { GenerateParams } from "@/lib/ai/ai-recipe-provider";

/**
 * 고정 시스템 지침 — 요리 도메인 규칙 + 출력 정책. 호출마다 동일하므로 캐싱한다.
 * 한국어 레시피를 기본으로 한다.
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
 * 시스템 블록 — 고정부에 cache_control 부여.
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

/** 사용자 변수부 — 요리 이름·인분. 캐싱하지 않는다. */
export function buildUserPrompt(params: GenerateParams): string {
  return `요리 이름: ${params.dishName}\n인분: ${params.servings}인분\n\n위 요리의 레시피와 ${params.servings}인분을 기준으로 한 1인분 영양 정보를 생성해 emit_recipe 도구로 반환하세요.`;
}
