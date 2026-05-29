# 01. 기능 인벤토리 — Sprint 1 6기능

> **이 챕터 전에 알아야 할 것**: [00-OVERVIEW.md](./00-OVERVIEW.md) — 포팅 원칙·읽는 순서.
>
> **이 챕터 완료 후 다음 챕터**: [02-DATA-MODEL.md](./02-DATA-MODEL.md) — Supabase 스키마와 사용자 식별 옵션 P.

---

## 1.0 개요

본 챕터는 미니앱에서 구현해야 할 **Sprint 1 6기능**을 인벤토리화한다. 각 기능마다:

- 사용자 흐름
- 수용 기준
- 관련 API (백엔드 호출)
- 관련 화면 (Granite 라우팅)
- 관련 컴포넌트 (TDS 매핑 대상)
- 신규 RN 구현 시 변경점 (현재 웹 대비)

기능 간 의존성 요약:

```
(a) 레시피 생성 ─ (b) 영양 분석 (a의 응답 일부)
       │
       ▼
(c) 레시피 저장 ───┬─→ (d) 목록 조회
                   │
                   ├─→ (e) 즐겨찾기 토글
                   │
                   └─→ (f) 레시피 삭제
```

**범위 외**: 회원가입·로그인 폼, 비밀번호 재설정, 소셜 로그인 등 인증 UI는 미니앱 v1에서 **미구현**(ADR-009 D2). `getAnonymousKey()`로 자동 식별한다.

---

## 1.1 기능 a) 레시피 생성 (요리명 → AI 스트리밍 생성)

### 사용자 흐름

1. 사용자가 메인/생성 화면에서 요리명 입력 (예: "김치찌개").
2. 선택 입력: 인분 수(`servings`, 기본 2, 1~20).
3. "생성" 버튼 탭.
4. AI가 스트리밍으로 응답하고 화면에 점진적으로 표시.
5. 완료되면 전체 레시피(설명·재료·단계·팁·영양)가 표시되고 "저장" 버튼이 활성화된다.

### 수용 기준

- AC1. 요리명 1~100자 검증. 공백만 입력 시 입력란 에러 표시 (400 응답 도달 전 클라이언트에서 차단).
- AC2. 스트리밍 중 사용자가 취소 가능 (네비게이션·취소 버튼). 미니앱은 fetch stream의 `AbortController`로 처리 (08-STREAMING 챕터).
- AC3. 응답 청크 중 `event: error` 도달 시 사용자 친화적 에러 UI(한국어). `done` 청크로 스트림 종료.
- AC4. 비로그인 상태에서도 생성 가능 (생성 API는 공개 — API 계약 1절).
- AC5. 완료 후 생성 결과는 메모리에만 존재하며, 사용자가 "저장"을 탭해야 (c)로 진행한다.

### 관련 API

| 메서드 | 경로 | 인증 | 비고 |
|--------|------|------|------|
| POST | `/api/recipes/generate` | **공개** | `stream: true`로 SSE 사용 |

요청 shape (`GenerateRecipeRequest`):

```ts
{ dishName: string, servings?: number, stream?: boolean }
```

응답 shape (스트리밍 모드): `event: meta` → `event: text`(N회) → `event: recipe` → `event: done`.
응답 shape (비스트리밍): `{ data: GeneratedRecipe }`.

상세는 [03-API-CONTRACT.md](./03-API-CONTRACT.md) 1절 및 `_workspace/01_architect_api_contract.md` 1절.

### 관련 화면

- 현재 웹: `/recipe/generate` (`src/app/recipe/generate/page.tsx`)
- 미니앱: Granite 라우트 (07-ROUTING 챕터에서 매핑)

### 관련 컴포넌트

- 현재 웹: `SearchForm` (입력) + `RecipeDisplay` (결과 표시) + `NutritionPanel` (영양)
- 미니앱: TDS 컴포넌트로 1:1 매핑 (06-UI-MAPPING 챕터)

### 신규 RN 구현 시 변경점

- **SSE → fetch stream**: RN의 `fetch`는 `ReadableStream`을 반환. `text/event-stream` 청크를 라인 파싱해 `event:`/`data:` 추출 (08-STREAMING).
- **인증 헤더**: 공개 엔드포인트지만 백엔드가 옵션 P upsert를 위해 `X-Toss-User-Id`를 받으면 좋다. 비로그인(=식별자 없음) 시는 헤더 생략 (백엔드는 헤더 없음 = 비저장 사용자로 처리).
- **취소**: 웹은 `AbortController` + `EventSource` 대안. RN도 fetch + `AbortController` 동일 패턴.
- **점진 표시 UX**: Gemini는 부분 JSON이 흐를 수 있어 청크 텍스트 점진 표시 시 UI 깜빡임 가능 (08-STREAMING에서 처리).

---

## 1.2 기능 b) 영양 정보 분석 (생성 결과에 포함)

### 사용자 흐름

기능 (a)의 응답에 `nutrition` 객체가 포함되어 함께 반환된다. 별도 화면 없이 (a)의 결과 화면에서 함께 표시.

### 수용 기준

- AC1. `nutrition` 객체는 6개 필드(`calories`, `carbohydrates`, `protein`, `fat`, `fiber`, `healthNote`) 모두 존재.
- AC2. 숫자 필드는 양수 또는 0. 음수가 들어오면 zod에서 차단되어 백엔드가 502 `AI_PROVIDER_ERROR` 반환.
- AC3. `healthNote`는 한국어 한 줄 ~ 짧은 문단.

### 관련 API

별도 API 없음. (a)의 응답에 임베드됨.

### 관련 화면

(a)와 동일 — 생성 결과 화면.

### 관련 컴포넌트

- 현재 웹: `NutritionPanel`
- 미니앱: TDS 카드/리스트로 매핑 (06-UI-MAPPING)

### 신규 RN 구현 시 변경점

- 컴포넌트 매핑만. 데이터 모양은 변화 없음.

---

## 1.3 기능 c) 레시피 저장 (Supabase)

### 사용자 흐름

1. (a)에서 생성된 결과 화면에서 "저장" 버튼 탭.
2. 미니앱이 백엔드로 `POST /api/recipes` 호출 (`X-Toss-User-Id` 헤더 포함).
3. 백엔드가 옵션 P 매핑 upsert → recipes 테이블 insert → `Recipe`(id 포함) 반환.
4. 미니앱이 마이 레시피 캐시 무효화 후, 상세 화면 또는 마이 레시피로 이동(라우팅 결정은 07).

### 수용 기준

- AC1. 식별자(`X-Toss-User-Id`) 없으면 401. 미니앱은 진입 시 `getAnonymousKey()`로 항상 식별자 보유.
- AC2. 요청 본문은 (a)의 응답인 `GeneratedRecipe` 전체.
- AC3. 응답은 `{ data: Recipe }` (201). 저장된 `id`·`createdAt`·`isFavorite: false` 포함.
- AC4. 저장 성공 후 (d) 목록에 즉시 반영(낙관적 업데이트 또는 캐시 무효화).

### 관련 API

| 메서드 | 경로 | 인증 | 비고 |
|--------|------|------|------|
| POST | `/api/recipes` | 필요 | `X-Toss-User-Id` 헤더 |

요청 shape (`SaveRecipeRequest`):

```ts
{ recipe: GeneratedRecipe }
```

응답: `{ data: Recipe }` (201).

상세는 [03-API-CONTRACT.md](./03-API-CONTRACT.md) 3절.

### 관련 화면

- 현재 웹: `/recipe/generate` 의 저장 버튼.
- 미니앱: 생성 화면 또는 결과 모달의 저장 버튼.

### 관련 컴포넌트

- 현재 웹: `RecipeDisplay` 의 저장 액션 + `useRecipeGenerate` 훅 (저장 mutation)
- 미니앱: 동일 흐름을 RN으로 재구성.

### 신규 RN 구현 시 변경점

- **인증**: Supabase 쿠키 세션 → `X-Toss-User-Id` 헤더.
- **상태 관리**: 웹은 React Query/SWR 류 또는 직접 fetch 훅. 미니앱은 RN용 동등 패턴(현재 웹의 `useMyRecipes`·`api-client.ts` 패턴 참조).
- **404 처리**: ADR-005 정책 그대로 — 저장은 404 시나리오 없지만, 후속 단건 조회·즐겨찾기·삭제에서는 동일 "찾을 수 없음" UI.

---

## 1.4 기능 d) 마이 레시피 목록 조회

### 사용자 흐름

1. 사용자가 "마이 레시피" 탭/화면 진입.
2. 미니앱이 `GET /api/recipes`를 `X-Toss-User-Id` 헤더와 함께 호출.
3. 목록 렌더링. 즐겨찾기 필터 토글 가능 (`?favorite=true`).
4. 페이지네이션(또는 무한 스크롤) — `page`/`pageSize` 쿼리.
5. 각 카드 탭 → 상세 화면(추후 단건 조회 `GET /api/recipes/[id]`).

### 수용 기준

- AC1. 빈 목록은 빈 상태 UI(404 아님, 200 + `data: []`).
- AC2. 페이지 1부터 시작, `pageSize` 기본 20, 상한 50(초과 시 백엔드가 clamp, ADR-006). 미니앱은 응답 `meta.pageSize`를 신뢰.
- AC3. `?favorite=true`는 즐겨찾기만, `?favorite=false`는 비즐겨찾기만, 미지정은 전체. `favorite` 값이 `"true"`/`"false"`가 아니면 400.
- AC4. 401 시 미니앱은 식별자 재발급 시도 → 그래도 실패면 에러 토스트.

### 관련 API

| 메서드 | 경로 | 인증 | 비고 |
|--------|------|------|------|
| GET | `/api/recipes?favorite=&page=&pageSize=` | 필요 | 본인 것만 |
| GET | `/api/recipes/[id]` | 필요 | 상세 진입 |

응답: `{ data: Recipe[], meta: { total, page, pageSize } }`.

상세는 [03-API-CONTRACT.md](./03-API-CONTRACT.md) 2절·2.5절.

### 관련 화면

- 현재 웹: `/my-recipes` (`src/app/my-recipes/page.tsx`), `/recipe/[id]` (`src/app/recipe/[id]/page.tsx`)
- 미니앱: 마이 탭 + 상세 화면.

### 관련 컴포넌트

- 현재 웹: `RecipeCard` (목록 아이템), `FavoriteButton`, `RecipeDisplay`/`NutritionPanel`(상세).
- 미니앱: TDS 리스트·카드·버튼 매핑 (06-UI-MAPPING).

### 신규 RN 구현 시 변경점

- **인증**: 쿠키 → 헤더.
- **단건 진입**: 웹은 `/recipe/[id]` 보호 페이지(ADR-007 proxy). 미니앱은 Granite 라우팅에서 가드 처리(07-ROUTING). 비식별자는 라우트 진입 자체를 차단하거나 진입 시 식별자 재발급.
- **404 분기**: ADR-005 — 없음·타인·잘못된 id 모두 동일 "레시피를 찾을 수 없어요" UI.

---

## 1.5 기능 e) 즐겨찾기 토글

### 사용자 흐름

1. 마이 레시피 목록 또는 상세 화면의 별 아이콘 탭.
2. 미니앱이 `PATCH /api/recipes/[id]/favorite` 호출 (목표 값 명시).
3. 낙관적 업데이트 후 응답 도착 시 확정.

### 수용 기준

- AC1. 요청 본문은 `{ isFavorite: boolean }` — 토글 아님, **목표 값 명시**(API 계약 4.1).
- AC2. 동일 호출을 두 번 보내도 결과 동일(멱등).
- AC3. 401 / 404 / 503 응답 시 낙관적 업데이트 롤백.
- AC4. 즐겨찾기 필터(`?favorite=true`)와 즉시 정합.

### 관련 API

| 메서드 | 경로 | 인증 | 비고 |
|--------|------|------|------|
| PATCH | `/api/recipes/[id]/favorite` | 필요 | 본인 것만 |

응답: `{ data: Recipe }` (200).

상세는 [03-API-CONTRACT.md](./03-API-CONTRACT.md) 4절.

### 관련 화면

마이 레시피 목록 + 상세.

### 관련 컴포넌트

- 현재 웹: `FavoriteButton`
- 미니앱: TDS 아이콘 버튼 + 낙관적 업데이트 훅.

### 신규 RN 구현 시 변경점

- 인증 헤더로 전환.
- 낙관적 업데이트 패턴은 동일.

---

## 1.6 기능 f) 레시피 삭제

### 사용자 흐름

1. 마이 레시피 또는 상세에서 삭제 액션 (long press 또는 메뉴).
2. 확인 모달 → 미니앱이 `DELETE /api/recipes/[id]` 호출.
3. 응답 도착 시 목록에서 제거.

### 수용 기준

- AC1. 삭제 확인 다이얼로그 필수 (실수 방지).
- AC2. 응답은 `{ data: { id } }` (200 — ADR 결정: 204 대신 200 + id).
- AC3. 404 시(이미 삭제됨/타인 소유) "이미 삭제된 레시피입니다" UI.
- AC4. 삭제 후 마이 레시피 캐시 무효화.

### 관련 API

| 메서드 | 경로 | 인증 | 비고 |
|--------|------|------|------|
| DELETE | `/api/recipes/[id]` | 필요 | 본인 것만 |

응답: `{ data: { id } }` (200).

상세는 [03-API-CONTRACT.md](./03-API-CONTRACT.md) 5절.

### 관련 화면

마이 레시피, 상세.

### 관련 컴포넌트

TDS 아이콘 버튼 + 다이얼로그(`@toss/tds-react-native`).

### 신규 RN 구현 시 변경점

- 인증 헤더로 전환.
- 확인 다이얼로그는 TDS Dialog 사용.

---

## 1.7 기능 g) 테마 기반 요리 추천 (Phase 6 — ADR-016)

### 사용자 흐름

1. 홈에서 "오늘의 추천 받기" CTA 탭 → `/recipe/recommend` 진입.
2. ThemePicker로 상황(6종) + 날씨(5종) 중 최소 1개 선택.
3. "추천받기" Button 탭 → `POST /api/recommendations { theme }` 호출.
4. 응답 카드 5개(요리명·설명·태그) 렌더. 사용자가 카드 탭.
5. `/recipe/generate?dishName=<요리명>` 네비 → 기존 SSE 생성 플로우 재사용.
6. 재추천: ThemePicker 변경 시 자동 재호출(이전 in-flight abort) 또는 `refresh()` 액션.

### 수용 기준 (AC6.* — 10-SPRINT-PLAN §10.7 동기)

- AC6.1 테마 미선택 시 "추천받기" Button disabled.
- AC6.2 응답 정확히 5개. zod `length(5)` 위반 시 INTERNAL_ERROR.
- AC6.3 카드 탭 → `/recipe/generate?dishName=<선택>` 네비 + SearchForm prefilled.
- AC6.4 테마 변경 시 이전 in-flight abort + 새 fetch + 결과 교체.
- AC6.5 401/네트워크/AbortError 한국어 사용자 친화 메시지.
- AC6.6 추천 결과 하단 AI 면책 1줄(ADR-015 D40 패턴).

### 관련 API

| 메서드 | 경로 | 인증 | 비고 |
|--------|------|------|------|
| POST | `/api/recommendations` | 필요(`X-Toss-User-Id`) | 비-stream JSON |

요청: `{ theme: { situation?, weather? } }` (최소 1개).
응답: `{ data: { items: [{dishName, description, tags}] × 5, meta: { theme, generatedAt } } }`.

상세는 [03-API-CONTRACT.md §3.8](./03-API-CONTRACT.md).

### 관련 화면

- `/recipe/recommend` (신규).
- `/recipe/generate` (확장 — `dishName` URL 파라미터 수신, Phase 2부터 이미 지원).
- 홈 (`/`) — "오늘의 추천 받기" CTA 1개 추가(D50).

### 관련 컴포넌트

- `ThemePicker` (신규) — TDS `SegmentedControl.Root` + `.Item` 2개 축(상황·날씨).
- `RecommendationCard` (신규) — TDS `Pressable` + `Txt`(요리명·설명) + `Badge`(tags).
- `useRecommendations` (신규) — fetch + AbortController + theme hash 캐시(D51).

### 신규 RN 구현 시 변경점

- 백엔드 신규 엔드포인트(별 저장소 `AIReceipe`)는 외부 작업 PENDING(ADR-016).
- 미니앱 측은 zod 계약·api-client 메서드·UI까지 동결.

---

## 1.8 기능 ↔ 자산 매트릭스 (한눈 보기)

| 기능 | API | 인증 | 현재 화면 | 현재 컴포넌트 | 현재 훅 |
|------|-----|------|----------|--------------|---------|
| a) 생성 | `POST /api/recipes/generate` (stream) | 공개 | `/recipe/generate` | `SearchForm`, `RecipeDisplay` | `useRecipeGenerate` |
| b) 영양 | (a)에 임베드 | 공개 | (a)와 동일 | `NutritionPanel` | (a)와 동일 |
| c) 저장 | `POST /api/recipes` | 필요 | `/recipe/generate` 의 저장 | `RecipeDisplay` 액션 | `useRecipeGenerate` (또는 별도 mutation) |
| d) 목록 | `GET /api/recipes`, `GET /api/recipes/[id]` | 필요 | `/my-recipes`, `/recipe/[id]` | `RecipeCard`, `RecipeDisplay` | `useMyRecipes`, `useRecipe` |
| e) 즐겨찾기 | `PATCH /api/recipes/[id]/favorite` | 필요 | 목록·상세 | `FavoriteButton` | (목록/상세 훅에 포함) |
| f) 삭제 | `DELETE /api/recipes/[id]` | 필요 | 목록·상세 | (액션 버튼) | (목록/상세 훅에 포함) |
| g) 테마 추천 | `POST /api/recommendations` | 필요 | `/recipe/recommend` | `ThemePicker`, `RecommendationCard` | `useRecommendations` |

> 미니앱이 호출할 API 총 **7개 엔드포인트** (Phase 0~5 6개 + Phase 6 추천 1개). 자세한 shape·zod·CORS는 [03-API-CONTRACT.md](./03-API-CONTRACT.md).

## 1.9 미니앱에서 v1에 미구현되는 항목 (요약)

- 회원가입·로그인 폼·비밀번호 재설정 → `getAnonymousKey()` 자동 식별 (ADR-009 D2)
- 프로필 화면·계정 설정 → v1 범위 외
- 검색·필터(요리명 검색) → v1 범위 외 (favorite 필터만)
- 공유 → v1 범위 외 (추천은 Phase 6에서 도입 — §1.7)
- 알림 → v1 범위 외
- 자유 텍스트 테마 입력·추천 이미지·개인화 → Phase 7 진화 (ADR-016 누적 미해결)

> v1 이후 확장은 별 ADR/Sprint로 처리. 본 묶음은 Sprint 1 6기능 + Phase 6 추천을 다룬다.

## 1.10 SSOT 참조

- API 계약: `_workspace/01_architect_api_contract.md`
- 도메인 타입: `src/types/recipe.ts`, `src/types/api.ts`
- 컴포넌트: `src/components/AGENTS.md`
- 훅: `src/hooks/AGENTS.md`
- 페이지: `src/app/page.tsx`, `src/app/my-recipes/page.tsx`, `src/app/recipe/generate/page.tsx`, `src/app/recipe/[id]/page.tsx`
- ADR: ADR-001, ADR-005, ADR-006, ADR-009
