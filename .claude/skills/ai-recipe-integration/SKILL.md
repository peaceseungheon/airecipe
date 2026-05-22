---
name: ai-recipe-integration
description: "Claude API(Anthropic SDK)를 레시피 앱에 통합하는 가이드 — 레시피 생성/추천, 영양/식단 분석. 프롬프트 캐싱, 구조화된 JSON 출력(tool use), 어댑터 격리, 재시도/타임아웃, 비용 관리를 다룬다. AI 기능을 구현하거나 Claude API를 호출하는 코드를 작성·수정할 때 반드시 이 스킬을 사용할 것. 프롬프트 설계, AI 응답 파싱, 영양 분석 로직 작성 시에도 사용."
---

# AI 레시피 통합 가이드 (Claude API)

레시피 생성/추천과 영양/식단 분석을 Claude API로 구현한다. 최신 모델 ID는 `claude-opus-4-7`(고품질), 비용/속도 균형은 `claude-sonnet-4-6`, 경량은 `claude-haiku-4-5-20251001`. 레시피 생성/영양 분석은 tool use로 출력 스키마가 강제되므로 **`claude-haiku-4-5-20251001`을 기본으로 시작**(비용 최적화)하고, 사용자 평가에서 품질 부족이 드러나면 sonnet → opus 순서로 올린다.

## 핵심 원칙: AI는 어댑터 뒤에 격리한다

Anthropic SDK를 Route Handler나 컴포넌트에 직접 호출하지 않는다. `AIRecipeProvider` 인터페이스(`software-design-principles` 스킬의 Adapter 패턴) 뒤로 숨긴다. 이유:
- 테스트에서 목 주입 가능 (결정적 검증).
- 모델/제공자 교체가 Service에 영향 없음 (DIP).
- 프롬프트·파싱 로직이 한 곳에 모임.

## 프롬프트 캐싱 — 비용 절감의 핵심

레시피 생성/영양 분석은 긴 시스템 프롬프트(요리 지침, 출력 스키마, 예시)를 반복 사용한다. 이 고정 부분에 `cache_control`을 붙여 캐싱한다. 캐시 TTL은 5분이며, 반복 호출 시 입력 토큰 비용을 크게 줄인다.

```ts
const systemPrompt = [
  { type: "text", text: RECIPE_SYSTEM_INSTRUCTIONS,
    cache_control: { type: "ephemeral" } }, // 고정부 → 캐싱
];
// 사용자별 변수(보유 재료, 식단 제약)는 user 메시지로 — 캐싱하지 않음
```

빌더(Factory 패턴)로 고정부/변수부를 분리해 캐싱 경계를 명확히 한다.

## 구조화된 출력 — tool use로 JSON 강제

레시피·영양 데이터는 자유 텍스트가 아니라 **구조화된 JSON**이어야 프론트가 안전하게 소비한다. Claude의 tool use(함수 호출)로 출력 스키마를 강제한다.

```ts
const tools = [{
  name: "emit_recipe",
  description: "생성된 레시피를 구조화된 형태로 반환",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      ingredients: { type: "array", items: { /* ... */ } },
      steps: { type: "array", items: { type: "string" } },
      nutrition: { /* 영양 정보 */ },
    },
    required: ["title", "ingredients", "steps"],
  },
}];
// tool_choice로 해당 도구 사용 강제 → 응답을 JSON으로 안정적으로 파싱
```

> tool input_schema의 필드명이 `src/types/`의 공유 타입 및 API 응답 DTO와 **일치**해야 한다. 여기서 어긋나면 AI→UI 경계면 버그가 된다. QA가 이 경계를 검증한다.

## 영양/식단 분석

- 영양 계산은 두 경로가 가능하다: (a) LLM이 추정, (b) 재료 DB 조회 후 계산. 정확도가 중요하면 (b)를, 빠른 추정이면 (a)를 쓰되 "추정치" 라벨을 붙인다. 전략(Strategy) 패턴으로 교체 가능하게 둔다.
- 식단 제약(알레르기, 채식 등)은 생성 프롬프트의 변수부에 명시하고, 생성 후 검증 단계에서 위반 여부를 재확인한다 (AI 출력을 맹신하지 않음).

## 재시도 / 타임아웃 / 에러

- 어댑터 계층에서 일시적 오류(429, 5xx)에 지수 백오프 재시도 (최대 2~3회).
- 타임아웃을 설정하고, 초과 시 사용자에게 명확한 메시지로 변환한다.
- AI 응답 파싱 실패(스키마 불일치)는 조용히 삼키지 않고 로깅 + 재시도 또는 명시적 실패 반환.

## 비용 / 안전
- API 키는 서버 환경변수로만 (`process.env`). 절대 클라이언트 번들에 노출하지 않는다.
- 사용자 입력을 프롬프트에 넣을 때 프롬프트 인젝션을 고려한다 — 시스템 지침을 사용자 입력보다 우선하도록 구조화하고, tool use로 출력을 제약한다.
- 토큰 사용량을 로깅하여 비용을 모니터링한다.

> Anthropic SDK 사용법·캐싱·tool use의 최신 세부는 `claude-api` 스킬 또는 context7 문서를 참조한다.
