# Phase 6 Architect Baseline — 테마 기반 요리 추천 + 선택→레시피 생성

> 일자: 2026-05-26
> 작성자: orchestrator(메인 세션 — architect 팀원이 3회 idle 무산출이라 Phase 4.5/5 선례대로 통합 수행)
> 입력: `_workspace/00_input/requirements.md` — A안(백엔드 신규 엔드포인트 `POST /api/recommendations`).
> 게이트: 본 문서 확정 → api-client(T2)·frontend(T3) 시작.

---

## A. 결정 카탈로그 (D44 ~ D52)

### D44 — 테마 분류 체계(고정 카테고리 v1)
- **결정**: v1은 **고정 카테고리 2종** — `situation`(상황: 점심/저녁/야식/모임/혼밥/특별한 날) + `weather`(날씨: 더운날/추운날/비오는날/맑은날/쌀쌀한날). 두 축은 **둘 다 선택**(둘 다 nullable) 가능. 둘 다 미선택 시 zod에서 차단.
- **근거**: 자유 텍스트는 추천 품질·캐싱·검수 정책(개인정보 입력 차단) 모두 부담. 두 축 고정으로 시작하고 v2에 식이/계절/인원 추가 여지.
- **시행 검증**: zod schema에 `RecommendationTheme = { situation?: SituationKey; weather?: WeatherKey }`, 두 axis 모두 undefined 시 `VALIDATION_ERROR`.
- **대안 기각**:
  - 자유 텍스트 입력 → 검수 정책(개인정보·민감 키워드) + AI 프롬프트 인젝션 부담.
  - 단일 축(상황만 또는 날씨만) → 사용자 기대(상황별·날씨별 등) 미충족.
- **롤백**: 백엔드가 카테고리 키 미지원 시 `VALIDATION_ERROR` 반환. 미니앱은 카테고리 라벨을 클라이언트 측 한국어 매핑(키→라벨 dict)로 보관해 백엔드와 분리.

### D45 — 응답 shape(요리명 + 짧은 설명 + 태그)
- **결정**: 추천 결과는 `{ items: Array<{ dishName, description, tags }>, meta: { theme, generatedAt } }`. `dishName` 1~60자, `description` 1~120자, `tags` 0~5개 짧은 라벨. **이미지 URL 미포함**(v2).
- **근거**: 카드 표시에 충분하면서 토큰 비용 최소. 이미지는 서버 비용·CDN·검수 가이드(저작권) 부담 — v2.
- **시행 검증**: zod 응답 schema 강제. 6개 이상 요청 시 백엔드가 잘라 5로 응답(03 §3.8.4 명세).
- **대안 기각**:
  - 요리명만 → 카드 정보 빈약, 선택 UX 약함.
  - +레시피 미리보기(재료·시간) → 추천에서 미리 만들어진 정보 노출 → 생성 결과와 불일치 위험.
- **롤백**: 응답 필드 부재 시 미니앱이 빈 문자열 fallback 후 카드 표시.

### D46 — 추천 개수(기본 5개, 백엔드 강제 상한)
- **결정**: 응답 배열은 **정확히 5개**. 백엔드는 AI 응답 후 5개 미만이면 502, 5개 초과면 잘라서 5개. 미니앱은 5개 카드 고정 렌더링.
- **근거**: 카드 리스트 UX 일관성. 한 화면에 5개 카드가 스크롤 1회 이내 가시 범위.
- **시행 검증**: zod `z.array(itemSchema).length(5)` 강제. 위반 시 zod failure → `INTERNAL_ERROR` ("서버 응답 형식이 올바르지 않아요.").
- **대안 기각**:
  - 가변 N — 미니앱 UI에서 빈 슬롯 처리 복잡.
- **롤백**: 미니앱 측 `length(5)` → `.min(3).max(8)`로 완화. 백엔드 합의 후 변경.

### D47 — 인증(보호 — `X-Toss-User-Id` 필수)
- **결정**: `POST /api/recommendations`는 **보호 엔드포인트**. `X-Toss-User-Id` 헤더 필수. 401 시 `useTossUserId` 재호출 후 1회 재시도(05 §5.4 패턴 재사용).
- **근거**: (1) 호출 빈도 제한·악용 차단을 위한 사용자 식별 필요. (2) 향후 개인화(과거 저장 레시피 기반 추천) 기반 마련. (3) 기존 보호 엔드포인트 패턴과 일관.
- **시행 검증**: api-client `getRecommendations`에서 `tossUserId: required`, `refreshTossUserId: optional`. 401 자동 재시도.
- **대안 기각**: 공개 엔드포인트 → 호출 빈도 제한 어려움 + 향후 개인화 인계 비용.
- **롤백**: 콘솔 등록 지연으로 `X-Toss-User-Id` 미발급 상태에서는 추천 진입 차단(에러 화면 안내). 공개로 전환 시 `ADR-016 R1`.

### D48 — 스트리밍(비-stream)
- **결정**: 추천은 **비-stream 단일 JSON 응답**. SSE 미사용.
- **근거**: 추천 결과는 작은 JSON 배열(5 × ~200B = ~1KB)이라 점진 표시 불필요. 생성(레시피)은 큰 JSON이라 스트림이 가치, 추천은 단순 요청-응답이 단순.
- **시행 검증**: `Content-Type: application/json` 단일 응답. zod 한 번에 검증.
- **대안 기각**: SSE 점진 카드 노출 — UX 부담 대비 효과 미미.
- **롤백**: 응답 지연이 심해지면 스트림 추가 + `mode?: 'stream'` 옵션. ADR-016 R2.

### D49 — 진입점 라우트(`/recipe/recommend`)
- **결정**: 새 라우트 `pages/recipe/recommend.tsx` → `/recipe/recommend`. `/recipe/*` 그룹 일관성(기존 `/recipe/generate` + `/recipe/[id]`).
- **근거**: 사용자 흐름이 "레시피 도메인 → 추천 → 생성"이라 `/recipe/*` 그룹이 자연스러움. `/recommendations` 최상위는 도메인 분리감.
- **시행 검증**: Granite `createRoute('/recipe/recommend', ...)`. router.gen.ts 자동.
- **대안 기각**: `/recommendations` → 최상위 그룹 추가 부담. `/recipe/recommendations` → 복수형으로 URL 길이.

### D50 — 진입 CTA(홈 `pages/index.tsx`에 1개)
- **결정**: 홈 화면(`src/pages/index.tsx`)의 "내 레시피로 가기" CTA **상단** 또는 **본문 하단**에 "오늘의 추천 받기" Button 추가. 탭 시 `/recipe/recommend`로 네비.
- **근거**: 홈 1군데만 노출 — 마이 목록 추가는 광고 위치(D34)와 중복 시각 부담. CTA 위치는 frontend가 기존 SearchForm·RecentRecipes 사이로 자연스러운 곳 결정.
- **시행 검증**: pages/index.tsx에 Button 1개 추가. text="오늘의 추천 받기" type="light" style="weak" size="medium".
- **대안 기각**:
  - 마이 목록 + 홈 양쪽 → 시각 부담·중복.
  - 진입점 없음(URL 직접 접근만) → 발견성 0.

### D51 — 재추천(클라이언트 측 새 fetch + SWR 캐시 키=테마 hash)
- **결정**: 동일 테마로 "다시 추천받기" 버튼 → useRecommendations 훅이 새 fetch 발사(이전 응답 폐기). 캐시는 SWR 패턴 — **테마 hash(situation+weather 직렬화)** 키. 새 테마 선택 시 자동 새 fetch.
- **근거**: 사용자는 동일 테마라도 새 추천을 원할 수 있음 + 테마 변경은 자동 트리거가 직관적.
- **시행 검증**: useRecommendations 훅 — `{ theme }` 의존성 + `refresh()` 함수 export. 이전 in-flight AbortController abort.
- **대안 기각**: 캐시 영구 → "다시 추천" 액션 무의미. 매번 새로 → 동일 테마 빠른 전환 시 깜빡임.

### D52 — AI 면책 문구(추천 리스트 하단 1줄)
- **결정**: 추천 결과 리스트 하단에 1줄 — `<Txt typography="st11" color={colors.grey600}>AI가 추천한 결과예요. 결과는 참고용이에요.</Txt>`. Phase 5 D40(NutritionPanel) 동일 패턴.
- **근거**: AI 생성 결과의 면책은 검수 가이드 §10.6 6번 — 영양 외에도 AI 추천에 적용 가능.
- **시행 검증**: 추천 페이지 컴포넌트 최하단 fixed 노출.
- **대안 기각**: 모달/툴팁 — 사용자 능동적 행동 필요, "명시" 요건 미달.

### 본 사이클 미적용 (별 ADR 또는 v2)
- **D-x 광고**: 추천 결과 하단 InlineAd — **본 사이클 미적용**. 추천은 짧은 카드 리스트(5개)라 광고 노출 시 시각 부담 + 마이 목록 광고와 중복 우려. ADR-014 D34 후속에서 광고 위치 정책 정비 후 결정.
- **이미지 URL**: D45 응답 shape에서 제외(v2).
- **개인화**(과거 저장 레시피 기반 추천): D47 인증 기반 마련했으나 v1은 미적용.

---

## B. SSOT 인용 위치 (확정)

| 항목 | 인용 위치 (본 저장소) |
|------|--------------------|
| API 계약 | `docs/appsintoss-port/03-API-CONTRACT.md §3.8` (신설) |
| 기능 인벤토리 | `docs/appsintoss-port/01-FEATURES.md §1.7` (신설 — 기능 g) |
| 라우트 매핑 | `docs/appsintoss-port/07-ROUTING.md §7.3.6` (신설) |
| TDS 컴포넌트 매핑 | `docs/appsintoss-port/06-UI-MAPPING.md §6.10` (신설 — Phase 6 추가 컴포넌트 표) |
| 수용 기준 | `docs/appsintoss-port/10-SPRINT-PLAN.md §10.7` (신설 — Phase 6 AC6.1~AC6.6) |
| 결정 카탈로그 | `docs/adr/ADR-016-recommendations.md` (신설) |

---

## C. zod / 타입 명세 (api-client 직접 인용)

```ts
// src/types/api.ts (확장 — Phase 6)
export const SITUATION_KEYS = [
  'lunch', 'dinner', 'midnight', 'gathering', 'solo', 'special',
] as const;
export const WEATHER_KEYS = [
  'hot', 'cold', 'rainy', 'sunny', 'chilly',
] as const;
export type SituationKey = typeof SITUATION_KEYS[number];
export type WeatherKey = typeof WEATHER_KEYS[number];

export interface RecommendationTheme {
  situation?: SituationKey;
  weather?: WeatherKey;
}

export interface RecommendationItem {
  dishName: string;        // 1~60자
  description: string;     // 1~120자
  tags: string[];          // 0~5개, 각 1~16자
}

export interface RecommendationsRequest {
  theme: RecommendationTheme;
}

export interface RecommendationsResponse {
  items: RecommendationItem[];  // 정확히 5개
  meta: {
    theme: RecommendationTheme;
    generatedAt: string;        // ISO8601
  };
}
```

```ts
// src/lib/zod/recommendations.ts (신규)
import { z } from 'zod';
import { SITUATION_KEYS, WEATHER_KEYS } from '../../types/api';

export const situationKeySchema = z.enum(SITUATION_KEYS);
export const weatherKeySchema = z.enum(WEATHER_KEYS);

export const recommendationThemeSchema = z
  .object({
    situation: situationKeySchema.optional(),
    weather: weatherKeySchema.optional(),
  })
  .refine(
    (v) => v.situation !== undefined || v.weather !== undefined,
    { message: '테마를 하나 이상 선택해주세요.' },
  );

export const recommendationItemSchema = z.object({
  dishName: z.string().min(1).max(60),
  description: z.string().min(1).max(120),
  tags: z.array(z.string().min(1).max(16)).max(5),
});

export const recommendationsResponseSchema = z.object({
  items: z.array(recommendationItemSchema).length(5),
  meta: z.object({
    theme: recommendationThemeSchema,
    generatedAt: z.string(),
  }),
});

export type RecommendationsResponseSchema = z.infer<
  typeof recommendationsResponseSchema
>;
```

---

## D. api-client 시그니처 (T2 인용)

```ts
// src/services/recipes.ts (확장 — Phase 6) — 또는 src/services/recommendations.ts 신규
export async function getRecommendations(
  req: RecommendationsRequest,
  auth: AuthedCallOptions,
): Promise<RecommendationsResponse> {
  const wrapped = await apiFetch(
    '/api/recommendations',
    apiResponseSchema(recommendationsResponseSchema),
    {
      method: 'POST',
      body: req,
      tossUserId: auth.tossUserId,
      refreshTossUserId: auth.refreshTossUserId,
    },
  );
  return wrapped.data;
}
```

- 에러 카테고리: `VALIDATION_ERROR`(테마 누락 등), `UNAUTHORIZED`(헤더 누락 → 자동 재시도), `AI_RATE_LIMITED`(429), `AI_PROVIDER_ERROR`(502), `INTERNAL_ERROR`(500), `DB_ERROR`(503).
- 한국어 메시지 매핑은 기존 KOREAN_ERROR_MESSAGE 재사용. 추가 매핑 0건.

---

## E. TDS 컴포넌트 실재성 검증 (06-UI-MAPPING §6.10용)

`node_modules/@toss/tds-react-native/dist/esm/components/` 직접 확인 결과:

| 컴포넌트 | 실재 여부 | 본 Phase 사용처 |
|----------|----------|---------------|
| `SegmentedControl.Root` / `.Item` | ✅ Phase 4(FilterTabs)에서 사용 | ThemePicker — situation·weather 두 축 |
| `Button` | ✅ | "추천 받기"·"다시 추천"·"재시도" |
| `Txt` | ✅ | 카드·면책 문구 |
| `Pressable` | RN core | RecommendationCard 카드 |
| `Badge` | ✅ Phase 3 RecipeCard에서 사용 | RecommendationCard 태그 |
| `ErrorPage` | ✅ Phase 3 NotFoundScreen | (필요 시 추천 에러 화면) |
| `PageNavbar` | ✅ | 추천 페이지 헤더 |

→ TDS 실재성 OK, 신규 컴포넌트는 합성으로 처리. **Chip/Tag 류는 TDS에 부재** → Badge 또는 Txt + View 합성으로 태그 표시.

---

## F. frontend 신규/확장 파일 (T3 인용)

| 파일 | 종류 | 책임 |
|------|------|------|
| `src/components/ThemePicker.tsx` | 신규 | situation·weather 두 축 SegmentedControl. controlled props(`value`/`onChange`). |
| `src/components/RecommendationCard.tsx` | 신규 | 카드 1건 — Pressable + Txt(dishName) + Txt(description) + Badge(tags). `onSelect(dishName)`. |
| `src/hooks/useRecommendations.ts` | 신규 | api-client `getRecommendations` 호출. 로딩·에러·AbortController + 테마 변경 시 이전 in-flight abort + `refresh()` export. |
| `src/pages/recipe/recommend.tsx` | 신규 | `/recipe/recommend` — ThemePicker + Button("추천받기") + 카드 리스트 + 면책 문구. 카드 탭 → `navigation.navigate('/recipe/generate', { dishName })`. |
| `src/pages/recipe/generate.tsx` | **변경 없음** | 이미 `dishName` URL param 수신 → SearchForm prefilled → 기존 SSE 자동 1회 실행. Phase 6에서 추가 변경 0건. |
| `src/pages/index.tsx` | 확장 | 홈 본문에 "오늘의 추천 받기" Button 추가 → `navigation.navigate('/recipe/recommend', {})`. |

---

## G. 라벨 매핑 (한국어 — 미니앱 측 dict)

```ts
// src/lib/i18n/recommendations.ts (또는 ThemePicker 내부 상수)
export const SITUATION_LABELS: Record<SituationKey, string> = {
  lunch: '점심',
  dinner: '저녁',
  midnight: '야식',
  gathering: '모임',
  solo: '혼밥',
  special: '특별한 날',
};

export const WEATHER_LABELS: Record<WeatherKey, string> = {
  hot: '더운 날',
  cold: '추운 날',
  rainy: '비 오는 날',
  sunny: '맑은 날',
  chilly: '쌀쌀한 날',
};
```

---

## H. QA 매트릭스 (T4 점검 항목 — 본 baseline 확정 후)

| ID | 점검 | 기준 |
|----|------|------|
| Q1 | 요청·응답 shape ↔ api-client ↔ frontend ↔ zod 일치 | 03 §3.8 SSOT |
| Q2 | 401/네트워크/AbortError 에러 처리 일관 | 기존 카탈로그 패턴 + `getRecommendations` 401 재시도 |
| Q3 | 카드 탭 → 생성 화면 dishName prefill | Granite navigate `/recipe/generate` + Route.useParams `dishName` |
| Q4 | 테마 변경 시 이전 in-flight abort | useRecommendations AbortController cleanup |
| Q5 | 로딩/에러/빈 결과/정상 상태 분기 완비 | 빈 결과는 zod `.length(5)` 강제로 발생 안 함 → "에러"로 처리 |
| Q6 | TDS 컴포넌트 실재성 | §E 표 — 모두 PASS |
| Q7 | hex 직접 사용 0건 | grep `'#[0-9a-fA-F]{3,8}'` 본 사이클 추가 파일 0건 |
| Q8 | AI 면책 문구 노출 | recommend 페이지 하단 1줄 (D52) |
| Q9 | 광고 위치 ADR-014 D34 | 본 사이클 미적용(D-x) → 광고 코드 추가 0건 검증 |
| Q10 | X-Toss-User-Id 평문 노출 0건 | 로깅·UI 노출 grep |
| Q11 | typecheck PASS, lint 0 errors | pnpm typecheck / pnpm lint |
| Q12 | AC6.1~AC6.6 통과 | 10-SPRINT-PLAN §10.7 신설 후 |

---

## I. 외부 작업 PENDING (별 저장소 `AIReceipe`)

- 새 백엔드 라우트 `app/api/recommendations/route.ts` 구현(`POST` only).
- AI 프롬프트 — Gemini/Claude로 `theme` → 5개 추천 JSON.
- 옵션 P 인증 미들웨어 적용 + 동일 CORS 정책.
- staging·prod 배포.
- 미배포 상태에서 미니앱은 401 또는 404 응답 → ApiClientError 카탈로그로 처리.

---

## J. 누적 미해결 (Phase 7 진화)

Phase 5 누적 + 본 Phase 미적용:
- 다크 모드 adaptive 토큰 (Phase 5 D39 보조)
- AbortSignal cast 2곳 (ADR-011 D13)
- 무한 스크롤 (Phase 3 인계 #6)
- 카드 측 삭제 UX (ADR-013 D22)
- 다중 동시 PATCH 큐 (Phase 4 v1 한계)
- 전면 광고 wiring + 빈도 제한 (ADR-014 D30·D34)
- Analytics SDK 통합 (ADR-014 D33)
- **신규**: 추천 자유 텍스트 / 이미지 / 개인화 / 추천 결과 광고 위치
