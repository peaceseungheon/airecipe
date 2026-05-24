# Phase 2 — api-client 산출 요약

> 작성: miniapp-api-client · 2026-05-24 · 팀 `airecipe-miniapp-phase2`
> 입력: `_workspace/00_input/requirements.md`, `_workspace/01_architect_phase2_baseline.md`, `_workspace_phase1/02_api_client_summary.md`, ADR-010
> 범위: baseline §E.api 5파일 작성 + `src/services/api-client.ts` `signal` 옵션 한 줄 확장(baseline §A.2 명시) + AbortSignal 타입 충돌 1회 통지

---

## 1. 산출 파일

### 코드 (신규)

| 파일 | 책임 | baseline 매핑 | 줄 수 |
|------|------|--------------|------|
| `src/lib/zod/stream.ts` | `streamChunkSchema` 5종 discriminated union (`meta`/`text`/`recipe`/`error`/`done`). `recipe` 청크는 `generatedRecipeSchema` 재사용, `error` 청크는 `apiErrorCodeSchema` 재사용 — 4자 정합 단언(03 §3.10 #9) 보장. | §A.3 | 50 |
| `src/services/sse-client.ts` | `streamRecipe(req, options): AsyncGenerator<StreamChunk>` — POST + SSE wire 파싱(`\n\n` 빈 줄 분리 + `data:` 다중 라인) + zod 검증 + error 청크 → `ApiClientError` throw + reader.releaseLock() finally + `!res.body` 폴백 신호. | §A.1, §C.1~C.4 | 200 |
| `src/hooks/useRecipeGenerate.ts` | 상태 머신(idle/streaming/done/error) + AbortController 생성·전달·cleanup + text 누적(progressText, 사용자 표시 금지) + recipe setRecipe + 첫 청크 15s/전체 90s 타임아웃 + `!res.body` 자동 폴백 + 한국어 에러 메시지 매핑. | §A.4, §C.5 | 232 |

### 코드 (확장)

| 파일 | 변경 | baseline 매핑 |
|------|------|--------------|
| `src/services/recipes.ts` | (a) `GenerateOptions`에 `signal?: AbortSignal` 추가. (b) `generateRecipe`가 `signal`을 `apiFetch`로 전달. (c) `generateRecipeStream(req, options): AsyncGenerator<StreamChunk>` 신규 — `sse-client.streamRecipe` Facade. `StreamChunk` 임포트 추가. | §A.2 |
| `src/services/api-client.ts` | (a) `ApiFetchInit`에 `signal?: AbortSignal` 추가. (b) fetch 호출에 `signal` 그대로 전달. (c) `AbortError` 발생 시 그대로 rethrow(INTERNAL_ERROR 변환 회피). | §A.2 (baseline에 명시된 한 줄 확장) |
| `src/services/index.ts` | barrel에 `generateRecipeStream`, `streamRecipe`, `StreamRecipeOptions` 추가 | — |
| `src/lib/zod/index.ts` | barrel에 `export * from './stream';` 1줄 추가 | §A.3 |

> `src/services/api-client.ts`의 확장은 baseline §A.2 마지막 행("기존 비스트리밍 `generateRecipe`도 동시 수용 — fetch에 그대로 전달 (한 줄 추가)")에 명시된 변경. baseline §D.1 "수정 없음" 단언과의 정합: API 시그니처 호환 유지(옵션 추가일 뿐), Phase 1 호출자에게 영향 0건, ADR-010 D5 raw 응답 정책 변동 없음.

### 인프라 변경

**없음.** `package.json`·`tsconfig.json` 모두 동결 유지 (Phase 1 그대로). RN/Granite 표준 fetch + TextDecoder + AbortController + zod만 사용.

---

## 2. 노출 인터페이스

### useRecipeGenerate

```ts
export type GenerateStatus = 'idle' | 'streaming' | 'done' | 'error';

export interface UseRecipeGenerateResult {
  status: GenerateStatus;
  /** 내부 신호. 사용자 화면 표시 금지 (08 §8.3.5). */
  progressText: string;
  recipe: GeneratedRecipe | null;
  error: string | null;        // ERROR_CODE_MESSAGES 매핑된 한국어
  generate: (req: GenerateRecipeRequest) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

export function useRecipeGenerate(): UseRecipeGenerateResult;
```

### generateRecipeStream

```ts
export function generateRecipeStream(
  req: GenerateRecipeRequest,
  options?: { tossUserId?: string; signal?: AbortSignal },
): AsyncGenerator<StreamChunk>;
```

### streamRecipe (sse-client 직접 노출 — 일반 소비자는 useRecipeGenerate 사용 권장)

```ts
export interface StreamRecipeOptions {
  signal?: AbortSignal;
  tossUserId?: string;
}

export async function* streamRecipe(
  req: GenerateRecipeRequest,
  options?: StreamRecipeOptions,
): AsyncGenerator<StreamChunk>;
```

### apiFetch / ApiFetchInit (확장)

```ts
export interface ApiFetchInit {
  // ... Phase 1 필드 그대로
  signal?: AbortSignal;     // Phase 2 추가
}
```

### 기존 함수 (Phase 1 호환)

`generateRecipe`/`listRecipes`/`getRecipe`/`saveRecipe`/`toggleFavorite`/`deleteRecipe` 시그니처 동일 — `generateRecipe`만 `options.signal` 옵션 추가.

---

## 3. SSE 청크 처리 결정 표

| 청크 타입 | sse-client 처리 | 훅 처리 |
|----------|----------------|---------|
| `meta` | yield | no-op (status는 이미 'streaming') |
| `text` | yield | setProgressText 누적 (내부 신호) — **UI 표시 금지** |
| `recipe` | yield | setRecipe + finalRecipeSeen=true |
| `error` | **throw `ApiClientError(code, message)`** (단일 에러 경로 — baseline §C.4) | catch 분기에서 toUserMessage 매핑 |
| `done` | yield + generator return | 정상 종료 신호 — for-await break |

> zod 실패 청크(스키마 위반)는 sse-client `extractChunk`에서 `undefined` 반환 → forward-compat (디버그 로깅은 추후 추가). recipe 청크의 zod 실패도 현재는 union 전체 실패로 통합 — 추후 backend 청크 변경 빈도 증가 시 분리 검증 옵션 도입.

---

## 4. 에러 카테고리 & 사용자 메시지

| 에러 출처 | code | 사용자 메시지 (한국어) |
|----------|------|----------------------|
| HTTP non-200 (ApiError shape 통과) | `error.code` 그대로 | ERROR_CODE_MESSAGES 매핑 |
| `!res.body` | `AI_PROVIDER_ERROR` + message="스트림 응답 본문이 없습니다." | (실제로는 폴백 트리거 — 사용자에게 노출 안 됨) |
| error 청크 | 청크의 `error.code` | ERROR_CODE_MESSAGES 매핑 |
| recipe 청크 zod 실패 | (현재 union 전체 실패로 청크 무시) | (recipe 미수신 → "AI 응답이 비어 있어요." 안내) |
| 네트워크 fetch reject | `INTERNAL_ERROR` | "오류가 발생했어요. 잠시 후 다시 시도해 주세요." |
| AbortError | rethrow (signal.aborted로 식별) | (취소·타임아웃·unmount — 사용자에게 노출 안 됨) |

ERROR_CODE_MESSAGES 8 매핑:
- VALIDATION_ERROR / UNAUTHORIZED / FORBIDDEN / NOT_FOUND / AI_RATE_LIMITED / AI_PROVIDER_ERROR / DB_ERROR / INTERNAL_ERROR — 모두 한국어, HTTP 숫자 노출 0건. AC2.4 충족.

---

## 5. 재시도·타임아웃·폴백 정책

| 항목 | Phase 2 정책 | 근거 |
|------|------------|------|
| 첫 청크 타임아웃 | 15초 — 초과 시 abort 후 비스트리밍 폴백 1회 | 08 §8.5.1 표 + baseline §A.4 라인 61 |
| 전체 한도 | 90초 — 초과 시 abort, idle 복귀 | 08 §8.5.1 표 |
| 청크 간 무응답 | (Phase 2 미구현 — Phase 3 후속) | baseline §A.4 라인 61 명시 |
| `!res.body` 폴백 | sse-client throw → 훅이 generateRecipe(stream:false) 1회 호출 | 08 §8.6 |
| 첫 청크 타임아웃 폴백 | 훅이 abort 분기에서 `!firstChunkSeen` 확인 후 동일 폴백 | 08 §8.5.1·§8.6 합성 |
| 401 자동 재시도 | **본 endpoint(공개)에서 미적용** | 05 §5.3 + baseline §A.4 라인 60 |
| 429/5xx 자동 재시도 | **없음** (Phase 1 정책 유지) | ADR-010 D3 |
| AbortError 처리 | rethrow + 호출 측이 signal.aborted로 식별 | 08 §8.4.1 |

폴백 트리거는 **이중 조건** 검사:
1. `controller.signal.aborted && !firstChunkSeen` — 첫 청크 타임아웃에 의한 abort
2. `err instanceof ApiClientError && err.error.code === 'AI_PROVIDER_ERROR' && err.message === '스트림 응답 본문이 없습니다.'` — `!res.body` 신호

> message 매칭은 fragile. 추후 별 sentinel 에러 코드(`NO_STREAM_BODY` 등) 도입 검토 — 단 현재 baseline §C.4의 단일 throw 정책 유지를 위해 message 매칭 사용. qa 검증 항목 #4에 명시.

---

## 6. baseline §D.2 격리 단언 — api-client 산출 범위 자기 검증

| # | 단언 | 결과 |
|---|------|------|
| 1 | `src/`의 `fetch(` 호출이 `api-client.ts` + `sse-client.ts` 정확히 2곳 | ✅ PASS — grep 결과 일치 |
| 5 | Toss user hash 평문 노출 0건 | ✅ PASS — sse-client는 헤더 부착만, 로그 0건 |
| 6 | `text` 청크 delta가 사용자 화면에 그려지지 않음 | ✅ PASS (api-client 측) — useRecipeGenerate는 setProgressText에만 누적. 화면 그리기 단언은 frontend qa 책임 |
| 7 | `recipe` 청크 외 채널로 최종 결과 결정 금지 | ✅ PASS — useRecipeGenerate.handleChunk에서 setRecipe는 `case 'recipe':`에서만 호출 |
| 8 | HTTP 200 + error 청크 → 사용자 에러 노출, HTTP 상태로 분기 금지 | ✅ PASS — sse-client는 ApiClientError throw, useRecipeGenerate는 error.code로 매핑 |
| 9 | `GeneratedRecipe`(id 없음) 보호 | ✅ PASS — useRecipeGenerate의 recipe 상태는 `GeneratedRecipe | null` (Recipe 아님) |
| 10 | 공개 endpoint 헤더 정책 | ✅ PASS — sse-client는 `if (options.tossUserId !== undefined)` 가드 |

#2 (Tailwind), #3 (next/link), #4 (useAuth)는 frontend 산출 범위 — 본 자기 검증 비대상.

---

## 7. ADR-010 D1·D3·D4·D5·D7 정합 확인 (Phase 1 동결 유지)

| ADR-010 결정 | Phase 2 영향 | 결과 |
|--------------|------------|------|
| D1 zod = dependencies + 응답 검증 | streamChunkSchema 신규로 SSE 청크에도 적용 | ✅ 확장 |
| D2 메모리 캐싱 | 무관 (sse-client는 캐시 미사용) | ✅ 유지 |
| D3 401 1회 재시도 | 본 endpoint(공개)에서 무관 | ✅ 유지 |
| D4 SDK 단일 격리 | sse-client는 SDK 직접 import 0건. tossUserId는 호출 측에서 주입 | ✅ 유지 |
| D5 raw 응답 + 호출 측 unwrap | apiFetch는 그대로. SSE는 별 경로 (§롤백 R4와 정합) | ✅ 유지 (확장) |
| D6 tsconfig `module: "ESNext"` | 변경 없음 | ✅ 유지 |
| D7 SDK 패키지 경로 미해결 한시 통과 | 본 Phase에서 useTossUserId 미사용 — D7 검증은 frontend 책임 | (frontend 영역) |

---

## 8. 직접 fetch 호출 단일점 검증 (grep)

```
$ grep -rn "fetch(" src/ --include="*.ts" --include="*.tsx"
src/services/api-client.ts:101:    res = await fetch(url, fetchInit);
src/services/sse-client.ts:79:    res = await fetch(url, init);
```

정확히 2곳. 단일점 단언 유지.

---

## 9. 빌드·검증 상태

### typecheck

```
$ pnpm typecheck
> tsc --noEmit
(api-client 산출 7파일 모두 통과)
```

남은 에러는 frontend T3 영역:
- `src/components/RecipeDisplay.tsx:135,147` (Badge children 타입)
- `src/router.gen.ts` (생성 페이지 미작성 시 잠시 발생, T3 완료 후 해소)

### lint

```
$ npx eslint src/services/* src/lib/zod/* src/hooks/useRecipeGenerate.ts
(출력 없음 — 0 에러 0 경고)
```

---

## 10. architect 통지 1건 → baseline §D.3 동결 + §D.1 §A.2 허용 확장 확정

### AbortSignal 타입 충돌 — 옵션 3 채택 (동일 cast 패턴, 2적용 지점)

- 사실: ESNext lib와 react-native types가 `AbortSignal.onabort` 시그니처를 다르게 정의 → TS2769.
- 결정 1 (architect 회신 2026-05-24): **옵션 3 채택** — `signal: x as RequestInit['signal']` cast 유지.
- 결정 2 (architect 후속 2026-05-24): **§D.3 범위 2곳 동결** — qa의 cast 경계 발견에 대한 판정. baseline §D.1 api-client.ts 행 "수정 없음" → "§A.2 허용 확장만"으로 갱신. api-client.ts의 cast는 §A.2 `signal?: AbortSignal` 옵션 추가의 자연 귀결로 정합.
- 적용 위치 (확정): `sse-client.ts:76` + `api-client.ts:100` — 동일 cast 패턴, 두 위치 모두 baseline §D.3 인용 주석 통일 적용:
  ```ts
  // baseline §D.3 — RN globals.d.ts AbortSignal vs ESNext lib union TS2769.
  // 런타임 동일 객체, TS nominal만 차이. Phase 3 또는 ADR-011 시 정식 해소.
  signal: ... as RequestInit['signal'],
  ```
- 근거 (baseline §D.3): 격리 범위 최소 / 런타임 영향 0 / 광범위 변경 회피 (lib 제거는 ESNext built-in 가용성 미검증 회귀 위험) / ADR-010 D7과 동일 패턴.
- 해소 조건 (Phase 3 또는 ADR-011 시점):
  - (a) `lib` 제거 + ESNext built-in 가용성 검증 PASS → tsconfig 정리 + cast 제거.
  - (b) react-native types 갱신 (AbortSignal이 lib.dom과 호환 형태로) → cast 제거.
  - (c) 다른 정식 해법 발견 시 architect 재평가.
- ADR 등록: baseline §F.2 표에 **D13** 추가됨 ("RN/ESNext lib union TS2769 격리 — 동일 cast 패턴, 두 적용 지점") — T5에서 ADR-011 단일 문서로 묶거나 ADR-010 보강 결정 시 §D.3 인용.

### cast 격리 정책 (architect 결정 — 확산 금지)

| 위치 | cast | 사유 |
|------|------|------|
| `src/services/sse-client.ts:76` | ✅ 적용 | SSE fetch 호출 — §D.3 적용 지점 |
| `src/services/api-client.ts:100` | ✅ 적용 | apiFetch fetch 호출 — §A.2 자연 귀결 |
| `src/services/recipes.ts` | ❌ cast 0건 | 위임만 (Facade) — `signal` 옵션 그대로 전달 |
| `src/hooks/useRecipeGenerate.ts` | ❌ cast 0건 | `new AbortController()` 자체는 ESNext lib 정상 — controller.signal 생성/전달에 cast 불요 |
| 그 외 모든 모듈 | ❌ cast 0건 | 전파 금지 — §A.2/§D.3 의도 위반 |

grep 검증: `grep -rn "as RequestInit" src/` → 정확히 2건 (api-client.ts:100, sse-client.ts:76). 추가 확산 0건 PASS.

baseline §G 멈춤 트리거 6가지 어느 항목에도 해당하지 않음 → 진행 지속 (T2 완료 상태 유지).

---

## 11. frontend·qa 인계 사항

### frontend (T3)
- `useRecipeGenerate` 시그니처 통지 완료 (SendMessage 2026-05-24).
- 화면 측 책임: SearchForm 입력 검증, 인디케이터 표시(progressText 금지), RecipeDisplay·NutritionPanel 렌더, "다시 시도" 버튼.
- unmount cleanup은 훅이 자동 처리 — 화면 측 추가 코드 불요.

### qa (T4)
- 검증 요청 SendMessage 완료 — 8 검증 항목 목록 전달.
- 핵심: 청크 zod 정합 / 단일점 / 폴백 정책 / 에러 매핑 / ADR-010 D5 정합.
- 발견 시 보고 경로: 청크 형식 차이 → architect, 단일점 위반 → 즉시 통지, text 화면 그리기 → frontend 통지.

### architect (T5)
- AGENTS.md 갱신 트리거(`src/services/AGENTS.md`·`src/hooks/AGENTS.md`):
  - services: 직접 fetch 단일점이 2곳(api-client + sse-client). "SSE는 본 wrapper 우회한 별 경로(streamFetch 등)" → "SSE는 sse-client.ts 별 모듈" 갱신.
  - services: `signal?: AbortSignal` 옵션 ApiFetchInit·GenerateOptions에 명시.
  - services: `generateRecipeStream` 7번째 도메인 함수로 추가 + AsyncGenerator 시그니처 명시.
  - hooks: `useRecipeGenerate` 신규 항목 — sse-client·generateRecipe(폴백)에만 의존, SDK 직접 import 0건.
- ADR-011(가칭) 5+1개 결정 항목:
  1. SSE 어댑터 별 모듈 (sse-client) — D8 후보
  2. AsyncGenerator<StreamChunk> 시그니처 — D9
  3. error 청크 → ApiClientError throw (어댑터 측) — D10
  4. text 청크 사용자 화면 미표시 — D11
  5. PageNavbar 채택 — D12 (frontend 검증 후)
  6. **추가: AbortSignal 타입 충돌 한시 cast** — D13 후보 (본 summary §10)

---

## 12. 변경 이력

| 날짜 | 변경 | 사유 |
|------|------|------|
| 2026-05-24 | 초기 작성 (Phase 2 T2 산출) | 신규 3파일 (zod/stream, sse-client, useRecipeGenerate) + 확장 4파일 (recipes, api-client, 2 barrels) + AbortSignal 충돌 통지 1건 |
