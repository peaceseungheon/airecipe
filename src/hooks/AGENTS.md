# src/hooks — React 훅 (Toss SDK 격리 진입점)

## 책임

`@apps-in-toss/web-framework` SDK 의존을 미니앱 전체에서 **단 한 곳**에 격리한다. 화면·services·다른 훅 어디서도 SDK를 직접 import하지 않고, 본 디렉터리의 훅이 노출한 도메인 인터페이스(`{ tossUserId, refresh }`)에만 의존한다 (DIP).

## 파일

| 파일 | 역할 | SSOT |
|------|------|------|
| `useTossUserId.tsx` | `getAnonymousKey()` 단일 격리 + 메모리 캐싱 + hash zod 검증 + Context Provider + 마스킹 헬퍼 | 05 §5.2.1, §5.2.3, §5.4, §5.10, 09 §9.5, baseline §A.7 |

## 노출 인터페이스

```ts
export interface TossUserIdContextValue {
  tossUserId: TossUserId | undefined;        // 발급 전엔 undefined
  refresh: () => Promise<TossUserId>;        // 401 시 SDK 재호출 → 새 hash 반환
}

export function TossUserIdProvider({ children }: PropsWithChildren): JSX.Element;
export function useTossUserId(): TossUserIdContextValue;     // Provider 누락 시 throw
export function formatTossUserIdMask(hash: TossUserId | undefined): string;  // 평문 노출 금지용 마스킹
```

## 규약 (강제)

- **SDK import는 파일 최상단 단일 줄** — `import { getAnonymousKey } from '@apps-in-toss/web-framework';`만 존재. 다른 어떤 모듈도 SDK를 import하지 않는다 (ADR-010 D4).
- **SDK 패키지 경로 미해결은 `@ts-expect-error` 1줄로 한시 통과** — 첫 `granite dev` 실행 시 모듈 미해결이면 즉시 architect에게 SendMessage → baseline §B.2 + ADR-010 D7 갱신 (ADR-010 §롤백 R1). 추측으로 다른 패키지(`@apps-in-toss/framework` 등)로 변경 금지.
- **hash zod 검증 의무** — `z.string().min(8).max(256)` (05 §5.2.3 라인 118, 백엔드 미들웨어와 동일). 부적합 hash는 캐시에 두지 않고 throw.
- **메모리 캐싱 (모듈 스코프)** — `let cachedTossUserId`. SecureStore 미도입 (ADR-010 D2). 콜드 스타트 시 동일 hash 가정.
- **`refresh()`는 새 hash를 직접 반환** — React Context state 비동기 갱신이 stale이라 api-client의 401 재시도(`refreshTossUserId: () => Promise<string>`)와 정합하려면 직접 반환 필요.
- **hash 평문 노출 금지** — UI/console.log에 hash를 직접 표시하지 않는다. `formatTossUserIdMask`만 사용 (09 §9.5 라인 221, 05 §5.10 라인 520).
- **마운트 시 캐시 우선** — `useEffect`에서 캐시 비어 있을 때만 SDK 호출 1회.

## 진입점

- `src/_app.tsx`에 `<TossUserIdProvider>`가 `AppContainer` 자식으로 마운트되어 있다.
- 화면·기타 훅은 `const { tossUserId, refresh } = useTossUserId();`로 사용.
- api-client 호출 시 `auth = { tossUserId, refreshTossUserId: refresh }`로 services에 주입.

## 변경 트리거

- SDK 패키지 경로 사양 변경 → 본 디렉터리의 import 1줄만 수정 (ADR-010 §롤백 R1).
- SecureStore 도입 결정 → 별 ADR로 ADR-010 D2 superseded. 캐시 구현부만 교체, 인터페이스(`{ tossUserId, refresh }`) 유지.
- `getAnonymousKey()` 가 콜드 스타트마다 다른 hash 반환 → ADR-010 §롤백 R2 발동. 백엔드 측 식별자 갱신 정책 재검토 (별 저장소 ADR).

## Phase 2·3 화면 흐름 훅 (Phase 1 위에 누적)

| 파일 | 역할 | SSOT |
|------|------|------|
| `useRecipeGenerate.ts` (Phase 2) | SSE 소비 — `{ status, progressText, recipe, error, generate, cancel, reset }`. AbortController 3곳(명시 cancel + unmount + 폴백). text 청크 사용자 표시 금지 | 08 §8.3, ADR-011 D11·D13, Phase 2 baseline §A.4 |
| `useRecipeCache.tsx` (Phase 3) | 마이 레시피 캐시 무효화 — `RecipeCacheProvider` + `useRecipeCacheTrigger()` (`{ trigger, invalidate }`). Context + bump trigger 패턴 (SWR/RQ 미도입) | ADR-012 D15, Phase 3 baseline §D.1·D.2 |
| `useMyRecipes.ts` (Phase 3) | 마이 목록 조회 — `listRecipes` raw `{data, meta}` 보존 (ADR-010 D5 예외). `trigger`를 useEffect dep에 포함. 401 자동 재시도(refresh 주입) | 03 §3.3, ADR-006(meta.pageSize 신뢰), Phase 3 baseline §A.1 |
| `useRecipeDetail.ts` (Phase 3) | 단건 조회 — `getRecipe` + **404 정규화**(ApiClientError code NOT_FOUND → `notFound:true`, error null). trigger dep 미포함(상세는 id 단건) | 03 §3.4, ADR-004·005, ADR-012 D16, Phase 3 baseline §A.1·§D.5 |
| `useSaveRecipe.ts` (Phase 3) | 저장 mutation — `save(recipe): Promise<Recipe \| null>`. 성공 시 `invalidate()` 정확 1회. 실패 시 0건(stale 마이 유지). AbortController unmount + cancelled 플래그 | 03 §3.5, ADR-012 D15·D17, Phase 3 baseline §A.1·§A.4·§D.3 |
| `useFullScreenAd.ts` (Phase 4.5) | 전면 광고 — `ads.showFullScreen({ signal })` 위임. `{ request: () => Promise<AdResult>, isPending, error }`. AbortController unmount + 직전 in-flight abort. **Phase 4.5는 wiring 0곳(코드 경로만)** | 11-ADS §11.4, ADR-014 D30·D31·D32 |
| `useToggleFavorite.ts` (Phase 4) | PATCH 즐겨찾기 — `{ toggle: (id, target) => Promise<Recipe \| null>, pendingId, error, reset }`. **id 가변 시그니처** (단일 hook 인스턴스 + 카드별 pendingId 판정 — rules of hooks 정합). 성공 시 invalidate() + Recipe 반환. 실패 null 반환(호출 측 rollback). 직전 in-flight abort. | 03 §3.6, ADR-013 D19·D20·D24, baseline §B D10 |
| `useDeleteRecipe.ts` (Phase 4) | DELETE 삭제 — `{ remove: () => Promise<boolean>, isPending, error, reset }`. id 고정(상세 화면 1곳 호출). **404 성공 정규화** (D21) — `NOT_FOUND` catch → invalidate + true 반환. 메시지 0건. | 03 §3.7, ADR-013 D21, baseline §B D6·D10 |
| `useMyRecipes.ts` 확장 (Phase 4) | Phase 3 위에 `mutate: (next: Recipe) => void` 추가 — data 안 id 매칭 항목 교체. 낙관적 UI · 호출 측 prev 보관 패턴(D19) | ADR-013 D19, baseline §B D4 |
| `useRecipeDetail.ts` 확장 (Phase 4) | Phase 3 위에 `mutate: (next: Recipe) => void` 추가 — PATCH 응답 Recipe로 직접 갱신(refetch GET 회피 — D20) | ADR-013 D20, baseline §B D5 |

## Phase 2·3 추가 규약 (Phase 1 규약 위에 누적)

- **외부 인터페이스 안정성** — Phase 2 `useRecipeGenerate`의 7-tuple, Phase 3 4 훅의 시그니처는 Phase 4 이후도 유지. 변경 시 본 AGENTS.md + ADR-012 결과 표 갱신.
- **AbortController unmount cleanup + cancelled 플래그 의무** — Phase 3 4 훅 모두 useEffect cleanup에서 둘 다 적용 (Phase 2 패턴 답습, Phase 3 baseline §H.2 #17).
- **401 재시도는 api-client 단일 위치(`apiFetch`)** — 본 디렉터리 훅은 `refreshTossUserId: refresh` 주입만 책임 (ADR-010 D3).
- **`RecipeCacheProvider`는 `TossUserIdProvider` 안쪽 마운트** — 식별자가 있어야 캐시도 의미. `_app.tsx`에 두 Provider 순서 동결 (ADR-012 D15).
- **id 정규화 책임** — `useRecipeDetail`이 catch 첫 분기에서 NOT_FOUND를 `notFound: true` state로 변환. 화면 측은 try/catch 없이 `notFound` 분기만 (ADR-005·ADR-012 D16).
- **사용자 친화 한국어 에러 매핑** — `ApiErrorCode` 8종 모두 매핑 (4 훅 모두 동일 표). NOT_FOUND는 useRecipeDetail에서 notFound state로 분기되므로 메시지 표는 완전성 유지용.
- **`useSaveRecipe.save` 성공 시 invalidate 정확 1회** — Phase 3 baseline §H.2 #15. 실패 catch는 setError만. Phase 4 mutation 훅도 동일 패턴 답습.
- **광고 SDK 직접 import 금지** (Phase 4.5) — ADR-014 D26. `useFullScreenAd`는 `../lib/ads`의 `ads.showFullScreen`만 사용. 본 디렉토리에서 `@apps-in-toss/framework`의 광고 API import 0건. (Toss 인증 SDK `getAnonymousKey`는 광고와 무관, 본 규약 대상 외.)
- **낙관적 UI는 호출 측 책임** (Phase 4) — ADR-013 D19. mutation 훅(`useToggleFavorite`)은 내부에 prev 보관 안 함. 호출 측이 (a) `mutate(next)` → (b) `await toggle(id, target)` → (c) `null` 시 `mutate(prev)` 롤백. `useMyRecipes.mutate`·`useRecipeDetail.mutate`로 즉시성 보장.
- **`useToggleFavorite` id 가변 시그니처** (Phase 4) — ADR-013 D24. 카드 목록 map 안에서 카드별 hook 호출 불가(rules of hooks) → 단일 인스턴스 + `toggle(id, target)`. `pendingId === card.id`로 카드별 pending UI 판정. `useDeleteRecipe(id)`는 상세 화면 1곳 호출이라 id 고정.
- **mutation 훅의 `invalidate()` 호출은 성공 시 1회** (Phase 4) — ADR-013 답습. useToggleFavorite 성공 1회 + useDeleteRecipe 성공·404 정규화 1회. 실패 시 0건(stale data 유지가 안전).

## 비범위 (Phase 3)

- Phase 4 mutation 훅 (`useToggleFavorite`, `useDeleteRecipe`) — 동일 invalidate 패턴 답습. Phase 4 baseline에서 정의.
- 키별 부분 무효화 — Phase 3 단일 trigger 충분. Phase 4·5에서 별 ADR 검토.
- 무한 스크롤 / focus refetch — ADR-012 §대안 D·H 기각. Phase 5에서 재검토.
- 단위 테스트(jest + @testing-library/react-native) — Phase 1~3 비범위. qa의 정적 검증으로 대체.

## 관련 ADR

- [ADR-009](../../docs/adr/ADR-009-appsintoss-port-architecture.md) — D2 Toss 식별자 전환.
- [ADR-010](../../docs/adr/ADR-010-miniapp-phase1-conventions.md) — D2 메모리 캐싱·D3 401 1회 재시도·D4 SDK 단일 격리·D5 raw 응답 정책·D7 패키지 경로 한시 통과.
- [ADR-011](../../docs/adr/ADR-011-miniapp-phase2-streaming-ui.md) — D9·D10 SSE 어댑터·D11 text 청크 미표시·D13 AbortSignal cast 격리.
- [ADR-012](../../docs/adr/ADR-012-miniapp-phase3-routing-cache-404.md) — D14 라우트 경로·D15 Context+bump trigger·D16 404 단일 컴포넌트·D17 저장 후 상세 직진·D18 단순 페이지네이션.
