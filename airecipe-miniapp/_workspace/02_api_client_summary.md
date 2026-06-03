# 02 — cooking-log api-client 플러밍 요약 (M1·M2·M4·M5)

요리 기록 피드의 백엔드 호출 단일 경로 + 데이터 훅 + 이미지 피커 어댑터 구현 요약.
SSOT: `docs/appsintoss-port/03-API-CONTRACT.md` §3.8b (cooking-logs 4 엔드포인트).

## 커밋

| 태스크 | 커밋 | 내용 |
|--------|------|------|
| M1 | `6374e91` | zod 스키마 + 타입 (TDD) |
| M2 | `07c2abc` | 이미지 피커 격리 어댑터(media) + 정규화 (TDD) |
| M4 | `e41fc3e` | cooking-logs api-client 메서드 4종 |
| M5 | `e7d096e` | 캐시 트리거 + 데이터/뮤테이션 훅 |

## 게이트 결과 (각 태스크 후 실측)

- `pnpm test`: 2 suites / 7 tests PASS (cooking-log.test.ts 4 + normalize.test.ts 3).
- `pnpm typecheck`: PASS (tsc --noEmit, 에러 0).
- `pnpm lint`: 0 errors (router.gen.ts 누적 warning 1건 — 기존, 본 작업 무관).

## 응답 shape 인용 위치 (SSOT)

- `CookingLog` shape: 03 §3.8b.1 — `{ id, photoUrl(presigned), recipe(GeneratedRecipe 스냅샷), rating(1..5), review, createdAt }`. 내부 식별자 비노출.
- 생성 201 `{ data: CookingLog }`: §3.8b.2.
- 목록 200 `{ data: CookingLog[], meta }`: §3.8b.3 (빈 목록도 200).
- 상세 200 `{ data: CookingLog }` / 404 통일: §3.8b.4.
- 삭제 200 `{ data: { id } }` (204 아님): §3.8b.5.
- 에러 4종 카탈로그: §3.8b.6 (400/401/404/500). AI 무관 → 429/502 미발생.

## 재시도/타임아웃 정책

- 401 자동 재시도 1회: `apiFetch` 단일 위치(`src/services/api-client.ts`). 훅은 `refreshTossUserId: refresh` 주입만.
- 네트워크 실패: `apiFetch`가 `INTERNAL_ERROR`로 정규화.
- 타임아웃: 별도 정책 없음(기존 recipes.ts와 동일 — apiFetch 단일 지점에 향후 추가 시 1곳).
- 응답 zod 검증 실패: `apiFetch`가 `INTERNAL_ERROR`("서버 응답 형식이 올바르지 않아요.")로 변환.

---

## 프론트엔드 인계 — 정확한 시그니처·import 경로

### api-client 메서드 (`src/services/cooking-logs.ts`, barrel `src/services`)

```ts
import {
  createCookingLog, listCookingLogs, getCookingLog, deleteCookingLog,
} from '../services'; // 또는 '../services/cooking-logs'

createCookingLog(req: CreateCookingLogRequest, auth: AuthedCallOptions): Promise<CookingLog>
listCookingLogs(query: CookingLogListQuery, auth: AuthedCallOptions): Promise<CookingLogListResponse> // raw { data, meta }
getCookingLog(id: string, auth: AuthedCallOptions): Promise<CookingLog>
deleteCookingLog(id: string, auth: AuthedCallOptions): Promise<{ id: string }>
```
- `AuthedCallOptions` = `{ tossUserId: string; refreshTossUserId?: () => Promise<string> }` (recipes.ts 재사용, `../services`에서 export).
- 프론트는 보통 메서드를 직접 호출하지 않고 아래 훅을 사용.

### 데이터/뮤테이션 훅 (각각 직접 경로 import — hooks barrel 없음)

```ts
// 피드 목록 — src/hooks/useCookingFeed.ts
useCookingFeed(query: CookingLogListQuery)
  → { data: CookingLog[]; meta: ListMeta | null; isLoading: boolean; error: string | null; refetch: () => void }
  // query 변경·캐시 invalidate·refetch() 시 자동 재조회. 빈 목록은 data:[] + 정상.

// 생성 — src/hooks/useCreateCookingLog.ts
useCreateCookingLog()
  → { isSaving: boolean; error: string | null;
      create: (req: CreateCookingLogRequest) => Promise<CookingLog | null>;  // 성공 시 저장본 반환 + invalidate, 실패 null
      reset: () => void }

// 삭제 — src/hooks/useDeleteCookingLog.ts  (id는 훅 인자 — useDeleteRecipe 동일)
useDeleteCookingLog(id: string)
  → { remove: () => Promise<boolean>;  // true: 성공·404 정규화(navigate), false: 실패(error 노출)
      isPending: boolean; error: string | null; reset: () => void }

// 상세 — src/hooks/useCookingLogDetail.ts
useCookingLogDetail(id: string | undefined)
  → { data: CookingLog | null; isLoading: boolean; notFound: boolean; error: string | null; refetch: () => void }
  // notFound=true → NotFoundScreen 분기(ADR-005 통일). error는 그 외 에러 한국어 메시지.
```

- `tossUserId`/`refresh`는 훅 내부에서 `useTossUserId()`로 획득 — 프론트는 전달 불필요.
- 모든 훅은 `CookingLogCacheProvider`(이미 `_app.tsx`에 래핑됨) 하위에서만 사용 가능.

### 이미지 피커 어댑터 (`src/lib/media`)

```ts
import { media, type PickedImage } from '../lib/media';

media.isSupported(): boolean
media.pickFromAlbum(): Promise<PickedImage | null>   // null = 취소·미지원
media.pickFromCamera(): Promise<PickedImage | null>

PickedImage = { dataUri: string /* "data:image/jpeg;base64,..." */; mimeType: string /* "image/jpeg" */ }
```
- `local` 환경(또는 브리지 미지원) → noop(항상 null·isSupported false).
- `PickedImage.dataUri`/`mimeType`을 그대로 `CreateCookingLogRequest.image`/`mimeType`에 매핑.

### 타입 (`src/types/cooking-log.ts`, `src/types/api` re-export)

```ts
import type {
  CookingLog, CreateCookingLogRequest, CookingLogListQuery,
} from '../types/cooking-log';
// 또는 ../types/api 에서: CookingLog, CookingLogListQuery, CreateCookingLogRequest,
//   CreateCookingLogResponse, CookingLogListResponse, GetCookingLogResponse, DeleteCookingLogResponse
```

---

## 계획 대비 조정 (파일:이유)

1. **`src/types/cooking-log.ts`의 `GeneratedRecipe` import 경로**: 계획은 `'./api'` 제안 — 실제는 `'./recipe'`(recipes.ts·types/api.ts 모두 `../types/recipe`에서 import). recipe.ts로 정렬.
2. **훅의 `toUserMessage`**: 계획은 `./toUserMessage` 공용 유틸 import 제안 — 실제 공용 유틸 없음. 기존 모든 훅(useMyRecipes 등)이 `ERROR_CODE_MESSAGES` + `toUserMessage`를 **로컬 복제**. 동일하게 로컬 복제(범위 밖 공용 추출 금지). NOT_FOUND 메시지만 "레시피" → "기록"으로 cooking-log 맥락에 맞춤.
3. **훅의 service/ApiClientError import**: 계획은 `../services/cooking-logs`·`../services/api-client` 직접 — 실제 기존 훅은 모두 `../services` barrel 경유. barrel(`src/services/index.ts`)에 cooking-logs 4종 추가 후 동일 패턴으로 import.
4. **`useDeleteCookingLog` 시그니처**: 계획 예시는 `remove(id)` — 실제 useDeleteRecipe는 `id`를 훅 인자로 받고 `remove()`(무인자) 반환. useDeleteRecipe 정확 미러(id 훅 인자 + 404 성공 정규화 + `{ remove, isPending, error, reset }`).
5. **`useCookingFeed` refetch 구현**: 계획의 `tick` state를 기존 useMyRecipes의 `refetchTick` 네이밍으로 통일(동일 의미).
6. **`@jest/globals` devDependency 추가**: 저장소 첫 jest 테스트 파일이라 tsc가 `@jest/globals`(pnpm store에는 있으나 미호이스팅)를 해석 못 함 → `pnpm add -D @jest/globals@29.7.0`로 명시 의존성 등록. typecheck 통과 위한 최소 조정. (M1 커밋에 포함.)

## 불변식 준수 확인

- 백엔드 호출은 `apiFetch`만 통과 (직접 fetch 0건 — cooking-logs.ts는 apiFetch 위임).
- 응답은 zod 검증(`cookingLogSchema` 재사용 — `generatedRecipeSchema` 포함).
- 에러 메시지 한국어 (ApiErrorCode 8종 매핑).
- `X-Toss-User-Id`는 useTossUserId·apiFetch 내부에서만 — UI/로깅 노출 0.
- SDK 직접 import는 `media/adapter.appsintoss.ts` 1곳만 (`grep` 검증).
- 화면 파일(pages/, 컴포넌트) 무변경 — 다음 프론트엔드 에이전트 담당.
