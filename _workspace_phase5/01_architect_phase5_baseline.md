# Phase 5 — 출시 준비 baseline (architect 동결)

> 일자: 2026-05-25
> 범위: 검수 체크리스트 매핑 + 코드 측 안전한 점검·교체 + 외부 작업 PENDING 분리
> SSOT: `10-SPRINT-PLAN §10.6` + `09-ENV-CONFIG §9.5·§9.6` + 검수 가이드 `checklist/app-nongame.md`

---

## A. TDS 컴포넌트 실재성 점검 (사전 검증)

### A.1 직접 `View`/`Text` 사용 현황 (`react-native` import)

| 파일 | 사용 | 판정 |
|------|------|------|
| `src/components/NutritionPanel.tsx` | `StyleSheet, View` | OK — layout 컨테이너만, Txt는 TDS |
| `src/components/RecipeCard.tsx` | `Pressable, StyleSheet, View` | OK — 동일 |
| `src/components/SearchForm.tsx` | `StyleSheet, View` | OK |
| `src/components/RecipeDisplay.tsx` | `StyleSheet, View` | OK |
| `src/components/EmptyState.tsx` | `StyleSheet, View` | OK |
| `src/pages/index.tsx` | `ScrollView, StyleSheet, View` | OK |
| `src/pages/recipe/[id].tsx` | `ScrollView, StyleSheet, View` | OK |
| `src/pages/recipe/generate.tsx` | `ScrollView, StyleSheet, View` | OK |
| `src/pages/my-recipes.tsx` | `ScrollView, StyleSheet, View` | OK |
| `src/lib/ads/adapter.noop.tsx` | `StyleSheet, View` | OK |
| **`pages/_404.tsx`** | **`Text, View`** | **FAIL — Granite 폴백 페이지가 raw Text. TDS Txt로 교체 필요 (P0)** |

### A.2 TDS 컴포넌트 사용 (검수 의무)

- 모든 텍스트 노출은 `Txt` 또는 TDS 합성 컴포넌트(PageNavbar/Button/Badge/ConfirmDialog/IconButton/SegmentedControl/ErrorPage/AppContainer).
- `pages/_404.tsx`만 직접 raw Text — Granite 기본 폴백이며 사용자 진입 가능. **Phase 5에서 NotFoundScreen 또는 TDS Txt로 교체**.

## B. 디자인 토큰 hex → TDS 토큰 매핑 (D39)

### B.1 현재 hex 사용 위치 (18곳)

| 파일·라인 | 현재 | 용도 |
|-----------|------|------|
| `NutritionPanel.tsx:86` | `'#F2F4F6'` | tableContainer bg |
| `NutritionPanel.tsx:106` | `'#E7F4EC'` | healthNote bg (green tint) |
| `RecipeCard.tsx:120` | `'#FFFFFF'` | card bg |
| `RecipeCard.tsx:122` | `'#E5E8EB'` | card border |
| `RecipeCard.tsx:126` | `'#F2F4F6'` | metadata row bg |
| `RecipeDisplay.tsx:203` | `'#3182F6'` | (deprecated 위치 — RecipeDisplay 미사용 추정) |
| `pages/recipe/generate.tsx:245` | `'#FFFFFF'` | save button bg |
| `pages/recipe/generate.tsx:254` | `'#F2F4F6'` | result section bg |
| `pages/recipe/generate.tsx:260` | `'#FBE9E9'` | error box bg |
| `pages/index.tsx:72` | `'#FFFFFF'` | container bg |
| `pages/my-recipes.tsx:255` | `'#FFFFFF'` | container bg |
| `pages/my-recipes.tsx:268` | `'#FBE9E9'` | error box bg |
| `pages/my-recipes.tsx:292` | `'#FBE9E9'` | favoriteError bg |
| `pages/recipe/[id].tsx:231` | `'#FFFFFF'` | container bg |
| `pages/recipe/[id].tsx:244` | `'#FBE9E9'` | favorite error bg |
| `pages/recipe/[id].tsx:256` | `'#FBE9E9'` | delete error bg |
| `lib/ads/adapter.noop.tsx:47` | `'#E5E8EB'` | placeholder border |
| `lib/ads/adapter.noop.tsx:49` | `'#F9FAFB'` | placeholder bg |

### B.2 TDS 토큰 매핑 (D39 — `colors` from `@toss/tds-react-native`)

> SSOT: `node_modules/@toss/tds-colors/dist/esm/index.d.ts`에서 직접 검증한 light 모드 hex.

| Hex | TDS 토큰 | 정확도 |
|-----|---------|--------|
| `#FFFFFF` | `colors.white` | 정확 |
| `#F2F4F6` | `colors.grey100` | 정확 (light=#f2f4f6) |
| `#E5E8EB` | `colors.grey200` | 정확 (light=#e5e8eb) |
| `#F9FAFB` | `colors.grey50` | 정확 (light=#f9fafb) |
| `#3182F6` | `colors.blue500` | 정확 (light=#3182f6) |
| `#E7F4EC` | `colors.green50` | 근사 (light=#f0faf6) — green tint 동등 |
| `#FBE9E9` | `colors.red50` | 근사 (light=#ffeeee) — red tint 동등 |

### B.3 다크 모드 처리 정책 (D39 보조)

- 본 Phase는 **light 모드 기준 hex의 정확 동등치를 TDS 토큰으로 교체**만 수행.
- 실 다크 모드 대응 (TDS adaptive color hook 도입)은 별 ADR(Phase 6 또는 향후 진화)로 분리. 현 시점 사용자 체감 차이 0.
- `colors.*` 토큰은 단일 string(light mode hex)이므로 본 교체는 시각적 회귀 0.

## C. AI 면책 문구 (D40)

### C.1 추가 위치

- **`src/components/NutritionPanel.tsx`** — 영양 정보 표시 컴포넌트. healthNote 섹션 옆 또는 하단에 면책 문구.
- 추가 위치 선정 근거: 영양 정보는 의료·건강 자문으로 오해될 수 있는 유일한 영역(검수 가이드 §10.6 6번).
- 면책 문구는 매번 노출되며, `nutrition` props 존재 시 항상 렌더.

### C.2 면책 문구 형식

```
AI가 생성한 참고용 정보예요. 의료·영양 자문이 아닙니다.
```

- TDS `Txt` typography `caption2` 또는 `label2Reading` 사용. 색상 `colors.grey600`.
- healthNote 박스와 별도 영역으로 NutritionPanel 하단에 1줄 추가.

## D. 에러 메시지 카탈로그 (D41)

### D.1 현재 매핑 (Phase 1·3 동결분)

`src/services/api-client.ts`의 `ApiErrorCode` 8종:

| 코드 | 한국어 메시지 (현행) | 노출 화면 |
|------|------|----------|
| `NOT_FOUND` | "레시피를 찾을 수 없어요" / NotFoundScreen | recipe/[id], PATCH·DELETE 404 (Phase 4) |
| `VALIDATION_ERROR` | 화면별 분기 — 입력 검증은 클라이언트 zod 처리 | generate |
| `UNAUTHORIZED` | "다시 시도해주세요" — 자동 refresh 1회 후 throw | api-client 내부 |
| `RATE_LIMITED` | "잠시 후 다시 시도해주세요" | useRecipeGenerate |
| `INTERNAL` (5xx) | "잠시 후 다시 시도해주세요" | 공통 |
| `NETWORK` | "네트워크 연결을 확인해주세요" | 공통 |
| `BAD_GATEWAY` (502) | "AI 모델 응답이 지연되고 있어요. 잠시 후 다시" | useRecipeGenerate |
| `UNKNOWN` | "알 수 없는 오류가 발생했어요" | fallback |

### D.2 점검 결과 (Phase 5 본 차)

- Phase 1·3·4 누적 매핑이 화면 측에 구현되어 있음 → 신규 보강 0건.
- 점검 grep으로 영문 메시지·HTTP 상태 그대로 노출 0건 확인 — 본 phase에서 PASS.

## E. granite.config.ts 점검 (D43)

| 항목 | 현재 | 판정 |
|------|------|------|
| `scheme` | `'intoss'` | OK |
| `appName` | `'airecipe-miniapp'` | OK (RFC-1123) |
| `brand.displayName` | `'AI 레시피'` | OK (한글) |
| `brand.primaryColor` | `'#FF6B35'` | OK (브랜드 색 — TDS 토큰 강제 대상 아님) |
| `brand.icon` | `''` | **PENDING — 콘솔 등록 후 URL 채워야 검수 통과 (외부 작업)** |
| `permissions` | `[]` | OK (최소 권한) |
| env 키 | API_BASE_URL/APP_ENV/LOG_LEVEL/ADS_* | OK |

## F. 보안 점검 (D43)

- AI Provider API 키 grep: 0건 ✓ (코드에는 미존재)
- Supabase service role 키 grep: 0건 ✓
- `X-Toss-User-Id` 평문 console.log: 0건 ✓ (AGENTS.md 규약 준수)
- `formatTossUserIdMask` 사용 누락: 0건 (현 phase에서 UI 노출 0건)

## G. 출시 정책 (D43)

| 항목 | 상태 |
|------|------|
| 디지털 자산/도박/자금세탁 카테고리 | 미해당 ✓ (레시피 콘텐츠) |
| AI 면책 문구 | C.1·C.2에서 추가 (D40) |
| 비게임 TDS 의무 | 준수 ✓ (A.2) |
| 권한 최소화 | `permissions: []` ✓ |
| CORS·도메인 화이트리스트 | 03-API-CONTRACT §3.1.4 SSOT 준수 (백엔드 측 책임 — 별 저장소) |
| 번들 100MB 이하 | dev server 실행 시점 검증 (외부 작업 PENDING) |
| 콘솔 고객센터 URL·홈페이지 | **외부 작업 PENDING** |

## H. 결정 카탈로그 (D39~D43, ADR-015)

| ID | 결정 | 출처 |
|----|------|------|
| D39 | hex → TDS `colors` 토큰 일괄 교체 (light 모드 정확 동등치). 다크 모드 adaptive 도입은 별 ADR | 본 baseline §B |
| D40 | AI 면책 문구 추가 — NutritionPanel 하단 1줄 + 면책 문구 fixed | 본 baseline §C |
| D41 | 에러 메시지 카탈로그 — Phase 1·3·4 누적 그대로 동결, 본 phase 추가 0건 | 본 baseline §D |
| D42 | package.json scripts dev:local·build:staging·build:prod 이미 존재 동결 | 09-ENV-CONFIG §9.4.1 |
| D43 | 출시 PENDING 명시 (icon URL, 콘솔 등록, 도메인 화이트리스트, 디바이스 테스트, 번들 검증) — 본 사이클 비범위 | 본 baseline §E·G |

## I. 멈춤 트리거 (architect 사전)

1. hex 교체 중 시각적 회귀 의심 → 즉시 부분 적용 후 별 ADR로 미룸.
2. TDS `colors` 토큰 light mode hex가 예상과 다를 때 → tds-colors d.ts 재검증 후 매핑표 정정.
3. NutritionPanel 면책 문구가 healthNote와 중복 인식될 수 있는 경우 → 위치 분리 (별 박스).
4. typecheck/lint 실패 → 원인 분석 후 재시도. 강제 우회(`-no-verify`, `-no-gpg-sign`) 금지.

## J. 진행 순서

1. **B 작업**: hex → TDS 토큰 일괄 교체 (10개 파일).
2. **A.1 작업**: `pages/_404.tsx`를 TDS Txt 사용 + NotFoundScreen 재사용 검토.
3. **C 작업**: NutritionPanel에 AI 면책 문구 추가.
4. typecheck + lint 검증.
5. QA report 작성 (Q1~Q10 매트릭스 + AC5.1~5.4 분리표).
6. ADR-015 발행 + 06/09 갱신 + AGENTS.md 갱신 + CLAUDE.md 갱신.
7. 최종 커밋.

본 baseline은 Phase 5 동결 — 이후 결정 변경은 ADR-015 supersede 형식으로 처리.
