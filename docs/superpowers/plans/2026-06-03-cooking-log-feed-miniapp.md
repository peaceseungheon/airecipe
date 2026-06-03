# 요리 기록 피드 — 미니앱 구현 계획 (Plan 2/2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **이 프로젝트의 실행 경로:** 미니앱은 자체 오케스트레이터(`miniapp-orchestrator` + `miniapp-architect`/`miniapp-api-client`/`miniapp-frontend`/`miniapp-qa`)를 가진다. 그 팀으로 실행해도 되고 superpowers 서브에이전트로 실행해도 된다. **태스크 단위 + 태스크 사이 QA**를 지킨다.

**선행 조건:** Plan 1(백엔드)이 완료되어 `airecipe-miniapp/docs/appsintoss-port/03-API-CONTRACT.md`에 cooking-logs 4종 계약이 반영돼 있어야 한다(api-client의 SSOT).

**Goal:** 미니앱 메인(홈)을 내 요리 기록 피드로 전환하고, 3탭 [피드·레시피·마이]로 재편하며, 사진 업로드(앱인토스 브리지) + 백엔드 호출(api-client/zod/hooks)로 기록 생성/목록/상세/삭제를 구현한다.

**Architecture:** 백엔드 호출은 기존 단일 경로(`apiFetch`)만 통과한다. 앱인토스 이미지 브리지(`AppsInToss.fetchAlbumPhotos`/`openCamera`)는 기존 광고 어댑터(ADR-014)와 동일한 **격리 어댑터**(`src/lib/media/`)로 감싼다(브리지가 `.d.ts`에 없어 로컬 타입 선언 필요). UI는 TDS 우선(`EditableRating`/`ReadOnlyRating` 실재 확인됨). 라우팅은 Granite 파일 라우팅 + `router.gen.ts` 수동 등록(ADR-018).

**Tech Stack:** React Native 0.84 + `@granite-js/react-native` + `@toss/tds-react-native` + `@apps-in-toss/framework@2.6.0` + zod. 검증: `pnpm typecheck`(tsc) + `pnpm lint`(eslint) + `pnpm test`(jest, 순수 로직만) + QA 경계면 매트릭스.

**SSOT:** 설계 스펙 §7(미니앱 아키텍처)·§8(업로드 흐름) + `docs/appsintoss-port/03-API-CONTRACT.md`(계약)·`06-UI-MAPPING`·`07-ROUTING`·`09-ENV-CONFIG`.

**기준 디렉토리:** 모든 경로는 `airecipe-miniapp/` 하위.

---

## File Structure (생성/수정 맵)

**생성:**
- `src/lib/zod/cooking-log.ts` — 요청/응답 zod 스키마.
- `src/types/cooking-log.ts` — 도메인/요청/응답 타입.
- `src/lib/media/types.ts` · `adapter.appsintoss.ts` · `adapter.noop.ts` · `index.ts` — 이미지 피커 격리 어댑터.
- `src/services/cooking-logs.ts` — api-client 메서드 4종.
- `src/hooks/useCookingFeed.ts` · `useCreateCookingLog.ts` · `useDeleteCookingLog.ts` · `useCookingLogDetail.ts`.
- `src/hooks/useCookingLogCache.tsx` — 피드 캐시 무효화 트리거(useRecipeCache 미러).
- `src/components/CookingLogCard.tsx` · `FeedEmptyState.tsx` · `PhotoPickerButton.tsx` · `StarRatingInput.tsx` · `RecipeSnapshotPicker.tsx` · `CookingLogForm.tsx`.
- `pages/recipe/index.tsx` — 레시피 탭 랜딩(기존 홈 콘텐츠 이전).
- `pages/cooking-log/new.tsx` — 업로드 폼.
- `pages/cooking-log/[id].tsx` — 기록 상세.

**수정:**
- `src/lib/zod/index.ts` — re-export 추가.
- `src/types/api.ts` — 요청/응답 타입 re-export.
- `src/components/BottomTabBar.tsx` — 2탭 → 3탭(feed/recipe/my).
- `pages/index.tsx` — 생성 폼 제거 → 피드.
- `pages/my-recipes.tsx` · `pages/recipe/generate.tsx` · `pages/recipe/recommend.tsx` · `pages/recipe/[id].tsx` · `pages/_404.tsx` · `pages/terms.tsx` · `pages/privacy.tsx` — `BottomTabBar active` prop 갱신.
- `pages/recipe/generate.tsx` — 생성 완료 후 "이 레시피로 기록 남기기" 진입 추가.
- `src/router.gen.ts` — 신규 3 라우트 수동 등록.
- `src/_app.tsx` — `CookingLogCacheProvider` 래핑.
- `granite.config.ts` — photos/camera 권한 선언.
- 문서: `docs/adr/ADR-021-cooking-log-feed.md`(신규) + `06-UI-MAPPING`·`07-ROUTING`·`09-ENV-CONFIG` + `pages/privacy.tsx`(사진 저장 고지 1줄) + `pages/AGENTS.md`·`src/components/AGENTS.md`·`src/lib/AGENTS.md`·`src/hooks/AGENTS.md`.

---

## Task M1: zod 스키마 + 타입 (TDD)

**Files:**
- Create: `src/lib/zod/cooking-log.ts`
- Create: `src/types/cooking-log.ts`
- Modify: `src/lib/zod/index.ts`, `src/types/api.ts`
- Test: `src/lib/zod/cooking-log.test.ts`

- [ ] **Step 1: 실패하는 스키마 테스트 작성**

Create `src/lib/zod/cooking-log.test.ts`:
```ts
import { describe, expect, it } from '@jest/globals';
import { cookingLogSchema, createCookingLogRequestSchema } from './cooking-log';

const recipe = {
  dishName: '김치찌개', description: 'd', servings: 2, cookTimeMinutes: 30,
  difficulty: 'easy', ingredients: [{ name: '김치', quantity: 200, unit: 'g' }],
  steps: [{ order: 1, instruction: '끓인다' }], tips: [],
  nutrition: { calories: 1, carbohydrates: 1, protein: 1, fat: 1, fiber: 1, healthNote: 'n' },
};

describe('cookingLogSchema', () => {
  it('정상 응답을 파싱한다', () => {
    const ok = cookingLogSchema.parse({
      id: 'x', photoUrl: 'https://s/x', recipe, rating: 5, review: '맛',
      createdAt: '2026-06-03T00:00:00.000Z',
    });
    expect(ok.rating).toBe(5);
  });
  it('rating 범위를 벗어나면 거부', () => {
    expect(() => cookingLogSchema.parse({
      id: 'x', photoUrl: 'https://s/x', recipe, rating: 9, review: '맛', createdAt: 'x',
    })).toThrow();
  });
});

describe('createCookingLogRequestSchema', () => {
  it('요청 형식을 검증한다', () => {
    const ok = createCookingLogRequestSchema.parse({
      image: 'data:image/jpeg;base64,AAA', mimeType: 'image/jpeg',
      recipe, sourceRecipeId: null, rating: 4, review: '좋아요',
    });
    expect(ok.review).toBe('좋아요');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd airecipe-miniapp && pnpm test src/lib/zod/cooking-log.test.ts`
Expected: FAIL — 모듈 미존재.

- [ ] **Step 3: 스키마 작성** (기존 `generatedRecipeSchema` 재사용)

Create `src/lib/zod/cooking-log.ts`:
```ts
import { z } from 'zod';
import { generatedRecipeSchema } from './recipe';

export const cookingLogSchema = z.object({
  id: z.string(),
  photoUrl: z.string(),
  recipe: generatedRecipeSchema,
  rating: z.number().int().min(1).max(5),
  review: z.string(),
  createdAt: z.string(),
});

export const createCookingLogRequestSchema = z.object({
  image: z.string().regex(/^data:image\//),
  mimeType: z.string().regex(/^image\//),
  recipe: generatedRecipeSchema,
  sourceRecipeId: z.string().nullable().optional(),
  rating: z.number().int().min(1).max(5),
  review: z.string().trim().min(1).max(1000),
});

export type CookingLogSchema = z.infer<typeof cookingLogSchema>;
export type CreateCookingLogRequestSchema = z.infer<typeof createCookingLogRequestSchema>;
```
> `generatedRecipeSchema`의 정확한 export 경로(`./recipe`)는 survey 기준. 다르면 실제 경로로 맞춘다.

- [ ] **Step 4: 도메인/요청 타입 작성**

Create `src/types/cooking-log.ts`:
```ts
import type { GeneratedRecipe } from './api'; // 또는 GeneratedRecipe 가 정의된 실제 위치

export interface CookingLog {
  id: string;
  photoUrl: string;
  recipe: GeneratedRecipe;
  rating: number;
  review: string;
  createdAt: string;
}

export interface CreateCookingLogRequest {
  image: string;
  mimeType: string;
  recipe: GeneratedRecipe;
  sourceRecipeId?: string | null;
  rating: number;
  review: string;
}

export interface CookingLogListQuery {
  page?: number;
  pageSize?: number;
}
```
> `GeneratedRecipe` import 경로는 기존 정의 위치(`src/types/api.ts` 또는 `src/types/recipe.ts`)에 맞춘다 — survey의 `recipes.ts`가 import하는 경로를 그대로 사용.

- [ ] **Step 5: re-export 추가**

`src/lib/zod/index.ts`에 `export * from './cooking-log';` 추가.
`src/types/api.ts`에 (기존 패턴 따라) cooking-log 응답 타입 alias 추가:
```ts
import type { CookingLog } from './cooking-log';
export type CookingLogListResponse = ApiListResponse<CookingLog>;
```

- [ ] **Step 6: 통과 + 타입 확인**

Run: `cd airecipe-miniapp && pnpm test src/lib/zod/cooking-log.test.ts && pnpm typecheck`
Expected: PASS + 타입 통과.

- [ ] **Step 7: Commit**
```bash
git add airecipe-miniapp/src/lib/zod/cooking-log.ts airecipe-miniapp/src/lib/zod/cooking-log.test.ts airecipe-miniapp/src/lib/zod/index.ts airecipe-miniapp/src/types/cooking-log.ts airecipe-miniapp/src/types/api.ts
git commit -m "feat(miniapp): cooking-log zod 스키마 + 타입 (TDD)"
```

---

## Task M2: 이미지 피커 격리 어댑터 (TDD: 순수 정규화)

`AppsInToss.fetchAlbumPhotos`/`openCamera`를 단일 모듈로 격리. 브리지는 `.d.ts` 미선언 → 로컬 타입.

**Files:**
- Create: `src/lib/media/types.ts`, `src/lib/media/normalize.ts`, `src/lib/media/adapter.appsintoss.ts`, `src/lib/media/adapter.noop.ts`, `src/lib/media/index.ts`
- Test: `src/lib/media/normalize.test.ts`

- [ ] **Step 1: 브리지 실재/시그니처 재확인** (실재성 게이트)

Run:
```bash
cd airecipe-miniapp && grep -nE "fetchAlbumPhotos|openCamera" node_modules/@apps-in-toss/framework/dist/index.js | head
```
Expected: `AppsInToss = { ... fetchAlbumPhotos: ..., openCamera: ... }` 형태 확인. 접근 경로가 `AppsInToss.fetchAlbumPhotos`임을 확정(named export 아님). 반환 형태(`{ id, dataUri }`)는 디바이스 실증 PENDING로 둔다.

- [ ] **Step 2: 인터페이스 + 순수 정규화 작성**

Create `src/lib/media/types.ts`:
```ts
export interface PickedImage {
  dataUri: string;  // "data:image/jpeg;base64,..."
  mimeType: string; // "image/jpeg"
}

export interface MediaAdapter {
  isSupported(): boolean;
  pickFromAlbum(): Promise<PickedImage | null>;
  pickFromCamera(): Promise<PickedImage | null>;
}
```

Create `src/lib/media/normalize.ts`:
```ts
import type { PickedImage } from './types';

/**
 * 브리지 반환(dataUri 또는 raw base64)을 표준 PickedImage로 정규화.
 * - 이미 data URI면 그대로 + mime 파싱.
 * - raw base64로 추정되면 jpeg로 가정해 prefix.
 */
export function normalizePicked(raw: string | null | undefined): PickedImage | null {
  if (!raw) return null;
  if (raw.startsWith('data:')) {
    const mime = /^data:([^;]+);/.exec(raw)?.[1] ?? 'image/jpeg';
    return { dataUri: raw, mimeType: mime };
  }
  return { dataUri: `data:image/jpeg;base64,${raw}`, mimeType: 'image/jpeg' };
}
```

- [ ] **Step 3: 실패하는 정규화 테스트**

Create `src/lib/media/normalize.test.ts`:
```ts
import { describe, expect, it } from '@jest/globals';
import { normalizePicked } from './normalize';

describe('normalizePicked', () => {
  it('data URI는 그대로 + mime 파싱', () => {
    expect(normalizePicked('data:image/png;base64,QQ==')).toEqual({
      dataUri: 'data:image/png;base64,QQ==', mimeType: 'image/png',
    });
  });
  it('raw base64는 jpeg로 prefix', () => {
    expect(normalizePicked('QUJD')).toEqual({
      dataUri: 'data:image/jpeg;base64,QUJD', mimeType: 'image/jpeg',
    });
  });
  it('빈 값은 null', () => {
    expect(normalizePicked(null)).toBeNull();
    expect(normalizePicked('')).toBeNull();
  });
});
```

Run: `cd airecipe-miniapp && pnpm test src/lib/media/normalize.test.ts`
Expected: PASS (normalize.ts 이미 작성됨).

- [ ] **Step 4: 앱인토스 어댑터 작성** (SDK 접근 단일 위치 + 로컬 타입)

Create `src/lib/media/adapter.appsintoss.ts`:
```ts
import { AppsInToss } from '@apps-in-toss/framework';
import type { MediaAdapter, PickedImage } from './types';
import { normalizePicked } from './normalize';

// 브리지가 .d.ts에 없어 로컬 선언(런타임 실재 — index.js 확인). 디바이스 실증 PENDING.
interface ImageBridgeResult { id?: string; dataUri?: string }
interface MediaBridges {
  fetchAlbumPhotos?: (opts: {
    maxCount?: number; maxWidth?: number; base64?: boolean;
  }) => Promise<ImageBridgeResult[] | ImageBridgeResult>;
  openCamera?: (opts: { maxWidth?: number; base64?: boolean }) => Promise<ImageBridgeResult>;
}

const bridges = AppsInToss as unknown as MediaBridges;

function firstResult(r: ImageBridgeResult[] | ImageBridgeResult): ImageBridgeResult | null {
  if (Array.isArray(r)) return r[0] ?? null;
  return r ?? null;
}

export function createAppsInTossMediaAdapter(): MediaAdapter {
  return {
    isSupported: () => typeof bridges.fetchAlbumPhotos === 'function',
    pickFromAlbum: async (): Promise<PickedImage | null> => {
      if (typeof bridges.fetchAlbumPhotos !== 'function') return null;
      const res = await bridges.fetchAlbumPhotos({ maxCount: 1, maxWidth: 1024, base64: false });
      return normalizePicked(firstResult(res)?.dataUri);
    },
    pickFromCamera: async (): Promise<PickedImage | null> => {
      if (typeof bridges.openCamera !== 'function') return null;
      const res = await bridges.openCamera({ maxWidth: 1024, base64: false });
      return normalizePicked(res?.dataUri);
    },
  };
}
```

- [ ] **Step 5: noop 어댑터 + 환경 분기 작성**

Create `src/lib/media/adapter.noop.ts`:
```ts
import type { MediaAdapter } from './types';

// 로컬/미지원 환경 placeholder — 실제 선택 불가, null 반환.
export const noopMediaAdapter: MediaAdapter = {
  isSupported: () => false,
  pickFromAlbum: async () => null,
  pickFromCamera: async () => null,
};
```

Create `src/lib/media/index.ts`:
```ts
import type { MediaAdapter } from './types';
import { noopMediaAdapter } from './adapter.noop';
import { createAppsInTossMediaAdapter } from './adapter.appsintoss';

function selectAdapter(): MediaAdapter {
  if (import.meta.env.APP_ENV === 'local') return noopMediaAdapter;
  const adapter = createAppsInTossMediaAdapter();
  return adapter.isSupported() ? adapter : noopMediaAdapter;
}

export const media: MediaAdapter = selectAdapter();
export type { MediaAdapter, PickedImage } from './types';
```

- [ ] **Step 6: 타입/린트 확인**

Run: `cd airecipe-miniapp && pnpm typecheck && pnpm lint`
Expected: 통과. (SDK 직접 import는 `adapter.appsintoss.ts` 1곳만 — 광고 어댑터 규약 동일.)

- [ ] **Step 7: Commit**
```bash
git add airecipe-miniapp/src/lib/media
git commit -m "feat(miniapp): 이미지 피커 격리 어댑터(media) + 정규화 (TDD)"
```

---

## Task M3: granite.config 권한 선언

**Files:**
- Modify: `granite.config.ts`

- [ ] **Step 1: 권한 스키마 확인** (실재성)

Run:
```bash
cd airecipe-miniapp && grep -rnE "permissions|PermissionName|access" node_modules/@apps-in-toss/framework/dist/plugins/*.d.ts 2>/dev/null | head
```
Expected: `appsInToss` 플러그인의 `permissions` 필드 형태 확인(객체 `{ name, access }` 배열인지 문자열 배열인지). 아래 Step 2를 실제 타입에 맞춘다.

- [ ] **Step 2: 권한 추가** (가장 유력한 형태 — 확인 결과로 조정)

`granite.config.ts`의 `appsInToss({ ... permissions: [] })`를:
```ts
      permissions: [
        { name: 'photos', access: 'read' },
        { name: 'camera', access: 'access' },
      ],
```
> Step 1 결과가 문자열 배열이면 `permissions: ['photos', 'camera']`로 맞춘다. 타입 통과를 기준으로 확정.

- [ ] **Step 3: 타입 확인**

Run: `cd airecipe-miniapp && pnpm typecheck`
Expected: 통과(권한 형태가 플러그인 타입과 일치).

- [ ] **Step 4: Commit**
```bash
git add airecipe-miniapp/granite.config.ts
git commit -m "feat(miniapp): photos/camera 권한 선언 (cooking-log)"
```

---

## Task M4: api-client 메서드 (cooking-logs)

**Files:**
- Create: `src/services/cooking-logs.ts`

- [ ] **Step 1: 메서드 작성** (recipes.ts 패턴 정확히 미러)

Create `src/services/cooking-logs.ts`:
```ts
import { apiFetch } from './api-client';
import { apiResponseSchema, apiListResponseSchema } from '../lib/zod/api';
import { cookingLogSchema } from '../lib/zod/cooking-log';
import type { AuthedCallOptions } from './recipes'; // 기존 정의 재사용(없으면 동일 타입 로컬 선언)
import type {
  CookingLog, CreateCookingLogRequest, CookingLogListQuery,
} from '../types/cooking-log';
import type { ApiListResponse } from '../types/api';

export async function createCookingLog(
  req: CreateCookingLogRequest,
  auth: AuthedCallOptions,
): Promise<CookingLog> {
  const wrapped = await apiFetch('/api/cooking-logs', apiResponseSchema(cookingLogSchema), {
    method: 'POST',
    body: req,
    tossUserId: auth.tossUserId,
    refreshTossUserId: auth.refreshTossUserId,
  });
  return wrapped.data;
}

export async function listCookingLogs(
  query: CookingLogListQuery,
  auth: AuthedCallOptions,
): Promise<ApiListResponse<CookingLog>> {
  return apiFetch('/api/cooking-logs', apiListResponseSchema(cookingLogSchema), {
    method: 'GET',
    query: { page: query.page, pageSize: query.pageSize },
    tossUserId: auth.tossUserId,
    refreshTossUserId: auth.refreshTossUserId,
  });
}

export async function getCookingLog(
  id: string,
  auth: AuthedCallOptions,
): Promise<CookingLog> {
  const wrapped = await apiFetch(`/api/cooking-logs/${id}`, apiResponseSchema(cookingLogSchema), {
    method: 'GET',
    tossUserId: auth.tossUserId,
    refreshTossUserId: auth.refreshTossUserId,
  });
  return wrapped.data;
}

export async function deleteCookingLog(
  id: string,
  auth: AuthedCallOptions,
): Promise<{ id: string }> {
  const wrapped = await apiFetch(
    `/api/cooking-logs/${id}`,
    apiResponseSchema(/* { id } */ (await import('zod')).z.object({ id: z.string() })),
    { method: 'DELETE', tossUserId: auth.tossUserId, refreshTossUserId: auth.refreshTossUserId },
  );
  return wrapped.data;
}
```
> **정리:** `deleteCookingLog`의 인라인 zod는 보기 나쁘다 — 파일 상단에 `import { z } from 'zod';` 추가하고 `const deleteResponseSchema = z.object({ id: z.string() });`를 모듈 상수로 정의해 사용한다. (recipes.ts의 delete 메서드가 어떤 스키마를 쓰는지 확인해 동일 패턴으로 맞춘다.)

- [ ] **Step 2: 타입/린트 확인**

Run: `cd airecipe-miniapp && pnpm typecheck && pnpm lint`
Expected: 통과. `apiFetch`/`apiResponseSchema`/`apiListResponseSchema`/`AuthedCallOptions` 경로가 recipes.ts와 동일한지 확인.

- [ ] **Step 3: Commit**
```bash
git add airecipe-miniapp/src/services/cooking-logs.ts
git commit -m "feat(miniapp): cooking-logs api-client 메서드 4종"
```

---

## Task M5: 캐시 트리거 + 데이터 훅

**Files:**
- Create: `src/hooks/useCookingLogCache.tsx`, `src/hooks/useCookingFeed.ts`, `src/hooks/useCreateCookingLog.ts`, `src/hooks/useDeleteCookingLog.ts`, `src/hooks/useCookingLogDetail.ts`
- Modify: `src/_app.tsx`

- [ ] **Step 1: 캐시 프로바이더 작성** (useRecipeCache.tsx 미러)

Create `src/hooks/useCookingLogCache.tsx`:
```tsx
import React, { createContext, useCallback, useContext, useState, type PropsWithChildren } from 'react';

interface CookingLogCacheValue { trigger: number; invalidate: () => void }
const Ctx = createContext<CookingLogCacheValue | null>(null);

export function CookingLogCacheProvider({ children }: PropsWithChildren) {
  const [trigger, setTrigger] = useState(0);
  const invalidate = useCallback(() => setTrigger((n) => n + 1), []);
  return <Ctx.Provider value={{ trigger, invalidate }}>{children}</Ctx.Provider>;
}

export function useCookingLogCacheTrigger(): CookingLogCacheValue {
  const ctx = useContext(Ctx);
  if (ctx === null) throw new Error('useCookingLogCacheTrigger must be used within <CookingLogCacheProvider>');
  return ctx;
}
```

- [ ] **Step 2: _app.tsx 에 프로바이더 래핑**

`src/_app.tsx`에서 `RecipeCacheProvider` 안쪽(또는 형제)에 `CookingLogCacheProvider`를 추가해 전 화면이 트리거에 접근:
```tsx
<TossUserIdProvider>
  <RecipeCacheProvider>
    <CookingLogCacheProvider>
      {children /* 또는 기존 라우터 트리 */}
    </CookingLogCacheProvider>
  </RecipeCacheProvider>
</TossUserIdProvider>
```
> 실제 `_app.tsx`의 중첩 구조를 열어 동일 위치에 삽입.

- [ ] **Step 3: 피드 목록 훅 작성** (useMyRecipes 미러)

Create `src/hooks/useCookingFeed.ts`:
```ts
import { useEffect, useRef, useState } from 'react';
import { listCookingLogs } from '../services/cooking-logs';
import { useTossUserId } from './useTossUserId';
import { useCookingLogCacheTrigger } from './useCookingLogCache';
import { toUserMessage } from './toUserMessage'; // useMyRecipes가 쓰는 동일 유틸 경로로 맞춤
import type { CookingLog, CookingLogListQuery } from '../types/cooking-log';
import type { ListMeta } from '../types/api';

interface State { data: CookingLog[]; meta: ListMeta | null; isLoading: boolean; error: string | null }
const INITIAL: State = { data: [], meta: null, isLoading: true, error: null };

export function useCookingFeed(query: CookingLogListQuery) {
  const { tossUserId, refresh } = useTossUserId();
  const { trigger } = useCookingLogCacheTrigger();
  const [state, setState] = useState<State>(INITIAL);
  const [tick, setTick] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (tossUserId === undefined) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    let cancelled = false;
    setState((p) => ({ ...p, isLoading: true, error: null }));
    (async () => {
      try {
        const res = await listCookingLogs(query, { tossUserId, refreshTossUserId: refresh });
        if (cancelled || controller.signal.aborted) return;
        setState({ data: res.data, meta: res.meta, isLoading: false, error: null });
      } catch (err) {
        if (cancelled || controller.signal.aborted) return;
        setState((p) => ({ ...p, isLoading: false, error: toUserMessage(err) }));
      }
    })();
    return () => { cancelled = true; controller.abort(); };
  }, [query.page, query.pageSize, tossUserId, refresh, trigger, tick]);

  return { ...state, refetch: () => setTick((n) => n + 1) };
}
```
> `toUserMessage`의 실제 위치/이름을 `useMyRecipes.ts`에서 확인해 동일하게 import. 없으면 useMyRecipes 내부의 에러 매핑을 공용 유틸로 추출하지 말고(범위 밖) 동일 매핑을 로컬 복제.

- [ ] **Step 4: 생성 훅 작성** (useSaveRecipe 미러)

Create `src/hooks/useCreateCookingLog.ts`:
```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { createCookingLog } from '../services/cooking-logs';
import { useTossUserId } from './useTossUserId';
import { useCookingLogCacheTrigger } from './useCookingLogCache';
import { toUserMessage } from './toUserMessage';
import type { CookingLog, CreateCookingLogRequest } from '../types/cooking-log';

export function useCreateCookingLog() {
  const { tossUserId, refresh } = useTossUserId();
  const { invalidate } = useCookingLogCacheTrigger();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => { cancelledRef.current = true; abortRef.current?.abort(); };
  }, []);

  const create = useCallback(async (req: CreateCookingLogRequest): Promise<CookingLog | null> => {
    if (tossUserId === undefined) { setError('로그인이 필요해요. 잠시 후 다시 시도해 주세요.'); return null; }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setIsSaving(true); setError(null);
    try {
      const saved = await createCookingLog(req, { tossUserId, refreshTossUserId: refresh });
      if (cancelledRef.current) return null;
      invalidate(); setIsSaving(false); return saved;
    } catch (err) {
      if (cancelledRef.current) return null;
      setError(toUserMessage(err)); setIsSaving(false); return null;
    }
  }, [tossUserId, refresh, invalidate]);

  return { isSaving, error, create };
}
```

- [ ] **Step 5: 삭제 훅 + 상세 훅 작성** (useDeleteRecipe / useRecipeDetail 미러)

Create `src/hooks/useDeleteCookingLog.ts`:
```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteCookingLog } from '../services/cooking-logs';
import { useTossUserId } from './useTossUserId';
import { useCookingLogCacheTrigger } from './useCookingLogCache';
import { toUserMessage } from './toUserMessage';

export function useDeleteCookingLog() {
  const { tossUserId, refresh } = useTossUserId();
  const { invalidate } = useCookingLogCacheTrigger();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  useEffect(() => { cancelledRef.current = false; return () => { cancelledRef.current = true; }; }, []);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    if (tossUserId === undefined) { setError('로그인이 필요해요. 잠시 후 다시 시도해 주세요.'); return false; }
    setIsDeleting(true); setError(null);
    try {
      await deleteCookingLog(id, { tossUserId, refreshTossUserId: refresh });
      if (cancelledRef.current) return false;
      invalidate(); setIsDeleting(false); return true;
    } catch (err) {
      if (cancelledRef.current) return false;
      setError(toUserMessage(err)); setIsDeleting(false); return false;
    }
  }, [tossUserId, refresh, invalidate]);

  return { isDeleting, error, remove };
}
```

Create `src/hooks/useCookingLogDetail.ts`:
```ts
import { useEffect, useRef, useState } from 'react';
import { getCookingLog } from '../services/cooking-logs';
import { useTossUserId } from './useTossUserId';
import { toUserMessage } from './toUserMessage';
import { ApiClientError } from '../services/api-client';
import type { CookingLog } from '../types/cooking-log';

interface State { data: CookingLog | null; isLoading: boolean; notFound: boolean; error: string | null }
const INITIAL: State = { data: null, isLoading: true, notFound: false, error: null };

export function useCookingLogDetail(id: string | undefined) {
  const { tossUserId, refresh } = useTossUserId();
  const [state, setState] = useState<State>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (id === undefined || tossUserId === undefined) return;
    abortRef.current?.abort();
    const controller = new AbortController(); abortRef.current = controller;
    let cancelled = false;
    setState({ ...INITIAL });
    (async () => {
      try {
        const data = await getCookingLog(id, { tossUserId, refreshTossUserId: refresh });
        if (cancelled || controller.signal.aborted) return;
        setState({ data, isLoading: false, notFound: false, error: null });
      } catch (err) {
        if (cancelled || controller.signal.aborted) return;
        const notFound = err instanceof ApiClientError && err.error.code === 'NOT_FOUND';
        setState({ data: null, isLoading: false, notFound, error: notFound ? null : toUserMessage(err) });
      }
    })();
    return () => { cancelled = true; controller.abort(); };
  }, [id, tossUserId, refresh]);
  return state;
}
```
> `ApiClientError`의 실제 에러 코드 접근(`err.error.code` vs `err.code`)을 `api-client.ts`에서 확인해 정확히 맞춘다(survey: `error: ApiError['error']` 필드).

- [ ] **Step 6: 타입/린트 확인**

Run: `cd airecipe-miniapp && pnpm typecheck && pnpm lint`
Expected: 통과.

- [ ] **Step 7: Commit**
```bash
git add airecipe-miniapp/src/hooks/useCookingLogCache.tsx airecipe-miniapp/src/hooks/useCookingFeed.ts airecipe-miniapp/src/hooks/useCreateCookingLog.ts airecipe-miniapp/src/hooks/useDeleteCookingLog.ts airecipe-miniapp/src/hooks/useCookingLogDetail.ts airecipe-miniapp/src/_app.tsx
git commit -m "feat(miniapp): cooking-log 캐시 트리거 + 데이터/뮤테이션 훅"
```

---

## Task M6: BottomTabBar 3탭 재편

**Files:**
- Modify: `src/components/BottomTabBar.tsx`

- [ ] **Step 1: TabKey/TABS/path 타입 확장**

`src/components/BottomTabBar.tsx`:
```ts
export type TabKey = 'feed' | 'recipe' | 'my';

type TabPath = '/' | '/recipe' | '/my-recipes';

const TABS: { key: TabKey; label: string; path: TabPath }[] = [
  { key: 'feed', label: '피드', path: '/' },
  { key: 'recipe', label: '레시피', path: '/recipe' },
  { key: 'my', label: '마이 레시피', path: '/my-recipes' },
];
```
`handlePress`의 path 파라미터 타입을 `TabPath`로, `BottomTabBarProps.active`는 `TabKey | 'none'` 유지. 나머지 렌더 로직 불변(D63 'none' 센티넬 그대로).

- [ ] **Step 2: 타입 확인(의도된 에러 노출)**

Run: `cd airecipe-miniapp && pnpm typecheck`
Expected: `pages/index.tsx`(`active="home"`)에서 타입 에러 — `'home'`은 더 이상 유효하지 않음. 이는 다음 태스크에서 모든 화면 active를 갱신하라는 신호. (이 태스크 단독 커밋은 M7과 함께.)

- [ ] **Step 3: 커밋은 M7 종료 후 일괄**(타입이 깨진 중간 상태라 단독 커밋 보류).

---

## Task M7: 홈→피드 전환 + 레시피 탭 신설 + 전 화면 active 갱신

**Files:**
- Create: `pages/recipe/index.tsx`
- Modify: `pages/index.tsx`, `pages/my-recipes.tsx`, `pages/recipe/generate.tsx`, `pages/recipe/recommend.tsx`, `pages/recipe/[id].tsx`, `pages/_404.tsx`, `pages/terms.tsx`, `pages/privacy.tsx`

- [ ] **Step 1: 레시피 탭 랜딩 신설** (기존 홈 콘텐츠 이전)

Create `pages/recipe/index.tsx` — 현재 `pages/index.tsx`의 SearchForm + "오늘의 추천" CTA + 약관 푸터를 그대로 옮기되 라우트는 `/recipe`, 탭은 `active="recipe"`:
```tsx
import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { createRoute, useNavigation } from '@granite-js/react-native';
import { Button, PageNavbar } from '@toss/tds-react-native';
import { BottomTabBar } from '../../src/components/BottomTabBar';
import { SearchForm } from '../../src/components/SearchForm';

export const Route = createRoute('/recipe', { component: RecipeHomePage });

function RecipeHomePage() {
  const navigation = useNavigation();
  const handleSubmit = useCallback(
    (dishName: string, servings: number) => navigation.navigate('/recipe/generate', { dishName, servings }),
    [navigation],
  );
  return (
    <View style={styles.root}>
      <PageNavbar><PageNavbar.Title>레시피</PageNavbar.Title></PageNavbar>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <SearchForm onSubmit={handleSubmit} />
        <Button onPress={() => navigation.navigate('/recipe/recommend', {})}>오늘의 추천 받기</Button>
        {/* 약관/개인정보 푸터: 기존 index.tsx 푸터 블록을 그대로 이전 */}
      </ScrollView>
      <BottomTabBar active="recipe" />
    </View>
  );
}
const styles = StyleSheet.create({ root: { flex: 1 }, scrollContent: { padding: 16, paddingBottom: 24 } });
```
> 기존 `pages/index.tsx`의 import 경로 깊이(`../src/...`)가 한 단계 더 깊어짐(`../../src/...`)에 주의. 약관 푸터 마크업·스타일은 현 index.tsx에서 그대로 복사.

- [ ] **Step 2: 홈을 피드로 전환**

`pages/index.tsx`를 피드 화면으로 교체(목록은 M9의 `CookingLogCard`/`FeedEmptyState` 사용 — 우선 골격 + FAB):
```tsx
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { createRoute, useNavigation } from '@granite-js/react-native';
import { PageNavbar, Txt, colors } from '@toss/tds-react-native';
import { BottomTabBar } from '../src/components/BottomTabBar';
import { useTossUserId } from '../src/hooks/useTossUserId';
import { useCookingFeed } from '../src/hooks/useCookingFeed';
import { CookingLogCard } from '../src/components/CookingLogCard';
import { FeedEmptyState } from '../src/components/FeedEmptyState';

const PAGE_SIZE = 10;
export const Route = createRoute('/', { component: FeedPage });

function FeedPage() {
  const navigation = useNavigation();
  const { tossUserId } = useTossUserId();
  const [page] = useState(1);
  const query = useMemo(() => ({ page, pageSize: PAGE_SIZE }), [page]);
  const { data, isLoading, error } = useCookingFeed(query);

  const goNew = useCallback(() => navigation.navigate('/cooking-log/new', {}), [navigation]);
  const goDetail = useCallback((id: string) => navigation.navigate('/cooking-log/:id', { id }), [navigation]);

  return (
    <View style={styles.root}>
      <PageNavbar><PageNavbar.Title>요리 피드</PageNavbar.Title></PageNavbar>
      {tossUserId === undefined || isLoading ? (
        <View style={styles.center}><Txt typography="st9" color={colors.grey600}>불러오는 중…</Txt></View>
      ) : error ? (
        <View style={styles.center}><Txt typography="st9" color={colors.grey600}>{error}</Txt></View>
      ) : data.length === 0 ? (
        <FeedEmptyState onAction={goNew} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <CookingLogCard log={item} onPress={() => goDetail(item.id)} />}
          contentContainerStyle={styles.listContent}
        />
      )}
      <Pressable style={styles.fab} onPress={goNew} accessibilityRole="button" accessibilityLabel="기록 올리기">
        <Txt typography="t5" color={colors.white}>＋ 올리기</Txt>
      </Pressable>
      <BottomTabBar active="feed" />
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 16, paddingBottom: 96 },
  fab: { position: 'absolute', right: 16, bottom: 72, backgroundColor: colors.orange500, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 24 },
});
```
> FAB는 hex 금지(ADR-015 D39) — `colors.orange500`/`colors.white` 토큰만 사용(위 코드 준수).

- [ ] **Step 3: 전 화면 active prop 갱신**

다음 파일의 `<BottomTabBar active=... />`를 규칙대로 변경:
- `pages/my-recipes.tsx`: `active="my"` (유지 — 변경 없음, 확인만).
- `pages/recipe/generate.tsx`·`recommend.tsx`·`[id].tsx`·`pages/_404.tsx`·`pages/terms.tsx`·`pages/privacy.tsx`: `active="none"` (유지 — 확인).
- 신규 `pages/recipe/index.tsx`: `active="recipe"` (Step 1에서 설정).
- `pages/index.tsx`: `active="feed"` (Step 2에서 설정).
> 즉 깨졌던 곳은 `index.tsx`(home→feed)뿐. 나머지는 'none'/'my'로 이미 유효. typecheck로 잔여 'home' 참조 0 확인.

- [ ] **Step 4: 타입/린트 확인** (M9 컴포넌트 미존재로 import 에러 발생 가능)

Run: `cd airecipe-miniapp && pnpm typecheck`
Expected: `CookingLogCard`/`FeedEmptyState` 미존재 에러만 남음(M9에서 생성). BottomTabBar 'home' 에러는 해소.
> 순서 조정: M9를 먼저 하거나, Step 2의 피드 목록 부분을 임시 placeholder로 두고 M9 후 연결. 권장: **M8·M9를 먼저 만들고 본 Step 2의 import를 마지막에 연결**. 실행자는 M7 Step1/Step3(레시피탭+active) 먼저, M7 Step2(피드 본체)는 M9 직후로 미룬다.

- [ ] **Step 5: Commit** (M6 + M7 Step1/Step3 묶음)
```bash
git add airecipe-miniapp/src/components/BottomTabBar.tsx airecipe-miniapp/pages/recipe/index.tsx airecipe-miniapp/pages/index.tsx airecipe-miniapp/pages/my-recipes.tsx airecipe-miniapp/pages/recipe airecipe-miniapp/pages/_404.tsx airecipe-miniapp/pages/terms.tsx airecipe-miniapp/pages/privacy.tsx
git commit -m "feat(miniapp): 3탭(피드/레시피/마이) 재편 + 홈→피드 + 레시피 탭 신설"
```

---

## Task M8: 업로드 폼 + 컴포넌트

**Files:**
- Create: `src/components/PhotoPickerButton.tsx`, `src/components/StarRatingInput.tsx`, `src/components/RecipeSnapshotPicker.tsx`, `src/components/CookingLogForm.tsx`, `pages/cooking-log/new.tsx`

- [ ] **Step 1: 사진 선택 버튼** (media 어댑터 사용)

Create `src/components/PhotoPickerButton.tsx`:
```tsx
import React, { useCallback } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Button, Txt, colors } from '@toss/tds-react-native';
import { media, type PickedImage } from '../lib/media';

export function PhotoPickerButton({ value, onPick }: { value: PickedImage | null; onPick: (img: PickedImage | null) => void }) {
  const pick = useCallback(async () => {
    const img = await media.pickFromAlbum();
    if (img) onPick(img);
  }, [onPick]);
  return (
    <View style={styles.box}>
      {value ? <Image source={{ uri: value.dataUri }} style={styles.preview} /> : (
        <Txt typography="st9" color={colors.grey500}>요리 사진을 추가해 주세요</Txt>
      )}
      <Button type="light" style="weak" onPress={pick}>{value ? '사진 변경' : '사진 선택'}</Button>
    </View>
  );
}
const styles = StyleSheet.create({
  box: { gap: 8, alignItems: 'center' },
  preview: { width: '100%', height: 200, borderRadius: 12, backgroundColor: colors.grey100 },
});
```
> `media.isSupported()===false`(local/noop)일 때 안내 문구를 추가해도 좋다(범위 최소화로 선택).

- [ ] **Step 2: 별점 입력** (TDS EditableRating 실재 확인됨)

Create `src/components/StarRatingInput.tsx`:
```tsx
import React, { useCallback } from 'react';
import { EditableRating } from '@toss/tds-react-native';

export function StarRatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const handle = useCallback((v: number) => onChange(Math.round(v)), [onChange]);
  return <EditableRating value={value} onValueChange={handle} size="large" max={5} />;
}
```
> 실재 확인: `EditableRating`은 `@toss/tds-react-native` 최상위 named export(`dist/.../rating/EditableRating.d.ts`). props `value/onValueChange/size('medium'|'large'|'big')/max`. typecheck로 import 성공 확인.

- [ ] **Step 3: 레시피 스냅샷 선택** (저장 레시피 목록 + 전달된 레시피)

Create `src/components/RecipeSnapshotPicker.tsx`:
```tsx
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt, colors } from '@toss/tds-react-native';
import { useMyRecipes } from '../hooks/useMyRecipes';
import type { GeneratedRecipe } from '../types/api';

interface Props {
  selected: { recipe: GeneratedRecipe; sourceRecipeId: string | null } | null;
  onSelect: (recipe: GeneratedRecipe, sourceRecipeId: string | null) => void;
}

export function RecipeSnapshotPicker({ selected, onSelect }: Props) {
  const { data, isLoading } = useMyRecipes({ page: 1, pageSize: 20 });
  if (selected) {
    return <Txt typography="t5" color={colors.grey900}>{selected.recipe.dishName}</Txt>;
  }
  if (isLoading) return <Txt typography="st9" color={colors.grey500}>레시피 불러오는 중…</Txt>;
  if (data.length === 0) return <Txt typography="st9" color={colors.grey500}>저장된 레시피가 없어요. 레시피 탭에서 먼저 만들어 주세요.</Txt>;
  return (
    <View style={styles.list}>
      {data.map((r) => (
        <Pressable key={r.id} style={styles.row} onPress={() => onSelect(r, r.id)}>
          <Txt typography="st9" color={colors.grey900}>{r.dishName}</Txt>
        </Pressable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({ list: { gap: 4 }, row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.grey200 } });
```
> `Recipe`는 `GeneratedRecipe` + {id, isFavorite, createdAt}. 스냅샷에는 GeneratedRecipe 필드만 보내야 하므로 `onSelect`에서 `r`(Recipe)을 그대로 넘기되, 폼 제출 시 GeneratedRecipe 형태로 추출(아래 CookingLogForm에서 처리).

- [ ] **Step 4: 폼 조립**

Create `src/components/CookingLogForm.tsx`:
```tsx
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, TextField, Txt, colors } from '@toss/tds-react-native';
import { PhotoPickerButton } from './PhotoPickerButton';
import { StarRatingInput } from './StarRatingInput';
import { RecipeSnapshotPicker } from './RecipeSnapshotPicker';
import type { PickedImage } from '../lib/media';
import type { GeneratedRecipe } from '../types/api';
import type { CreateCookingLogRequest } from '../types/cooking-log';

interface Props {
  initialRecipe?: { recipe: GeneratedRecipe; sourceRecipeId: string | null } | null;
  pending?: boolean;
  error?: string | null;
  onSubmit: (req: CreateCookingLogRequest) => void;
}

function toGeneratedRecipe(r: GeneratedRecipe): GeneratedRecipe {
  return {
    dishName: r.dishName, description: r.description, servings: r.servings,
    cookTimeMinutes: r.cookTimeMinutes, difficulty: r.difficulty,
    ingredients: r.ingredients, steps: r.steps, tips: r.tips, nutrition: r.nutrition,
  };
}

export function CookingLogForm({ initialRecipe = null, pending, error, onSubmit }: Props) {
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [recipeSel, setRecipeSel] = useState(initialRecipe);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = () => {
    if (!photo) return setLocalError('요리 사진을 추가해 주세요.');
    if (!recipeSel) return setLocalError('레시피를 선택해 주세요.');
    if (rating < 1) return setLocalError('별점을 매겨 주세요.');
    if (review.trim().length === 0) return setLocalError('소감을 입력해 주세요.');
    setLocalError(null);
    onSubmit({
      image: photo.dataUri, mimeType: photo.mimeType,
      recipe: toGeneratedRecipe(recipeSel.recipe), sourceRecipeId: recipeSel.sourceRecipeId,
      rating, review: review.trim(),
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Txt typography="t5" color={colors.grey900}>요리 사진</Txt>
      <PhotoPickerButton value={photo} onPick={setPhoto} />
      <Txt typography="t5" color={colors.grey900}>레시피</Txt>
      <RecipeSnapshotPicker selected={recipeSel} onSelect={(recipe, id) => setRecipeSel({ recipe, sourceRecipeId: id })} />
      <Txt typography="t5" color={colors.grey900}>별점</Txt>
      <StarRatingInput value={rating} onChange={setRating} />
      <Txt typography="t5" color={colors.grey900}>소감</Txt>
      <TextField variant="line" value={review} onChangeText={setReview} placeholder="한 줄 소감을 남겨 주세요" />
      {(localError || error) ? <Txt typography="st11" color={colors.red500}>{localError ?? error}</Txt> : null}
      <Button onPress={submit} disabled={pending}>{pending ? '올리는 중…' : '기록 올리기'}</Button>
    </ScrollView>
  );
}
const styles = StyleSheet.create({ content: { padding: 16, gap: 12, paddingBottom: 96 } });
```
> `colors.red500` 실재 여부 확인(없으면 기존 에러 색 토큰 사용 — SearchForm의 에러 표시 토큰을 미러).

- [ ] **Step 5: 업로드 페이지**

Create `pages/cooking-log/new.tsx`:
```tsx
import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { createRoute, useNavigation } from '@granite-js/react-native';
import { PageNavbar } from '@toss/tds-react-native';
import { BottomTabBar } from '../../src/components/BottomTabBar';
import { CookingLogForm } from '../../src/components/CookingLogForm';
import { useCreateCookingLog } from '../../src/hooks/useCreateCookingLog';
import type { GeneratedRecipe } from '../../src/types/api';

interface NewParams { recipe?: GeneratedRecipe; sourceRecipeId?: string }

export const Route = createRoute('/cooking-log/new', {
  validateParams: (params: unknown): NewParams => {
    const o = (params ?? {}) as Record<string, unknown>;
    return {
      recipe: (o.recipe ?? undefined) as GeneratedRecipe | undefined,
      sourceRecipeId: typeof o.sourceRecipeId === 'string' ? o.sourceRecipeId : undefined,
    };
  },
  component: NewCookingLogPage,
});

function NewCookingLogPage() {
  const params = Route.useParams();
  const navigation = useNavigation();
  const { isSaving, error, create } = useCreateCookingLog();
  const initialRecipe = params.recipe ? { recipe: params.recipe, sourceRecipeId: params.sourceRecipeId ?? null } : null;

  const handleSubmit = useCallback(async (req: Parameters<typeof create>[0]) => {
    const saved = await create(req);
    if (saved) navigation.navigate('/', {}); // 피드로 복귀(상단 노출)
  }, [create, navigation]);

  return (
    <View style={styles.root}>
      <PageNavbar><PageNavbar.Title>요리 기록 올리기</PageNavbar.Title></PageNavbar>
      <CookingLogForm initialRecipe={initialRecipe} pending={isSaving} error={error} onSubmit={handleSubmit} />
      <BottomTabBar active="none" />
    </View>
  );
}
const styles = StyleSheet.create({ root: { flex: 1 } });
```

- [ ] **Step 6: 타입/린트**

Run: `cd airecipe-miniapp && pnpm typecheck && pnpm lint`
Expected: 통과(M9 컴포넌트는 아직 — 피드 페이지 import만 남으면 M9 후 해소).

- [ ] **Step 7: Commit**
```bash
git add airecipe-miniapp/src/components/PhotoPickerButton.tsx airecipe-miniapp/src/components/StarRatingInput.tsx airecipe-miniapp/src/components/RecipeSnapshotPicker.tsx airecipe-miniapp/src/components/CookingLogForm.tsx airecipe-miniapp/pages/cooking-log/new.tsx
git commit -m "feat(miniapp): 요리 기록 업로드 폼 + 사진/별점/레시피 컴포넌트"
```

---

## Task M9: 피드 카드 + 빈 상태 + 상세 페이지

**Files:**
- Create: `src/components/CookingLogCard.tsx`, `src/components/FeedEmptyState.tsx`, `pages/cooking-log/[id].tsx`

- [ ] **Step 1: 피드 카드** (RecipeCard 패턴 + 사진 + ReadOnlyRating)

Create `src/components/CookingLogCard.tsx`:
```tsx
import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { ReadOnlyRating, Txt, colors } from '@toss/tds-react-native';
import type { CookingLog } from '../types/cooking-log';

export function CookingLogCard({ log, onPress }: { log: CookingLog; onPress: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${log.recipe.dishName} 기록 보기`}>
      <Image source={{ uri: log.photoUrl }} style={styles.photo} />
      <View style={styles.body}>
        <Txt typography="t5" color={colors.grey900}>{log.recipe.dishName}</Txt>
        <ReadOnlyRating value={log.rating} variant="compact" size="small" max={5} />
        <Txt typography="st9" color={colors.grey700} numberOfLines={2}>{log.review}</Txt>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: { borderRadius: 12, backgroundColor: colors.white, marginBottom: 12, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.grey200 },
  photo: { width: '100%', height: 200, backgroundColor: colors.grey100 },
  body: { padding: 12, gap: 6 },
});
```
> `ReadOnlyRating` 실재 확인됨(named export). variant `'compact'`, size `'small'`.

- [ ] **Step 2: 빈 상태** (EmptyState 재사용 또는 전용)

Create `src/components/FeedEmptyState.tsx`:
```tsx
import React from 'react';
import { EmptyState } from './EmptyState';

export function FeedEmptyState({ onAction }: { onAction: () => void }) {
  return (
    <EmptyState
      title="아직 기록이 없어요"
      description="만든 요리의 사진과 소감을 남겨 보세요."
      actionLabel="기록 올리기"
      onAction={onAction}
    />
  );
}
```
> `EmptyState` props(title/description/actionLabel/onAction)는 survey 확인됨.

- [ ] **Step 3: 상세 페이지** (recipe/[id].tsx 패턴 + 삭제)

Create `pages/cooking-log/[id].tsx`:
```tsx
import React, { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { createRoute, useNavigation } from '@granite-js/react-native';
import { Button, PageNavbar, ReadOnlyRating, Txt, colors } from '@toss/tds-react-native';
import { BottomTabBar } from '../../src/components/BottomTabBar';
import { NotFoundScreen } from '../../src/components/NotFoundScreen';
import { RecipeDisplay } from '../../src/components/RecipeDisplay';
import { useCookingLogDetail } from '../../src/hooks/useCookingLogDetail';
import { useDeleteCookingLog } from '../../src/hooks/useDeleteCookingLog';

interface DetailParams { id?: string }
export const Route = createRoute('/cooking-log/:id', {
  validateParams: (params: unknown): DetailParams => {
    const o = (params ?? {}) as Record<string, unknown>;
    return { id: typeof o.id === 'string' ? o.id : undefined };
  },
  component: CookingLogDetailPage,
});

function CookingLogDetailPage() {
  const params = Route.useParams();
  const navigation = useNavigation();
  const { data, isLoading, notFound, error } = useCookingLogDetail(params.id);
  const { isDeleting, remove } = useDeleteCookingLog();
  const [confirming, setConfirming] = useState(false);

  const onDelete = useCallback(async () => {
    if (!params.id) return;
    const ok = await remove(params.id);
    if (ok) navigation.navigate('/', {});
  }, [params.id, remove, navigation]);

  if (params.id === undefined || notFound) return (<View style={styles.root}><NotFoundScreen /><BottomTabBar active="none" /></View>);
  if (isLoading) return (<View style={styles.center}><Txt typography="st9" color={colors.grey600}>불러오는 중…</Txt><BottomTabBar active="none" /></View>);
  if (error || !data) return (<View style={styles.center}><Txt typography="st9" color={colors.grey600}>{error ?? '기록을 찾을 수 없어요.'}</Txt><BottomTabBar active="none" /></View>);

  return (
    <View style={styles.root}>
      <PageNavbar><PageNavbar.Title>{data.recipe.dishName}</PageNavbar.Title></PageNavbar>
      <ScrollView contentContainerStyle={styles.content}>
        <Image source={{ uri: data.photoUrl }} style={styles.photo} />
        <ReadOnlyRating value={data.rating} variant="full" size="medium" max={5} />
        <Txt typography="st9" color={colors.grey800}>{data.review}</Txt>
        <RecipeDisplay recipe={data.recipe} />
        <Button type="danger" style="fill" onPress={onDelete} disabled={isDeleting}>{isDeleting ? '삭제 중…' : '기록 삭제'}</Button>
      </ScrollView>
      <BottomTabBar active="none" />
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 12, paddingBottom: 96 },
  photo: { width: '100%', height: 240, borderRadius: 12, backgroundColor: colors.grey100 },
});
```
> `RecipeDisplay`/`NotFoundScreen` 실재 컴포넌트(survey 확인). `RecipeDisplay`가 `GeneratedRecipe`를 받는지 `Recipe`를 받는지 시그니처 확인 후 맞춤(스냅샷은 GeneratedRecipe). 불일치 시 필요한 필드만 표시하는 간단 렌더로 대체. 삭제 확인 다이얼로그는 MVP에서 즉시 삭제로 단순화(원하면 기존 `DeleteConfirmDialog` 재사용).

- [ ] **Step 4: 피드 페이지 import 연결 확인** (M7 Step2 마무리)

이제 `CookingLogCard`/`FeedEmptyState` 존재 → `pages/index.tsx` 타입 에러 해소.

Run: `cd airecipe-miniapp && pnpm typecheck && pnpm lint`
Expected: 통과(에러 0, router.gen.ts 누적 warning 1 허용).

- [ ] **Step 5: Commit**
```bash
git add airecipe-miniapp/src/components/CookingLogCard.tsx airecipe-miniapp/src/components/FeedEmptyState.tsx airecipe-miniapp/pages/cooking-log
git commit -m "feat(miniapp): 피드 카드 + 빈 상태 + 기록 상세(삭제)"
```

---

## Task M10: 라우터 수동 등록 + 생성→기록 진입

**Files:**
- Modify: `src/router.gen.ts`, `pages/recipe/generate.tsx`

- [ ] **Step 1: 신규 라우트 등록**

`src/router.gen.ts`의 `RegisterScreenInput`에 추가(빌드 시 자동 재생성되지만 수동 dev 정합 위해, ADR-018 패턴):
```ts
    '/recipe': (typeof _RecipeIndexRoute)['_inputType'];
    '/cooking-log/new': (typeof _CookingLogNewRoute)['_inputType'];
    '/cooking-log/:id': (typeof _CookingLogIdRoute)['_inputType'];
```
+ 상응하는 import/route 변수 등록을 기존 파일의 패턴(다른 라우트 항목)과 동일하게 추가.
> 실제 `router.gen.ts` 형식(각 라우트가 어떻게 import/등록되는지)을 그대로 따라 3개 추가. `granite dev`/`build`가 재생성하므로 형식만 일치시키면 됨.

- [ ] **Step 2: 생성 완료 화면에 "이 레시피로 기록 남기기" 추가**

`pages/recipe/generate.tsx`의 생성 완료(`status==='done' && recipe`) 블록에 버튼 추가:
```tsx
<Button type="light" style="weak" onPress={() => navigation.navigate('/cooking-log/new', { recipe })}>
  이 레시피로 기록 남기기
</Button>
```
> 저장 버튼 옆/아래. `recipe`는 미저장 `GeneratedRecipe`라 `sourceRecipeId` 없이 전달(스냅샷 only). 저장본에서 진입하는 경로는 피드 FAB→폼 내 RecipeSnapshotPicker가 담당.

- [ ] **Step 3: 타입/린트 + dev 라우팅 확인**

Run: `cd airecipe-miniapp && pnpm typecheck && pnpm lint`
Expected: 통과.

- [ ] **Step 4: Commit**
```bash
git add airecipe-miniapp/src/router.gen.ts airecipe-miniapp/pages/recipe/generate.tsx
git commit -m "feat(miniapp): 라우트 등록(/recipe·/cooking-log/*) + 생성→기록 진입"
```

---

## Task M11: 문서 + 개인정보 고지 + QA 게이트

**Files:**
- Create: `docs/adr/ADR-021-cooking-log-feed.md`
- Modify: `docs/appsintoss-port/06-UI-MAPPING.md`, `07-ROUTING.md`, `09-ENV-CONFIG.md`, `pages/privacy.tsx`, `pages/AGENTS.md`, `src/components/AGENTS.md`, `src/lib/AGENTS.md`, `src/hooks/AGENTS.md`, `CLAUDE.md`

- [ ] **Step 1: ADR-021 작성**

Create `docs/adr/ADR-021-cooking-log-feed.md`: 결정 기록 — 3탭 재편(피드/레시피/마이), 홈→피드, 미디어 어댑터 격리(브리지 untyped 로컬 타입), base64 백엔드 경유 업로드, TDS Editable/ReadOnlyRating 채택, photos/camera 권한, 별 캐시 프로바이더. 스펙 §3 결정표 인용 + 검증 PENDING(디바이스 사진 선택 실증).

- [ ] **Step 2: SSOT 챕터 갱신**

- `06-UI-MAPPING.md`: CookingLogCard/CookingLogForm/PhotoPickerButton/StarRatingInput(EditableRating)/ReadOnlyRating/FeedEmptyState 매핑 + FAB 토큰 규약.
- `07-ROUTING.md`: 라우트 표에 `/recipe`·`/cooking-log/new`·`/cooking-log/:id` 추가 + 3탭 BottomTabBar(피드/레시피/마이) 갱신(ADR-017 후속).
- `09-ENV-CONFIG.md`: photos/camera 권한 선언 절 추가(미니앱 신규 env는 없음 — 사진은 백엔드 경유).

- [ ] **Step 3: 개인정보처리방침 고지 1줄**

`pages/privacy.tsx` 본문 상수에 사진 저장 고지 추가(사진은 R2에 저장·서명 URL로 조회, 개인정보). ADR-020 보일러플레이트 형식 유지.

- [ ] **Step 4: AGENTS.md 갱신**

- `src/lib/AGENTS.md`: `media/` 어댑터 — SDK 직접 import 단일 위치 규약(ads와 동일).
- `src/components/AGENTS.md`·`src/hooks/AGENTS.md`·`pages/AGENTS.md`: 신규 파일 행 추가.
- 루트 `airecipe-miniapp/CLAUDE.md` "현재 단계" 절 + 변경 이력 1행.

- [ ] **Step 5: QA 경계면 검증** (integration-coherence-qa-miniapp 기준)

다음을 교차 점검(미니앱 QA 매트릭스):
- 백엔드 응답 shape(03-API-CONTRACT cooking-logs) ↔ `cookingLogSchema` ↔ `CookingLog` 타입 일치.
- api-client 메서드 ↔ 화면 호출(피드/폼/상세) 시그니처 일치.
- 라우팅 ↔ `navigation.navigate` 경로(`/`·`/recipe`·`/cooking-log/new`·`/cooking-log/:id`) 일치.
- TDS 매핑 실재성: `EditableRating`/`ReadOnlyRating`/`PageNavbar`/`Button`/`TextField` 실제 export 확인(grep).
- 인증 헤더: 보호 호출 4종 모두 `tossUserId` + 401 재시도 전달.
- 검수: photos/camera 권한 선언 + hex 0건(grep) + SDK 직접 import는 media/ads 어댑터만(grep).

- [ ] **Step 6: 최종 게이트**

Run: `cd airecipe-miniapp && pnpm test && pnpm typecheck && pnpm lint`
Expected: 테스트 PASS · 타입 통과 · 린트 0 에러(router.gen.ts 누적 warning 1 허용).

Run(검수 grep):
```bash
cd airecipe-miniapp && grep -rnE "#[0-9a-fA-F]{6}" src pages | grep -v router.gen || echo "hex 0건"
grep -rn "@apps-in-toss/framework" src pages | grep -vE "adapter.toss|adapter.appsintoss|useTossUserId" || echo "SDK 직접 import 격리 OK"
```
Expected: hex 0건 · SDK import는 어댑터/useTossUserId만.

- [ ] **Step 7: Commit**
```bash
git add airecipe-miniapp/docs airecipe-miniapp/pages/privacy.tsx airecipe-miniapp/CLAUDE.md airecipe-miniapp/src/components/AGENTS.md airecipe-miniapp/src/lib/AGENTS.md airecipe-miniapp/src/hooks/AGENTS.md airecipe-miniapp/pages/AGENTS.md
git commit -m "docs(miniapp): ADR-021 + SSOT 갱신 + 사진 저장 개인정보 고지 + AGENTS"
```

---

## Self-Review (작성자 체크)

- **스펙 커버리지:** §7.1 미디어 어댑터(M2) · §7.2 권한(M3) · §7.3 api-client/zod/훅(M1,M4,M5) · §7.4 라우팅 3탭(M6,M7,M10) · §7.5 컴포넌트(M8,M9) · §7.6 별점 실재성(M8 EditableRating)·개인정보 고지(M11) · §8 업로드 흐름(M8 폼 + M10 생성→기록) — 모두 태스크 존재. ✅
- **플레이스홀더:** 코드 스텝은 실제 코드. 문서 스텝(M11)은 갱신 대상·내용 명시. `deleteCookingLog` 인라인 zod는 Step에서 모듈 상수로 정리하도록 명시. ✅
- **타입 일관성:** `PickedImage`(media) → PhotoPickerButton/CookingLogForm 동일. `CookingLog`(types) → 카드/상세/훅 동일. `AuthedCallOptions` 재사용(recipes.ts). `EditableRating`/`ReadOnlyRating` props는 실재 d.ts 기준. ✅
- **의존 순서 주의:** M6은 타입을 깨뜨리는 중간 상태 → M7과 함께 커밋. M7 Step2(피드 본체)는 M9 컴포넌트 생성 후 연결(plan에 명시). 실행자는 M6→M7(Step1/3)→M8→M9→M7(Step2 연결 확인)→M10 순으로 진행 권장. ✅
- **검증 게이트:** 본 저장소 실제 게이트(typecheck/lint/jest + QA 매트릭스 + 검수 grep)로 구성 — 강제 단위 TDD를 UI에 부과하지 않음(코드베이스 관례 존중). ✅

## 실행 핸드오프 (전체)

Plan 1(백엔드) → Plan 2(미니앱) 순. 각 Plan은 태스크 단위로 실행하고 사이에 리뷰/QA. 디바이스 사진 선택·R2 실 송출은 외부 작업으로 PENDING(각 Plan의 PENDING 절).
