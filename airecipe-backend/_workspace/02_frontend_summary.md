# 02. 프론트엔드 구현 요약 (Sprint 1, T4)

> 계약 SSOT: `_workspace/01_architect_api_contract.md` · 공유 타입: `src/types/` · 상태관리: ADR-003.
> 모든 응답 소비는 `{ data, meta? }` unwrap, 에러는 `{ error: { code, message } }` 코드 분기.

## 1. 페이지 ↔ 라우트 ↔ 소비 API

| 경로(URL) | 파일 | 보호 | 사용 훅 | 소비 API |
|-----------|------|------|--------|---------|
| `/` | `src/app/page.tsx` | 공개 | `useAuth`, `useMyRecipes`(로그인 시 최근 6개) | GET /api/recipes |
| `/recipe/generate` | `src/app/recipe/generate/page.tsx` | 공개 | `useRecipeGenerate`, `useMyRecipes.save`, `useAuth` | POST /api/recipes/generate (SSE), POST /api/recipes(저장) |
| `/recipe/[id]` | `src/app/recipe/[id]/page.tsx` | **보호** | `useRecipe` | GET /api/recipes/[id], PATCH /[id]/favorite, DELETE /[id] |
| `/my-recipes` | `src/app/my-recipes/page.tsx` | **보호** | `useMyRecipes`(favorite 필터) | GET /api/recipes, PATCH /[id]/favorite, DELETE /[id] |
| `/auth/login` | `src/app/auth/login/page.tsx` | 공개 | `useAuth.signIn` | Supabase Auth |
| `/auth/signup` | `src/app/auth/signup/page.tsx` | 공개 | `useAuth.signUp` | Supabase Auth |

라우팅 정합성: 모든 `href`/`router.push`는 위 실제 경로와 일치. route group 미사용(URL=디렉토리 그대로).

## 2. 페이지 보호 (middleware.ts ↔ 계약 0.3 표 일치)

`middleware.ts` matcher = `/my-recipes/:path*`, `/recipe/:path*`, `/auth/login`, `/auth/signup`.
- 보호: `/my-recipes`, `/recipe/[id]` → 미인증 시 `/auth/login?redirect=<원래경로>`.
- 공개 예외: `/recipe/generate`(생성은 공개 API) — matcher의 `/recipe/*` 중 generate만 코드에서 공개 처리.
- 인증 상태로 `/auth/login|signup` 접근 → `/`.
- 세션 갱신은 `@supabase/ssr` 미들웨어 패턴(요청 쿠키 read → 응답 쿠키 write).

## 3. 컴포넌트 (presentational, src/components/)

- `ui/`: 경량 shadcn 패턴 프리미티브 — `button`, `input`, `label`, `card`, `badge`, `alert`, `spinner`. `cn`(`@/lib/utils`, clsx+tailwind-merge).
- 도메인: `RecipeCard`(Recipe), `RecipeDisplay`(GeneratedRecipe|Recipe 공통 필드만, id 미접근), `NutritionPanel`(NutritionInfo), `FavoriteButton`(목표값 콜백), `SearchForm`, `AuthForm`, `NavBar`.
- 보조: `recipe-format.ts`(difficulty 라벨/조리시간 포맷).

설계: 컴포넌트는 표현·콜백 위임만, 데이터/로직은 훅·페이지. `GeneratedRecipe`(미저장) vs `Recipe`(저장됨) 타입 분리 준수(계약 불변식 2).

## 4. 훅 (src/hooks/)

| 훅 | 상태 모델 | 핵심 |
|----|----------|------|
| `api-client.ts` | — | `{data}`/`{data,meta}` unwrap, `ApiClientError`(code 분기), SWR fetcher |
| `useRecipeGenerate` | React 로컬 | SSE(StreamChunk) 소비: meta→text*→recipe→done, error 청크(HTTP 200). 결과=GeneratedRecipe |
| `useMyRecipes` | SWR | 목록/저장/즐겨찾기(멱등·낙관적)/삭제. 변경 후 캐시 mutate |
| `useRecipe` | SWR(잠정) | 단건 — 목록 캐시 매칭(GET /[id] 미계약). 추가 시 단건 fetch 교체 예정 |
| `useAuth` | React + Supabase | 세션 사용자, signIn/signUp/signOut, onAuthStateChange 구독 |

## 5. 계약 정합 확인 (실제 백엔드 구현 교차 검증 완료)
- 응답 래핑: 백엔드 `ok`/`okList` = `{data}`/`{data,meta}` — 훅 unwrap과 일치.
- SSE: 백엔드 `encodeSSE` = `event: <type>\ndata:<json>\n\n`, 흐름 meta→text*→recipe→done, 에러=HTTP200+error 청크 — `useRecipeGenerate` 파서와 일치.
- 즐겨찾기: PATCH 본문 `{ isFavorite }` 목표값 — `setFavorite(id, target)` 일치.
- 삭제: DELETE → `{ data: { id } }` — 일치.

## 6. 미해결 / 후속
- **단건 GET /api/recipes/[id] 부재**: architect에 계약 보완 요청 발신. 현재 `useRecipe`는 목록 캐시 매칭(잠정). 딥링크/페이지네이션 밖 진입 시 not found 처리. 계약 추가되면 단건 fetch로 교체.
- **Next 16 `middleware` 파일 규약 deprecated(→ proxy)**: 현재 동작하나 경고 발생. 계약이 `middleware.ts`로 명시되어 유지. 향후 `proxy.ts` 전환은 architect 협의 후.
- 의존성 추가: `swr`, `clsx`, `tailwind-merge`(package.json) — ADR-003 SWR 결정 반영.

## 7. 검증
- `npx tsc --noEmit`: 통과.
- `npm run build`(env -u NODE_OPTIONS): **통과**. 10개 라우트 생성 — `/`, `/auth/login`, `/auth/signup`, `/my-recipes`, `/recipe/generate`(static client), `/recipe/[id]`(dynamic), API 4개(backend), middleware(proxy) 등록.
- 빌드 환경: `.env.local`에 플레이스홀더 값 필요(`createBrowserClient`가 빈 값이면 prerender 시 throw). 실제 Supabase/Anthropic 값은 backend가 관리. `.env*`는 gitignore.
- 주의: `npm install`이 샌드박스에서 비영속될 수 있음 — deps 설치는 `env -u NODE_OPTIONS npm install`로 수행. (`swr`/`clsx`/`tailwind-merge`)
- QA(T5)에 라우팅 정합성 + 응답 소비 경계면 교차검증 요청.
