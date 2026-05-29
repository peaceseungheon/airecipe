# 0008. AI Provider 기본값을 Gemini로 전환하고 Claude를 비활성 보존

- 상태: 채택됨
- 날짜: 2026-05-22

## 맥락

세션 #2에서 Claude 모델을 `claude-sonnet-4-6` → `claude-haiku-4-5-20251001`로 내려 비용을 ~70% 절감했다(ADR-002 개정 노트). 본 세션에서 사용자는 한 단계 더 나아가 **AI Provider 기본값 자체를 Gemini로 전환**할 것을 결정했다. 동시에 운영 안전망으로 Claude를 즉시 되돌릴 수 있어야 한다.

검토한 제약:

- 단일 Provider 강 결합은 회피해야 한다. 한 Provider의 장애·요금 변경·정책 변경이 서비스에 직접 영향을 주면 안 된다.
- 빠른 롤백 경로가 필요하다. 새 Provider에서 응답 품질·지연·구조화 출력 실패율이 기대 이하일 때, 코드 수정 없이 운영 환경에서 즉시 되돌릴 수 있어야 한다.
- ADR-002의 Adapter 격리(`AIRecipeProvider` 인터페이스) 덕분에 Service·Route·UI 코드는 SDK를 모른다. 따라서 인터페이스를 불변으로 유지하면서 구현체만 교체·추가하는 것이 가능하다.

## 결정

1. **기본 Provider를 Gemini로 변경**한다. 모델은 사용자 지정값인 `gemini-3.1-flash-lite`, SDK는 `@google/genai`(Google GenAI SDK).
2. **Claude 구현은 삭제하지 않고 비활성 보존**한다. `claude-recipe-provider.ts`·`@anthropic-ai/sdk`·`ANTHROPIC_API_KEY`·`ANTHROPIC_MODEL`은 그대로 유지한다.
3. **Factory 패턴을 도입**한다. `src/lib/ai/ai-recipe-provider.factory.ts`가 `AI_PROVIDER` 환경변수를 읽어 `GeminiRecipeProvider` 또는 `ClaudeRecipeProvider` 인스턴스를 생성한다.
   - `AI_PROVIDER` 값: `"gemini"` | `"claude"`. **기본값 `"gemini"`**.
   - Service Composition Root는 Factory의 결과를 주입받는다. Service 코드는 무엇이 주입됐는지 모른다(DIP 유지).
4. **인터페이스 불변**: `AIRecipeProvider`(`src/lib/ai/ai-recipe-provider.ts`)의 시그니처는 변경하지 않는다. 두 구현체는 동일 계약을 만족(LSP)한다.
5. **구조화 출력 방식 차이를 인정하되 도메인 타입은 통합**한다.
   - Claude: tool use(`input_schema` on `emit_recipe`) → `prompts/recipe-tool-schema.ts`.
   - Gemini: `responseSchema`(JSON Schema 기반 구조화 출력) → `prompts/recipe-response-schema.ts`.
   - 두 스키마는 **모두 동일한 `GeneratedRecipe`**(`src/types/recipe.ts`)와 1:1 정합되도록 SSOT를 유지한다. zod 검증(`recipe-schema.ts`)도 단일이다.

## 근거

- **Adapter + Factory 조합**(DIP/OCP): Adapter는 SDK를 격리하고, Factory는 어떤 Adapter를 쓸지를 단일 지점에서 결정한다. Provider가 늘어도 Factory 한 분기만 늘어난다. Service는 영향 없다.
- **환경변수 토글 = 운영 안전망**: 응답 품질·지연·요금 이슈가 발생하면 `AI_PROVIDER=claude`로 재배포만 하면 즉시 원복된다. 코드 PR·리뷰·머지 사이클 없이 운영자가 처리 가능하다.
- **두 SDK 공존의 비용은 한시적**: 번들 표면이 늘고 보안 감사 대상이 둘이 된다. 그러나 이는 6개월 내 Gemini가 충분히 검증되면 ADR로 제거 결정을 따로 내려 해소한다(아래 결과 참조).
- **구조화 출력 일치 강제**: 두 Provider의 출력이 모두 `GeneratedRecipe`로 수렴해야 Service·UI는 어떤 Provider가 응답했는지 모를 수 있다. 두 스키마(tool input_schema / responseSchema)와 zod·도메인 타입의 3자 정합이 본 결정의 핵심 불변식.

## 대안

- **A. 완전 교체(Claude 코드 삭제)**: 단순하지만 롤백 비용이 크다. 새 Provider의 품질·안정성을 운영에서 검증하기 전까지 위험을 감수해야 한다. 기각.
- **B. 런타임 선택만(기본값 없이 항상 환경변수 필수)**: 환경변수 누락 시 명시적 실패는 안전하지만, 운영 기본값이 모호해진다. "기본은 Gemini, 롤백은 Claude"라는 의도가 코드에서 사라진다. 기각.
- **C. 새 인터페이스로 추상화 갱신**: 두 Provider의 차이(tool use vs responseSchema)를 노출하는 더 풍부한 인터페이스로 바꾸는 안. 그러나 현재 두 구현 모두 `GeneratedRecipe` 단일 출력으로 수렴하므로 기존 인터페이스로 충분하다. YAGNI 위반. 기각.

## 결과

- (+) `AI_PROVIDER` 환경변수 한 줄로 즉시 롤백 가능 (운영 안전망 확보).
- (+) Service·Route·UI 코드는 변경되지 않는다. ADR-002의 격리가 이번에 그 가치를 실증한다.
- (+) 향후 Provider 추가(예: OpenAI, Bedrock) 시 새 Adapter + Factory 한 분기로 끝난다(OCP).
- (−) `@anthropic-ai/sdk`와 `@google/genai`가 deps에 공존한다. 번들 크기·보안 감사 표면이 늘어난다. → **6개월 후(2026-11) Gemini 운영 안정성 평가 후 Claude 비활성 코드 제거 검토**(별도 ADR로 결정).
- (−) 두 구조화 출력 스키마(`recipe-response-schema.ts` ↔ `recipe-tool-schema.ts`)와 zod 검증(`recipe-schema.ts`)·도메인 타입(`src/types/recipe.ts`)의 4자 동기화를 사람이 수동 유지해야 한다. → **기술 부채로 등록: 스키마 일관성 자동 검증 테스트 도입**(SESSION_NOTES 세션 #3 참조).
- 스트리밍: 두 Provider 모두 텍스트 델타를 청크 콜백으로 노출하지만, Gemini는 부분 JSON이 흐를 수 있어 UI 점진 렌더링 체감이 다를 수 있다(런타임 검증 항목).
- 캐싱: Claude는 prompt cache(`cache_control: ephemeral`), Gemini는 `cachedContents` 별도 API. 현재는 Gemini 캐싱 미사용(YAGNI). 호출량이 늘어 비용이 의미 있게 보이면 별도 ADR로 도입.

## 환경변수

| 변수 | 용도 | 기본값 |
|------|------|--------|
| `AI_PROVIDER` | Provider 선택 (`"gemini"` \| `"claude"`) | `gemini` |
| `GEMINI_API_KEY` | Gemini 호출 키 | (필수, `AI_PROVIDER=gemini`일 때) |
| `GEMINI_MODEL` | Gemini 모델 오버라이드 | `gemini-3.1-flash-lite` |
| `ANTHROPIC_API_KEY` | Claude 호출 키 | (필수, `AI_PROVIDER=claude`일 때) |
| `ANTHROPIC_MODEL` | Claude 모델 오버라이드 | `claude-haiku-4-5-20251001` |

롤백 절차: `AI_PROVIDER=claude` 설정 후 `ANTHROPIC_API_KEY` 존재 확인 → 재배포.

## 참고

- ADR-002 (Claude AI Adapter + Facade + Factory) — 본 ADR이 그 격리의 연장선.
- `src/lib/ai/AGENTS.md` — Provider-agnostic 갱신본.
- `_workspace/01_architect_api_contract.md` — `GeneratedRecipe` SSOT.

## 후속 ADR

- [ADR-009](ADR-009-appsintoss-port-architecture.md) — 앱인토스 미니앱은 백엔드를 호출만 하므로 Provider 선택을 인지하지 않는다. 본 ADR의 Factory·환경변수 토글은 그대로 살아남는다.
