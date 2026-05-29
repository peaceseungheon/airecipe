# Phase 6 QA Report — 테마 기반 요리 추천 (ADR-016)

> 일자: 2026-05-29
> 검증자: orchestrator (메인 세션 — 팀원 무산출로 통합 수행, Phase 4.5·5 선례)
> 결과: **ALL PASS** — Q1~Q12 12/12 PASS, FAIL 0건. typecheck PASS, lint 0 errors(Phase 3 누적 router.gen.ts warning 1건만).

## 결과 요약

| 매트릭스 | 항목 | 결과 |
|----------|------|------|
| Q1 | SSOT ↔ zod ↔ api-client ↔ frontend 응답 shape 일치 | PASS |
| Q2 | 테마 미선택 시 zod refine + UI disabled | PASS |
| Q3 | 401 자동 재시도 1회 (apiFetch 단일 위치) | PASS |
| Q4 | 테마 변경 시 이전 in-flight abort + 새 fetch | PASS |
| Q5 | 카드 탭 → `/recipe/generate?dishName=<선택>` + SearchForm prefilled | PASS |
| Q6 | 추천 결과 정확히 5개 (zod `length(5)` 강제) | PASS |
| Q7 | AI 면책 1줄 (D52 — `typography="st11"`, `colors.grey600`) | PASS |
| Q8 | TDS 컴포넌트 실재성 (SegmentedControl/Pressable/Badge/Txt/Button/PageNavbar) | PASS |
| Q9 | hex 직접 사용 0건 (`colors.*` 토큰 — ADR-015 D39 준수) | PASS |
| Q10 | 한국어 에러 메시지 (ApiErrorCode 8종 매핑) | PASS |
| Q11 | SSOT 5종 갱신 정합성 (01/03/06/07/10) | PASS |
| Q12 | typecheck PASS + lint 0 errors | PASS |

## Q1. SSOT ↔ zod ↔ api-client ↔ frontend 응답 shape 일치

- **SSOT(03 §3.8.3)**: `{ data: { items × 5, meta: { theme, generatedAt } } }`.
- **zod(`src/lib/zod/recommendations.ts`)**: `recommendationsResponseSchema` — `items: array(itemSchema).length(5)` + `meta: { theme, generatedAt }`.
- **api-client(`src/services/recipes.ts:212`)**: `apiFetch('/api/recommendations', apiResponseSchema(recommendationsResponseSchema), ...)` → `wrapped.data: { items, meta }`.
- **frontend(`src/hooks/useRecommendations.ts:106`)**: `setItems(result.items)`. `result`은 `{ items, meta }`이고 `items: RecommendationItem[]`로 타입 일치.
- **카드(`src/components/RecommendationCard.tsx`)**: `item.dishName`/`item.description`/`item.tags` 모두 zod schema 동일.

**결과: PASS** — 경계면 4단계(SSOT/zod/api-client/frontend) 모두 정합.

## Q2. 테마 미선택 시 zod refine + UI disabled

- **zod(`recommendations.ts:23-26`)**: `recommendationThemeSchema.refine(v => v.situation !== undefined || v.weather !== undefined, ...)`.
- **UI(`recommend.tsx:39`)**: `const selected = theme.situation !== undefined || theme.weather !== undefined;`.
- **CTA(`recommend.tsx:104`)**: `<Button disabled={!selected || isLoading}>`.
- **훅(`useRecommendations.ts:81-86`)**: `if (!selected) { setItems([]); ... return; }` — 호출 보류.
- 미선택 상태일 때 안내 메시지 노출(`recommend.tsx:118-122`).

**결과: PASS** — AC6.1 통과. zod refine은 백엔드도 호출되기 전 frontend 측 가드로도 작동(보낼 일 없지만 방어선).

## Q3. 401 자동 재시도 1회

- **api-client(`api-client.ts:110-118`)**: `if (res.status === 401 && allowRetry && init.refreshTossUserId) { ... recursion with allowRetry=false }`.
- **useRecommendations(`useRecommendations.ts:107`)**: `refreshTossUserId` 전달 → 401 재시도 활성화.
- **useTossUserId**: refresh는 SDK `getAnonymousKey()` 재호출 후 새 hash 반환(05 §5.4 SSOT).

**결과: PASS** — Phase 1·3·4 패턴 재사용, 별도 변경 없음.

## Q4. 테마 변경 시 이전 in-flight abort + 새 fetch

- **`useRecommendations.ts:91-93`**: `abortRef.current?.abort()` → new AbortController.
- **`useRecommendations.ts:107`**: `signal: controller.signal` 전달 → `apiFetch`가 `fetch`에 주입(`api-client.ts:100`).
- **`useRecommendations.ts:78-85`**: theme 변경 시 useEffect 재실행(deps `[key, selected, theme, tossUserId, refreshTossUserId, trigger]`).
- **cleanup(`useRecommendations.ts:74-78`)**: unmount 시 `cancelledRef.current = true` + abort.

**결과: PASS** — AC6.4 통과. 동일 테마 재호출(`refresh()`)도 trigger 증가로 동일 경로 실행.

## Q5. 카드 탭 → `/recipe/generate?dishName=<선택>` + SearchForm prefilled

- **카드(`RecommendationCard.tsx:38`)**: `onPress` 콜백 위임.
- **페이지(`recommend.tsx:48-53`)**: `handleSelectDish(dishName)` → `navigation.navigate('/recipe/generate', { dishName })`.
- **generate(`generate.tsx:46-57`)**: `validateParams`에서 `dishName: string` 수신.
- **SearchForm**: Phase 2부터 `initialDishName`/`initialServings` prop 지원 — `generate.tsx` 본문에서 이미 사용 중.

**결과: PASS** — AC6.3 통과. generate.tsx 측 변경 없음(이미 지원).

## Q6. 추천 결과 정확히 5개

- **zod(`recommendations.ts:46`)**: `z.array(recommendationItemSchema).length(5)`.
- **api-client → zod 검증**: `apiFetch`가 `schema.safeParse` 실패 시 `ApiClientError('INTERNAL_ERROR', '서버 응답 형식이 올바르지 않아요.')` throw(`api-client.ts:124-131`).
- **에러 경로**: `useRecommendations` catch에서 한국어 메시지로 변환.

**결과: PASS** — AC6.2 통과. 백엔드가 5개를 보장하지 않으면 사용자에게 명확한 에러 노출.

## Q7. AI 면책 1줄 (D52)

- **위치(`recommend.tsx:152-158`)**: `items.length > 0` 분기 하단 fixed.
- **스타일**: `<Txt typography="st11" color={colors.grey600}>`.
- **카피**: "AI가 생성한 참고용 추천이에요. 식당·식자재 등 실제 상황을 고려해 선택해주세요."
- **Phase 5 D40 NutritionPanel 패턴과 동일**.

**결과: PASS** — AC6.6 통과.

## Q8. TDS 컴포넌트 실재성

- `SegmentedControl.Root` + `.Item` — Phase 4 FilterTabs에서 검증 PASS(06 §6.5).
- `Pressable` — react-native 표준.
- `Badge` — Phase 3·4 RecipeCard 사용 PASS.
- `Txt` typography(`t4`, `t5`, `st9`, `st11`) — Phase 2·3·4·5 누적 사용 PASS.
- `Button` `type="primary"|"light"` × `style="fill"|"weak"` — Phase 2·4 누적 PASS.
- `PageNavbar` + `.Title` — Phase 2부터 사용.
- `colors.*`(white, grey200, grey500, grey600, grey700, grey900, red50, red700, grey100) — Phase 5 D39 토큰 카탈로그.

**결과: PASS** — 모든 컴포넌트가 `@toss/tds-react-native` 실재. 추가 검증 없이 PASS.

## Q9. hex 직접 사용 0건

```
grep -rEn "['\"]#[0-9a-fA-F]{3,8}['\"]" src/components/{ThemePicker,RecommendationCard}.tsx \
  src/hooks/useRecommendations.ts src/lib/zod/recommendations.ts \
  src/pages/recipe/recommend.tsx
→ (0건)
```

**결과: PASS** — ADR-015 D39 준수. 신규 파일 5종 모두 `colors.*` 토큰만 사용.

## Q10. 한국어 에러 메시지 (ApiErrorCode 8종 매핑)

- **`useRecommendations.ts:142-151`**: `ERROR_CODE_MESSAGES: Record<ApiErrorCode, string>` — 8종 모두 매핑.
- **`toUserMessage`**: `ApiClientError` 분기 + fallback `INTERNAL_ERROR`.
- **`pages/recipe/recommend.tsx:139-144`**: error state 렌더 — 한국어 메시지 + "다시 시도" Button.
- HTTP 상태 직접 분기 0건(03 §3.10 #2 + #7 통일).

**결과: PASS** — Phase 1·3·4 패턴 누적.

## Q11. SSOT 5종 갱신 정합성

| SSOT | 절 | 갱신 내용 |
|------|----|-----------|
| 01-FEATURES | §1.7 신설 + §1.8/§1.9/§1.10 renumber + 매트릭스 행 추가 | 기능 g) 흐름·AC·관련 API·화면·컴포넌트 |
| 03-API-CONTRACT | §3.8 신설 + §3.9/§3.11(#6 5→6)/§3.13 갱신 | 엔드포인트 7 신설 + HTTP 매트릭스 행 |
| 06-UI-MAPPING | §6.10 신설 | ThemePicker + RecommendationCard 시그니처 + AI 면책 |
| 07-ROUTING | §7.3.6 신설 + 라우트 표 행 5 + Navbar 분산 표 | `/recipe/recommend` |
| 10-SPRINT-PLAN | §10.7 신설 + §10.8/§10.10 renumber + 의존성 그래프 | Phase 6 AC6.1~AC6.6 |

- ADR-016 의 SSOT 인용 위치 모두 일치.
- 한국어 라벨(상황 6종 + 날씨 5종)은 03 §3.8.2 표를 단일 SSOT로 ThemePicker가 의존(`SITUATION_LABELS`/`WEATHER_LABELS`).
- 03 §3.8.4 에러 코드는 `ApiErrorCode` 8종 카탈로그 재사용(신규 코드 0건).

**결과: PASS** — 5종 SSOT + ADR-016 모두 동기.

## Q12. typecheck PASS + lint 0 errors

```
$ pnpm typecheck
> tsc --noEmit
(0 errors)

$ pnpm lint
> eslint .
src/router.gen.ts
  1:1  warning  Unused eslint-disable directive (no problems were reported)
✖ 1 problem (0 errors, 1 warning)
```

- router.gen.ts warning은 Phase 3부터 누적된 무해 warning(eslint-disable directive — granite 자동 생성 산출물).

**결과: PASS** — Phase 5와 동일 상태.

## 외부 작업 PENDING (코드 측 통과 — ADR-016 외)

| 항목 | 상태 |
|------|------|
| 백엔드 `app/api/recommendations/route.ts` 구현 | 별 저장소 `AIReceipe`에 인계 |
| CORS 화이트리스트 등록 | 외부 |
| staging·prod 배포 | 외부 |
| 실 송출 검증 (5개 응답·zod 통과·401 자동 재시도) | 백엔드 배포 후 |
| `/recipe/recommend` granite 자동 라우트 생성 | granite build 시 router.gen.ts 자동 — 본 사이클은 수동 갱신 |

## 미해결 (Phase 7 진화 — 별 ADR)

ADR-016 §누적 미해결 참조:
- 자유 텍스트 테마 입력 (D44 보조)
- 추천 이미지 URL (D45 보조)
- 개인화 추천 (D47 보조 — 과거 저장 레시피 기반)
- 추천 결과 위치 광고 (ADR-014 D34 후속)
- 다크 모드 adaptive 토큰 (ADR-015 D39 보조)
- AbortSignal cast 2곳 (ADR-011 D13)
- 무한 스크롤 (Phase 3 인계)
- 카드 측 삭제 UX swipe·long-press (ADR-013 D22)
- 다중 동시 PATCH 큐 (Phase 4 v1 한계)
- 전면 광고 wiring (ADR-014 D30·D34)
- Analytics SDK (ADR-014 D33)
