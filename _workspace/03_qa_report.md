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
