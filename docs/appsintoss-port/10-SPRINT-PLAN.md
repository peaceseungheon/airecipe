# 10. 스프린트 계획 — Phase 0~5 구현 순서·의존성·수용 기준

> **이 챕터 전에 알아야 할 것**: 본 묶음 00~09 챕터 모두 + ADR-009.
>
> **이 챕터 완료 후**: 신규 RN+Granite 미니앱 LLM이 본 챕터를 따라 Phase 0부터 순차 실행한다.

---

## 10.0 개요

본 챕터는 신규 미니앱을 **빈 저장소에서 출시 가능 상태까지** 가져가는 단계별 계획을 제공한다. 각 Phase는:

- 목적 (한 줄)
- 입력 (선행 완료 항목)
- 출력 (산출물)
- 핵심 작업 체크리스트
- 의존하는 챕터·외부 자산
- 완료 수용 기준 (다음 Phase로 넘어가는 기준)

전체 의존성:

```
Phase 0  프로젝트 스캐폴딩
   ↓
Phase 1  공유 타입·API 클라이언트·식별자 훅
   ↓
Phase 2  레시피 생성 화면 + 스트리밍 (기능 a, b)
   ↓
Phase 3  레시피 저장·마이 레시피·상세 (기능 c, d)
   ↓
Phase 4  즐겨찾기·삭제 (기능 e, f) + 404 UI 통일
   ↓
Phase 5  출시 준비 (TDS 점검·콘솔 등록·검수 체크리스트)
```

각 Phase는 **수용 기준을 충족하기 전까지 다음 Phase 진입 금지**. 의존성 위반은 통합 버그의 주된 원인.

## 10.1 Phase 0 — 프로젝트 스캐폴딩

### 목적
빈 저장소에서 시작해 "Welcome" 화면이 토스 앱 내(또는 샌드박스)에서 표시될 때까지.

### 입력
- 본 묶음 [00-OVERVIEW.md](./00-OVERVIEW.md), [09-ENV-CONFIG.md](./09-ENV-CONFIG.md).
- 앱인토스 콘솔 접근 권한 (appName·아이콘 등록).
- 백엔드 도메인 결정 (production·staging URL).

### 출력
- 새 git 저장소 + `granite.config.ts` + 기본 라우팅 1화면.
- 로컬 dev 서버 동작 + 토스 샌드박스 미니앱 진입 가능.

### 작업 체크리스트
- [ ] `npm create granite-app` 또는 동등 명령으로 스캐폴딩 (Granite >= 1.0).
- [ ] `@apps-in-toss/framework`, `@granite-js/react-native`, `@granite-js/plugin-env`, `@toss/tds-react-native` 설치.
- [ ] [09-ENV-CONFIG.md](./09-ENV-CONFIG.md) 9.2의 `granite.config.ts` 작성 (RFC-1123 appName, 한글 displayName, icon URL, scheme: 'intoss').
- [ ] `.env.local` / `.env.staging` / `.env.production` 또는 동등 메커니즘으로 `API_BASE_URL`, `APP_ENV` 주입.
- [ ] 콘솔에 앱 등록 (appName·displayName·아이콘 업로드·카테고리: 비게임·고객센터 URL).
- [ ] 기본 라우트 1개 (홈) 동작 확인.
- [ ] `getAnonymousKey()` 호출 → hash 받아오기 확인 (콘솔 로그 또는 화면 표시 임시).

### 의존 챕터
- [00-OVERVIEW.md](./00-OVERVIEW.md) — 원칙·읽기 순서
- [09-ENV-CONFIG.md](./09-ENV-CONFIG.md) — granite.config.ts·환경변수

### 의존 외부 자산
- 백엔드 운영 URL (이 단계에서는 호출 불필요, 환경변수만 선반영)
- 앱인토스 콘솔

### 수용 기준
- AC0.1. `granite dev` 또는 동등 명령으로 로컬 dev 서버 기동.
- AC0.2. 토스 샌드박스(또는 QR)로 미니앱 진입 → 홈 화면 표시.
- AC0.3. `import.meta.env.API_BASE_URL`이 빌드 산출물에 인라인됨 확인.
- AC0.4. `getAnonymousKey()` 호출이 `undefined`가 아닌 hash 반환 (SDK 2.4.5+ 기준).
- AC0.5. 콘솔 등록 정보(appName·displayName)와 `granite.config.ts` 일치.

---

## 10.2 Phase 1 — 공유 타입·API 클라이언트·식별자 훅

### 목적
6개 엔드포인트 호출을 위한 **공통 인프라**를 만든다. 실제 화면 구현 전에 단일 호출 경로를 표준화.

### 입력
- Phase 0 완료.
- [02-DATA-MODEL.md](./02-DATA-MODEL.md), [03-API-CONTRACT.md](./03-API-CONTRACT.md), [05-AUTH.md](./05-AUTH.md) (backend가 작성).

### 출력
- `src/types/recipe.ts`·`api.ts` (현재 웹에서 복사).
- `src/services/api-client.ts` (헤더 자동 주입 fetch 래퍼).
- `src/hooks/useTossUserId.ts` (식별자 발급·캐싱 훅).
- 401 자동 재시도(식별자 재발급 1회) 로직.
- zod 스키마(현재 `recipe-schema.ts` 참조)로 응답 검증.

### 작업 체크리스트
- [ ] 현재 웹의 `src/types/recipe.ts`·`api.ts`·`user.ts`(`User` 인터페이스는 Toss 기반으로 재정의)를 미니앱 저장소로 복사.
- [ ] `getAnonymousKey()`를 SecureStore 또는 메모리에 캐싱하는 `useTossUserId` 훅 작성. 첫 호출 시 1회 발급, 이후 캐시.
- [ ] `apiFetch(path, init)` 래퍼 작성. `tossUserId`를 받으면 `X-Toss-User-Id` 헤더 자동 추가. base URL은 `import.meta.env.API_BASE_URL`.
- [ ] 401 응답 시 식별자 재발급 후 1회 재시도. 두 번째도 401이면 에러 throw.
- [ ] 응답 unwrap 유틸 (`.data` 추출 + 에러 코드 분기).
- [ ] zod 검증 도입 — 현재 `src/lib/ai/recipe-schema.ts` 또는 등가 위치의 zod 스키마를 미니앱에 복사하여 응답 검증.

### 의존 챕터
- [02-DATA-MODEL.md](./02-DATA-MODEL.md) — 사용자 식별 옵션 P(미니앱은 헤더만 알면 됨)
- [03-API-CONTRACT.md](./03-API-CONTRACT.md) — 6개 엔드포인트 shape
- [05-AUTH.md](./05-AUTH.md) — `X-Toss-User-Id` 헤더 송출 패턴

### 의존 외부 자산
- 현재 웹 `src/types/recipe.ts`, `src/types/api.ts`, `src/types/user.ts` (복사 원본)
- 백엔드 운영 URL (호출 가능)

### 수용 기준
- AC1.1. 미니앱 첫 진입 시 `useTossUserId()`가 hash를 반환.
- AC1.2. `apiFetch('/api/recipes', { tossUserId })` → 200 OK + `{ data: [], meta: {...} }` (빈 사용자).
- AC1.3. `apiFetch('/api/recipes')` (헤더 누락) → 401 받고 자동 재시도 후 정상.
- AC1.4. 응답 shape이 zod 검증 통과. snake_case 키 미존재 확인.
- AC1.5. 6개 엔드포인트 모두 호출 가능 상태(아직 UI 없음, 콘솔 또는 임시 버튼으로 호출).

---

## 10.3 Phase 2 — 레시피 생성 화면 + 스트리밍 (기능 a, b)

### 목적
요리명 입력 → AI 스트리밍 응답을 점진 표시 → 영양 정보까지 완성된 상태로 화면 노출.

### 입력
- Phase 1 완료.
- [04-AI-PROVIDER.md](./04-AI-PROVIDER.md) (백엔드 내부 동작 이해용), [06-UI-MAPPING.md](./06-UI-MAPPING.md), [07-ROUTING.md](./07-ROUTING.md), [08-STREAMING.md](./08-STREAMING.md).

### 출력
- 홈 화면 (기본).
- 레시피 생성 화면 (`SearchForm` 대응 TDS 컴포넌트, 입력+버튼).
- 결과 표시 화면 (`RecipeDisplay` + `NutritionPanel` 대응 TDS 컴포넌트).
- SSE → fetch stream 어댑터 + `AbortController` 취소.

### 작업 체크리스트
- [ ] Granite 라우팅에서 홈 + 생성 화면 라우트 등록(07-ROUTING).
- [ ] 입력 폼 (요리명 + 인분 수, 클라이언트 측 zod 검증).
- [ ] `fetch('/api/recipes/generate', { method: 'POST', body: { dishName, servings, stream: true } })`로 스트리밍 호출.
- [ ] `Response.body`를 `ReadableStream`으로 읽어 `event:` + `data:` 라인 파싱 (08-STREAMING).
- [ ] 청크 타입 분기: `meta`(시작 알림), `text`(점진 표시), `recipe`(최종 결과), `error`(에러 청크), `done`(종료).
- [ ] `recipe` 청크의 `recipe`를 최종 결과로 상태 저장 → 결과 화면 렌더.
- [ ] 사용자 취소(뒤로가기·취소 버튼)에서 `AbortController.abort()`.
- [ ] Gemini 부분 JSON 점진 렌더링 시 깜빡임 방지 (08-STREAMING 가이드).
- [ ] 영양 정보 UI는 `NutritionPanel` 대응 TDS 카드/리스트.
- [ ] 에러 청크 도달 시 한국어 에러 UI.
- [ ] 클라이언트 측 응답 shape zod 검증 (`GeneratedRecipe`).

### 의존 챕터
- [04-AI-PROVIDER.md](./04-AI-PROVIDER.md) — Gemini/Claude 응답 차이 이해 (Gemini 부분 JSON 가능성)
- [06-UI-MAPPING.md](./06-UI-MAPPING.md) — `SearchForm`/`RecipeDisplay`/`NutritionPanel` → TDS 매핑
- [07-ROUTING.md](./07-ROUTING.md) — 라우트 정의
- [08-STREAMING.md](./08-STREAMING.md) — SSE → fetch stream

### 수용 기준
- AC2.1. "김치찌개" 입력 → 생성 버튼 → 텍스트 점진 표시 → 최종 레시피·영양 정보 완성.
- AC2.2. 뒤로가기 시 in-flight 요청 abort, UI 일관 상태.
- AC2.3. 빈/공백 요리명 시 클라이언트에서 차단.
- AC2.4. 백엔드 502/429 응답을 청크 또는 HTTP 상태로 받아 사용자 친화적 한국어 메시지.
- AC2.5. 응답이 `GeneratedRecipe` 타입 (id 없음) — 저장 전 임을 확실히.
- AC2.6. 비로그인 상태(헤더 없이)에서도 생성 정상 동작.

---

## 10.4 Phase 3 — 저장·목록·상세 (기능 c, d)

### 목적
생성된 레시피를 저장하고, 마이 레시피 목록에서 조회/페이지네이션/필터, 상세 화면 진입까지.

### 입력
- Phase 2 완료.
- [03-API-CONTRACT.md](./03-API-CONTRACT.md) 2/2.5/3절 (목록·단건·저장).
- [06-UI-MAPPING.md](./06-UI-MAPPING.md), [07-ROUTING.md](./07-ROUTING.md).

### 출력
- 결과 화면의 "저장" 버튼 동작 (`POST /api/recipes`).
- 마이 레시피 목록 화면 (`RecipeCard` 대응 TDS 리스트).
- 페이지네이션 또는 무한 스크롤, 즐겨찾기 필터.
- 레시피 상세 화면 (`GET /api/recipes/[id]`).

### 작업 체크리스트
- [ ] "저장" 버튼 → `apiFetch('/api/recipes', { method: 'POST', body: { recipe: GeneratedRecipe }, tossUserId })`.
- [ ] 저장 성공 시 마이 레시피 캐시 무효화 + 상세 화면(또는 마이 탭)으로 이동.
- [ ] 마이 레시피 화면: `GET /api/recipes?page=&pageSize=&favorite=` 호출, 응답 `meta.pageSize`를 신뢰(clamp).
- [ ] 카드 탭 → `/recipe/[id]` 라우트 진입, `GET /api/recipes/[id]` 호출.
- [ ] 401 시 식별자 재발급 재시도(Phase 1 로직 활용).
- [ ] 404 시 "레시피를 찾을 수 없어요" UI (ADR-005 정책).
- [ ] 빈 목록 시 빈 상태 UI.

### 의존 챕터
- [03-API-CONTRACT.md](./03-API-CONTRACT.md) — 2절(목록), 2.5절(단건), 3절(저장)
- [06-UI-MAPPING.md](./06-UI-MAPPING.md) — `RecipeCard`·`RecipeDisplay` 매핑
- [07-ROUTING.md](./07-ROUTING.md) — 마이 탭·상세 라우트

### 수용 기준
- AC3.1. Phase 2에서 생성한 레시피 저장 → 201 + `Recipe`(id 포함) 응답.
- AC3.2. 마이 레시피 진입 시 방금 저장한 레시피가 첫 페이지에 보임.
- AC3.3. 카드 탭 → 상세 화면 진입 → 새로고침(라우트 재진입)에도 정상 표시.
- AC3.4. `pageSize=100` 요청 시 백엔드가 50으로 clamp, 응답 `meta.pageSize=50` 미니앱이 신뢰.
- AC3.5. 두 명의 다른 식별자로 저장 → 서로 보이지 않음 (소유자 격리).
- AC3.6. `?favorite=true` 필터 동작 (Phase 4의 즐겨찾기 이후 실증 가능).

---

## 10.5 Phase 4 — 즐겨찾기·삭제 + 404 UI 통일 (기능 e, f)

### 목적
즐겨찾기 토글과 삭제를 완성하고, 404 케이스를 모든 화면에서 일관 처리.

### 입력
- Phase 3 완료.
- [03-API-CONTRACT.md](./03-API-CONTRACT.md) 4/5절.

### 출력
- 별 아이콘 토글 (`FavoriteButton` 대응 TDS 버튼) + 낙관적 업데이트.
- 삭제 다이얼로그 + `DELETE /api/recipes/[id]` 호출 + 목록 제거.
- 404 분기 일원화 ("레시피를 찾을 수 없어요" 컴포넌트).

### 작업 체크리스트
- [ ] `PATCH /api/recipes/[id]/favorite` 호출 시 본문에 `{ isFavorite: boolean }` (목표 값, 토글 아님).
- [ ] 낙관적 업데이트 후 응답 도착 시 확정, 실패 시 롤백.
- [ ] 삭제: 확인 다이얼로그 (TDS Dialog) → `DELETE` → 목록 제거 + 캐시 무효화.
- [ ] 404 응답을 받는 3개 엔드포인트(GET[id]·PATCH·DELETE) 모두 동일 "찾을 수 없어요" UI로 라우팅.
- [ ] 동시성: PATCH 두 번 빠르게 → 마지막 의도가 보장됨 (멱등 — `isFavorite` 목표 값 명시 덕분).

### 의존 챕터
- [03-API-CONTRACT.md](./03-API-CONTRACT.md) — 4절(즐겨찾기), 5절(삭제), 0.3절(소유권 정책)
- [06-UI-MAPPING.md](./06-UI-MAPPING.md) — `FavoriteButton`·Dialog 매핑

### 수용 기준
- AC4.1. 즐겨찾기 토글 시 별 즉시 채워짐 → 응답 OK → 그대로 / 실패 → 롤백.
- AC4.2. 즐겨찾기 필터 토글 시 목록이 즉시 갱신.
- AC4.3. 삭제 확인 → 200 + `{ data: { id } }` → 목록에서 제거.
- AC4.4. 이미 삭제된 id로 다시 PATCH/DELETE 시 404 → 동일 "찾을 수 없어요" UI.
- AC4.5. 두 명의 다른 식별자 시나리오에서 격리 유지.

---

## 10.6 Phase 5 — 출시 준비 (TDS 점검·콘솔·검수 체크리스트)

### 목적
앱인토스 검수 통과·출시 가능 상태.

### 입력
- Phase 0~4 완료.
- [09-ENV-CONFIG.md](./09-ENV-CONFIG.md) 9.6 출시 정책 점검.

### 출력
- 검수 통과한 미니앱 빌드 + 콘솔 검토 요청 제출.

### 작업 체크리스트
- [ ] **TDS 컴포넌트 사용 검증** — 모든 화면이 `@toss/tds-react-native` 컴포넌트 또는 그 위의 컴포지션. 커스텀 색상·폰트는 TDS 토큰 활용.
- [ ] **번들 100MB 이하** (압축 해제). 이미지 등 리소스 분리.
- [ ] **권한 최소화** — `permissions: []` 또는 명확히 필요한 권한만.
- [ ] **CORS·도메인 화이트리스트** — 백엔드와 마지막 점검 (09-ENV-CONFIG 9.3).
- [ ] **에러 처리 점검** — 401·404·429·502·503 모든 경로에 사용자 친화적 한국어 UI.
- [ ] **고객센터·홈페이지** 콘솔 등록 — 내비게이션 바 더보기 기능 정상.
- [ ] **공유하기 기능** — 미니앱 이름과 딥링크 표시 확인.
- [ ] **AI 면책 문구** — 영양 정보·`healthNote`가 의료 자문이 아님을 명시 (서비스 오픈 정책 점검).
- [ ] **샌드박스 전 시나리오 테스트** — 6기능 모두 정상.
- [ ] **출시 정책 준수** — 디지털 자산·도박·자금세탁 카테고리 미해당 (`intro/guide.md` 1절).

### 의존 챕터
- [09-ENV-CONFIG.md](./09-ENV-CONFIG.md) — 9.5 보안 체크리스트, 9.6 출시 정책 점검
- 모든 앞 챕터 통과 후 진입

### 의존 외부 자산
- 앱인토스 콘솔 (검토 요청 제출)
- 백엔드 운영 안정성 (Vercel)

### 수용 기준
- AC5.1. 검수 가이드(비게임) 체크리스트 항목 모두 통과.
- AC5.2. 콘솔에서 "검토 요청" 제출 → 반려 사유 없음.
- AC5.3. 토스앱 5.246.0 이상 기준으로 미니앱 진입·홈 화면 등록 동작.
- AC5.4. 사용자 6기능 e2e (회원가입 없음 → 자동 진입 → 6기능 사용 → 종료) 무결성.

---

## 10.7 Phase 6 — 테마 기반 요리 추천 (기능 g, ADR-016)

### 목적
테마(상황·날씨) 선택 → 5개 요리 추천 → 카드 탭 시 기존 생성 화면 재사용.

### 입력
- 03-API-CONTRACT §3.8 (`POST /api/recommendations`)
- 06-UI-MAPPING §6.10 (ThemePicker, RecommendationCard)
- 07-ROUTING §7.3.6 (`/recipe/recommend`)
- ADR-016 (D44~D52 9 결정)

### 출력
- `src/lib/zod/recommendations.ts` (신규)
- `src/services/recipes.ts` 확장 — `getRecommendations` 메서드
- `src/hooks/useRecommendations.ts` (신규)
- `src/components/ThemePicker.tsx`, `src/components/RecommendationCard.tsx` (신규)
- `src/pages/recipe/recommend.tsx` (신규)
- `src/pages/index.tsx` 확장 — "오늘의 추천 받기" CTA 1개 추가

### 작업 체크리스트
- [ ] 03 §3.8 zod 스키마 동결 → `src/lib/zod/recommendations.ts`.
- [ ] `getRecommendations` 메서드 + 401 자동 재시도 (Phase 1·3·4 패턴 재사용).
- [ ] ThemePicker(SegmentedControl 2축) + RecommendationCard(Pressable+Txt+Badge).
- [ ] useRecommendations 훅 — theme deps + AbortController + refresh().
- [ ] `/recipe/recommend` 라우트 + Navbar 백 + 분기 렌더(로딩/에러/빈/정상).
- [ ] 홈 CTA 추가(D50).
- [ ] AI 면책 1줄(D52 — Phase 5 D40 패턴).
- [ ] typecheck PASS + lint 0 errors.

### 의존 챕터
- 03-API-CONTRACT §3.8
- 06-UI-MAPPING §6.10
- 07-ROUTING §7.3.6
- ADR-016, ADR-015 D40 (면책 패턴)

### 의존 외부 자산 (PENDING)
- 백엔드 신규 엔드포인트 — 별 저장소 `AIReceipe`.
- CORS 화이트리스트 등록.
- staging·prod 배포.

### 수용 기준
- AC6.1. 테마 미선택 시 "추천받기" Button disabled.
- AC6.2. 응답 정확히 5개(zod `length(5)` 강제). 위반 시 INTERNAL_ERROR.
- AC6.3. 카드 탭 → `/recipe/generate?dishName=<선택>` 네비 + SearchForm prefilled.
- AC6.4. 테마 변경 시 이전 in-flight abort + 새 fetch + 결과 교체.
- AC6.5. 401/네트워크/AbortError 한국어 사용자 친화 메시지.
- AC6.6. 추천 결과 하단 AI 면책 1줄(`typography="st11"`, `colors.grey600`).

> AC6.* 코드 측 통과 + 백엔드 미배포 상태에서는 401/404 한국어 안내(ADR-016 외부 작업 PENDING). 실 송출 검증은 백엔드 배포 후.

---

## 10.8 의존성 그래프 (한 화면)

```
Phase 0 (스캐폴딩)                 ── 09-ENV-CONFIG
   │
   ▼
Phase 1 (인프라)                   ── 02-DATA-MODEL, 03-API-CONTRACT, 05-AUTH
   │
   ▼
Phase 2 (생성 + 스트리밍)          ── 04-AI-PROVIDER, 06-UI-MAPPING, 07-ROUTING, 08-STREAMING
   │
   ▼
Phase 3 (저장·목록·상세)           ── 03-API-CONTRACT(2/2.5/3), 06-UI-MAPPING, 07-ROUTING
   │
   ▼
Phase 4 (즐겨찾기·삭제·404 통일)   ── 03-API-CONTRACT(4/5), ADR-005, 06-UI-MAPPING
   │
   ▼
Phase 5 (출시)                     ── 09-ENV-CONFIG 9.6, 검수 가이드
   │
   ▼
Phase 6 (테마 추천)                ── 03-API-CONTRACT §3.8, 06-UI-MAPPING §6.10, 07-ROUTING §7.3.6, ADR-016
```

## 10.9 위험·완화

| 위험 | 영향 | 완화 |
|------|------|------|
| `getAnonymousKey()` SDK 버전 미달 | 사용자 식별 불가 | granite.config.ts에서 최소 SDK 명시·진입 시 SDK 버전 체크 |
| 백엔드 옵션 P 미적용 | 401 무한 루프 | Phase 1 시작 전 backend가 옵션 P 미들웨어 배포 완료 확인 |
| Gemini 부분 JSON 깜빡임 | 생성 화면 UX 저하 | 08-STREAMING의 디바운싱/누적 전략 적용 |
| CORS 헤더 누락 | 모든 호출 실패 | Phase 1 첫 호출 즉시 CORS 응답 점검 |
| 번들 100MB 초과 | 검수 반려 | 리소스 분리·이미지 압축·`granite build --analyze` 활용 |
| 도메인 화이트리스트 미등록 | 외부 호출 거부 | Phase 0에서 콘솔 등록 우선 |
| TDS 미사용 | 검수 반려 | Phase 2부터 TDS 강제 — 커스텀 컴포넌트도 TDS 위에 |

## 10.10 SSOT 참조

- ADR-009 (포팅 결정), ADR-010~016 (Phase 1~6 결정)
- 본 묶음 00~09 챕터 전체
- 검수 가이드: `checklist/app-nongame.md`
- 출시 절차: `development/deploy.md`
- 서비스 오픈 정책: `intro/guide.md`
