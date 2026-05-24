# src/services — 단일 HTTP 호출 경로 + 6 도메인 함수

## 책임

미니앱의 **모든 백엔드 호출의 단일 진입점**. `api-client.ts`가 fetch I/O·헤더 부착·401 재시도·zod 검증을 단일 책임으로 수행하고, `recipes.ts`가 6 엔드포인트별 도메인 호출 함수를 노출한다.

## 파일

| 파일 | 역할 | SSOT |
|------|------|------|
| `api-client.ts` | `apiFetch<T>(path, schema, init)` 단일 fetch 래퍼 + `ApiClientError` + 401 1회 재시도 + zod 검증 (raw 응답에 적용) + `init.signal?: AbortSignal` 옵션 (Phase 2 추가) | Phase 1 baseline §A.4, 03 §3.1·§3.9, 05 §5.4 + Phase 2 baseline §A.2 |
| `recipes.ts` | 6 도메인 호출 함수 — `generateRecipe`/`listRecipes`/`getRecipe`/`saveRecipe`/`toggleFavorite`/`deleteRecipe` + `generateRecipeStream` Facade (Phase 2 추가, sse-client에 위임) | 03 §3.2~3.7 + Phase 2 baseline §A.2·§C.1 |
| `sse-client.ts` (Phase 2 신규) | SSE → fetch+ReadableStream 어댑터. `streamRecipe(req, options): AsyncGenerator<StreamChunk>`. wire 파싱(`\n\n` 분리 + 다중 `data:`) + `streamChunkSchema` zod + `error` 청크 → `ApiClientError` throw + `!res.body` 폴백 신호 | 03 §3.2.4, 08 §8.3~8.5, Phase 2 baseline §A.1·§C.1~C.4, ADR-011 D8~D10 |
| `index.ts` | barrel — 공개 함수·`ApiClientError`·`AuthedCallOptions`·`GenerateOptions` + `streamRecipe` 재노출 | — |

## 규약 (강제)

- **직접 fetch 호출 단일점 (모듈 단위)** — `fetch(` 패턴은 본 디렉터리의 `api-client.ts`(apiFetch) + `sse-client.ts`(streamRecipe) 정확 2곳에만 존재한다. 화면·훅·다른 services는 절대 `fetch`를 직접 호출하지 않는다 (CLAUDE.md §3, Phase 2 baseline §D.2 #1).
- **`AbortSignal` cast 패턴은 본 디렉터리 2곳에만** — `signal: <source>.signal as RequestInit['signal']`는 `api-client.ts:100` + `sse-client.ts:76` 정확 2곳. RN globals.d.ts vs ESNext lib `AbortSignal` 충돌 한시 통과 (ADR-011 D13, Phase 2 baseline §D.3). 다른 모듈로 전파 금지. Phase 3 또는 ADR-011 D13 해소 조건 (a)/(b)/(c) 충족 시 2곳 동시 제거.
- **SSE는 `apiFetch` 우회** — `streamRecipe`는 자체 fetch 호출. JSON 단일 응답 정책(ADR-010 D5)과 SSE 와이어 파싱은 책임이 달라 별 모듈로 분리 (ADR-011 D8).
- **응답은 raw 래핑으로 반환** — `apiFetch`는 `{ data, meta? }` 자체를 zod로 검증한 뒤 그대로 반환. unwrap은 `recipes.ts`의 각 함수가 수행 (`wrapped.data` 추출). 단, `listRecipes`는 `meta.pageSize` 신뢰가 필요해 raw `{ data, meta }` 그대로 반환 (ADR-010 D5).
- **401 재시도 1회만** — `apiFetchInternal`의 `allowRetry: boolean` 플래그가 재귀 깊이 1을 강제. `refreshTossUserId` 미제공 시 재시도하지 않고 `ApiClientError('UNAUTHORIZED', ...)` throw (05 §5.4, ADR-010 D3).
- **에러 분기는 `error.code` 기반** — `ApiClientError.error.code: ApiErrorCode`로 분기. HTTP 상태로 분기 금지 (03 §3.10 단언 #2).
- **`X-Toss-User-Id` 헤더는 `init.tossUserId`가 truthy일 때만 부착** — 공개 엔드포인트(`POST /generate`)는 헤더 없이 호출 가능 (03 §3.1.3, 03 §3.2.1).
- **Toss SDK 직접 import 금지** — 본 디렉터리는 SDK를 직접 의존하지 않는다. recipes.ts의 보호 5 함수는 `auth: AuthedCallOptions = { tossUserId, refreshTossUserId? }`를 받아 hook 반환값을 주입받는다 (DIP, ADR-010 D4).
- **비스트리밍 `generateRecipe`는 `stream: false` 강제** — `recipes.ts:generateRecipe`가 내부적으로 `{ ...req, stream: false }`. SSE는 `generateRecipeStream` Facade → `sse-client.ts:streamRecipe` 위임 (ADR-011 D8).
- **`AbortController.signal`은 `init.signal` 옵션으로 전달** — Phase 2 추가. apiFetch/streamRecipe 모두 수용. unmount cleanup·명시 cancel·타임아웃 모두 abort로 통일 (08 §8.4).
- **SSE 청크 zod 검증 + `error` 청크 → `ApiClientError` throw** — sse-client가 어댑터 측에서 변환. 호출 측(`useRecipeGenerate`)은 `try { for await ... } catch (err)` 한 곳에서 통합 처리 (ADR-011 D10).
- **text 청크 사용자 화면 표시 금지** — sse-client는 yield까지만. 표시 정책은 훅·화면 책임이며 미표시(인디케이터만)가 결정값 (ADR-011 D11, 08 §8.3.5).

## 진입점

- 외부 import 경로: `import { generateRecipe, ApiClientError, ... } from '../services';` (barrel).
- 보호 5 함수 호출 시 `auth.tossUserId`는 `useTossUserId()` 훅의 반환값을 그대로 전달. `auth.refreshTossUserId`는 `refresh` 함수.

## 변경 트리거

- 03 챕터에 새 엔드포인트 추가 → `recipes.ts`에 새 함수 추가, 시그니처는 베이스라인의 `AuthedCallOptions` 패턴 따른다.
- 응답 shape 위반 발견(snake_case·`userId` 누출) → baseline §G #1 트리거 → architect SendMessage → 본 디렉터리 우회 변경 금지.
- 429/5xx 자동 재시도 도입 — Phase 3 이후 ADR로 변경. 본 ADR-010 D3은 1회 한정.

## 비범위 (Phase 3 이후)

- 낙관적 업데이트·로컬 캐시 — Phase 3 (목록·즐겨찾기 화면).
- 429/5xx 자동 재시도 — Phase 3 별 ADR (ADR-010 D3 1회 한정 정책 확장).
- `react-native-sse` 옵션 B 전환 — Granite `Response.body`/`TextDecoder` 미지원 확정 시 ADR-011 R1 트리거 (08 §8.6).
- 단위 테스트(jest + fetch mock) — qa 정적 검증으로 대체. 추가 필요 시 별 ADR.

## 관련 ADR

- [ADR-005](../../docs/adr/ADR-005-ownership-violation-404.md) — `FORBIDDEN` 미분기 결정.
- [ADR-009](../../docs/adr/ADR-009-appsintoss-port-architecture.md) — 백엔드 분리·헤더 인증.
- [ADR-010](../../docs/adr/ADR-010-miniapp-phase1-conventions.md) — D1·D3·D4·D5 본 디렉터리의 Phase 1 핵심 결정.
- [ADR-011](../../docs/adr/ADR-011-miniapp-phase2-streaming-ui.md) — D8(SSE 별 모듈 분리)·D9(AsyncGenerator)·D10(에러 청크 단일 매핑)·D13(AbortSignal cast 2곳 한시 통과). 본 Phase 2 결정.
