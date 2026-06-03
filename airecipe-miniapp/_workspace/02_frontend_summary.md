# 02 — Frontend Summary: 요리 기록 피드 (ADR-021, 2026-06-03)

화면+문서(M3·M6~M11) 구현. 플러밍(M1·M2·M4·M5 — zod/타입/미디어 어댑터/api-client/훅/_app provider)은 선행 커밋.

## 추가/수정한 화면·컴포넌트

### 페이지 (`pages/`)
| 라우트 | 파일 | 상태 | 소비 훅 |
|--------|------|------|---------|
| `/` (피드) | `pages/index.tsx` | 재작성(홈→피드) | `useCookingFeed` |
| `/recipe` (레시피 탭) | `pages/recipe/index.tsx` | 신규 | — (SearchForm 위임) |
| `/cooking-log/new` | `pages/cooking-log/new.tsx` | 신규 | `useCreateCookingLog` |
| `/cooking-log/:id` | `pages/cooking-log/[id].tsx` | 신규 | `useCookingLogDetail`, `useDeleteCookingLog` |
| `/recipe/generate` | `pages/recipe/generate.tsx` | 수정(생성→기록 버튼 1개) | (기존) |

### 컴포넌트 (`src/components/`)
| 컴포넌트 | 상태 | TDS 매핑 |
|----------|------|----------|
| `BottomTabBar.tsx` | 수정(2탭→3탭 feed/recipe/my) | `Pressable`+`Txt`+`colors` |
| `PhotoPickerButton.tsx` | 신규 | `Button`+`Image`+`Txt` / `media` 어댑터 |
| `StarRatingInput.tsx` | 신규 | `Rating readonly={false}` |
| `RecipeSnapshotPicker.tsx` | 신규 | `Pressable`+`Txt` / `useMyRecipes` |
| `CookingLogForm.tsx` | 신규 | `TextField`(line)+`Button`+위 3종 |
| `CookingLogCard.tsx` | 신규 | `Image`+`Rating readonly`+`Txt` |
| `FeedEmptyState.tsx` | 신규 | `EmptyState` 재사용 |

### 설정/라우터
- `granite.config.ts` — photos(read)/camera(access) 권한.
- `src/router.gen.ts` — 수동 등록 `/recipe`·`/cooking-log/new`·`/cooking-log/:id`.

## 라우트 표 (navigate ↔ createRoute 정합 grep 확인 완료)
모든 `navigation.navigate` 타깃이 등록 `createRoute`와 1:1. 탭바는 `/`·`/recipe`·`/my-recipes`로 이동. `/cooking-log/:id`는 피드에서 `:id` 형식 호출(createRoute 경로와 동일).

## 소비 api-client 메서드 (모두 `../services` barrel, 직접 fetch 0건)
`listCookingLogs`(useCookingFeed) / `createCookingLog`(useCreateCookingLog) / `getCookingLog`(useCookingLogDetail) / `deleteCookingLog`(useDeleteCookingLog) / `listRecipes`(useMyRecipes — RecipeSnapshotPicker 재사용).

## 계획 대비 조정 (실제 시그니처 반영)
1. **TDS 별점 (D79, 중대):** 계획의 `EditableRating`/`ReadOnlyRating` named import는 **실재하지 않음** — `@toss/tds-react-native`의 `rating/index.d.ts` barrel은 `Rating`만 public export(두 컴포넌트는 내부 타입, `.d.ts` 미노출, TS2305로 확인). → 단일 `Rating` 판별 유니온으로 정정: 입력 `<Rating readonly={false} size="large">`, 표시 `<Rating readonly variant size>`. 3파일(StarRatingInput/CookingLogCard/cooking-log[id]).
2. **`useDeleteCookingLog`:** 계획 초안의 `remove(id)`가 아니라 `useDeleteCookingLog(id)`(훅 인자) + `remove()`(무인자) + `isPending`. 상세 페이지를 실 시그니처에 맞춤.
3. **에러 텍스트 색:** `colors.red500`(실재) 대신 기존 화면 관례 `colors.red700`(generate/[id] 사용) 미러.
4. **`GeneratedRecipe` 경로:** `../types/recipe`(계획의 `../types/api` 아님 — cooking-log 타입의 실 경로).
5. **권한 타입:** `@apps-in-toss/plugins` `Permission` 유니온 = 객체 `{name,access}` 배열. photos.access='read', camera.access='access' — 계획 M3 형태 그대로 통과.

## TDS 실재성 확인
- 실재 채택: `Rating`(판별 유니온), `PageNavbar`, `Button`, `TextField`(variant="line"/hasError), `EmptyState`, `RecipeDisplay`(GeneratedRecipe 수용), `NotFoundScreen`, `colors.{orange500,white,red700,grey*}`.
- 정정: `EditableRating`/`ReadOnlyRating` → `Rating readonly` 분기(named export 부재).

## 최종 게이트 (실측)
- `pnpm test` → 2 suites / **7 PASS**.
- `pnpm typecheck` → **PASS**.
- `pnpm lint` → **0 errors** (router.gen.ts warning 1, 허용).
- hex grep(`src pages` excl router.gen) → **hex 0건**.
- SDK 격리 grep → 코드 import는 `src/_app.tsx`(기존 registerApp 베이스라인)만, 신규 SDK 호출은 `media/adapter.appsintoss.ts` 1곳(grep 제외 대상). **격리 OK**.

## 커밋
| 태스크 | 해시 |
|--------|------|
| M3 권한 | `62428d7` |
| M8 업로드 폼 | `f8f139d` |
| M9 카드/빈상태/상세 | `630f3e1` |
| M6+M7 3탭/피드/레시피탭 | `bcf0c29` |
| M10 라우트/생성→기록 | `25c3c6e` |
| M11 문서 | `6157f4f` |

## PENDING (외부 작업 — 코드만, 미실행)
- 디바이스 사진 선택 실증(`media.pickFromAlbum/pickFromCamera` 반환 형태 — `normalizePicked`가 양쪽 흡수하나 실증 필요).
- 백엔드 배포(cooking_logs·RLS·R2·4 엔드포인트·CORS·R2 시크릿). 미배포 시 401/404 → 한국어 안내 자동.
- 권한 콘솔 등록(photos/camera 최소권한 정당화).
- R2 presigned TTL ↔ 피드 캐싱(백엔드 측).

## QA 인계 요청
(1) 라우팅 정합(navigate↔createRoute↔router.gen.ts), (2) TDS 실재성(`Rating` 판별 유니온 정정 포함), (3) api-client 소비 shape(CookingLog↔cookingLogSchema↔화면), (4) 인증 헤더(보호 4종 tossUserId+401 재시도), (5) 검수 grep(hex 0·SDK 격리).
