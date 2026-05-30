/**
 * 추천 프롬프트 팩토리 — 시스템 지침(SSOT) + 사용자 프롬프트 빌더 (ADR-011).
 *
 * 두 Provider가 공유한다:
 * - Claude: buildRecommendSystemBlocks() — cache_control(ephemeral)로 고정부 캐싱.
 * - Gemini: buildRecommendSystemText() — 평문 systemInstruction.
 * 사용자 프롬프트(buildRecommendUserPrompt)는 동일 텍스트를 양쪽이 공유한다.
 *
 * 프롬프트 본문은 이 파일이 SSOT다 — Provider 코드에 흩지 않는다.
 *
 * 인젝션 방지: theme는 고정 enum만 통과(zod 검증 후 호출)하므로 자유 텍스트 삽입이 없다.
 * 라벨 매핑은 빌더 내부 상수(프롬프트 품질용) — 미니앱 §3.8.2 표와 동일.
 */
import type Anthropic from "@anthropic-ai/sdk";
import type { RecommendInput } from "@/lib/ai/ai-recommendation-provider";
import type {
  SituationKey,
  WeatherKey,
} from "@/lib/ai/recommendation-schema";

/** 상황 enum → 한국어 라벨 (프롬프트 품질용). */
const SITUATION_LABELS: Record<SituationKey, string> = {
  lunch: "점심",
  dinner: "저녁",
  midnight: "야식",
  gathering: "모임",
  solo: "혼밥",
  special: "특별한 날",
};

/** 날씨 enum → 한국어 라벨 (프롬프트 품질용). */
const WEATHER_LABELS: Record<WeatherKey, string> = {
  hot: "더운 날",
  cold: "추운 날",
  rainy: "비 오는 날",
  sunny: "화창한 날",
  chilly: "쌀쌀한 날",
};

/** 추천 시스템 지침 (고정부 — 캐싱 대상). */
export const RECOMMEND_SYSTEM_INSTRUCTIONS = `당신은 한국 요리 추천 전문가입니다.
주어진 상황·날씨 테마에 어울리는 서로 다른 요리를 정확히 5개 추천합니다.

규칙:
- 각 항목은 한국어 요리명(60자 이내), 추천 이유 한 줄 설명(120자 이내), 키워드 태그(최대 5개, 각 16자 이내)로 구성합니다.
- 중복 요리를 추천하지 않습니다(5개 모두 서로 다른 요리).
- 반드시 지정된 구조(도구/JSON 스키마)로만 응답하고 자유 텍스트를 쓰지 마십시오.`;

/** 선택된 테마를 한국어 라벨 문장으로 변환한다. */
function describeTheme(input: RecommendInput): string {
  const parts: string[] = [];
  if (input.theme.situation !== undefined) {
    parts.push(`상황: ${SITUATION_LABELS[input.theme.situation]}`);
  }
  if (input.theme.weather !== undefined) {
    parts.push(`날씨: ${WEATHER_LABELS[input.theme.weather]}`);
  }
  return parts.join(" / ");
}

/** 사용자 프롬프트 — 호출별 가변부(선택된 테마). */
export function buildRecommendUserPrompt(input: RecommendInput): string {
  return `${describeTheme(input)}\n위 테마에 어울리는 서로 다른 요리 5개를 지정된 구조로 추천해 주세요.`;
}

/**
 * Claude용 시스템 블록 — 고정부를 cache_control(ephemeral)로 표시해 캐싱한다.
 * 캐시 적중 시 입력 토큰 비용을 절감한다(ai-recipe-integration).
 */
export function buildRecommendSystemBlocks(): Anthropic.Messages.TextBlockParam[] {
  return [
    {
      type: "text",
      text: RECOMMEND_SYSTEM_INSTRUCTIONS,
      cache_control: { type: "ephemeral" },
    },
  ];
}

/** Gemini용 시스템 지침 평문. */
export function buildRecommendSystemText(): string {
  return RECOMMEND_SYSTEM_INSTRUCTIONS;
}
