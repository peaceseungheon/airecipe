# Phase 2 — frontend 산출 요약

> 작성: miniapp-frontend · 2026-05-24 · 팀 `airecipe-miniapp-phase2`
> 입력: `_workspace/00_input/requirements.md`, `_workspace/01_architect_phase2_baseline.md`,
>       `_workspace_phase1/02_frontend_summary.md`, `_workspace_phase1/02_api_client_summary.md`
> 범위: Phase 2 baseline §E.fe 분담 — TDS 컴포넌트·홈/생성 화면·dev 트리거 제거·about 정리

---

## 1. 산출 파일

### 신규 코드

| 파일 | 책임 | baseline 매핑 |
|------|------|--------------|
| `src/components/recipe-format.ts` | `difficultyLabel`/`difficultyTone`(positive/neutral/critical)/`formatCookTime`/`formatServings` 순수 함수 | §A.6, 06 §6.4.8 |
| `src/components/SearchForm.tsx` | 요리명·인분 입력 폼 — TDS `TextField` `variant="line"` + `NumericSpinner` (`disable` prop) + `Button` (`type="primary"` `style="fill"`). 클라이언트 측 zod 검증(trim·min 1·max 100·1~20인분) | §A.6, 06 §6.4.1, §B.1·§B.3·§B.4 |
| `src/components/NutritionPanel.tsx` | 칼로리 강조 + 4 매크로(grid) + healthNote | §A.6, 06 §6.4.3 |
| `src/components/RecipeDisplay.tsx` | 타이틀·설명·`Badge` 3개·재료 `List`/`ListRow`·조리 순서·팁·actions 슬롯. **공통 필드만 사용**(id/createdAt/isFavorite 미참조) | §A.6, 06 §6.4.2, 불변식 2 |
| `src/pages/recipe/generate.tsx` | `/recipe/generate` 라우트 — `useRecipeGenerate` 결합·params 자동 1회 생성·취소 버튼·에러 매핑·결과 1회 렌더 | §A.5, 07 §7.3.2, 08 §8.3~8.5 |
| `pages/recipe/generate.tsx` | Granite barrel (`export { Route } from 'pages/recipe/generate'`) — `baseUrl: "src"` alias 정합 | §A.5 |

### 재작성/수정

| 파일 | 변경 | 사유 |
|------|------|------|
| `src/pages/index.tsx` | Phase 1 dev 트리거(`Phase1DevTrigger`/`isDev`/`STUB_GENERATED_RECIPE`/관련 styles) 일괄 제거 → TDS `PageNavbar` + 안내 텍스트 + `SearchForm`. 제출 시 `navigation.navigate('/recipe/generate', { dishName, servings })` | Phase 2 진입 시 §A.5, 06 §6.4.6 |
| `src/router.gen.ts` | `_AboutRoute` 제거 + `_RecipeGenerateRoute` 추가 (granite dev 첫 실행 시 자동 재생성 예상의 임시 수동 갱신) | §A.5 — about 삭제 + generate 신규 |

### 삭제

| 파일 | 사유 |
|------|------|
| `src/pages/about.tsx` | Phase 1 스캐폴드 잔여. 본 미니앱 도메인과 무관 — requirements 정리 항목 |
| `pages/about.tsx` | 위 barrel |

---

## 2. TDS 컴포넌트 실재성·시그니처 (frontend가 직접 검증)

baseline §B.1 표 기반으로 실제 export·시그니처 확인 후 사용. 핵심 사실:

| 컴포넌트 | 실 import 경로 | Phase 2에서 사용한 시그니처 |
|---------|----------------|----------------------------|
| `PageNavbar` | `@toss/tds-react-native` (root, via `./extensions/page-navbar`) | compound: `PageNavbar.Title`. `BackButton` 자체는 없음 — Granite 진입점이 자동 처리 |
| `Button` | root | `type="primary"`/`"light"`, `style="fill"`/`"weak"`, `display="block"`, `size="large"`/`"medium"`, `loading`, `disabled`, `onPress` (children: ReactNode) |
| `TextField` | root | `variant: 'box'\|'line'\|'big'\|'hero'` **필수**. `value: string\|number`, `onChangeText: (next: string\|number) => void`, `hasError`, `help`, `disabled`/`editable` |
| `NumericSpinner` | root | `size: 'tiny'\|'small'\|'medium'\|'large'` 필수. `number`, `minNumber`, `maxNumber`, **`disable` (오타 아님, prop명)**, `onNumberChange(n: number) => void` |
| `Badge` | root | **`children: string` 필수 (Txt 등 컴포넌트 child 불가)**. `size: 'tiny'\|...\|'large'`, `type: 'blue'\|'teal'\|'green'\|'red'\|'yellow'\|'elephant'`, `badgeStyle: 'fill'\|'weak'` |
| `Txt` | root | `typography: 't1'\|...\|'t5'\|'st9'\|...\|'st12'`, `color: string`, `numberOfLines`, RN Text props |
| `List` | root | `rowSeparator: 'full'\|'indented'\|'none'`, children |
| `ListRow` | root | compound: `.Texts`/`.LeftText`/`.RightTexts`/`.Icon`/`.Image`. `left`/`contents`/`right`(ReactNode), `verticalPadding: 'extraSmall'\|8\|'small'\|16\|'medium'\|24\|'large'\|32`, `onPress` |

### Badge 시그니처 차이로 인한 RecipeDisplay 변경

baseline §B.1은 `Badge`를 ParagraphBadge 상속으로 명시했으나 실 시그니처는 **`children: string`만 허용**. frontend가 처음 작성한 `<Badge><Txt>...</Txt></Badge>` 패턴은 컴파일 에러 → string 직접 자식 + `type`+`badgeStyle`로 색상 의미 매핑하는 패턴으로 일관 교체. 06 §6.3.4의 의미 매핑(easy=green/fill, medium=teal/weak, hard=red/fill, 중립 메타=elephant/weak) 그대로 적용.

> 본 사실은 06 §6.3.4의 매핑 그대로 일치하나 baseline §B.1 표의 "상속받은 ParagraphBadge props" 문구는 약간 오해 소지가 있음 — architect에게 baseline §B.1 Badge 행 갱신 요청은 별 통지 사항(본 산출 자체는 정합).

---

## 3. 노출 인터페이스

### `SearchForm`

```ts
export interface SearchFormProps {
  onSubmit: (dishName: string, servings: number) => void;
  initialDishName?: string;
  initialServings?: number;
  disabled?: boolean;
  pending?: boolean;
  submitLabel?: string;
}
```

- 클라이언트 측 zod: `z.string().trim().min(1).max(100)` (AC2.3).
- 인분: `1 <= servings <= 20`, clamp.
- Button `loading={pending}` + `disabled={!canSubmit}` — 스트리밍 중 재제출 차단.

### `RecipeDisplay`

```ts
export interface RecipeDisplayProps {
  recipe: GeneratedRecipe;   // GeneratedRecipe 또는 Recipe(공통 필드만)
  actions?: React.ReactNode; // Phase 3 저장/즐겨찾기 슬롯
}
```

`id`/`createdAt`/`isFavorite` 미참조 — 불변식 2 (AC2.5)·06 §6.7 보호.

### `NutritionPanel`

```ts
export interface NutritionPanelProps {
  nutrition: Nutrition;
}
```

`Nutrition` 6 필드(calories/carbohydrates/protein/fat/fiber/healthNote) 모두 사용. healthNote는 truthy일 때만 렌더.

### 라우트

| Granite 라우트 | 파일 | params 시그니처 | 진입 시 |
|---------------|------|-----------------|---------|
| `/` | `src/pages/index.tsx` | — | PageNavbar + 안내 + SearchForm |
| `/recipe/generate` | `src/pages/recipe/generate.tsx` | `{ dishName?: string; servings?: number }` | params.dishName truthy 시 자동 1회 generate(stream:true). useRef 가드로 1회만 |

---

## 4. `useRecipeGenerate` 결합 (baseline §A.4·§C.5)

`generate` 화면에서 훅을 다음과 같이 소비:

```tsx
// cancel은 의도적으로 미사용 — abort만 발사하고 status 전이가 비동기라 UI 일관성에 약함.
// 본 화면은 취소·다시시도·SearchForm 재제출 모두 reset()으로 통합 — 동기 setState(status='idle')까지 보장 → AC2.2 UI 일관.
const { status, recipe, error, generate, reset } = useRecipeGenerate();

// 자동 진입 (1회 가드)
useEffect(() => {
  if (autoGeneratedRef.current) return;
  if (params.dishName?.trim()) {
    autoGeneratedRef.current = true;
    void generate({ dishName: params.dishName, servings: params.servings ?? 2, stream: true });
  }
}, [params.dishName, params.servings, generate]);
```

UI 분기:
- `status === 'streaming'` → "AI가 레시피를 생성하고 있어요" 인디케이터 + 취소 버튼(`reset()`) (08 §8.3.5 — **text 청크 delta 화면 미표시**).
- `status === 'done' && recipe` → `RecipeDisplay` + `NutritionPanel` 1회 렌더.
- `status === 'error' && error` → 한국어 에러 박스 + "다시 시도"(`reset()` + `generate(req)`)/"홈으로" 버튼.
- `status === 'idle' && !params.dishName` → 폼 안내 텍스트.

뒤로가기 = AbortController.abort()는 **훅의 useEffect cleanup**에서 보장 (`useRecipeGenerate` 내부 — 08 §8.4.2). frontend는 별도 useBackEvent 가드를 Phase 2에 추가하지 않음 (baseline §A.4 라인 58 "Phase 2는 (1)(2)만 필수"에 정합).

### cancel vs reset 선택 근거

api-client 통지(2회차): `cancel()`은 in-flight `AbortController.abort()`만 발사하고 상태 전이(`status='streaming' → 'idle'`)는 비동기. UI에서 즉시 idle이 필요하면 `reset()` 권장. frontend는 본 통지를 반영해 화면 측 핸들러를 `reset()` 한 곳으로 통합 — AC2.2의 "UI 일관 상태"를 한 frame 지연 없이 보장.

---

## 5. AC 매핑 (baseline §H / requirements §수용 기준)

| AC | 충족 위치 | 비고 |
|----|----------|------|
| **AC2.1** 입력 → 점진 표시 → 최종 완성 | SearchForm 제출 → generate 화면 자동 진입 → 인디케이터 → `recipe` 청크 도착 시 RecipeDisplay/NutritionPanel 1회 렌더 | 실호출 검증은 qa(T4) |
| **AC2.2** 뒤로가기 abort | `useRecipeGenerate` useEffect cleanup이 unmount 시 abortRef.current?.abort() 호출 | 훅 책임(api-client) |
| **AC2.3** 빈/공백 차단 | SearchForm 클라이언트 측 zod trim.min(1) | `dishNameSchema.safeParse` 후 에러 시 서버 도달 0건 |
| **AC2.4** 502/429 사용자 친화 한국어 | 훅의 `toUserMessage`가 `ApiClientError.code → ERROR_CODE_MESSAGES` 매핑. generate 화면이 `error` state를 errorBox에 표시 | HTTP 상태/원문 노출 0건 |
| **AC2.5** `GeneratedRecipe`(id 없음) 타입 보호 | RecipeDisplay/NutritionPanel/generate 화면 모두 `recipe.id` 미참조. 타입은 `GeneratedRecipe` | 타입 + 런타임 보호 |
| **AC2.6** 비로그인 정상 동작 | 본 화면들이 `useTossUserId` 미import. 공개 endpoint이므로 헤더 미부착 | 훅이 `tossUserId` 옵션 미주입 시 X-Toss-User-Id 헤더 생략 (sse-client §A.1) |

---

## 6. 격리 단언 검증 (baseline §D.2)

| # | 단언 | 결과 |
|---|------|------|
| 1 | 직접 fetch 호출은 api-client.ts + sse-client.ts 2곳뿐 | **통과** — `grep -rn "fetch(" src/` 정확히 2건 |
| 2 | Tailwind 클래스 0건 (`className=`, `tw\``) | **통과** |
| 3 | `next/link`/`useRouter`/`href` 0건 | **통과** |
| 4 | `useAuth` 0건 | **통과** |
| 5 | Toss user hash 평문 노출 0건 | **통과** — generate/index 화면 모두 useTossUserId 미사용 (헤더 미부착 공개 endpoint) |
| 6 | text 청크 delta가 사용자 화면에 그려지지 않음 | **통과** — pages/components 어디에도 `progressText` 참조 없음 (주석 언급만) |
| 7 | `recipe` 청크 외 채널로 최종 결과 결정 금지 | **통과** — `setRecipe`는 훅이 recipe 청크에서만 호출 (frontend는 `recipe` state만 소비) |
| 8 | HTTP 200 + error 청크 → 사용자에게 에러 노출 | **통과** — sse-client throw → 훅 setError → errorBox 표시 |
| 9 | `GeneratedRecipe`(id 없음) 보호 | **통과** — `recipe.id`/`createdAt`/`isFavorite` 참조 0건 |
| 10 | 공개 endpoint 헤더 정책 | **통과** — sse-client가 옵션 미주입 시 X-Toss-User-Id 헤더 생략 (api-client 책임 확인) |

---

## 7. 검증 — typecheck / lint

```bash
pnpm typecheck   # 0 errors
pnpm lint        # 0 errors, 1 warning (router.gen.ts unused-disable — 자동 생성, Phase 1 동결 그대로)
```

실호출 검증(AC2.x 통과 매트릭스)은 qa(T4) 책임. `granite dev` 실 가동은 ADR-010 D7(SDK 패키지 경로) 해소가 별 트리거.

---

## 8. 미해결·후속 작업

| 항목 | 처리 위치 |
|------|----------|
| `@apps-in-toss/web-framework` 패키지 경로 검증 (D7) | Phase 2 첫 `granite dev` 실행 시 — useTossUserId.tsx의 `@ts-expect-error` 해소 또는 architect 통지 (baseline §F.1). generate 화면은 useTossUserId 미import이라 본 검증과 무관 진행 가능 |
| `router.gen.ts` 자동 재생성 | granite dev 첫 실행 시 자동. 본 산출의 수동 갱신은 임시 |
| Phase 3 진입 시 RecipeDisplay actions slot에 "저장" 버튼 추가 | Phase 3 — Phase 2 코드 변경 0 (slot은 이미 ReactNode prop) |
| 하드웨어 백 가드(useBackEvent) | Phase 3 또는 후속 — Phase 2는 (1) 명시 cancel + (2) unmount cleanup만 필수 (baseline §A.4) |
| `Badge`의 ParagraphBadge child:string 제약 → baseline §B.1 표 행 갱신 권장 | architect (T5 06-UI-MAPPING 갱신 시 함께) |
| `useRecipeGenerate`의 cancel vs reset 의미 차별화 (cancel은 abort만, status 전이는 비동기 / reset은 동기 setState까지) → ADR-011(가칭) D-N 후보 등록 | architect T5. api-client가 `UseRecipeGenerateResult` JSDoc에 보강해 둠 — frontend 결합이 reset 한 곳으로 통합된 결정 근거 보존 |

---

## 9. 변경 이력

| 일시 | 변경 | 사유 |
|------|------|------|
| 2026-05-24 단계 1 | recipe-format.ts 작성 | baseline 작업 순서 [E] 단독 가능 |
| 2026-05-24 단계 2 | SearchForm/NutritionPanel/RecipeDisplay 작성 | baseline [F] — TDS 시그니처 실 확인 후 작성 |
| 2026-05-24 단계 3 | index.tsx 재작성 (dev 트리거 일괄 제거 + TDS 매핑) + about 삭제 | baseline [G] + Phase 1 잔여 정리 |
| 2026-05-24 단계 4 | recipe/generate.tsx placeholder 작성 + router.gen.ts 동기화 | barrel + 컴파일 가능 상태 확보 |
| 2026-05-24 단계 5 | RecipeDisplay Badge 패턴 교정 (Txt child → string child) | TDS Badge 실 시그니처 `children: string` 발견 — 06 §6.3.4 의미 매핑 그대로 type+badgeStyle로 표현 |
| 2026-05-24 단계 6 | generate.tsx 본격 결합 — useRecipeGenerate 훅 import + 자동 진입 + 취소/재시도/에러 분기 | api-client의 훅 시그니처 확정 후 |
| 2026-05-24 단계 7 | typecheck/lint 0 에러 통과 + 격리 단언 10건 자체 검증 | qa 인계 직전 자체 검증 |
| 2026-05-24 단계 8 | 취소·다시시도 핸들러를 `cancel()`에서 `reset()`로 통합 (cancel 분해 제거) | api-client 2회차 통지 — `cancel()`은 abort만 발사하고 status 전이가 비동기. AC2.2 UI 일관을 위해 동기 setState를 보장하는 `reset()` 사용 |
