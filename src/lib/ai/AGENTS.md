# src/lib/ai/ — AI 어댑터 (Claude 통합)

Claude API를 도메인 인터페이스 뒤로 격리하는 계층 (Adapter 패턴, ADR-002).

## 책임
레시피 생성 + 영양 분석을 Claude tool use로 수행하고, 결과를 검증된 `GeneratedRecipe`로 반환한다. Service는 이 계층의 추상(`AIRecipeProvider`)에만 의존하며 Anthropic SDK를 모른다(DIP).

## 핵심 규약
- **SDK 격리**: Anthropic SDK import는 `claude-recipe-provider.ts`에만. 다른 계층은 `AIRecipeProvider` 인터페이스만 사용.
- **tool use input_schema = `GeneratedRecipe` 필드명** (`prompts/recipe-tool-schema.ts`). 어긋나면 AI→UI 경계면 버그(계약 6절 불변식 6).
- **AI 응답은 경계 검증**: tool 입력을 `recipe-schema.ts`(zod)로 파싱. 형태 불일치는 `AIProviderError(provider_error)`.
- **프롬프트 캐싱**: 시스템 고정부에 `cache_control: ephemeral`(`prompts/prompt-factory.ts`).
- **재시도/타임아웃은 이 계층**: SDK `maxRetries`(429/5xx 지수 백오프) + `timeout`. 에러는 `AIProviderError(rate_limited|provider_error)`로 분류 → Service가 ApiErrorCode로 매핑.

## 진입점/주요 파일
| 파일 | 역할 |
|------|------|
| `ai-recipe-provider.ts` | `AIRecipeProvider` 인터페이스 + `AIProviderError` |
| `claude-recipe-provider.ts` | Anthropic SDK 구현체 (생성/스트리밍) |
| `recipe-schema.ts` | AI 출력 zod 검증 (= `GeneratedRecipe`) |
| `prompts/prompt-factory.ts` | 시스템 고정부(캐싱)/사용자 변수부 분리 (Factory) |
| `prompts/recipe-tool-schema.ts` | `emit_recipe` tool 스키마 |

## 주의
- 모델 기본값 `claude-sonnet-4-6` (`ANTHROPIC_MODEL` 환경변수로 오버라이드 가능).
- API 키는 서버 환경변수(`ANTHROPIC_API_KEY`) 전용 — 클라이언트 노출 금지.
- 확장 지점(YAGNI): 영양 계산 경로가 둘 이상이면 Strategy 도입(ADR-002). 현재는 LLM 추정 단일 경로.
