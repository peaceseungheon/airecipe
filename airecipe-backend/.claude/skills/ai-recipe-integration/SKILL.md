---
name: ai-recipe-integration
description: "AI Provider(기본 Gemini, Claude 롤백)를 레시피 앱에 통합하는 가이드 — 레시피 생성/추천, 영양/식단 분석. 프롬프트 캐싱, 구조화된 JSON 출력(Gemini responseSchema / Claude tool use), 어댑터+Factory 격리, 재시도/타임아웃, 비용 관리를 다룬다. AI 기능을 구현하거나 AI Provider API를 호출하는 코드를 작성·수정할 때 반드시 이 스킬을 사용할 것. 프롬프트 설계, AI 응답 파싱, 영양 분석 로직 작성 시에도 사용."
---

# AI 레시피 통합 가이드 (Gemini 기본, Claude 롤백)

레시피 생성/추천과 영양/식단 분석을 AI Provider로 구현한다. 본 프로젝트의 기본 Provider는 **Google Gemini**(`gemini-3.1-flash-lite`, SDK `@google/genai`)이며, 운영 안전망으로 **Claude**(`@anthropic-ai/sdk`, 최신 `claude-opus-4-7`/`claude-sonnet-4-6`/`claude-haiku-4-5-20251001`)가 비활성 보존된다. Provider 선택은 `AI_PROVIDER` 환경변수(`"gemini"` 기본 \| `"claude"` 롤백)로 Factory(`src/lib/ai/ai-recipe-provider.factory.ts`)가 수행한다(ADR-008).

레시피 생성/영양 분석은 두 Provider 모두 구조화 출력으로 스키마가 강제된다. **Gemini는 `responseSchema`(JSON Schema), Claude는 tool use(`input_schema` on `emit_recipe`)** 로 출력 형태를 보장한다. 어떤 Provider든 결과는 동일한 `GeneratedRecipe`(`src/types/recipe.ts`)로 수렴하며 zod로 검증한다.

## 핵심 원칙: AI는 어댑터 + Factory 뒤에 격리한다

AI SDK(`@google/genai`·`@anthropic-ai/sdk`)를 Route Handler나 컴포넌트에서 직접 호출하지 않는다. `AIRecipeProvider` 인터페이스(`software-design-principles` 스킬의 Adapter 패턴) 뒤로 숨기고, 구현체 선택은 Factory가 단일 지점에서 수행한다. 이유:
- 테스트에서 목 주입 가능 (결정적 검증).
- Provider 교체·추가가 Service에 영향 없음 (DIP/OCP). 실제로 ADR-008에서 Claude→Gemini 기본 전환을 Service 코드 변경 없이 수행.
- 프롬프트·파싱·재시도 로직이 한 곳에 모임.
- 새 Provider를 추가하려면 새 Adapter + Factory 한 분기만 추가하면 된다(Service·Route·UI는 불변).

## 프롬프트 캐싱 — 비용 절감의 핵심

레시피 생성/영양 분석은 긴 시스템 프롬프트(요리 지침, 출력 스키마, 예시)를 반복 사용한다. 가능한 Provider에서는 고정 부분을 캐싱해 반복 호출 비용을 줄인다.

- **Claude**: `cache_control: { type: "ephemeral" }`을 시스템 프롬프트 고정부 블록에 부착(5분 TTL). 현재 본 프로젝트는 Claude 모드에서 이 방식을 사용.
- **Gemini**: `cachedContents` 별도 API로 캐싱(자동 부착 아님). 본 프로젝트의 기본 Gemini 모드에서는 호출량 대비 도입 비용 평가 결과 **현재 미사용**(YAGNI; ADR-008 결과 참조).

```ts
// Claude — 시스템 프롬프트 고정부에 cache_control 부착
const systemPrompt = [
  { type: "text", text: RECIPE_SYSTEM_INSTRUCTIONS,
    cache_control: { type: "ephemeral" } },
];
// 사용자별 변수(보유 재료, 식단 제약)는 user 메시지로 — 캐싱하지 않음
```

빌더(Factory 패턴)로 고정부/변수부를 분리해 캐싱 경계를 명확히 한다. 이 분리는 Provider와 무관하게 유지한다.

## 구조화된 출력 — Provider별 방식, 동일한 도메인 타입

레시피·영양 데이터는 자유 텍스트가 아니라 **구조화된 JSON**이어야 프론트가 안전하게 소비한다. 두 Provider 모두 구조화 출력을 지원하지만 방식이 다르다.

- **Claude (tool use)**: `emit_recipe` 도구의 `input_schema`로 출력 형태를 강제, `tool_choice`로 해당 도구 사용 강제.
- **Gemini (`responseSchema`)**: `generationConfig.responseSchema`에 JSON Schema를 지정, `responseMimeType: "application/json"`과 함께 사용.

```ts
// Claude — tool use
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

// Gemini — responseSchema (개념적 형태; 실제 SDK 호출은 `@google/genai` 참고)
const generationConfig = {
  responseMimeType: "application/json",
  responseSchema: {
    type: "object",
    properties: { /* 위와 동일한 필드명·타입 */ },
    required: ["title", "ingredients", "steps"],
  },
};
```

> 두 스키마의 필드명은 `src/types/recipe.ts`의 `GeneratedRecipe` 및 API 응답 DTO와 **일치**해야 한다. zod 검증(`recipe-schema.ts`)도 이 단일 도메인 타입에 맞춘다. 여기서 어긋나면 AI→UI 경계면 버그가 된다 — 한 Provider만 깨지는 형태가 가장 위험하다. QA가 이 경계를 검증한다.

## 영양/식단 분석

- 영양 계산은 두 경로가 가능하다: (a) LLM이 추정, (b) 재료 DB 조회 후 계산. 정확도가 중요하면 (b)를, 빠른 추정이면 (a)를 쓰되 "추정치" 라벨을 붙인다. 전략(Strategy) 패턴으로 교체 가능하게 둔다.
- 식단 제약(알레르기, 채식 등)은 생성 프롬프트의 변수부에 명시하고, 생성 후 검증 단계에서 위반 여부를 재확인한다 (AI 출력을 맹신하지 않음).

## 재시도 / 타임아웃 / 에러

- 어댑터 계층에서 일시적 오류(429, 5xx)에 지수 백오프 재시도 (최대 2~3회).
- 타임아웃을 설정하고, 초과 시 사용자에게 명확한 메시지로 변환한다.
- AI 응답 파싱 실패(스키마 불일치)는 조용히 삼키지 않고 로깅 + 재시도 또는 명시적 실패 반환.

## 비용 / 안전
- API 키(`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`)는 서버 환경변수로만 (`process.env`). 절대 클라이언트 번들에 노출하지 않는다. `NEXT_PUBLIC_` 접두사 금지.
- 사용자 입력을 프롬프트에 넣을 때 프롬프트 인젝션을 고려한다 — 시스템 지침을 사용자 입력보다 우선하도록 구조화하고, 구조화 출력(`responseSchema`/tool use)으로 출력을 제약한다.
- 토큰 사용량을 로깅하여 비용을 모니터링한다.
- **운영 롤백**: `AI_PROVIDER=claude` 환경변수 + `ANTHROPIC_API_KEY` 존재만으로 즉시 Claude 경로 복귀 (코드 변경 없음, ADR-008).

## 환경변수 (재확인)

| 변수 | 용도 | 기본값 |
|------|------|--------|
| `AI_PROVIDER` | Provider 선택 (`"gemini"` \| `"claude"`) | `gemini` |
| `GEMINI_API_KEY` | Gemini 호출 키 | (필수, gemini 모드) |
| `GEMINI_MODEL` | Gemini 모델 오버라이드 | `gemini-3.1-flash-lite` |
| `ANTHROPIC_API_KEY` | Claude 호출 키 | (필수, claude 모드) |
| `ANTHROPIC_MODEL` | Claude 모델 오버라이드 | `claude-haiku-4-5-20251001` |

> Google GenAI SDK(`@google/genai`)의 최신 세부는 context7 문서를 참조한다. Anthropic SDK 사용법·캐싱·tool use의 세부는 `claude-api` 스킬 또는 context7 문서를 참조한다.
