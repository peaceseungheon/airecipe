# Phase 5 QA Report — 출시 준비

> 일자: 2026-05-25
> 범위: Q1~Q10 매트릭스 + AC5.1~AC5.4 분리표 + 누적 미해결 재평가
> 진입 조건: Phase 4 완료 + Phase 5 baseline §B·C·E 코드 측 작업 완료

---

## 1. Q 매트릭스 (10항 — 정적 검증)

| ID | 점검 항목 | 방법 | 결과 |
|----|----------|------|------|
| Q1 | hex 색상 → TDS `colors` 토큰 일괄 교체 (D39) | `grep -rn "'#[0-9a-fA-F]{3,8}'" src/ pages/` | **PASS** — 0건. 모든 hex 토큰화 |
| Q2 | TDS `colors` import 누락 (필요한 파일) | `grep -rn "from '@toss/tds-react-native'" src/ pages/` | **PASS** — 색상 사용 파일 10개 모두 colors import |
| Q3 | NutritionPanel AI 면책 문구 (D40) | NutritionPanel.tsx 최하단 `Txt typography="st11"` 검증 | **PASS** — "AI가 생성한 참고용 정보예요. 의료·영양 자문이 아닙니다." |
| Q4 | pages/_404.tsx TDS 사용 | `pages/_404.tsx` 내용 검증 | **PASS** — NotFoundScreen 재사용 + navigation.canGoBack 폴백 |
| Q5 | granite.config.ts 검수 항목 | scheme/appName/permissions/displayName | **PASS** — 코드 측 OK. icon URL은 콘솔 등록 후 채움 (PENDING) |
| Q6 | 금지 환경변수(API 키·DB URL) 코드 부재 | `grep -rn "GEMINI_API_KEY\|ANTHROPIC_API_KEY\|SUPABASE_SERVICE_ROLE_KEY"` | **PASS** — 0건 |
| Q7 | tossUserId 평문 노출 (UI/log) | `grep -rn "console.*tossUserId\|console.*hash"` (코드) | **PASS** — 0건. `formatTossUserIdMask` 규약 준수 |
| Q8 | 에러 메시지 한국어 매핑 일관성 (D41) | 5개 훅의 KOREAN_ERROR_MESSAGE 매핑 비교 | **PASS** — useSaveRecipe/useMyRecipes/useToggleFavorite/useDeleteRecipe/useRecipeDetail 동일 매핑 |
| Q9 | SDK 패키지 경로 해결 (Phase 1·2·3 누적 미해결) | `pnpm typecheck` 모듈 해결 | **PASS** — 누적 미해결 해소됨 (commit `46f0566` 적용 후 검증 완료) |
| Q10 | 환경별 빌드 스크립트 (D42) | `package.json` scripts | **PASS** — dev:local·dev:staging·build:staging·build:prod 4종 정의 |

**합계: 10/10 PASS, FAIL 0건.**

---

## 2. D39~D43 시행 검증

| ID | 결정 | 시행 결과 |
|----|------|----------|
| D39 | hex → TDS `colors` 토큰 (light 모드 정확 동등치) | 10 파일 60+ hex 토큰 교체 완료. typecheck/lint PASS |
| D40 | AI 면책 문구 — NutritionPanel 하단 fixed 1줄 | NutritionPanel.tsx에 `typography="st11" color={colors.grey600}` 추가 |
| D41 | 에러 메시지 카탈로그 동결 — Phase 1·3·4 누적 그대로 | 5개 훅 동일 매핑, 화면 측 한국어 일관 |
| D42 | package.json scripts 4종 동결 | 추가 변경 0건 |
| D43 | 출시 PENDING 명시 (외부 작업) | §3 분리표 참조 |

---

## 3. AC5.1~AC5.4 검증 (수용 기준 분리표)

| AC | 내용 | 본 사이클 | 코드 측 결과 | 외부 작업 |
|----|------|-----------|-------------|----------|
| AC5.1 | 검수 가이드(비게임) 체크리스트 모두 통과 | 코드 측 검증 | **PASS** — TDS 100%/권한 최소/면책 문구/한국어 UI | 콘솔 검수 제출 PENDING |
| AC5.2 | 콘솔 "검토 요청" 제출 → 반려 사유 없음 | **외부 작업 PENDING** | — | 콘솔 제출 + 응답 대기 |
| AC5.3 | 토스앱 5.246.0+ 미니앱 진입·홈 화면 등록 | **외부 작업 PENDING** | — | 실 디바이스 + 콘솔 |
| AC5.4 | 사용자 6기능 e2e 무결성 | 코드 경로 PASS | **PASS** — Phase 1~4 누적 산출 + 본 사이클 hex 교체 후 시각적 회귀 0 | 실 디바이스 테스트 PENDING |

---

## 4. 누적 미해결 재평가 (Phase 5 본 차)

### 4.1 해소된 항목

| 항목 | 출처 | 해소 사유 |
|------|------|----------|
| SDK 패키지 경로 (`@apps-in-toss/web-framework` 미해결) | Phase 1~4 인계 | `commit 46f0566`에서 `@apps-in-toss/framework`로 수정 + Phase 5 본 차 typecheck PASS로 확정 |
| **`useBackEvent` 하드웨어 백** | Phase 3 인계 | Phase 4 ConfirmDialog `closeOnDimmerClick`로 해결 (Phase 4 baseline에서 표기됨) |
| **디자인 토큰 hex 직접 사용** | Phase 2 인계 #7 | Phase 5 D39로 일괄 교체 완료 |
| **AI 면책 문구** | 검수 가이드 §10.6 6번 | Phase 5 D40로 NutritionPanel 추가 완료 |

### 4.2 본 사이클 비범위 (별 ADR로 분리)

| 항목 | 출처 | 향후 처리 |
|------|------|----------|
| AbortSignal cast 2곳 | ADR-011 D13 | 별 ADR (현 v1 유지 가능 — 해소 조건 미달) |
| 무한 스크롤 | Phase 3 인계 #6 | 별 ADR (출시 후 진화) |
| 카드 측 삭제 UX (swipe/long-press) | Phase 4 ADR-013 D22 | 별 ADR (출시 후 진화) |
| 다중 동시 PATCH 큐 | Phase 4 v1 한계 | 별 ADR (출시 후 진화) |
| 전면 광고 wiring + 빈도 제한 | ADR-014 D30·D34 | 별 ADR (콘솔 발급 후) |
| Analytics SDK 통합 | ADR-014 D33 | 별 ADR (측정 SDK 결정 후) |
| 다크 모드 adaptive 토큰 도입 | Phase 5 D39 보조 | 별 ADR (출시 후 진화) |

### 4.3 외부 작업 (코드 측 비범위)

| 항목 | 담당 | 해소 조건 |
|------|------|----------|
| 콘솔 `adGroupId` 발급·승인 | 앱인토스 콘솔 | 콘솔 등록 + 승인 |
| 콘솔 앱 등록 (appName/displayName/icon URL/카테고리/고객센터·홈페이지/도메인 화이트리스트) | 앱인토스 콘솔 | 검수 제출 전 등록 |
| 백엔드 옵션 P 배포 | 별 저장소 AIReceipe | 별 저장소 작업 |
| 번들 100MB 점검 | 빌드 산출 | `granite build` 실행 후 산출물 크기 확인 |
| 실 디바이스 e2e 테스트 (6기능) | QA 인력 | staging 배포 + 디바이스 테스트 |

---

## 5. typecheck + lint 결과

```
$ pnpm typecheck
> tsc --noEmit
(exit 0, 0 errors)

$ pnpm lint
> eslint .
src/router.gen.ts:1:1  warning  Unused eslint-disable directive
✖ 1 problem (0 errors, 1 warning)
```

router.gen.ts warning은 Phase 3 누적 무해 warning. 본 사이클 신규 0건.

---

## 6. 멈춤 트리거 검토

본 사이클 멈춤 트리거 4종 (baseline §I) 모두 미발동:
1. ✓ hex 교체 시각적 회귀 — 모든 매핑이 light 모드 정확 동등치(`#f2f4f6 == colors.grey100` 등). 시각적 동일.
2. ✓ TDS 매핑표 정정 — 매핑표 검증으로 정확 매핑 확인 (tds-colors `index.d.ts`).
3. ✓ 면책 문구 중복 인식 — NutritionPanel 하단 별 위치(healthNote와 분리).
4. ✓ typecheck/lint 강제 우회 — 정상 통과.

---

## 7. 결론

**Phase 5 코드 측 모든 검수 점검 통과 (ALL PASS).** 출시 가능 상태 도달.

남은 작업은 모두 **외부 작업**:
1. 앱인토스 콘솔 등록 (앱 정보·고객센터·도메인 화이트리스트·아이콘 URL·`adGroupId`).
2. 백엔드 옵션 P 배포 확인 (별 저장소).
3. staging 배포 + 실 디바이스 e2e 테스트 (6기능).
4. `granite build` 산출물 100MB 이하 확인.
5. 콘솔 검토 요청 제출 → 반려 사유 응답 대기.

**Phase 6(출시 후 진화)는 별 ADR로 분리** — AbortSignal cast, 무한 스크롤, 카드 측 삭제 UX, 다중 동시 PATCH 큐, 전면 광고 wiring, Analytics SDK 통합, 다크 모드 adaptive 토큰.
