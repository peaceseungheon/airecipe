# 0012. AI Provider에 Kimi(Moonshot AI) 추가 및 기본 Provider 전환

- 상태: 채택됨
- 날짜: 2026-05-30

## 맥락

사용자가 AI 레시피 생성·추천의 기본 Provider를 **Kimi(Moonshot AI)** 로 전환할 것을 요청했다.

검토한 제약·기회:

- ADR-008에서 도입한 **Factory + Adapter** 격리(`AIRecipeProvider`·`AIRecommendationProvider` 인터페이스, `AI_PROVIDER` 환경변수 스위치)는 Provider 추가를 "새 Adapter + Factory 한 분기"로 끝낼 수 있도록 설계됐다. 본 결정은 그 OCP 확장점을 실제로 행사한다.
- Kimi(Moonshot AI)는 **OpenAI 호환 API**를 제공한다. `openai` npm SDK의 `baseURL`을 `https://api.moonshot.ai/v1`로 지정하면 기존 OpenAI 호출 코드 형태를 그대로 사용할 수 있어, 새 Adapter 구현 부담이 작다.
- 기존 Gemini(기본)·Claude(롤백 보존) 두 경로의 **운영 안전망은 유지**돼야 한다. 새 Provider의 응답 품질·지연·구조화 출력 실패율이 기대 이하일 때 코드 수정 없이 즉시 되돌릴 수 있어야 한다.
- **응답 계약 불변**이 전제다. `GeneratedRecipe`(`src/types/recipe.ts`)·`RecommendationItem[]`(추천)은 변경하지 않는다. 따라서 미니앱·웹 프론트·API 계약 소비자는 무영향이다.

## 결정

1. **Kimi(Moonshot AI) 어댑터를 신규 추가**한다. 레시피 생성·추천 두 경로 각각에 `AIRecipeProvider`·`AIRecommendationProvider` 인터페이스를 만족하는 Kimi 구현체를 둔다. 구조화 출력은 OpenAI 호환 레이어의 **`response_format: { type: "json_object" }`** 방식으로 강제하고, 결과는 기존과 동일하게 zod 검증(`recipe-schema.ts`·`recommendation-schema.ts`)을 통과시킨다.
2. **`openai` npm SDK + `baseURL` 방식**으로 Moonshot 엔드포인트를 호출한다. SDK 구성: `baseURL = https://api.moonshot.ai/v1`(env 오버라이드), 모델 `kimi-k2`(env 오버라이드).
3. **기본 Provider를 `kimi`로 전환**한다. `AI_PROVIDER` 미설정 시 기본값을 `"kimi"`로 한다. 두 Factory(`ai-recipe-provider.factory.ts`·`ai-recommendation-provider.factory.ts`)의 `AIProviderKind`에 `"kimi"`를 추가하고 `DEFAULT_PROVIDER`를 `"kimi"`로 바꾼다.
4. **Gemini·Claude 구현은 삭제하지 않고 롤백용으로 보존**한다. `AI_PROVIDER=gemini` 또는 `AI_PROVIDER=claude`로 즉시 되돌릴 수 있다. ADR-008의 환경변수 토글 = 운영 안전망 원칙을 그대로 유지·확장한다.
5. **인터페이스 불변**: `AIRecipeProvider`·`AIRecommendationProvider`의 시그니처는 변경하지 않는다. Kimi 구현체는 동일 계약을 위반 없이 만족한다(LSP). Service·Route·UI 코드는 무엇이 주입됐는지 모른다(DIP 유지).
6. **환경변수 오버라이드**: 모델·base URL·키를 `KIMI_MODEL`·`KIMI_BASE_URL`·`KIMI_API_KEY`로 오버라이드 가능하게 한다(중국 엔드포인트 등 base URL 교체 여지 확보).

## 근거

- **Factory OCP 확장점의 실행**: ADR-008이 설계해 둔 "새 Adapter + Factory 한 분기" 경로를 그대로 따른다. Service·Route·UI는 변경되지 않으며, 변경 표면은 두 Factory의 분기 한 줄과 신규 어댑터 파일에 국한된다.
- **OpenAI 호환 = SDK 일관성·견고성**: Moonshot이 OpenAI 호환 API를 제공하므로 검증된 `openai` SDK(재시도·타임아웃·스트리밍·타입)를 재사용한다. plain fetch 직접 구현 대비 견고성과 일관성이 높다.
- **응답 계약 수렴 강제**: Kimi의 구조화 출력도 반드시 `GeneratedRecipe`·`RecommendationItem[]`로 수렴해야 Service·UI는 어떤 Provider가 응답했는지 모를 수 있다. OpenAI 호환의 `json_object` 출력 → zod 검증의 2단 정합이 본 결정의 핵심 불변식이다(특히 추천은 서버 zod `.length(5)`가 5개 강제의 최종 보증 — ADR-011).
- **환경변수 토글 유지 = 운영 안전망 확장**: 새 Provider 검증 전까지 Gemini/Claude를 보존해 `AI_PROVIDER` 한 줄로 즉시 롤백 가능. 코드 PR·리뷰·머지 사이클 없이 운영자가 처리한다.

## 대안

- **A. 기존 어댑터 제거(Gemini/Claude 삭제)**: 단순하지만 롤백 안전성을 상실한다. Kimi의 품질·안정성을 운영에서 검증하기 전까지 위험을 감수해야 한다. 기각.
- **B. plain fetch로 Moonshot REST 직접 구현**: 의존성 1개를 아끼지만 재시도·타임아웃·스트리밍·타입을 직접 재구현해야 하고, 다른 어댑터와의 일관성이 깨진다. SDK 사용 대비 견고성 손해가 크다. 기각.
- **C. OpenAI 호환이 아닌 중국 엔드포인트(api.moonshot.cn) 기본화**: 글로벌 기본은 `api.moonshot.ai`로 둔다. 중국 엔드포인트는 `KIMI_BASE_URL` 오버라이드로 열어두되 기본값으로 채택하지 않는다. 보류.
- **D. 구조화 출력에 tool/function calling 사용**: OpenAI 호환 function calling도 가능하나, 본 유스케이스는 단일 JSON 객체 산출이므로 `json_object`로 충분하다(YAGNI). 추후 필요 시 어댑터 내부에서 전환 가능(인터페이스 불변).

## 결과

- (+) `AI_PROVIDER` 환경변수 한 줄로 Gemini/Claude로 즉시 롤백 가능(운영 안전망 유지·확장).
- (+) Service·Route·UI·미니앱·웹 프론트 코드는 변경되지 않는다. **응답 계약 불변이라 소비자 전원 무영향**.
- (+) 향후 Provider 추가도 동일 패턴(새 Adapter + Factory 한 분기)으로 끝난다(OCP 재확인).
- (−) 새 의존성 `openai` 1개가 deps에 추가된다. 번들 표면·보안 감사 대상이 늘어난다(기존 `@google/genai`·`@anthropic-ai/sdk`와 공존). → ADR-008의 "Gemini 안정성 평가 후 비활성 코드 제거 검토" 항목과 함께, Kimi 안정화 후 보존 Provider 정리를 별도 ADR로 결정.
- (−) **OpenAI 호환 레이어의 구조화 출력은 `json_object` 방식**으로, Gemini `responseSchema`·Claude tool use와 달리 스키마 필드/길이를 SDK 레벨에서 강제하지 못한다. 모델이 형식을 어길 수 있으므로 **zod 검증이 단일 최종 게이트**다(추천 5개 강제는 서버 `.length(5)`가 보증 — ADR-011). 이 차이를 어댑터 내부에 격리한다.
- 구조화 출력 스키마가 Provider별로 3종(Gemini `responseSchema` / Claude tool input_schema / Kimi `json_object` 프롬프트 지시)으로 늘어난다. 모두 동일 도메인 타입·zod로 수렴해야 하는 수동 동기화 부담이 ADR-008 대비 한 갈래 더 늘어난다(기술 부채로 등록).

## 환경변수

| 변수 | 용도 | 기본값 |
|------|------|--------|
| `AI_PROVIDER` | Provider 선택 (`"kimi"` \| `"gemini"` \| `"claude"`) | **`kimi`** |
| `KIMI_API_KEY` | Kimi(Moonshot) 호출 키 | (필수, `AI_PROVIDER=kimi`일 때) |
| `KIMI_MODEL` | Kimi 모델 오버라이드 | `kimi-k2` |
| `KIMI_BASE_URL` | Moonshot base URL 오버라이드 | `https://api.moonshot.ai/v1` |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | 롤백(Gemini) — ADR-008 참조 | (롤백 시 필수) / `gemini-3.1-flash-lite` |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | 롤백(Claude) — ADR-008 참조 | (롤백 시 필수) / `claude-haiku-4-5-20251001` |

롤백 절차: `AI_PROVIDER=gemini`(또는 `claude`) 설정 후 해당 키 존재 확인 → 재배포.

## 기존 ADR과의 관계

- **ADR-002 (Claude AI Adapter + Facade + Factory)** 의 격리 설계가 본 결정의 토대다.
- **ADR-008 (Gemini 기본 전환 + Factory 도입)** 의 직접 후속/연장이다. ADR-008이 정의한 Factory·`AI_PROVIDER` 토글·응답 계약 수렴 불변식을 그대로 따르며, 기본 Provider만 `gemini` → `kimi`로 한 단계 더 전환한다. Gemini는 이제 (Claude와 함께) 롤백 보존 경로가 된다.
- **ADR-011 (추천 엔드포인트)** 의 추천 경로(`AIRecommendationProvider` + Factory)에도 동일하게 Kimi 어댑터가 추가된다. 추천 5개 강제의 최종 보증인 서버 zod `.length(5)`는 본 변경과 무관하게 유효하다.

## 참고

- ADR-008 — 본 ADR이 그 Factory·토글의 직접 후속.
- ADR-011 — 추천 경로 Provider/Factory 패턴(Kimi 동일 적용).
- `src/lib/ai/AGENTS.md` — Provider 목록·기본값 갱신 대상.
- `src/lib/ai/ai-recipe-provider.factory.ts`·`ai-recommendation-provider.factory.ts` — `AIProviderKind`·`DEFAULT_PROVIDER` 변경 지점.
