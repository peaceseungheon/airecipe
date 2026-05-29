# 04. AI Provider 배경 — Gemini(기본)·Claude(롤백)·Adapter+Factory

> **이 챕터 전에 알아야 할 것**: [03-API-CONTRACT.md](./03-API-CONTRACT.md) 3.2절(생성 엔드포인트).
>
> **이 챕터 완료 후 다음 챕터**: [05-AUTH.md](./05-AUTH.md) — 옵션 P 인증 미들웨어와 CORS 흐름.
>
> **이 챕터의 위치**: 본 챕터는 **백엔드 내부 결정**에 대한 배경 설명용이다. 미니앱은 AI Provider를 직접 호출하지 않는다 — 백엔드의 SSE 응답만 소비한다 (3.2.4). 미니앱 LLM이 직접 SDK를 깔거나 키를 다룰 일은 없다. baseline E절 backend 추가 필독 + ADR-002·ADR-008 인용.

---

## 4.0 이 챕터의 목적

미니앱이 호출하는 `POST /api/recipes/generate`의 뒤편에서 무슨 일이 벌어지는지를 1차 LLM 독자가 이해할 수 있게 한다. 핵심 메시지는 세 가지다:

1. **Provider 선택은 환경변수 `AI_PROVIDER` 한 줄로 결정**된다 (ADR-008). 미니앱은 Provider를 모른다.
2. **두 Provider는 동일한 `GeneratedRecipe`로 수렴**한다 (`src/types/recipe.ts`). 미니앱 응답 처리 코드는 무엇이 응답했는지 분기할 필요가 없다.
3. **AI API 키는 절대 미니앱에 노출되지 않는다**. 키는 백엔드 환경변수 전용. 미니앱과 백엔드 사이의 경계가 키 격리 경계다.

본 챕터는 새 코드를 지시하지 않는다. 백엔드 코드는 ADR-009 D4에 따라 **수정하지 않는다**.

---

## 4.1 아키텍처 한눈 (ADR-002 + ADR-008)

```
미니앱 (RN + Granite)
   │  POST /api/recipes/generate (헤더 생략 가능 — 공개 엔드포인트)
   ▼
백엔드 Route Handler — src/app/api/recipes/generate/route.ts
   │  zod 검증 → service 호출 (Facade)
   ▼
RecipeGenerationService (Facade) — getRecipeGenerationService()
   │  AIRecipeProvider 인터페이스에만 의존 (DIP)
   ▼
AIRecipeProvider (Adapter 인터페이스) — src/lib/ai/ai-recipe-provider.ts
   │
   ├─► GeminiRecipeProvider (기본)   — src/lib/ai/gemini-recipe-provider.ts
   │     └─► @google/genai SDK
   │           - responseMimeType: "application/json"
   │           - responseSchema: RECIPE_RESPONSE_SCHEMA
   │           - 모델: gemini-3.1-flash-lite
   │
   └─► ClaudeRecipeProvider (롤백)   — src/lib/ai/claude-recipe-provider.ts
         └─► @anthropic-ai/sdk
               - tool use: emit_recipe (input_schema)
               - cache_control: ephemeral (5분 TTL)
               - 모델: claude-haiku-4-5-20251001
```

**Provider 선택은 `createAIRecipeProvider()` Factory가 환경변수 `AI_PROVIDER`로 결정** (`src/lib/ai/ai-recipe-provider.factory.ts`):

| `AI_PROVIDER` 값 | 반환 Provider |
|------------------|---------------|
| 미설정 또는 `"gemini"` | `GeminiRecipeProvider` (기본) |
| `"claude"` | `ClaudeRecipeProvider` |
| 그 외 | `AIProviderError` 명시적 throw — silent fallback 금지 |

Service Composition Root만 Factory를 호출하고, Service 코드는 무엇이 주입됐는지 모른다 (DIP 유지).

---

## 4.2 AIRecipeProvider 인터페이스 명세

출처: `src/lib/ai/ai-recipe-provider.ts` 전문 인용.

```ts
export interface GenerateParams {
  dishName: string;
  servings: number;
}

/** 스트리밍 진행 콜백. Route가 SSE(StreamChunk)로 변환한다. */
export interface StreamHandlers {
  onText?: (delta: string) => void;
}

export interface AIRecipeProvider {
  /** 비스트리밍 생성: 완성된 GeneratedRecipe 반환. */
  generateRecipe(params: GenerateParams): Promise<GeneratedRecipe>;

  /**
   * 스트리밍 생성: 진행 델타를 handlers로 흘리고, 최종 GeneratedRecipe를 반환.
   * Route는 반환된 최종 결과를 `recipe` 청크로, 델타를 `text` 청크로 변환한다.
   */
  generateRecipeStream(
    params: GenerateParams,
    handlers: StreamHandlers,
  ): Promise<GeneratedRecipe>;
}

/** AI 제공자 오류 분류 — Service가 ApiErrorCode로 매핑한다. */
export type AIErrorKind = "rate_limited" | "provider_error";

export class AIProviderError extends Error {
  constructor(
    public readonly kind: AIErrorKind,
    message: string,
    public readonly cause?: unknown,
  ) { super(message); this.name = "AIProviderError"; }
}
```

### 4.2.1 메서드 매트릭스

| 메서드 | 입력 | 출력 | 호출 경로 |
|--------|------|------|-----------|
| `generateRecipe(params)` | `{ dishName, servings }` | `Promise<GeneratedRecipe>` | Route 비스트리밍 (`stream: false`) |
| `generateRecipeStream(params, handlers)` | 위 + `{ onText? }` | `Promise<GeneratedRecipe>` | Route 스트리밍 (`stream: true`) — `handlers.onText`로 텍스트 델타 흘려보내고 최종 `recipe` 반환 |

> 두 메서드 모두 최종적으로 동일한 `GeneratedRecipe`를 반환한다. 스트리밍은 **부가적인 진행 콜백**을 노출할 뿐, 진실 공급원은 항상 반환된 `GeneratedRecipe`이다 — `text` 청크의 누적이 아님 (3.2.4 미니앱 소비 규칙 2).
>
> **`servings` 기본값 책임 경계**: `AIRecipeProvider.GenerateParams.servings`는 **필수**(`src/lib/ai/ai-recipe-provider.ts:15`)이고, API 경계의 `GenerateRecipeRequest.servings`는 **선택**(기본 2). 미지정 요청에 기본값을 적용하는 책임은 **Route가 아니라 Service**(`RecipeGenerationService`, Facade)에 있다. 미니앱이 `servings`를 생략하면 Service가 2를 채워 Provider에 전달한다. Service 코드(`src/services/recipe-generation-service.ts` 등)에서 default 주입 후 어댑터 호출하는 단일 책임이 보존된다.

### 4.2.2 에러 분류

`AIProviderError.kind`는 두 가지만 존재한다:

| kind | 의미 | Service 변환 결과 (ApiErrorCode) |
|------|------|----------------------------------|
| `rate_limited` | Provider 429 응답 | `AI_RATE_LIMITED` (HTTP 429) |
| `provider_error` | Provider SDK 오류·타임아웃·JSON 파싱 실패·스키마 불일치 | `AI_PROVIDER_ERROR` (HTTP 502) |

(매핑은 Service 계층의 책임. Route는 `ServiceError` → `ApiError` 변환만 한다.)

---

## 4.3 Gemini 통합 (기본 Provider)

출처: `src/lib/ai/gemini-recipe-provider.ts`.

### 4.3.1 SDK·모델·옵션

| 항목 | 값 |
|------|----|
| SDK | `@google/genai` (Google GenAI SDK, `GoogleGenAI` 클래스) |
| 기본 모델 | `gemini-3.1-flash-lite` (오버라이드: `GEMINI_MODEL`) |
| 출력 강제 | `responseMimeType: "application/json"` + `responseSchema: RECIPE_RESPONSE_SCHEMA` |
| 시스템 지침 | `config.systemInstruction` 에 `buildSystemText()` 평문 전달 |
| 최대 출력 토큰 | 2048 |
| 타임아웃 | 60초 (`AbortController` + `setTimeout`) |
| API 키 환경변수 | `GEMINI_API_KEY` (필수, `AI_PROVIDER=gemini` 일 때) |
| 캐싱 | **미사용** — Gemini `cachedContents`는 별 API이며 본 스프린트 범위 밖 (YAGNI; ADR-008) |

### 4.3.2 구조화 출력 (responseSchema)

`RECIPE_RESPONSE_SCHEMA` (`src/lib/ai/prompts/recipe-response-schema.ts`)는 `Schema` 타입 (`@google/genai`의 `Type.OBJECT/ARRAY/STRING/INTEGER/NUMBER`)로 정의된 JSON Schema이다. 모든 필드명·`required`·`propertyOrdering`이 `GeneratedRecipe`(`src/types/recipe.ts`)와 **정확히 1:1 일치**한다.

핵심 구조 (요약):

```ts
// src/lib/ai/prompts/recipe-response-schema.ts (요약)
RECIPE_RESPONSE_SCHEMA: Schema = {
  type: OBJECT,
  properties: {
    dishName, description, servings, cookTimeMinutes, difficulty,
    ingredients: ARRAY of { name, quantity, unit },
    steps: ARRAY of { order, instruction },
    tips: ARRAY of STRING,
    nutrition: { calories, carbohydrates, protein, fat, fiber, healthNote },
  },
  required: [모든 9개 필드],
  propertyOrdering: [같은 순서],
}
```

> Gemini `responseSchema` 모드에서는 `response.text`가 스키마와 일치하는 JSON 문자열이 보장된다. 그러나 어댑터는 **여전히 zod로 한 번 더 검증**한다 (`parseGeneratedRecipe`) — 외부 입력은 경계에서 검증한다는 원칙(ai-recipe-integration). 검증 실패 시 `AIProviderError("provider_error", "...")`로 변환된다.

### 4.3.3 스트리밍 처리

```ts
// gemini-recipe-provider.ts 발췌 (요약)
const stream = await client.models.generateContentStream({
  model, contents: buildUserPrompt(params),
  config: { systemInstruction, responseMimeType, responseSchema, ... }
});

let accumulated = "";
for await (const chunk of stream) {
  const delta = chunk.text ?? "";
  if (delta) {
    accumulated += delta;
    handlers.onText?.(delta);   // Route가 SSE `text` 청크로 변환
  }
}
return this.parseFinal(accumulated);   // 누적된 JSON을 1회 파싱·검증
```

**중요**: `responseSchema` 모드에서 `chunk.text`는 **부분 JSON 문자열**(JSON.parse 불가)이 흐른다. 따라서:

- `onText` 콜백은 **raw 델타를 그대로 전달**하고, 미니앱은 이를 점진 표시에 쓰지 않거나 (08-STREAMING 권장) 가벼운 UX 힌트 정도로만 사용한다.
- **최종 파싱은 스트림 종료 후 1회만 수행**한다. 누적된 완전한 JSON 문자열이 있어야 zod가 검증할 수 있다.
- 미니앱 측 점진 렌더링은 `text` 청크가 아니라 **최종 `recipe` 청크 도착 후** 한 번에 화면을 채우는 방식을 선택할 수 있다 (08-STREAMING에서 frontend가 결정).

### 4.3.4 에러 매핑

```ts
// gemini-recipe-provider.ts toProviderError (요약)
if (err instanceof ApiError && err.status === 429) → rate_limited
if (err instanceof ApiError)                       → provider_error
default (AbortError, 알 수 없는 오류 포함)            → provider_error
```

타임아웃(`AbortController`) 발동 시에는 `AbortError`가 SDK에서 throw되며 `provider_error`로 수렴된다.

---

## 4.4 Claude 통합 (롤백 Provider, 비활성 보존)

출처: `src/lib/ai/claude-recipe-provider.ts`.

### 4.4.1 SDK·모델·옵션

| 항목 | 값 |
|------|----|
| SDK | `@anthropic-ai/sdk` (Anthropic 공식 SDK) |
| 기본 모델 | `claude-haiku-4-5-20251001` (오버라이드: `ANTHROPIC_MODEL`) |
| 출력 강제 | tool use: `emit_recipe` 도구의 `input_schema` (강제 선택: `tool_choice: { type: "tool", name: "emit_recipe" }`) |
| 시스템 지침 | `system: buildSystemBlocks()` — 텍스트 블록 배열, **`cache_control: { type: "ephemeral" }` 부여** |
| 최대 출력 토큰 | 2048 |
| 재시도 | SDK 내장 `maxRetries: 2` (429/5xx 지수 백오프) |
| 타임아웃 | 60초 (SDK 옵션 `timeout`) |
| API 키 환경변수 | `ANTHROPIC_API_KEY` (필수, `AI_PROVIDER=claude` 일 때) |
| 프롬프트 캐싱 | **사용** — 고정 시스템 지침에 `cache_control: ephemeral` (5분 TTL) → 반복 호출 비용 절감 |

### 4.4.2 구조화 출력 (tool use)

`emitRecipeTool` (`src/lib/ai/prompts/recipe-tool-schema.ts`)는 Anthropic `Messages.Tool` 형태의 도구 정의이며, `input_schema`가 JSON Schema로 `GeneratedRecipe`와 1:1 일치한다. `tool_choice: { type: "tool", name: "emit_recipe" }`로 Claude가 반드시 이 도구를 호출하도록 강제한다.

핵심 구조 (요약):

```ts
// src/lib/ai/prompts/recipe-tool-schema.ts (요약)
emitRecipeTool: Anthropic.Messages.Tool = {
  name: "emit_recipe",
  description: "생성된 레시피와 1인분 기준 영양 정보를 구조화된 형태로 반환한다.",
  input_schema: {
    type: "object",
    properties: { /* dishName, description, ..., nutrition */ },
    required: [모든 9개 필드],
  },
}
```

응답에서 어댑터는 `content` 블록 중 `type === "tool_use" && name === "emit_recipe"`인 블록을 찾아 `toolUse.input`을 zod 검증 (`parseGeneratedRecipe`).

### 4.4.3 스트리밍 처리

```ts
// claude-recipe-provider.ts 발췌 (요약)
const stream = this.client.messages.stream({
  model, max_tokens, system: buildSystemBlocks(),
  tools: [emitRecipeTool],
  tool_choice: { type: "tool", name: "emit_recipe" },
  messages: [{ role: "user", content: buildUserPrompt(params) }],
});

if (handlers.onText) {
  stream.on("text", (delta) => handlers.onText!(delta));
}
const message = await stream.finalMessage();
return this.extractRecipe(message.content);
```

**참고**: tool 강제 모드에서는 `stream.on("text", ...)` 콜백이 거의 비어있을 수 있다 (Claude가 자유 텍스트를 생성하지 않고 곧바로 도구 호출 블록을 만들기 때문). 미니앱 점진 렌더링 UX는 Gemini와 마찬가지로 최종 `recipe` 청크 도착 시점이 사실상 단일 갱신 시점이다.

### 4.4.4 에러 매핑

```ts
// claude-recipe-provider.ts toProviderError (요약)
if (err instanceof Anthropic.APIError && err.status === 429) → rate_limited
if (err instanceof Anthropic.APIError)                       → provider_error
default                                                       → provider_error
```

---

## 4.5 프롬프트 인벤토리

본 묶음 외부에서 미니앱 LLM이 알 필요는 없으나, 디버깅·검수 시 참조할 수 있도록 출처와 핵심 내용을 인용한다.

### 4.5.1 시스템 지침 (SSOT, 두 Provider 공유)

출처: `src/lib/ai/prompts/prompt-factory.ts` 의 `RECIPE_SYSTEM_INSTRUCTIONS` 상수.

```
당신은 전문 요리사이자 영양사입니다. 사용자가 입력한 요리 이름에 대해 정확하고 실용적인
레시피와 1인분 기준 영양 정보를 생성합니다.

규칙:
- 모든 텍스트는 한국어로 작성합니다.
- 재료는 한국 가정에서 구할 수 있는 것으로, 양과 단위를 명확히 합니다(예: g, ml, 큰술, 작은술, 개, 컵).
- 조리 순서는 1부터 시작하는 단계 번호로, 각 단계를 구체적으로 설명합니다.
- 난이도는 easy/medium/hard 중 하나로 정직하게 평가합니다.
- 영양 정보는 1인분 기준 추정치이며, 칼로리(kcal), 탄수화물·단백질·지방·식이섬유(g)를 숫자로 제시합니다.
- healthNote는 이 요리의 건강 측면을 1~2문장으로 간단히 설명합니다.
- tips는 맛/보관/대체 재료 등 실용 팁을 0개 이상 제공합니다(없으면 빈 배열).
- 입력이 요리가 아니거나 부적절하면, 가장 근접한 합리적 해석으로 일반적인 요리 레시피를 생성합니다.
- 반드시 emit_recipe 도구를 호출하여 구조화된 형태로만 응답합니다. 자유 텍스트로 레시피를 쓰지 마십시오.
```

> 동일 본문이 Claude/Gemini 모두에 적용된다 — 행동 일치 보장. Claude는 `buildSystemBlocks()`로 `cache_control: ephemeral` 부여, Gemini는 `buildSystemText()` 평문 전달.

### 4.5.2 사용자 변수부 (Provider 공통)

```ts
// src/lib/ai/prompts/prompt-factory.ts
buildUserPrompt({ dishName, servings }) =>
  `요리 이름: ${dishName}\n인분: ${servings}인분\n\n위 요리의 레시피와 ${servings}인분을 기준으로 한 1인분 영양 정보를 생성해 emit_recipe 도구로 반환하세요.`
```

- 변수부는 캐싱 대상 아님 (매 호출 다름).
- 시스템 지침에서 `emit_recipe` 도구를 명시 — Gemini 측에서는 도구가 아니라 `responseSchema`로 강제되지만, 본 문구가 둘 다에 동일하게 작용해 출력 양식 일치에 도움이 된다.

### 4.5.3 Provider별 구조화 출력 스키마 위치

| Provider | 출력 강제 메커니즘 | 스키마 파일 |
|----------|-------------------|-------------|
| Gemini | `responseSchema` (JSON Schema 기반) | `src/lib/ai/prompts/recipe-response-schema.ts` |
| Claude | tool use `input_schema` | `src/lib/ai/prompts/recipe-tool-schema.ts` |
| 공통 검증 (모든 Provider) | zod | `src/lib/ai/recipe-schema.ts` |
| 도메인 타입 SSOT | TypeScript | `src/types/recipe.ts` |

**4자 정합 (ADR-008 핵심 불변식)**: 위 네 파일의 필드명·required·형태는 모두 동일해야 한다. 어긋나면 AI→DTO→UI 경계면 버그가 된다 (계약 6절 불변식 6, QA 검증 기준).

> 기술 부채 (ADR-008에서 등록): 스키마 일관성 자동 검증 테스트 도입 — SESSION_NOTES 세션 #3 참조. 미니앱 측에는 영향 없음.

---

## 4.6 zod 검증 (두 Provider 출력 수렴)

출처: `src/lib/ai/recipe-schema.ts` 인용.

```ts
import { z } from "zod";

const ingredientSchema = z.object({ name: z.string(), quantity: z.number(), unit: z.string() });
const stepSchema       = z.object({ order: z.number(), instruction: z.string() });
const nutritionSchema  = z.object({
  calories: z.number(), carbohydrates: z.number(), protein: z.number(),
  fat: z.number(), fiber: z.number(), healthNote: z.string(),
});

export const generatedRecipeSchema = z.object({
  dishName: z.string(),
  description: z.string(),
  servings: z.number(),
  cookTimeMinutes: z.number(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  ingredients: z.array(ingredientSchema).min(1),
  steps: z.array(stepSchema).min(1),
  tips: z.array(z.string()),
  nutrition: nutritionSchema,
});

export function parseGeneratedRecipe(input: unknown): GeneratedRecipe {
  return generatedRecipeSchema.parse(input);
}
```

**역할**:

- Gemini: 누적된 JSON 문자열을 `JSON.parse → parseGeneratedRecipe`.
- Claude: `toolUse.input`(SDK가 이미 JSON.parse 한 객체)을 `parseGeneratedRecipe`.
- 두 경로 모두 같은 `GeneratedRecipe` 타입을 반환 → Service는 무엇이 응답했는지 모름.
- 검증 실패 시 어댑터가 `AIProviderError("provider_error", "AI 응답이 레시피 스키마와 일치하지 않습니다.")` throw → Route가 HTTP 502 `AI_PROVIDER_ERROR` 변환.

또한 동일한 zod 스키마가 **저장 엔드포인트(`POST /api/recipes`)의 요청 본문 검증**에도 재사용된다 (`src/lib/validation.ts` `saveRecipeRequestSchema`). 즉:

```
AI 응답 검증 (생성 어댑터)  ┐
                            ├─► generatedRecipeSchema (단일 SSOT)
저장 요청 검증 (POST /recipes) ┘
```

`GeneratedRecipe` 스키마가 한 곳에서 유지되어 AI 출력과 사용자 저장 입력이 동일 형태로 강제된다.

---

## 4.7 환경변수 매트릭스 (ADR-008 인용)

| 변수 | 용도 | 기본값 | 필수 조건 |
|------|------|--------|-----------|
| `AI_PROVIDER` | Provider 선택 (`"gemini"` \| `"claude"`) | `gemini` | 선택 (미설정 시 gemini) |
| `GEMINI_API_KEY` | Gemini 호출 키 | (없음) | `AI_PROVIDER=gemini` 일 때 필수 |
| `GEMINI_MODEL` | Gemini 모델 오버라이드 | `gemini-3.1-flash-lite` | 선택 |
| `ANTHROPIC_API_KEY` | Claude 호출 키 | (없음) | `AI_PROVIDER=claude` 일 때 필수 |
| `ANTHROPIC_MODEL` | Claude 모델 오버라이드 | `claude-haiku-4-5-20251001` | 선택 |

> 위 변수는 **모두 백엔드(Vercel) 환경**에 설정된다. 미니앱(클라이언트)에는 절대 설정하지 않는다.

**롤백 절차** (ADR-008): `AI_PROVIDER=claude` 설정 + `ANTHROPIC_API_KEY` 존재 확인 → Vercel 재배포. 코드 PR 없이 운영자가 단독 처리 가능.

---

## 4.8 미니앱과 백엔드의 경계 — 키 격리

```
┌──────────────────────────────────┐    ┌────────────────────────────────────────┐
│ 미니앱 (RN + Granite)            │    │ 백엔드 (Vercel Next.js API)            │
│                                  │    │                                        │
│  - getAnonymousKey() hash 보관   │    │  GEMINI_API_KEY / ANTHROPIC_API_KEY    │
│  - X-Toss-User-Id 헤더만 전송    │    │  SUPABASE_SERVICE_ROLE_KEY (옵션 P)    │
│  - AI SDK 미설치, 키 미보유      │    │  AI Provider 직접 호출                 │
└────────────┬─────────────────────┘    └──────────────▲─────────────────────────┘
             │                                          │
             │ HTTPS (POST /api/recipes/generate ...)   │
             └──────────────────────────────────────────┘
                          외부 도메인 호출
                          - CORS 화이트리스트
                          - X-Toss-User-Id 인증 헤더
```

**불변식**:

- 미니앱은 `@anthropic-ai/sdk` 또는 `@google/genai`를 의존성으로 추가하지 않는다.
- 미니앱 빌드 산출물·환경변수·소스 코드에 `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`가 절대 포함되지 않는다.
- 키 누출 시 영향 범위는 백엔드 운영 환경에 한정된다 — 미니앱 사용자 디바이스에는 키가 없다.
- 미니앱은 백엔드 SSE 응답(`event: meta/text/recipe/error/done`)만 소비한다 — Provider 식별 정보는 응답에 포함되지 않는다 (미니앱 분기 불가능 = 의도된 격리).

---

## 4.9 미니앱이 이 챕터에서 가져갈 것 (요약 한 화면)

| 항목 | 결론 |
|------|------|
| 미니앱이 AI SDK를 깔아야 하나? | **아니오.** 백엔드만 호출. |
| 미니앱이 Provider를 알아야 하나? | **아니오.** 응답 shape이 동일. |
| 미니앱이 API 키를 다뤄야 하나? | **아니오.** 키는 백엔드 전용. |
| Gemini와 Claude 응답이 다르게 보일 수 있나? | **양식은 동일** (`GeneratedRecipe`). 단, 스트리밍 중 `text` 청크의 빈도·내용은 다를 수 있다 — UI는 이를 의존하지 않는다. |
| 어떤 모델이 응답했는지 헤더로 알 수 있나? | **현재 노출하지 않음.** 필요해지면 별 ADR로 응답 헤더(`X-AI-Provider`) 도입 결정. |
| AI 에러가 미니앱에 어떻게 전달되나? | 비스트리밍: HTTP 429 (`AI_RATE_LIMITED`) / 502 (`AI_PROVIDER_ERROR`). 스트리밍: HTTP 200 + `error` 청크 (3.2.6). |
| 응답 시간은? | Provider 응답 + 백엔드 처리 시간. 어댑터 타임아웃 60초. 미니앱 측은 별도 타임아웃 안전망 권장 (08-STREAMING). |

---

## 4.10 SSOT 참조

| 영역 | 경로 |
|------|------|
| Adapter 인터페이스 | `src/lib/ai/ai-recipe-provider.ts` |
| Factory | `src/lib/ai/ai-recipe-provider.factory.ts` |
| Gemini 구현 | `src/lib/ai/gemini-recipe-provider.ts` |
| Claude 구현 | `src/lib/ai/claude-recipe-provider.ts` |
| 프롬프트 Factory | `src/lib/ai/prompts/prompt-factory.ts` |
| Gemini responseSchema | `src/lib/ai/prompts/recipe-response-schema.ts` |
| Claude tool schema | `src/lib/ai/prompts/recipe-tool-schema.ts` |
| zod 검증 | `src/lib/ai/recipe-schema.ts` |
| 도메인 타입 SSOT | `src/types/recipe.ts` |
| ADR | [ADR-002](../adr/ADR-002-ai-adapter.md), [ADR-008](../adr/ADR-008-gemini-default-with-claude-fallback.md) |
| AGENTS.md | `src/lib/ai/AGENTS.md` |
| 환경변수 | [09-ENV-CONFIG.md](./09-ENV-CONFIG.md) (architect 작성 예정) |

---

## 4.11 변경 이력

| 날짜 | 변경 | 사유 |
|------|------|------|
| 2026-05-22 | 초기 작성 (세션 #4 Task #2) | 미니앱 LLM에게 백엔드 AI 통합 배경 제공 — Adapter/Factory·Provider 매트릭스·키 격리 |
| 2026-05-22 | §4.2.1 `servings` 기본값 책임 노트 추가 | qa sweep 보완 3 — Request(선택) ↔ GenerateParams(필수) 차이의 Service 책임 명시 |
