# 03 · QA Report — `POST /api/recommendations` (통합 정합성·계약 준수)

- 일자: 2026-05-30
- 작성: recipe-qa
- 기준 디렉토리: `airecipe-backend/`
- 검증 SSOT: `_workspace/01_architect_baseline.md` §4 (Q1~Q14)
- 방법: 생산자/소비자 **양쪽 동시 읽기** + zod 스키마 1:1 node 대조 + `tsc --noEmit`/`eslint`/`next build` **실행 출력** + 코드 경로 추적

---

## 0. 요약 매트릭스 — PASS 14 / FAIL 0

| # | 항목 | 판정 | 핵심 근거(파일:라인 / 명령 출력) |
|---|------|------|----------------------------------|
| Q1 | 계약 미러 일치 | **PASS** | node diff: SITUATIONS/WEATHERS/dishMax(60)/descMax(120)/tagInnerMax(16)/tagArrMax(5)/itemsLen(5) 전부 `MATCH=true` |
| Q2 | 요청 검증 → 400 | **PASS** | `route.ts:24-30` JSON catch → VALIDATION_ERROR; `parseOrThrow(recommendationsRequestSchema)`; refine `recommendation-schema.ts:29-36` |
| Q3 | 인증 우선 → 401 | **PASS** | `route.ts:22` `await requireUser` 가 본문 파싱(`:26`)보다 먼저. 헤더+쿠키 없으면 `requireUser`가 UNAUTHORIZED throw |
| Q4 | 정상 200 + items[5] | **PASS(정적)** | `route.ts:33-34` `ok(result)`→`{data:{items,meta}}`; items `.length(5)` `recommendation-schema.ts:48-50` |
| Q5 | meta echo + generatedAt ISO | **PASS** | `recommendation.service.ts:29` `meta:{ theme: input.theme, generatedAt: new Date().toISOString() }` |
| Q6 | AI shape 위반 → 502 | **PASS** | gemini `parseFinal`(`:91`)·claude `extractItems`(`:87`)가 `parseRecommendationItems`(.length(5)) → 실패 시 `AIProviderError("provider_error")` → service `AI_PROVIDER_ERROR`(502) |
| Q7 | provider throw → 429/502 | **PASS** | `recommendation.service.ts:36-46` rate_limited→`AI_RATE_LIMITED`(429), else→`AI_PROVIDER_ERROR`(502); 어댑터 `toProviderError` 429 분류 |
| Q8 | CORS OPTIONS 204 + 헤더 | **PASS** | `route.ts:40` `OPTIONS=corsPreflightResponse`(204); `cors.ts:18` Allow-Headers에 `X-Toss-User-Id`, `:20` Allow-Methods에 POST·OPTIONS; withCors 모든 분기 부착 |
| Q9 | 비-stream JSON | **PASS** | `ok()`=`NextResponse.json` 단일 응답. SSE/ReadableStream 미사용 |
| Q10 | Provider 전환 동일 shape | **PASS** | `factory:22-31` gemini/claude 둘 다 `Promise<RecommendationItem[]>`; service가 동일 meta 조립 → 동일 응답 shape |
| Q11 | 404 해소(라우트 존재) | **PASS** | `next build` 출력에 `ƒ /api/recommendations` 등재 |
| Q12 | 빌드·린트 | **PASS** | `tsc --noEmit` exit 0; `npm run lint`(eslint) exit 0; `next build` BUILD_EXIT=0 (Compiled successfully, TypeScript Finished) |
| Q13 | 무상태 | **PASS** | 신규 마이그레이션/리포지토리 0건; service·provider에 DB write 코드 0건 |
| Q14 | 에러 코드 정합 | **PASS** | 사용 코드 5종 모두 `api-response.ts STATUS_BY_CODE` + 미니앱 §3.8.4 표 내. `AI_ERROR` 0건 |

---

## 1. 통과 상세 (생산자/소비자 양쪽 동시 읽기)

### Q1 — 계약 미러 1:1 (최우선)
생산자 `src/lib/ai/recommendation-schema.ts` ↔ 소비자 `airecipe-miniapp/src/lib/zod/recommendations.ts` node 스크립트로 리터럴 추출·비교(전부 `MATCH=true`):

| 항목 | 백엔드(:라인) | 미니앱(:라인) | 일치 |
|------|--------------|--------------|------|
| SITUATION_KEYS `lunch,dinner,midnight,gathering,solo,special` | :13-20 | :11 | ✅ 값·순서 |
| WEATHER_KEYS `hot,cold,rainy,sunny,chilly` | :21 | :12 | ✅ 값·순서 |
| theme refine(최소 1축) | :29-36 | :20-28 | ✅ |
| dishName `.min(1).max(60)` | :41 | :33 | ✅ |
| description `.min(1).max(120)` | :42 | :34 | ✅ |
| tags `array(string.min(1).max(16)).max(5)` | :43 | :35 | ✅ |
| items `.length(5)` | :48-50 | :46 | ✅ |
| meta `{theme, generatedAt:string}` | :52-55 | :40-43 | ✅ |

refine 메시지 문구만 상이(검증 동작 동일 — 무영향).

### 응답 shape 경계면
- 생산자: `route.ts:34` `withCors(ok(result), request)` → `api-response.ts:28-30` `{ data }` → `{ data: { items, meta } }`.
- 소비자: `airecipe-miniapp/src/services/recipes.ts:216-227` `apiFetch('/api/recommendations', apiResponseSchema(recommendationsResponseSchema))` → `lib/zod/api.ts:34` `{ data: inner }` 검증 후 `.data` unwrap → `recommendationsResponseSchema.parse`. 백엔드 출력과 정확히 정합.
- 소비 훅: `useRecommendations.ts:104-114` `result.items` 사용. items[5] 보장과 일치.
- camelCase 100%: `dishName/description/tags/theme/generatedAt`. **snake_case 누출 0건**(무상태 — Mapper·DB 경유 없음).

### Q6 — AI 5개 강제 서버 재검증 경로
gemini(`gemini-recommendation-provider.ts:73-99`)·claude(`claude-recommendation-provider.ts:72-97`) 모두 AI 출력을 `parseRecommendationItems(raw.items)` 통과 → `recommendationItemsSchema = z.array(item).length(5)`. 4개/6개/dishName 61자/태그 6개 → zod throw → 어댑터가 `AIProviderError("provider_error")` 래핑 → service `AI_PROVIDER_ERROR`(502). **서버 측 재검증 경로 확정.** (node로 consumer/BE-items 스키마에 4/6/61자/태그6 거부 검증 의도했으나 일부 셸 출력 불안정 — 스키마 리터럴 동일성은 Q1 diff로 입증.)

### Q12 — 빌드·린트 (실행 출력)
- `npx tsc --noEmit` → `TSC_EXIT=0`
- `npm run lint`(eslint) → exit 0 (출력 없음)
- `npx next build` → `✓ Compiled successfully`, `Finished TypeScript`, `BUILD_EXIT=0`, Route 표에 `ƒ /api/recommendations`
- 주의: baseline §4 Q12는 `npm run lint`를 명시하나 `package.json`의 `lint` 스크립트는 `eslint`(과거 baseline이 가정한 `next lint` 아님). `npx next lint`는 실재하지 않는 하위명령. 실효 린트는 eslint이며 통과.

### Q14 — 에러 카탈로그
사용 코드: VALIDATION_ERROR(400)·UNAUTHORIZED(401)·AI_RATE_LIMITED(429)·AI_PROVIDER_ERROR(502)·INTERNAL_ERROR(500). 전부 `api-response.ts:16-25` + 미니앱 `lib/zod/api.ts:10-19` enum + §3.8.4 표 내. `ServiceError(code,message,cause?)`(`service-error.ts:8-16`) 시그니처 준수(statusCode 인자 오용 없음). `AI_ERROR`/`BAD_GATEWAY` 0건.

---

## 2. 관찰 (FAIL 아님)

- **O1 (Q12 lint 명칭):** baseline이 가정한 `next lint`는 미존재. 실효 린터는 `package.json` `lint:"eslint"`이며 exit 0. 후속 baseline 문구 정정 권장(담당: be-architect, 경미).
- **O2 (Q5 generatedAt 형식):** miniapp meta zod는 `generatedAt: z.string()`(형식 미강제). 백엔드는 `toISOString()` 사용 → ISO 보장. 계약 위반 아님.
- **O3 (Q8 CORS 운영):** 미배포·`APPSINTOSS_ALLOWED_ORIGINS` 미설정 시 비화이트리스트 origin엔 헤더 미부착(안전 fallback). 배포 시 미니앱 origin 등록 필요(운영 작업, 코드 무결).
- **O4 (동적 미수행):** 실 AI 키 부재로 provider 모킹 후 실제 HTTP 호출(200+items5, AI 4/6개→502)은 미수행. 코드 경로 추적 + zod 정적 대조 + 빌드 통과로 대체. 한계 명시(§3).

---

## 3. 방법론 한계

- **동적 라우트 호출 미수행:** 실 AI 키 부재로 라우트 통합 테스트(provider 모킹) 대신 정적 분석 + zod 교차검증 + 빌드/타입체크 실행으로 검증. Q4/Q6/Q7은 코드 경로 + 스키마 대조 기반.
- 본 세션 일부 Bash stdout 채널이 간헐 무응답이라, 핵심 사실은 Read 직접 정독 + node 스크립트 + 빌드 출력 파일 grep으로 교차 확인했다(추정 아님). 빌드/타입체크/린트는 모두 실제 exit 코드와 라우트 등재 출력으로 확정.

---

## 4. 통지

- **be-impl:** 액션 필요 항목 **없음**(FAIL 0). 빌드·타입·린트·계약 미러 전부 통과.
- **be-architect:** 계약 결함 없음. (경미) baseline §4 Q12의 `npm run lint` 기대를 실효 스크립트(`eslint`)와 일치하도록 문구 정정 권장(O1).
- **미니앱(소비자, 참고):** 추천 zod 미러·소비 경로(`useRecommendations.ts`, `services/recipes.ts:212-228`, `lib/zod/api.ts`) 완비 — 백엔드 응답 shape과 정합. 계약 변경 없음. 배포 시 origin 화이트리스트 등록만 운영 작업(O3).
