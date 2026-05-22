# 0002. Claude AI를 Adapter로 격리하고 생성+영양분석을 Facade로 조합

- 상태: 채택됨
- 날짜: 2026-05-21

## 맥락

F1(레시피 생성)·F2(영양 분석)는 Claude API(claude-sonnet-4-6)로 구현한다. Anthropic SDK를 Route Handler나 컴포넌트에서 직접 호출하면: (1) Service가 특정 SDK에 결합되어 DIP 위반, (2) 테스트에서 실 API 호출 필요(비결정적·비용), (3) 프롬프트·파싱 로직이 흩어진다. 또한 "레시피 생성"은 실제로는 AI 생성 + 영양 분석이라는 복합 유스케이스다.

## 결정

1. **Adapter 패턴**: `AIRecipeProvider` 인터페이스를 정의하고 `ClaudeRecipeProvider`가 Anthropic SDK를 격리한다. Service는 SDK를 모른다.
2. **Facade 패턴**: `RecipeGenerationService.generate()`가 AI 생성 + 영양 분석을 단일 진입점으로 묶는다. Route Handler는 이 Facade만 호출.
3. **Factory 패턴**: `prompt-factory.ts`가 시스템 프롬프트 고정부(캐싱 대상)와 사용자 변수부를 분리해 생성한다.
4. **구조화 출력**: Claude tool use(`emit_recipe`)로 JSON을 강제하며, `input_schema` 필드명은 `GeneratedRecipe`(src/types/recipe.ts)와 **일치**시킨다.
5. **Strategy 보류(YAGNI)**: 영양 계산 경로가 Sprint 1엔 LLM 추정 하나뿐이므로 Strategy 추상화를 도입하지 않고 확장 지점만 주석으로 표시한다.

## 근거

- **Adapter (DIP/LSP)**: SDK 격리로 목 주입 테스트가 가능하고, 모델/제공자 교체가 Service에 영향 없다. 어댑터 구현체는 동일 인터페이스 계약을 위반 없이 만족(LSP).
- **Facade (SRP)**: 생성·영양 분석 조합 로직이 Route에 새지 않게 한다. Route는 HTTP I/O만.
- **Factory + 캐싱**: 고정 시스템 프롬프트에 `cache_control: ephemeral`을 붙여 반복 호출 비용을 절감한다. 고정/변수 경계를 Factory가 명확히 한다.
- **tool use 스키마 일치**: AI→DTO→UI 경계면 버그의 핵심 원인이 필드명 불일치다. tool input_schema = 공유 타입으로 강제하면 QA가 이 경계를 단일 기준으로 검증한다.
- **Strategy 보류**: 구현체 하나뿐인 인터페이스는 오버엔지니어링(software-design-principles 스킬). 두 번째 경로(재료 DB 계산) 등장 시 추상화.

## 대안

- **SDK 직접 호출**: 결합도·테스트 어려움·프롬프트 분산. 기각.
- **자유 텍스트 파싱**: 정규식/휴리스틱 파싱은 깨지기 쉽다. tool use가 안정적. 기각.
- **Strategy 선도입**: 가상의 미래 요구를 위한 추상화. YAGNI 위반. 보류.

## 결과

- 트레이드오프: 인터페이스+어댑터+Facade로 계층이 늘어난다. 그러나 AI는 변동성·비용·테스트 난이도가 높은 외부 의존이라 격리 이득이 크다.
- 스트리밍: Provider가 청크 콜백을 노출하고 Route가 SSE(`StreamChunk`)로 변환한다. 스트리밍 에러는 HTTP 200 + `error` 청크로 전달(계약 1.3).
- 재시도(429/5xx 지수 백오프)·타임아웃은 어댑터 계층 책임. API 키는 서버 환경변수 전용.
- 관련: `ai-recipe-integration` 스킬, 계약서 1절.

## 개정 (2026-05-22)

기본 모델을 `claude-sonnet-4-6` → `claude-haiku-4-5-20251001`로 변경 (비용 ~70% 절감). 사유: F1·F2는 tool use로 출력 스키마가 강제되므로 모델 가중치 차이가 텍스트 자유도보다 양식 안정성에 끼치는 영향이 작다. Haiku도 Anthropic family라 tool use·prompt caching 호환성 동일. 품질이 부족하면 `ANTHROPIC_MODEL`로 sonnet/opus로 즉시 오버라이드 가능(Adapter 격리 덕분).
