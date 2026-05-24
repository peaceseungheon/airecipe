# Phase 2 — 레시피 생성 화면 + 스트리밍 (기능 a, b)

> 출처: 사용자 요청 "Phase 2 진입"
> SSOT: `docs/appsintoss-port/10-SPRINT-PLAN.md` §10.3

## 목적

요리명 입력 → AI 스트리밍 응답을 점진 표시 → 최종 레시피·영양 정보가 완성된 상태로 화면에 노출. **저장 전**(`GeneratedRecipe`) 단계까지.

## 입력 전제 (Phase 1 완료)

- ADR-010 동결 + AGENTS.md 4종 + zod@^4.4.3.
- `src/types/{recipe,api,user,env.d,index}.ts` — 6 엔드포인트 타입·`GeneratedRecipe`·`StreamChunk` 유니온 정의됨.
- `src/lib/zod/{api,recipe,index}.ts` — `generatedRecipeSchema`, `apiResponseSchema` factory 등 응답 검증.
- `src/services/{api-client,recipes,index}.ts` — `apiFetch`(401 1회 재시도) + 6 도메인 함수. `generateRecipe`는 현재 **stream:false 강제** (Phase 2에서 스트리밍 지원 추가 필요).
- `src/hooks/useTossUserId.tsx` — Toss SDK 단일 격리, Provider, `refresh: () => Promise<TossUserId>`.
- `src/_app.tsx` — `TossUserIdProvider` 마운트.
- `src/pages/index.tsx` — Phase 1 dev-only 트리거 잔존 → **Phase 2 진입 시 일괄 제거**.
- TDS RN `@toss/tds-react-native@^2.0.3` 설치됨, 사용 0건.

## 산출물 (10-SPRINT-PLAN §10.3 출력)

### 화면 (Granite 파일 라우팅)
- **홈 화면** (`src/pages/index.tsx`) — TDS Navbar + 생성 화면 진입 버튼 + 마이 레시피 진입(Phase 3 자리표시는 disabled OK). Phase 1 dev 트리거 제거.
- **레시피 생성 화면** (`src/pages/generate.tsx` 또는 동등 경로) — `SearchForm` 대응 (TextField/NumericSpinner/Button).
- **결과 표시 화면** (생성 화면 내 결과 영역 또는 별 라우트) — `RecipeDisplay` + `NutritionPanel` 대응. 진행 중 점진 표시 + 완성 시 최종 노출.

### 컴포넌트 (TDS 매핑 — 06 §6.4.1~3)
- `src/components/SearchForm.tsx` — TDS `TextField` + `NumericSpinner` + `Button`. 콜백 시그니처 `(dishName: string, servings: number) => void`. 클라이언트 측 zod 검증(공백·1~100자·1~20인분).
- `src/components/RecipeDisplay.tsx` — `View`+`Txt`+`Badge`+`List/ListRow`+actions slot. **공통 필드만 사용** (`id` 미참조, 불변식 2).
- `src/components/NutritionPanel.tsx` — 칼로리 강조 + 4 매크로 + healthNote.
- `src/components/recipe-format.ts` — `difficultyLabel`/`difficultyVariant`/`formatCookTime` 순수 함수.
- (필요 시) `src/components/AppNavbar.tsx` — 화면별 TDS `Navbar` 공통 래퍼. 06 §6.4.6 가이드에 따라.

### 인프라
- `src/services/api-client.ts` 또는 신규 `src/services/sse-client.ts` — SSE → fetch stream 어댑터. `Response.body` ReadableStream 파싱(`event:` + `data:`), `StreamChunk` discriminated union 분기(meta/text/recipe/error/done), `AbortController` 취소.
- `src/services/recipes.ts` — `generateRecipe` 스트리밍 모드 추가 (또는 별 `generateRecipeStream`). signal 전달.
- `src/hooks/useRecipeGeneration.ts` (또는 동등) — 입력→호출→점진 상태→최종 결과→에러→취소를 React 상태로 캡슐화. unmount/뒤로가기에서 abort.
- `src/lib/zod/stream.ts` — `StreamChunk` zod 스키마(이미 `src/types/api.ts`에 타입 있으면 zod로 보강).

### 라우팅 (Granite 파일 기반 — 07-ROUTING)
- `src/pages/index.tsx` 재작성 + `src/pages/generate.tsx` 신규. `useNavigation`으로 진입.
- `src/router.gen.ts` 자동 갱신 확인.

## 수용 기준 (10-SPRINT-PLAN §10.3 AC2.*)

- **AC2.1**: "김치찌개" 입력 → 생성 버튼 → 텍스트 점진 표시 → 최종 레시피·영양 정보 완성.
- **AC2.2**: 뒤로가기 시 in-flight 요청 abort, UI 일관 상태.
- **AC2.3**: 빈/공백 요리명 시 클라이언트에서 차단(zod min(1) + trim).
- **AC2.4**: 백엔드 502/429 응답을 청크 또는 HTTP 상태로 받아 사용자 친화적 한국어 메시지.
- **AC2.5**: 응답이 `GeneratedRecipe` 타입 (id 없음) — 저장 전 임을 확실히 (TS·런타임 가드).
- **AC2.6**: 비로그인 상태(헤더 없이)에서도 생성 정상 동작 (`generate`는 공개 — 03 §3.2.1).

## SSOT 인용 경로

| 영역 | 챕터 |
|------|------|
| 생성 엔드포인트 (요청·SSE 청크·에러) | `docs/appsintoss-port/03-API-CONTRACT.md` §3.2 |
| 스트리밍 wire 형식 + 미니앱 소비 규칙 | `docs/appsintoss-port/03-API-CONTRACT.md` §3.2.4 + `08-STREAMING.md` |
| AI Provider 응답 차이 (Gemini 부분 JSON / Claude tool 강제) | `docs/appsintoss-port/04-AI-PROVIDER.md` §4.5 |
| TDS 컴포넌트 매핑 (SearchForm/RecipeDisplay/NutritionPanel) | `docs/appsintoss-port/06-UI-MAPPING.md` §6.4.1, §6.4.2, §6.4.3 |
| TDS UI primitives (Button/TextField/Badge/Card/etc) | `docs/appsintoss-port/06-UI-MAPPING.md` §6.3 |
| Granite 파일 라우팅 + useNavigation | `docs/appsintoss-port/07-ROUTING.md` |
| 백엔드 호출 헤더(공개 generate는 헤더 생략 가능) | `docs/appsintoss-port/05-AUTH.md` §5.3 |
| Phase 1 동결 규약 | `docs/adr/ADR-010-miniapp-phase1-conventions.md` |
| 디렉터리 책임 | `src/{types,lib/zod,services,hooks}/AGENTS.md` |

## 비범위

- Phase 3 이후 기능 — 저장(`POST /api/recipes`)·목록·상세·즐겨찾기·삭제. 결과 화면의 "저장" 버튼은 Phase 3에서 추가.
- 백엔드 옵션 P 후속 ADR 배포(별 저장소 AIReceipe) — AC2.6은 공개 엔드포인트라 독립적이므로 영향 없음.
- 마이 레시피·상세 라우트 — Phase 3.

## 위험·완화

| 위험 | 완화 |
|------|------|
| TDS 컴포넌트(NumericSpinner/Badge/Navbar 등) 실제 패키지 미존재 또는 props 차이 | 06-UI-MAPPING의 매핑을 실 import로 검증. 차이 시 architect에게 통지 → 06 §6.5 갱신 + 합성/대안 결정. |
| `@apps-in-toss/web-framework` 패키지 경로 미해결(ADR-010 D7) | Phase 2 첫 `granite dev` 실행 시 검증. 실패 시 ADR-010 §롤백 R1 적용. |
| Gemini 부분 JSON 점진 렌더링 시 깜빡임 | 08-STREAMING의 누적/디바운싱 전략 적용. 본 Phase에서 가시적 UX 차이 측정. |
| `recipe` 청크 zod 검증 실패 (백엔드 응답 미세 차이) | 검증 실패 시 사용자 친화적 한국어 에러(`AI 응답을 이해하지 못했어요`). 디버그 로그는 stack에만(평문 hash·body 평문 노출 금지). |
| RN `fetch` ReadableStream 지원 검증 | 첫 호출 시 검증. 미지원이면 `Response.text()` 폴백 — 08-STREAMING 대안 절 인용. |
| 라우팅 가드(뒤로가기 시 abort)에서 `useEffect` cleanup 누락 | useEffect cleanup + AbortController.abort() 단위 테스트로 보장. |
