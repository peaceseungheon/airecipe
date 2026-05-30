# src/lib/ai/ — AI 통합 (Gemini 기본, Claude 비활성 보존)

AI Provider를 도메인 인터페이스 뒤로 격리하는 계층 (Adapter + Factory 패턴, ADR-002 + ADR-008).

## 책임
레시피 생성 + 영양 분석을 AI Provider로 수행하고, 결과를 검증된 `GeneratedRecipe`로 반환한다. Service는 이 계층의 추상(`AIRecipeProvider`)에만 의존하며 어떤 SDK가 쓰이는지 모른다(DIP). 현재 두 구현체가 공존하며 `AI_PROVIDER` 환경변수로 선택된다 — 기본 Gemini, 롤백용 Claude.

## 핵심 규약
- **SDK 격리**: `@google/genai`·`@anthropic-ai/sdk` import는 각각 `gemini-recipe-provider.ts`·`claude-recipe-provider.ts`에만. 다른 계층은 `AIRecipeProvider` 인터페이스만 사용.
- **Factory가 단일 선택 지점**: Provider 선택 분기는 `ai-recipe-provider.factory.ts`에만 존재. Composition Root(`composition.ts`)는 Factory의 결과를 주입받는다. Service·Route·UI에 Provider 분기를 흘리지 말 것.
- **두 구조화 출력 스키마는 동일한 도메인 타입으로 수렴**:
  - Claude tool use `input_schema` (`prompts/recipe-tool-schema.ts`)
  - Gemini `responseSchema` (`prompts/recipe-response-schema.ts`)
  - 두 스키마 모두 `GeneratedRecipe`(`src/types/recipe.ts`) 필드명과 일치해야 한다. 어긋나면 AI→UI 경계면 버그(계약 6절 불변식 6).
- **AI 응답은 경계 검증**: Provider 출력을 `recipe-schema.ts`(zod)로 파싱. 형태 불일치는 `AIProviderError(provider_error)`. zod는 Provider-agnostic, 단일 검증점.
- **프롬프트 캐싱**: 시스템 고정부에 Claude는 `cache_control: ephemeral` 적용(`prompts/prompt-factory.ts`). Gemini는 별도 `cachedContents` API가 있으나 현재 미사용(YAGNI; ADR-008 결과 참조).
- **재시도/타임아웃은 이 계층**: 각 SDK의 retry/timeout 옵션 사용. 일시적 오류(429/5xx)는 지수 백오프. 에러는 `AIProviderError(rate_limited|provider_error)`로 분류 → Service가 ApiErrorCode로 매핑.

## 진입점/주요 파일
| 파일 | 역할 |
|------|------|
| `ai-recipe-provider.ts` | `AIRecipeProvider` 인터페이스 + `AIProviderError` (불변 계약) |
| `ai-recipe-provider.factory.ts` | `AI_PROVIDER` 환경변수로 구현체 선택 (Factory, ADR-008) |
| `gemini-recipe-provider.ts` | Google GenAI SDK 구현체 (`@google/genai`, 기본) |
| `claude-recipe-provider.ts` | Anthropic SDK 구현체 (`@anthropic-ai/sdk`, 비활성 보존·롤백용) |
| `recipe-schema.ts` | AI 출력 zod 검증 (= `GeneratedRecipe`, Provider-agnostic) |
| `prompts/prompt-factory.ts` | 시스템 고정부(캐싱)/사용자 변수부 분리 |
| `prompts/recipe-response-schema.ts` | Gemini `responseSchema` (JSON Schema) |
| `prompts/recipe-tool-schema.ts` | Claude `emit_recipe` tool 스키마 |
| `ai-recommendation-provider.ts` | `AIRecommendationProvider` 인터페이스 + `RecommendInput` (ISP, ADR-011) |
| `ai-recommendation-provider.factory.ts` | `AI_PROVIDER` 환경변수로 추천 구현체 선택 (Factory, ADR-011/008) |
| `gemini-recommendation-provider.ts` | Google GenAI 추천 어댑터 (`@google/genai`, 기본) |
| `claude-recommendation-provider.ts` | Anthropic 추천 어댑터 (`@anthropic-ai/sdk`, 롤백) |
| `recommendation-schema.ts` | 추천 도메인 zod(enum·item·응답, 미니앱 1:1 미러) + `parseRecommendationItems`(`.length(5)`) |
| `prompts/recommendation-prompt-factory.ts` | 추천 시스템 지침 SSOT + 라벨 매핑 + 사용자 프롬프트 |
| `prompts/recommendation-response-schema.ts` | Gemini 추천 `responseSchema` |
| `prompts/recommendation-tool-schema.ts` | Claude 추천 tool 스키마 (`emit_recommendations`) |

## 환경변수 매트릭스
| 변수 | 용도 | 기본값 |
|------|------|--------|
| `AI_PROVIDER` | Provider 선택 (`"gemini"` \| `"claude"`) | `gemini` |
| `GEMINI_API_KEY` | Gemini 호출 키 | (필수, `AI_PROVIDER=gemini`일 때) |
| `GEMINI_MODEL` | Gemini 모델 오버라이드 | `gemini-3.1-flash-lite` |
| `ANTHROPIC_API_KEY` | Claude 호출 키 | (필수, `AI_PROVIDER=claude`일 때) |
| `ANTHROPIC_MODEL` | Claude 모델 오버라이드 | `claude-haiku-4-5-20251001` |

모든 키는 **서버 환경변수 전용** — `NEXT_PUBLIC_` 접두사 금지, 클라이언트 번들에 노출하지 말 것.

## 롤백 절차
한 줄: `AI_PROVIDER=claude` 설정 + `ANTHROPIC_API_KEY` 존재 확인 후 재배포. 코드 변경 없음.

## 캐싱 차이 노트
- **Claude**: `cache_control: ephemeral`을 시스템 프롬프트 고정부에 부착. 5분 TTL 자동 캐싱 (적용 중).
- **Gemini**: `cachedContents` 별도 API 사용 필요. 호출량이 적은 현 단계에서는 도입 비용 > 절감액. 호출량이 의미 있게 증가하면 별도 ADR로 도입 결정(YAGNI 유보).

## 주의
- Provider 추가 시 새 Adapter를 만들고 Factory에 한 분기 추가 — Service·Route·UI는 변경 금지(OCP).
- 두 스키마 파일(`recipe-response-schema.ts` ↔ `recipe-tool-schema.ts`)과 zod·도메인 타입의 정합은 사람이 수동 유지 중. 어긋나면 한 Provider만 깨진다. 자동 검증 테스트 도입은 기술 부채(SESSION_NOTES 세션 #3).
- 확장 지점(YAGNI): 영양 계산 경로가 둘 이상이면 Strategy 도입(ADR-002). 현재는 LLM 추정 단일 경로.
