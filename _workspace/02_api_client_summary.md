# Phase 3 — api-client 산출 요약

> 작성: miniapp-api-client · 2026-05-24 · 팀 `airecipe-miniapp-phase3`
> 입력: `_workspace/00_input/requirements.md`, `_workspace/01_architect_phase3_baseline.md`, `_workspace_phase1/02_api_client_summary.md`, `_workspace_phase2/02_api_client_summary.md`, ADR-010, ADR-011
> 범위: baseline §E.api 분담 — 4 신규 훅 + `_app.tsx` 확장 1줄
> 의존성: Phase 1 services 6 함수 + Phase 2 SSE 어댑터 + ADR-010·011 동결 그대로

---

## 1. 산출 파일

### 코드 (신규 4)

| 파일 | 책임 | baseline 매핑 | 줄 수 |
|------|------|--------------|------|
| `src/hooks/useRecipeCache.tsx` | `RecipeCacheProvider` + `useRecipeCacheTrigger()` Context — `{ trigger: number, invalidate: () => void }`. `invalidate()` → `setTrigger(n => n + 1)` 단조 증가. 구독 훅의 useEffect dep로 refetch 강제 (대안 (a) Context + bump key 채택, SWR/RQ 미도입 정합) | §D.1, §D.2 | 72 |
| `src/hooks/useSaveRecipe.ts` | `saveRecipe({ recipe })` mutation 훅 — 성공 시 `Recipe` 반환 + `invalidate()` 1회. 실패 시 null + `error` state(한국어). 식별자 미발급(`tossUserId === undefined`) 시 즉시 `UNAUTHORIZED` 메시지 + null. AbortController unmount cleanup + cancelled 플래그. | §A.1, §A.4, §D.3 | 137 |
| `src/hooks/useMyRecipes.ts` | `listRecipes(query, auth)` 호출 → raw `{ data, meta }` 보존 (ADR-010 D5 listRecipes 예외). cache trigger를 useEffect dep에 포함 — invalidate 시 자동 refetch. query/auth/refetchTick 변경 시 자동 refetch. 명시적 `refetch()` 노출. AbortController + cancelled 플래그. | §A.1, §D.2, ADR-010 D5 | 158 |
| `src/hooks/useRecipeDetail.ts` | `getRecipe(id, auth)` 호출 → `Recipe` 노출. **404 정규화** — `ApiClientError.error.code === 'NOT_FOUND'` → `notFound: true`, `error: null` (ADR-005 통일). cache trigger는 dep 미포함 (§D.5) — id 변경 또는 명시적 `refetch()`로만. AbortController + cancelled 플래그. | §A.1, §D.5, ADR-005 | 154 |

### 코드 (확장 1)

| 파일 | 변경 | baseline 매핑 |
|------|------|--------------|
| `src/_app.tsx` | `RecipeCacheProvider`를 `TossUserIdProvider` 안쪽에 1줄 wrap (식별자가 있어야 캐시도 의미). Phase 1·2 동결 코드 영향 0건. | §D.4 |

### 인프라 변경

**없음.** `package.json`·`tsconfig.json` 모두 동결 유지 (Phase 1·2 그대로). React 표준 Context/useState/useEffect/useRef + AbortController만 사용. zod·@toss/tds-react-native·@granite-js/react-native·@apps-in-toss/framework 모두 Phase 1·2에 추가됨.

> hooks barrel(`src/hooks/index.ts`) 신규 생성 안 함 — 현 import 패턴(`from './hooks/useRecipeGenerate'` 등 직접 import)을 유지. YAGNI (frontend 4 화면이 직접 import해도 일관성 유지).

---

## 2. 노출 인터페이스 (frontend에 사전 통지 완료 — SendMessage 2026-05-24)

### useRecipeCache.tsx

```ts
export interface RecipeCacheContextValue {
  trigger: number;                  // 단조 증가 카운터
  invalidate: () => void;           // setTrigger(n => n + 1)
}
export function RecipeCacheProvider({ children }: PropsWithChildren): JSX.Element;
export function useRecipeCacheTrigger(): RecipeCacheContextValue;   // Provider 누락 시 throw
```

### useSaveRecipe.ts (auth/cache 내부 주입 — 인자 불요)

```ts
export interface UseSaveRecipeResult {
  isSaving: boolean;
  error: string | null;                                         // 한국어 매핑
  save: (recipe: GeneratedRecipe) => Promise<Recipe | null>;    // 성공: Recipe + invalidate, 실패: null + error
  reset: () => void;
}
export function useSaveRecipe(): UseSaveRecipeResult;
```

### useMyRecipes.ts (query만 인자 — auth는 내부 useTossUserId)

```ts
export interface UseMyRecipesResult {
  data: Recipe[];                   // 초기/로딩 중 [], 빈 사용자도 [] (정상)
  meta: ListMeta | null;            // clamp 적용 pageSize는 meta.pageSize 신뢰
  isLoading: boolean;
  error: string | null;
  refetch: () => void;              // 명시적 재조회 (cache trigger와 별개)
}
export function useMyRecipes(query: RecipeListQuery): UseMyRecipesResult;
```

자동 refetch dep: `query.favorite`/`query.page`/`query.pageSize`/`tossUserId`/`refresh`/`trigger`/`refetchTick`.

### useRecipeDetail.ts (id만 인자)

```ts
export interface UseRecipeDetailResult {
  data: Recipe | null;
  isLoading: boolean;
  notFound: boolean;                // ADR-005: 없음·잘못된 id·타인 소유 모두 true
  error: string | null;             // 그 외 에러. notFound와 동시 true 불가
  refetch: () => void;
}
export function useRecipeDetail(id: string): UseRecipeDetailResult;
```

자동 refetch dep: `id`/`tossUserId`/`refresh`/`refetchTick`. **`trigger` 미포함** (§D.5).

---

## 3. baseline §H.2 격리 단언 자기 검증 결과

| # | 단언 | 결과 |
|---|------|------|
| 11 | `recipe.id` 사용은 저장된 `Recipe` 한정. `GeneratedRecipe` 표시에서 0건. | ✅ 훅 측 — `useSaveRecipe`/`useRecipeDetail`의 반환값(`Recipe`)에서만 사용. `GeneratedRecipe` 인자 받는 `useSaveRecipe.save(recipe)`도 `.id` 접근 0건. 화면 측 (RecipeCard) 검증은 frontend [D]·qa 책임 |
| 12 | 단일 fetch 점 — `src/`에서 `fetch(` 직접 호출 정확 2곳 | ✅ `api-client.ts:102` + `sse-client.ts:78` (`pnpm typecheck` 후 `grep -rn "fetch(" src/` 검증) |
| 13 | `NotFoundScreen` 단일 컴포넌트 정책 — `src/pages/`에서 404 statusCode 직접 렌더 0건 | (frontend [F] 책임 — `useRecipeDetail`이 `notFound: boolean`을 노출하여 단일 분기 가능하게 함) |
| 14 | `useMyRecipes`는 raw `{ data, meta }` 보존 (ADR-010 D5 예외) | ✅ `state: { data, meta }` 그대로 노출. `meta` 가공 0건 |
| 15 | `useSaveRecipe.save` 성공 시 `invalidate()` 정확 1회, 실패 시 0건 | ✅ try의 마지막 단계에서 `invalidate()` → `setIsSaving(false)` → `return saved`. catch는 `setError`만, invalidate 0건 |
| 16 | 식별자 가드 일관성 — `tossUserId === undefined` 시 호출 보류 | ✅ `useMyRecipes`/`useRecipeDetail`의 useEffect 진입 시 `if (tossUserId === undefined) return;`. `useSaveRecipe.save`는 즉시 `UNAUTHORIZED` 메시지 + null 반환(방어선) |
| 17 | AbortController unmount cleanup + cancelled 플래그 | ✅ 4 훅 모두 적용. `useMyRecipes`/`useRecipeDetail`은 매 effect 사이클의 in-flight도 abort (다음 effect 호출 시 이전 abort + 새 controller) |
| 18 | `useMyRecipes`는 `meta.pageSize`를 그대로 노출 (화면 측 page 계산 시 신뢰) | ✅ `meta` 객체 그대로 전달, 가공 0건 |

### §H.3 ADR-011 D13 cast 격리 유지

- 신규 4 훅 + `_app.tsx`에서 `as RequestInit['signal']` / `as AbortSignal` / `as unknown as ... Signal` cast **0건**.
- grep 검증: `grep -rn "as RequestInit\|as AbortSignal\|as unknown as.*Signal" src/ --include="*.ts" --include="*.tsx"` → 정확 2곳(`api-client.ts:100`, `sse-client.ts:76`).
- 4 훅 모두 `new AbortController()` + `controller.signal`을 services 함수에 그대로 전달 — services 내부에서 cast 흡수. cast 확산 0건 PASS.

### Phase 2 baseline §D.2 누적 격리 단언 — Phase 3 영향

| Phase 2 단언 | Phase 3 영향 |
|--------------|------------|
| #1 단일 fetch 점 (services 2곳) | ✅ 유지 — 훅 0건 추가 |
| #5 Toss user hash 평문 노출 0건 | ✅ 유지 — 신규 4 훅에 `console.log(hash)` 0건, UI 노출 0건 |
| #6 text 청크 delta 화면 표시 0건 | ✅ N/A — Phase 3 SSE 추가 없음 |
| #7 `recipe` 청크 외 결과 채널 0건 | ✅ N/A — Phase 3 SSE 추가 없음 |
| #8 HTTP 200 + error 청크 시 사용자 에러 표시 | ✅ N/A — Phase 3 SSE 추가 없음 |
| #9 `GeneratedRecipe` (id 없음) 보호 | ✅ 누적 — `useSaveRecipe.save(recipe: GeneratedRecipe)`는 `.id` 접근 0건. 반환값만 `Recipe`(id 포함) |
| #10 공개 endpoint 헤더 정책 | ✅ N/A — Phase 3 호출은 보호 3종(GET 목록 + GET 단건 + POST 저장) |

---

## 4. 응답 shape SSOT 인용 위치 (Phase 3 사용분)

| 영역 | 인용 |
|------|------|
| 목록 응답 raw `{ data: Recipe[], meta: ListMeta }` + clamp | 03 §3.3.3 (라인 297~315) + ADR-010 D5 |
| 단건 응답 `{ data: Recipe }` + 404 통일 | 03 §3.4.3 (라인 356~358) + 03 §3.4.4 (라인 361~371) + ADR-005 |
| 저장 응답 201 + `{ data: Recipe }` | 03 §3.5.3 (라인 402~407) |
| 401 자동 재시도 1회 | 05 §5.4 (라인 287~314) + ADR-010 D3 |
| `meta.pageSize` 신뢰 (clamp 적용값) | 03 §3.10 #10 (Phase 3 baseline §A.5) |
| `recipe.id` 사용 OK 위치 (저장된 Recipe만) | Phase 2 §D.2 #9 누적 + Phase 3 §H.2 #11 |

---

## 5. 캐시 무효화 정책 결정 표 (요구사항 §데이터 흐름)

| 동작 | 트리거 | 효과 |
|------|--------|------|
| 저장 성공 (`useSaveRecipe.save`) | try 끝 `invalidate()` 1회 | `useMyRecipes` 구독 훅 모두 refetch (trigger dep 변동) |
| 저장 실패 | invalidate 0건 | stale 마이 목록 유지 (안전) |
| 즐겨찾기 토글 (Phase 4) | `useToggleFavorite` 성공 시 | Phase 4 결정 |
| 삭제 (Phase 4) | `useDeleteRecipe` 성공 시 | Phase 4 결정 |
| 상세 명시 refetch | `useRecipeDetail.refetch()` | 본 훅만 재조회. invalidate와 무관 (§D.5) |
| 목록 명시 refetch | `useMyRecipes.refetch()` | 본 훅만 재조회. invalidate와 무관 (외 구독자 영향 0) |
| 라우트 재진입 (`/recipe/[id]` 새로고침) | 새 마운트 → 단발 useEffect | id dep만으로 fetch — 캐시 의존 없음 (ADR-004 정합) |

---

## 6. 재시도·타임아웃 정책 (Phase 3 변경 없음)

| 항목 | Phase 3 정책 | 근거 |
|------|------------|------|
| 401 자동 재시도 | apiFetch 단일 위치 1회 (`refreshTossUserId: refresh` 주입) | ADR-010 D3 그대로 |
| 429/5xx 자동 재시도 | **없음** (Phase 1 정책 유지) | ADR-010 D3 |
| 타임아웃 | apiFetch는 명시적 타임아웃 없음 (RN fetch 기본) | Phase 1 그대로 |
| AbortController unmount cleanup | 4 훅 모두 적용 (Phase 2 useRecipeGenerate 패턴 누적) | §H.2 #17 |
| 캐시 무효화 트리거 | 저장 성공 시 1회 (실패·취소 시 0건) | §D.3 |

---

## 7. 한국어 에러 매핑 (useRecipeGenerate 패턴 누적)

3 훅(`useSaveRecipe`/`useMyRecipes`/`useRecipeDetail`) 모두 `ERROR_CODE_MESSAGES` 8개 enum 키 매핑 표를 inline 보유. 정책 통일:

| code | 메시지 |
|------|--------|
| VALIDATION_ERROR | 입력을 다시 확인해 주세요. |
| UNAUTHORIZED | 로그인이 필요해요. 잠시 후 다시 시도해 주세요. |
| FORBIDDEN | 접근 권한이 없어요. |
| NOT_FOUND | 레시피를 찾을 수 없어요. (useRecipeDetail은 notFound state로 별도 분기 — 본 매핑 통상 미사용) |
| AI_RATE_LIMITED | 잠시 후 다시 시도해 주세요. |
| AI_PROVIDER_ERROR | AI 응답 생성에 실패했어요. 다시 시도해 주세요. |
| DB_ERROR | 일시적인 오류예요. 잠시 후 다시 시도해 주세요. |
| INTERNAL_ERROR | 오류가 발생했어요. 잠시 후 다시 시도해 주세요. |

> 공통화 — Phase 4 추가 훅(`useToggleFavorite`/`useDeleteRecipe`)에서도 동일 매핑 재사용 예상. 4 훅 이상에서 동일 표가 inline되면 `src/lib/messages/error.ts`로 추출 검토. 본 Phase는 YAGNI (4 위치 inline 유지).

---

## 8. 빌드·검증 상태

### typecheck

```
$ pnpm typecheck
> tsc --noEmit
(출력 0 — PASS)
```

### lint (4 신규 + _app.tsx)

```
$ npx eslint src/hooks/useRecipeCache.tsx src/hooks/useSaveRecipe.ts src/hooks/useMyRecipes.ts src/hooks/useRecipeDetail.ts src/_app.tsx
(출력 0 — 0 에러 0 경고)
```

### grep 단언

```
$ grep -rn "as RequestInit\|as AbortSignal\|as unknown as.*Signal" src/ --include="*.ts" --include="*.tsx"
src/services/api-client.ts:100:      signal: init.signal as RequestInit['signal'],
src/services/sse-client.ts:76:      signal: options.signal as RequestInit['signal'],
(정확 2곳 — 확산 0건 PASS)

$ grep -rn "fetch(" src/ --include="*.ts" --include="*.tsx"  # 실 호출만
src/services/api-client.ts:102:    res = await fetch(url, fetchInit);
src/services/sse-client.ts:78:    res = await fetch(url, init);
(정확 2곳 — 단일점 PASS. 훅 hit는 주석의 "refetch"만)
```

---

## 9. frontend·qa 인계 사항

### frontend (T3 — [D]~[H])

- 4 훅 시그니처 SendMessage 통지 완료(2026-05-24, message-id A).
- 사용 패턴 예제 4건(`/my-recipes`, `/recipe/[id]`, `/recipe/generate` 저장 버튼, `EmptyState`/`NotFoundScreen` 호출) 포함.
- 식별자 가드는 화면 측에서 `useTossUserId().tossUserId === undefined` 분기로 Loading 렌더 권장 — 훅 내부에도 방어선 있음(useEffect 진입 시 호출 보류).
- 카드 탭 → `navigation.navigate('/recipe/[id]', { id: recipe.id })`.
- 저장 후 라우팅 → `if (saved) navigation.navigate('/recipe/[id]', { id: saved.id })`.

### qa (T4 — 점진 검증)

- 검증 요청 SendMessage 완료(2026-05-24, message-id B). 자기 검증 결과 표 + 10 항목 권장 매트릭스.
- 핵심: 응답 zod 정합 / 캐시 무효화 정합 / 404 정규화 / 식별자 가드 / AbortController unmount / cast 격리 / 401 재시도 / 한국어 매핑 / Provider 마운트 순서.
- 발견 시 architect 경유 또는 본 에이전트 직접 SendMessage.

### architect (T5 — Phase 3 마무리)

- 본 산출은 ADR-010·011 동결 유지. 본 Phase에서 신규 결정 4개(라우팅·캐시·404·저장 흐름)는 baseline §F.2가 ADR-012(가칭) 후보로 카탈로그.
- AGENTS.md 갱신 트리거: `src/hooks/AGENTS.md`에 Phase 3 신규 4 훅(useRecipeCache·useSaveRecipe·useMyRecipes·useRecipeDetail) 책임·인터페이스 추가 (baseline §F.4).
- `_app.tsx` Provider 구조 갱신 — TossUserIdProvider 안쪽에 RecipeCacheProvider 명시.

---

## 10. 미해결·후속 작업

| 항목 | 처리 위치 |
|------|----------|
| Phase 2 인계 #1 (`@apps-in-toss/web-framework` SDK 경로 미해결) | Phase 3 첫 보호 endpoint 호출(useMyRecipes·useRecipeDetail 마운트)이 useTossUserId의 SDK 실호출 트리거. dev server 시점에 검증. 실패 시 ADR-010 §롤백 R1 + baseline §B.2 갱신. **추측 변경 금지** |
| 백엔드 옵션 P 미배포로 모든 보호 호출 401 | 코드 경로 검증은 PASS 가능(zod·헤더·cache·라우팅). 실호출 검증은 별 저장소 옵션 P 배포 후로 이연. qa report에 PENDING 명시 (Phase 1·2 동일 패턴) |
| 한국어 에러 매핑 inline 4 위치 (Phase 4 진입 시 추출 검토) | Phase 4의 useToggleFavorite·useDeleteRecipe 추가 후 6 위치 이상 inline 시 `src/lib/messages/error.ts`로 추출 |
| useRecipeDetail의 캐시 정책 — Phase 4 PATCH favorite 후 (1) `refetch()` 직접 + (2) `invalidate()` 정합 | Phase 4 (§D.5 후속 결정 보류 항목) |
| 무한 스크롤 (FlatList onEndReached) | Phase 5 출시 직전 별 ADR (baseline §A.5 — MVP는 단순 페이지네이션) |
| 429/5xx 지수 백오프 재시도 | Phase 3 이후 별 ADR (ADR-010 D3 1회 한정 정책 확장) |

---

## 11. ADR-010·011 동결 정합 확인

| ADR 결정 | Phase 3 영향 | 결과 |
|---------|------------|------|
| ADR-010 D1 zod = dependencies + 응답 검증 | 변경 0건 — services에서 적용. 훅은 검증된 객체 받음 | ✅ 유지 |
| ADR-010 D2 메모리 캐싱 (useTossUserId) | 변경 0건 — Phase 1 그대로 사용 | ✅ 유지 |
| ADR-010 D3 401 1회 재시도 | 변경 0건 — apiFetch 단일점, 훅은 `refreshTossUserId: refresh` 주입만 | ✅ 유지 |
| ADR-010 D4 SDK 단일 격리 | 변경 0건 — 신규 훅은 SDK 직접 import 0건, useTossUserId 통해서만 접근 | ✅ 유지 |
| ADR-010 D5 raw 응답 + 호출 측 unwrap | useMyRecipes는 raw `{ data, meta }` 그대로 노출 (listRecipes 예외 정책 그대로) | ✅ 유지 |
| ADR-010 D6 tsconfig `module: "ESNext"` | 변경 0건 | ✅ 유지 |
| ADR-010 D7 SDK 한시 통과 | 변경 0건 — 첫 보호 endpoint 호출 시 검증 트리거 (멈춤 트리거 #3) | ✅ 유지 |
| ADR-011 D8 SSE 별 모듈 | 변경 0건 — Phase 3 신규 SSE 0건 | ✅ 유지 |
| ADR-011 D9 AsyncGenerator | 변경 0건 — Phase 3 신규 SSE 0건 | ✅ 유지 |
| ADR-011 D10 error 청크 throw | 변경 0건 — Phase 3 신규 SSE 0건 | ✅ 유지 |
| ADR-011 D11 text 청크 미표시 | 변경 0건 — Phase 3 신규 SSE 0건 | ✅ 유지 |
| ADR-011 D12 PageNavbar | (frontend [E]·[F] 책임) | (api-client 비범위) |
| ADR-011 D13 AbortSignal cast 2곳 | 변경 0건 — 신규 훅 cast 0건 (§H.3 PASS) | ✅ 유지 |

---

## 12. 변경 이력

| 날짜 | 변경 | 사유 |
|------|------|------|
| 2026-05-24 | 초기 작성 (Phase 3 T2 산출) | 신규 4 훅 (useRecipeCache + useSaveRecipe + useMyRecipes + useRecipeDetail) + `_app.tsx` 확장 1줄 (RecipeCacheProvider wrap). frontend·qa 통지 완료. baseline §H.2 단언 8건 (api-client 책임분) + §H.3 cast 격리 모두 PASS |
