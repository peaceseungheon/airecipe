# QA 통합 정합성 리포트 — 2026-05-21

> 점진적 검증 진행 중. 백엔드(T3) 완료분 + 프론트(T4) 현재 분 경계면 교차 검증.

## 검증 범위
- 계약: `_workspace/01_architect_api_contract.md` (+ ADR-001~004)
- 공유 타입 SSOT: `src/types/*`
- 백엔드: routes / services / repository / mapper / ai / lib (전부)
- 프론트: hooks / pages / components (경계면 관련)
- tsc --noEmit: 0 errors (단, 타입 통과 ≠ 런타임 정합 — 아래 이슈는 타입으로 안 잡힘)

## 통과 (PASS)

### [계약 ↔ 공유 타입] — OK
- 래퍼 ApiResponse/ApiListResponse ↔ 계약 0.1 (api.ts:15-29)
- 에러 ApiError + 8코드 ↔ 계약 0.2 (api.ts:31-48)
- GeneratedRecipe(id 없음) vs Recipe(id 포함) ↔ 불변식 #2 (recipe.ts:36-56)
- StreamChunk 5종 union ↔ 계약 1.3 (api.ts:62-67)
- 엔드포인트 타입 ↔ 6절 매핑표, GET /[id] GetRecipeResponse 포함

### [B] 응답 헬퍼·에러 매핑 — OK
- api-response.ts STATUS_BY_CODE 8개 ↔ 계약 0.2 HTTP 표 정확 일치 (api-response.ts:16-25)
- ok/okList/fail이 {data}/{data,meta}/{error:{code,message}} 정확 생성. 모든 route가 이 헬퍼만 사용 → 래핑 일관

### [C] Mapper snake↔camel — OK
- rowToRecipe: 4개 snake→camel 변환 + user_id 제외 ↔ ADR-001 표 정확 (recipe-mapper.ts:37-52)
- recipeToInsertRow: 역변환 + id/created_at/is_favorite DB 위임 (54-74)
- Repository가 mapper에만 의존, snake_case 누출 없음 (supabase-recipe.repository.ts)

### [E] AI tool input_schema ↔ GeneratedRecipe — OK (불변식 #6)
- recipe-tool-schema.ts emit_recipe input_schema 9필드 = GeneratedRecipe 필드명/구조 정확 일치 (전 중첩 포함)
- recipe-schema.ts zod가 동일 형태로 런타임 재검증(.min(1) ingredients/steps — 계약 3.1 저장 검증과 정합)

### [SSE 생산자↔소비자] — OK (불변식 #5)
- 생산자 generate/route.ts: meta→text→recipe→done, 에러는 HTTP 200 + error 청크 (route.ts:60-87)
- sse.ts encodeSSE: `event:type\ndata:json\n\n` ↔ 계약 1.3 wire 형식
- 소비자 useRecipeGenerate.ts: 청크 type별 분기, error 청크 처리, 결과 GeneratedRecipe 타입 (useRecipeGenerate.ts:94-114). 양쪽 일치

### [GET 쿼리 coercion] — OK (favorite + pageSize 두 단언 모두 PASS, architect 교차확인 2026-05-21)
- listQuerySchema(validation.ts:28-41): favorite enum→boolean, page/pageSize z.coerce.number, 기본값 1/20, pageSize clamp transform
- 잘못된 쿼리 → parseOrThrow → ServiceError(VALIDATION_ERROR) → 400 (계약 2.3 일치)
- **favorite enum end-to-end (계약 2.1/ADR-006 단언 1) — OK**:
  - validation.ts:29-32 `z.enum(["true","false"]).transform(v=>v==="true")` — `z.coerce.boolean()` 미사용(`"false"`→`true` 오인 버그 없음). `?favorite=false`→`false`, `?favorite=true`→`true`, `?favorite=xyz`→enum 거부→400.
  - route.ts:33 `favoriteOnly: query.favorite` → service.ts:31 → repository.ts:39 `if (options.favoriteOnly) eq("is_favorite", true)`. truthy 체크라 `true`일 때만 즐겨찾기 필터, `false`/`undefined`는 전체. → `?favorite=true→즐겨찾기만`, `?favorite=false→전체` 단언 정확 일치.
- **pageSize clamp end-to-end (계약 2.2/ADR-006 단언 2) — OK** (backend fix 반영 확인, architect 교차확인):
  - validation.ts:36-41 `z.coerce.number().int().min(1).default(20).transform(n=>Math.min(n,50))` — transform이 파싱 후 적용되어 query.pageSize는 이미 clamp값(<=50).
  - route.ts:38 `service.list({ pageSize: query.pageSize })`(clamp값 조회) + route.ts:42 `okList(recipes, { total, page, pageSize: query.pageSize })`(meta에 동일 clamp값 회신) — meta.pageSize 불변식 충족.
  - `?pageSize=100`→Math.min(100,50)=50→200+meta.pageSize=50. `?pageSize=0/-1`→min(1) 실패→400. `?pageSize=abc`→coerce 후 int() 실패→400. 단언 정확 일치.

### [Auth API 경계] — OK
- generate route: requireUser 없음(공개) ↔ 계약 0.3
- GET/POST/PATCH/DELETE: requireUser → 미인증 401 ↔ 계약 0.3
- 소유자 격리: repository user_id 스코프 + RLS 이중 방어. setFavorite/delete는 findById 선확인 후 NOT_FOUND (service 주석대로 RLS상 403↔404 수렴 — 계약 4.3/5.3과 차이는 backend가 architect에 통지済)

### [GET /api/recipes/[id]] 백엔드 — OK
- [id]/route.ts에 GET 핸들러 존재(service.getById → ok(recipe) = {data:Recipe}) (route.ts:16-30)
- 응답 Recipe(id 포함), snake/userId 부재(목록과 동일 mapper)

### [useRecipe ↔ GET /api/recipes/[id]] 단건 경계 — OK (재검증 2026-05-21, 이전 CRITICAL 해소)
- 소비자 `src/hooks/useRecipe.ts:41-45`: `useSWR<Recipe>('/api/recipes/${id}', (url)=>requestData<Recipe>(url))` — 목록 캐시(`/api/recipes`)와 독립 키로 단건 GET 직접 호출. 더 이상 목록 find 잠정책 아님.
- 생산자 `[id]/route.ts:16-30`: 호출자 확보 → dead code 아님.
- shape 정합: `requestData<T>`가 `{data}`를 unwrap → `ok(recipe)`={data:Recipe}와 일치.
- ADR-005 수렴: 404→`notFound`, 그 외(401/503/네트워크)→`error` 분리(useRecipe.ts:47-48,86). page(recipe/[id]/page.tsx)는 인터페이스 무변경으로 동작.
- favorite/delete: 단건 캐시 + 목록 캐시(`isListKey`) 동시 무효화(useRecipe.ts:50-79). PATCH는 갱신 Recipe로 단건 캐시 채움, DELETE는 단건 제거+목록 무효화.
- 잔여(경미, 비경계면): recipe/[id]/page.tsx:6 docstring이 "잠정: 목록 캐시 매칭" 구버전 문구 유지 → 갱신 권장(기능 영향 없음).

### [링크 ↔ 라우트] — OK
- href 5종(/, /auth/login, /auth/signup, /my-recipes, /recipe/generate) 모두 실제 page 존재
- router.push 6곳(/, /recipe/generate?, /my-recipes, /recipe/${id}→/recipe/[id], redirectTo) 모두 해소. dangling 없음

## 실패 (수정 필요)
- 없음 (전 경계면 PASS, 2026-05-21 최종 재검증).

## 해소된 편차
- [middleware /recipe/[id] 가드 RESOLVED] (재검증 2026-05-21) 계약 0.3 페이지 보호표 PASS. `src/lib/supabase/middleware.ts:13` `PROTECTED_PREFIXES = ["/my-recipes", "/recipe/"]` + `:19` `PUBLIC_EXCEPTIONS = ["/recipe/generate"]`. 가드(:52-54): `isPublicException=PUBLIC_EXCEPTIONS.includes(pathname)`(정확 일치), `isProtected = !isPublicException && PROTECTED_PREFIXES.some(startsWith)`. 경로별 검증:
  - `/recipe/[id]`(예 `/recipe/abc`) → 비예외 + startsWith `/recipe/` → 보호. 미인증 redirect→`/auth/login?redirectTo=`. (이전 갭 해소)
  - `/recipe/generate` → 예외 정확 일치 → 공개. (계약 0.3 공개)
  - `/my-recipes` → 보호. `/`,`/auth/*` → 비보호 공개. 전부 계약 0.3 표 일치.
  - 정확 일치 예외(`includes`)는 startsWith 예외보다 안전(과다 노출 방지). page docstring(recipe/[id]/page.tsx:3 "middleware가 가드한다")과도 정합.
- [pageSize clamp RESOLVED] (재검증 2026-05-21) ADR-006 clamp 단언 PASS. `src/lib/validation.ts:36-41` `pageSize: z.coerce.number().int().min(1).default(20).transform((n)=>Math.min(n,50))` — `.max(50)` 제거되고 clamp 적용. route.ts:38-41이 meta.pageSize에 query.pageSize(=transform 적용 clamp값) 반환 → `?pageSize=100→200+meta.pageSize=50`. `?pageSize=0/-1/abc`는 여전히 400(min(1)/coerce NaN). 단언과 정확 일치.
- [편차-1 RESOLVED] 소유권 위반 403 vs 404 — ADR-005로 404 수렴 확정. 4자 일치 검증 완료:
  - 계약 0.2(line 40 403 예약/41 404)·0.3(line 49)·API표(line 58)·2.5.3/4.3/5.3(line 226-227/281-282/303-304) 모두 404 수렴 + ADR-005 인용
  - 타입 api.ts:33-39 FORBIDDEN 예약 주석(ADR-005)
  - 구현 recipe.service.ts:39-87 + supabase-recipe.repository.ts maybeSingle→null→NOT_FOUND
  - docs/api/recipes.md 404 문서화 (architect가 :115,152 구버전 문구 정정 완료)
  - **backend ADR-005/006 정리 후 코드 재검증 (2026-05-21) — PASS**: 403 로직 제거(service getById:42-44/setFavorite:66-69/delete:79-82 모두 NOT_FOUND 수렴, FORBIDDEN throw 없음), repository 인터페이스에서 `findOwnerId` 제거(5메서드 전부 userId 스코프), composition.ts admin 경로 제거(요청별 세션 클라이언트=RLS로 RecipeService 조립), `src/lib/supabase/admin.ts` 삭제 확인. dangling 참조 0건(admin/findOwnerId/createAdminClient/SERVICE_ROLE — client.ts:4의 "service role key 클라이언트 미노출" 주석만 잔존, 정확한 보안 설명). 제거가 기존 PASS 경계면을 깨지 않음 확인.

## INFO (확인 권장, 위반 아님)
- /auth/login·/auth/signup 로그인 시 / 리다이렉트(계약 0.3): middleware 미구현(UX 누락, 보안 영향 없음).

## 최종 결론
**PASS — 전 경계면 정합. 미해결 이슈 0건.** 최종 재검증(2026-05-21):
- ✅ [이전 CRITICAL] useRecipe가 GET /api/recipes/[id] 미호출 — 단건 SWR fetch로 교체. 딥링크/새로고침 정상, 백엔드 GET dead code 해소.
- ✅ [이전 WARNING] pageSize ADR-006 clamp — `validation.ts:36-41` `.transform((n)=>Math.min(n,50))`. `?pageSize=100→meta.pageSize=50`.
- ✅ [이전 WARNING] /recipe/[id] 가드 — 보호 prefix `/recipe/` + 공개 예외 `/recipe/generate`(정확 일치, `lib/supabase/middleware.ts:13,19,52-54`). 계약 0.3 페이지 보호표 전 경로 일치.
- ✅ [ADR-007] middleware.ts → proxy.ts 전환 — `src/proxy.ts:9` `export async function proxy(req)` + `:13-18` config.matcher 유지. `src/middleware.ts` 부재 확인. 가드 로직은 `lib/supabase/middleware.ts`(updateSession)에 유지, proxy가 위임(:7,10) — 로직 동일. dangling import 0건. 계약 0.3(proxy.ts) ↔ 실제 proxy.ts ↔ ADR-007 일치.
- ✅ favorite enum end-to-end (계약 2.1/ADR-006 단언 1): `?favorite=false→전체`, `=true→즐겨찾기만`, `=xyz→400`.
- ✅ 편차-1(403/404)은 ADR-005로 404 수렴 확정 + 문서 정정 완료(architect: docs/api/recipes.md:115,152, ADR-004:22 ADR-005 정정 노트, 계약 2.5.3=line 229 "403 미발생").

검증 완료 경계면 전체: 계약↔타입, 응답 래핑({data}/{data,meta}), 에러 매핑(8코드↔HTTP), Mapper(snake↔camel), AI tool schema↔GeneratedRecipe, SSE 생산자↔소비자, 쿼리 coercion(favorite/page/pageSize), auth API(401/공개), 소유권 격리(404 수렴), GET[id] 생산자+소비자, 링크↔라우트, 페이지 보호↔proxy(ADR-007).

→ **T5(경계면 점진적 검증) 완료.** T6 최종 문서 정합성 점검 시 권장 확인(architect 요청): ADR-004↔ADR-005 상호 참조, 계약 0.3(proxy.ts)↔proxy.ts↔ADR-007 일치, 빌드 시 middleware deprecation 경고 부재. 단, 본 검증은 정적 교차 비교 기준 — 실제 Supabase/Anthropic 연결 런타임 검증은 환경 키 확보 후 별도 필요(아래 미검증).

## 미검증 (런타임 — 환경 의존)
- 실제 Supabase 연결·RLS 정책 적용 하의 소유권 격리(404 수렴) 동작은 실 DB 없이는 정적 검증만 수행. 키 확보 후 통합 테스트 권장.
- 실제 Anthropic API 응답의 tool output이 recipe-schema zod를 통과하는지(AI 출력 변동성)는 실 호출로만 확인 가능. 어댑터의 스키마 재검증·재시도 경로는 정적 PASS.

---

# 세션 #3 검증 — 2026-05-22 (AI Provider 기본 Gemini 전환 + Factory 도입)

## 검증 범위 (세션 #3)
- 신규/수정 코드: `src/lib/ai/{gemini-recipe-provider.ts, ai-recipe-provider.factory.ts, ai-recipe-provider.ts, claude-recipe-provider.ts}`, `src/lib/ai/prompts/{recipe-response-schema.ts, prompt-factory.ts, recipe-tool-schema.ts}`, `src/lib/composition.ts`, `package.json`.
- 문서: `docs/adr/ADR-008-...md`, `docs/adr/ADR-002-...md`(Revision), `src/lib/ai/AGENTS.md`, 루트 `AGENTS.md`, `README.md`, `docs/SESSION_NOTES.md`, `.env.local.example`, `.claude/skills/ai-recipe-integration/SKILL.md`.
- 빌드: `npx tsc --noEmit` (0 errors), `npm run lint` (0 errors), `npm run build` (성공, 정적 페이지 10개 생성).

## 결과 요약 — PASS (Blocker 0건, Major 0건)
경계면 정합 전체 PASS. 발견된 minor/info는 모두 문서 톤·다이어그램 부정합으로 런타임/타입 안전성에 영향 없음.

## 통과 (PASS)

### [A] 계약·인터페이스 정합성 — OK
- A1. `AIRecipeProvider` 시그니처 불변 확인 (`ai-recipe-provider.ts:13-43`): `GenerateParams{dishName,servings}`, `StreamHandlers{onText?}`, `generateRecipe→Promise<GeneratedRecipe>`, `generateRecipeStream→Promise<GeneratedRecipe>`. 세션 #1·#2 검증 시점과 동일.
- A2. 두 구현체 모두 `implements AIRecipeProvider` 명시: `gemini-recipe-provider.ts:36`, `claude-recipe-provider.ts:35`. 반환 타입·파라미터 동일(LSP 만족). tsc 0 errors.
- A3. `StreamHandlers.onText` 양쪽 Provider에서 호출 확인:
  - Claude: `claude-recipe-provider.ts:86` `stream.on("text", (delta) => handlers.onText!(delta))` — SDK 이벤트 기반.
  - Gemini: `gemini-recipe-provider.ts:96-101` `for await (const chunk of stream) ... handlers.onText?.(delta)` — async iterator, undefined-safe.
- A4. `AIErrorKind = "rate_limited" | "provider_error"` 양쪽 의미 동일:
  - 429 → rate_limited (`gemini:144`, `claude:125`)
  - 그 외 SDK/네트워크 → provider_error (`gemini:151,158`, `claude:132,138`)
  - 추가 매핑: Gemini는 AbortError(타임아웃) → provider_error 수렴(`gemini:157` 주석). 의도된 단순화.

### [B] Factory 분기 정합성 — OK
- B1. 4가지 경로 매트릭스 (`ai-recipe-provider.factory.ts:26-41`):
  - 미설정/공문자열 → `kind = DEFAULT_PROVIDER = "gemini"` → Gemini (line 28).
  - `"gemini"` → Gemini (line 31-32).
  - `"claude"` → Claude (line 33-34).
  - 그 외 → `AIProviderError("provider_error", \`지원하지 않는 AI_PROVIDER: ${kind}. "gemini" 또는 "claude"만 허용됩니다.\`)` (line 36-39). **받은 값을 에러 메시지에 노출** → 디버깅 가능.
- B2. `composition.ts:10,24` Factory 일원화 확인. `new ClaudeRecipeProvider()` / `new GeminiRecipeProvider()` 직접 호출은 Factory(`factory.ts:32,34`)에만 존재 — 다른 곳 0건(grep 전수).
- B3. Singleton 패턴 확인 (`composition.ts:20-27`): `_generationService` 모듈 변수에 첫 호출 시점 1회 조립, 이후 재사용. **`AI_PROVIDER` 런타임 변경은 재배포 없이 반영되지 않는다** — 운영 롤백 시 재배포 필요. 이 의미는 ADR-008 line 62 "재배포" 표현 + AGENTS.md line 43 "재배포"에 명시되어 정합. SESSION_NOTES도 동일 톤. **별도 issue 불필요.**

### [C] SDK 격리 — OK (어댑터 경계 엄격)
- C1. `@google/genai` runtime import 2곳만:
  - `gemini-recipe-provider.ts:17` `import { ApiError, GoogleGenAI }` (어댑터 본체)
  - `prompts/recipe-response-schema.ts:12` `import { Type, type Schema }` (Provider 전용 스키마 정의)
- C2. `@anthropic-ai/sdk` runtime import 1곳만 + import type 2곳:
  - Runtime: `claude-recipe-provider.ts:12` `import Anthropic`
  - import type only: `prompts/prompt-factory.ts:12`, `prompts/recipe-tool-schema.ts:7` (런타임 영향 없음, 트리쉐이킹 대상)
- C3. Service/Route/Repository/Component/Hook 계층에 SDK import 0건 (grep 전수: `services/, app/, repositories/, components/, hooks/, mappers/` 깨끗).
- C4. `factory.ts`는 SDK 미참조 — Provider 클래스만 import (`:15-16`).

### [D] 스키마 정합성 (4자 동기화) — OK
- D1. 핵심 9개 최상위 필드 4자 일치 (`responseSchema:87-97 ↔ tool input_schema:77-87 ↔ zod:31-41 ↔ type:36-46`):
  `dishName, description, servings, cookTimeMinutes, difficulty(easy|medium|hard), ingredients[], steps[], tips[], nutrition`.
- D2. 중첩 객체 검증:
  - `ingredients[]`: `{name(string), quantity(number), unit(string)}` 모두 required — 4자 일치.
  - `steps[]`: `{order(int), instruction(string)}` 모두 required — 4자 일치.
  - `nutrition`: `{calories, carbohydrates, protein, fat, fiber}` 모두 number + `healthNote(string)` 모두 required — 4자 일치. zod는 number로 통일(Gemini는 NUMBER/INTEGER 혼합, JSON Schema도 number/integer 혼합 — JSON 파싱 후 zod number는 정수도 수용).
- D3. 파싱 단일 게이트 확인:
  - Gemini: `gemini-recipe-provider.ts:67,103,130` → `parseFinal → parseGeneratedRecipe`
  - Claude: `claude-recipe-provider.ts:64,90,111` → `extractRecipe → parseGeneratedRecipe`
  두 Provider 모두 `recipe-schema.ts`의 `parseGeneratedRecipe(zod)`를 단일 검증점으로 사용.
- D4. `difficulty` enum 값 ["easy","medium","hard"] 4자 일치(Gemini `Type.STRING+enum`, Claude `string+enum`, zod `z.enum`, type `Difficulty` union).

### [E] 환경변수 일관성 — OK
- E1. 코드에서 실제 읽는 환경변수 (`grep process.env`):
  - `AI_PROVIDER` (`factory.ts:27`)
  - `GEMINI_API_KEY`, `GEMINI_MODEL` (`gemini-recipe-provider.ts:40,48`)
  - `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (`claude-recipe-provider.ts:39,51`)
  - Supabase 3종(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- E2. 문서 6곳 표기 일치 검증:
  - `.env.local.example:13,17,19,23,25` ✓ 5종 + 기본값 표기
  - `README.md:85-98` ✓ 5종 + 기본값 + 롤백 절차
  - 루트 `AGENTS.md:63-65` ✓ 5종 + 기본값
  - `src/lib/ai/AGENTS.md:32-38` ✓ 5종 표 + 기본값
  - `ADR-008:54-60` ✓ 5종 표 + 기본값
  - `SESSION_NOTES.md:106-108` ✓ AI 관련 변수 표기
  - `.claude/skills/ai-recipe-integration/SKILL.md:96-100` ✓ 5종 + 기본값
- E3. 기본값 동일성:
  - `AI_PROVIDER` 기본 = `gemini` — 6곳 일치.
  - `GEMINI_MODEL` 기본 = `gemini-3.1-flash-lite` — 6곳 일치 + 코드(`gemini-recipe-provider.ts:32` `DEFAULT_MODEL`).
  - `ANTHROPIC_MODEL` 기본 = `claude-haiku-4-5-20251001` — 6곳 일치 + 코드(`claude-recipe-provider.ts:30` `DEFAULT_MODEL`).

### [F] 빌드·타입·런타임 안전성 — OK
- F1. `npx tsc --noEmit`: **0 errors** (백그라운드 실행 exit 0).
- F2. `npm run lint`: **0 errors** (백그라운드 실행 exit 0).
- F3. `npm run build`: **성공** (Compiled 4.4s, TypeScript 2.3s, 정적 페이지 10/10 생성). 환경변수 없이도 정적 페이지(`/`, `/auth/login`, `/auth/signup`, `/my-recipes`, `/recipe/generate`)가 정상 생성됨 → **import-only 단계 throw 없음, 지연 초기화 패턴 유지 확인**.
- F4. `composition.ts:20-27` 지연 게이트 확인: 모듈 import 시점에는 `_generationService=null`만 선언, 첫 `getRecipeGenerationService()` 호출 시 `createAIRecipeProvider()`(→ Provider 생성자 → key 검증). 빌드 타임에는 호출되지 않음 → 키 없이 빌드 통과.
- F5. AI 계층 타입 안전성 우회 0건 (grep `any|as unknown|@ts-ignore|@ts-expect-error` on `src/lib/ai/` — 매치 없음). `tool_use.input`은 `unknown`→`parseGeneratedRecipe(zod)`로 안전 파싱.

### [G] 문서·코드 ADR 정합성 — OK
- G1. ADR-008 Decision 3줄 ↔ 실제 코드:
  - Factory(`AI_PROVIDER` 분기) → `factory.ts:26-41` ✓
  - SDK 격리(Adapter 2개) → `gemini-/claude-recipe-provider.ts` + import 격리 ✓
  - Default Provider=gemini → `factory.ts:20 DEFAULT_PROVIDER="gemini"` + `gemini-recipe-provider.ts:32 DEFAULT_MODEL="gemini-3.1-flash-lite"` ✓
- G2. ADR-002 Revision (line 43-52) ADR-008을 line 52 "[ADR-008]..." 명시 참조 ✓.
- G3. `src/lib/ai/AGENTS.md:20-30` 파일 테이블에 8개 파일 등재:
  - `ai-recipe-provider.ts`, `ai-recipe-provider.factory.ts`, `gemini-recipe-provider.ts`, `claude-recipe-provider.ts`, `recipe-schema.ts`, `prompts/prompt-factory.ts`, `prompts/recipe-response-schema.ts`, `prompts/recipe-tool-schema.ts` — **요청 5개 포함 빠짐없이 모두 등재** ✓.
- G4. `SESSION_NOTES.md` 세션 #3(line 58-93) 변경사항이 실제 코드 변동과 일치. 단, line 72 "수정 예정: Composition Root" 표현은 이미 적용됨(`composition.ts` 변경 확인) — 문구만 "수정 완료"로 갱신하면 깔끔하나 정합성 영향 없음(아래 minor-#3 참조).
- G5. README의 환경변수 예시(line 84-98) ↔ `.env.local.example`(line 6-25) 키 5종·기본값·서버 전용 주의문구 1:1 일치.

### [H] 잔여 Claude 디폴트 흔적 — OK
- H1. `composition.ts`·Route·Service·기타 어떤 코드에도 `"claude"`·`Claude` 기본값 하드코딩 0건.
  - `services/recipe-generation.service.ts:4` 헤더 주석에 "구체 Claude SDK를 모른다"는 표현은 **롤백용 import이자 ADR-002 문맥 설명** — 기본값 강제 아님(코드는 `AIRecipeProvider`만 의존). 다만 Provider-agnostic 톤과는 어긋남 → 아래 minor-#1.
- H2. AGENTS.md/README/SKILL.md/AGENTS.md(ai) 인트로 모두 "Gemini 기본 (Claude 롤백)" 톤 ✓.

### [I] 회귀 회피 — OK (세션 #1·#2 PASS 항목 재검증)
- I1. SSE 청크 종류 4종 의미 불변 (`route.ts:61,65,68,72,74` meta/text/recipe/error/done). Provider의 `onText` 시그니처 불변(`StreamHandlers.onText?: (delta:string)=>void`)이므로 SSE 매핑 영향 없음.
- I2. F2 영양 정보가 단일 호출로 반환 — `AIRecipeProvider` 계약 불변, 두 Provider의 응답이 모두 `GeneratedRecipe.nutrition` 포함 (D2 확인). Service Facade(`recipe-generation.service.ts:28-37`)도 단일 호출만 수행.
- I3. 에러 매핑 매트릭스 ↔ Route:
  - `AIProviderError(rate_limited)` → `recipe-generation.service.ts:60` → `ServiceError("AI_RATE_LIMITED")` → `api-response.ts:21` HTTP 429 ✓
  - `AIProviderError(provider_error)` → 동 line 60 → `ServiceError("AI_PROVIDER_ERROR")` → `api-response.ts:23` HTTP 502 ✓
  - 스트리밍 경로(`generate/route.ts:69-72`)는 HTTP 200 + error 청크로 동일 코드 노출(계약 1.3) ✓
  - 두 Provider 모두 동일한 `AIProviderError(kind, message, cause)`를 던지므로 매핑 분기 불필요(LSP 충족).

## Minor / Info (위반 아님, 권장 갱신)

다음 발견은 모두 **문서 표현/다이어그램**에 국한되며 런타임·타입·계약 정합성에 영향 없음. 카운트 4건:

- **minor-#1** [G/H] `src/services/recipe-generation.service.ts:4` 헤더 주석이 "구체 Claude SDK를 모른다"로 표기 — Provider-agnostic 톤과 어긋남. **수정 권고(backend)**: "구체 AI SDK(Gemini/Claude)를 모른다" 또는 "구체 Provider 구현(Gemini/Claude SDK)을 모른다"로 갱신.
- **minor-#2** [G] `README.md:31` 아키텍처 다이어그램이 `[AIRecipeProvider] ← [ClaudeRecipeProvider]`만 표기 — 루트 `AGENTS.md:10-12`에 이미 Gemini(기본)+Claude(롤백) 둘 다 그린 것과 비대칭. **수정 권고(architect)**: AGENTS.md와 동일하게 두 Provider를 Factory 분기로 표기.
- **minor-#3** [G] `docs/SESSION_NOTES.md:148` 파일 구조 트리의 `src/lib/ai/` 설명이 `# ClaudeRecipeProvider (Adapter)`만 표기 — 세션 #3의 본문(line 60-66, Gemini 기본 전환 명시)과 트리 표기가 불일치. **수정 권고(architect)**: 트리 주석을 `# Gemini/Claude Adapter + Factory (ADR-008)` 또는 동등 표현으로 갱신. 동 파일 line 72의 "수정 예정: Composition Root"도 실제 적용됨 → "수정 완료"로 어조 정정 권장.
- **info-#4** [B] `composition.ts:20` 싱글턴 모듈 변수는 `AI_PROVIDER` 변경이 **재배포 없이 반영되지 않음**(첫 호출 캐시). ADR-008 line 62 / AGENTS.md line 43 / README line 103이 모두 "재배포"로 명시하여 정합 — issue 아님, 운영자 인지용 정보로만 기록.

## 세션 #3 검증 매트릭스 요약

| 항목 | 상태 | 비고 |
|------|------|------|
| A 계약·인터페이스 | PASS | AIRecipeProvider 시그니처 불변, LSP·DIP 유지, 두 Provider 동일 계약 |
| B Factory 분기 | PASS | 4경로 매트릭스 정확, 미설정·"gemini"·"claude"·그외 모두 의도대로 동작 |
| C SDK 격리 | PASS | @google/genai 2곳·@anthropic-ai/sdk 1곳(+ type 2곳), 다른 계층 누출 0건 |
| D 스키마 4자 정합 | PASS | responseSchema↔input_schema↔zod↔GeneratedRecipe 9필드 + 중첩 완전 일치 |
| E 환경변수 일관성 | PASS | 코드 5종 ↔ 문서 6곳 표기·기본값 모두 일치 |
| F 빌드·타입 | PASS | tsc/lint/build 0 errors, 환경변수 없이도 정적 빌드 통과(지연 초기화) |
| G 문서·ADR 정합 | PASS | ADR-008·002·AGENTS·SESSION_NOTES·README 정합 (minor 3건 별도) |
| H Claude 디폴트 흔적 | PASS | 기본값 강제 0건, 인트로 톤 모두 Provider-agnostic |
| I 회귀 회피 | PASS | SSE/F2/에러 매핑 영향 없음, 세션 #1·#2 PASS 항목 유지 |

**최종 결론 — PASS.** Blocker 0건, Major 0건, Minor 3건(문서 표현/다이어그램, 비기능), Info 1건(운영자 인지용). 세션 #3 변경(AI Provider Gemini 전환 + Factory 도입 + Claude 비활성 보존)은 ADR-002의 Adapter 격리 가치를 실증하며, Service·Route·UI 계약에 영향 없이 안전하게 통합됨.

## 미검증 (런타임 — 실제 환경 의존, 세션 #3 신규)
- 실제 `GEMINI_API_KEY`로 한국어 레시피 생성 시 `responseSchema` 출력이 zod(`recipe-schema.ts`)를 통과하는지 — 정적 정합(D)만 확인. AI 출력 변동성에 따른 누락 필드/타입 오류 가능성은 어댑터의 `provider_error` 변환 경로로 수렴됨.
- `AI_PROVIDER=claude` 롤백 시 재배포 한 번에 Claude 경로로 복귀하는지(`ANTHROPIC_API_KEY` 활성화 + 싱글턴 캐시 리셋이 재배포로 보장됨).
- Gemini 스트리밍에서 `chunk.text`가 부분 JSON 문자열로 흐를 때 UI 점진 렌더링 체감(`useRecipeGenerate.ts:100` `progressText` 누적) — Claude의 자연어 델타와 텍스트 형식이 달라 UX 검증 필요. 기능적 throw는 없음(`gemini:103` 누적 후 1회 파싱).
