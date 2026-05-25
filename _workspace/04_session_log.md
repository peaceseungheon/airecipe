# Phase 5 Session Log — 출시 준비 (TDS 토큰화·AI 면책·검수 분리표)

> 일자: 2026-05-25
> 입력: 사용자 — "phase 5 진행."
> 실행: orchestrator(메인 세션, auto mode) — 팀 1개 동시 제약으로 architect/실행/qa 통합 (Phase 4·4.5 답습)

## 타임라인

1. **진입 결정** — Phase 4 완료 후 Phase 5(출시 준비) 진입. SPRINT-PLAN §10.6 + 09-ENV-CONFIG §9.5·§9.6 SSOT 확인.

2. **워크스페이스 정리**:
   - `_workspace` (Phase 4 산출) → `_workspace_phase4/` 보존.
   - 새 `_workspace/00_input/requirements.md` 작성.

3. **architect baseline 작성** — `_workspace/01_architect_phase5_baseline.md`:
   - TDS 컴포넌트 실재성 점검 (A) — 직접 `View`/`Text` 사용 11개 파일 검토 → 10개 OK + `pages/_404.tsx`만 raw Text FAIL.
   - hex → TDS 토큰 매핑 표 (B) — light 모드 정확 동등치 7종.
   - AI 면책 문구 추가 (C) — NutritionPanel 하단 fixed.
   - 에러 메시지 카탈로그 (D) — Phase 1·3·4 누적 그대로 동결.
   - granite.config.ts 점검 (E) — icon URL만 외부 PENDING.
   - 보안 점검 (F) — API 키/Supabase service role 키 grep 0건.
   - 출시 정책 (G) — 코드 측 / 외부 작업 분리.
   - 결정 카탈로그 D39~D43 (H) — 5 결정 동결.

4. **TDS 색상 토큰 검증** — `node_modules/@toss/tds-colors/dist/esm/index.d.ts` 직접 검증. light 모드 hex 매핑:
   - `#FFFFFF` → `colors.white` (정확)
   - `#F2F4F6` → `colors.grey100` (light=#f2f4f6 정확)
   - `#E5E8EB` → `colors.grey200` (정확)
   - `#F9FAFB` → `colors.grey50` (정확)
   - `#191F28` → `colors.grey900` (정확)
   - `#4E5968` → `colors.grey700` (정확)
   - `#8B95A1` → `colors.grey500` (정확)
   - `#3182F6` → `colors.blue500` (정확)
   - `#FBE9E9` → `colors.red50` (근사 — #ffeeee)
   - `#C0392B` → `colors.red700` (근사 — #d22030)
   - `#E7F4EC` → `colors.green50` (근사 — #f0faf6)
   - `#1B6E3F` → `colors.green700` (근사 — #029359)

5. **typography 키 검증** — `caption2` 부재 발견 → `st11`로 정정. TDS typography 키는 `t1~t7`, `st1~st13`만 유효.

6. **코드 작성** — hex → TDS colors 토큰 일괄 교체 (10 파일, 60+ hex):
   - `src/components/NutritionPanel.tsx` — 토큰 교체 + AI 면책 문구 추가 (D40).
   - `src/components/RecipeCard.tsx`/`SearchForm.tsx`/`RecipeDisplay.tsx`/`EmptyState.tsx` — 토큰 교체.
   - `src/pages/index.tsx`/`my-recipes.tsx`/`recipe/generate.tsx`/`recipe/[id].tsx` — 토큰 교체.
   - `src/lib/ads/adapter.noop.tsx` — 토큰 교체.

7. **`pages/_404.tsx` 재작성** — raw `Text`/`View` → `NotFoundScreen` 재사용 + `useNavigation.canGoBack` 폴백. 단일 404 컴포넌트 정책(ADR-012 D16)을 Granite 폴백 라우트까지 확장.

8. **typecheck 1차 PASS** — exit 0.

9. **lint 1차 PASS** — 0 errors, 1 무해 warning (router.gen.ts Phase 3 누적).

10. **hex grep 최종 검증** — `grep -rn "'#[0-9a-fA-F]{3,8}'" src/ pages/` → 0건 확인.

11. **에러 메시지 일관성 검증** — 5개 훅의 KOREAN_ERROR_MESSAGE 매핑 grep으로 동일 매핑 확인. ApiErrorCode 8종 모두 한국어 매핑. HTTP 상태/영문 그대로 노출 0건.

12. **누적 미해결 SDK 패키지 경로 점검** — `@apps-in-toss/framework`로 이미 수정됨 (`commit 46f0566`). typecheck PASS로 해소 확정.

13. **QA report 작성** — `_workspace/03_qa_report.md`:
    - Q1~Q10 매트릭스 10/10 PASS.
    - D39~D43 시행 5/5 PASS.
    - AC5.1·5.4 코드 측 PASS, AC5.2·5.3 외부 작업 PENDING.
    - 누적 미해결 재평가 — SDK 패키지 경로 + useBackEvent + hex + AI 면책 4항 해소.

14. **문서 작성**:
    - `docs/adr/ADR-015-miniapp-phase5-release-readiness.md` 발행 — D39~D43 5 결정.
    - `docs/appsintoss-port/06-UI-MAPPING.md` §6.1 색상 규약 갱신 + §6.9 변경 이력 추가.
    - `docs/appsintoss-port/09-ENV-CONFIG.md` §9.6 코드 측 통과/외부 작업 분리표 갱신.
    - `src/components/AGENTS.md` 스타일링 규약 갱신 — TDS colors 토큰 의무 + AI 면책 문구 위치.
    - `CLAUDE.md` "현재 단계" 절 갱신 + 변경 이력 추가.

15. **커밋** (다음 단계).

## 결정 사항 (D39~D43, ADR-015 발행)

| ID | 결정 | 출처 |
|----|------|------|
| D39 | hex → TDS `colors` 토큰 일괄 교체 (light 모드 정확 동등치). 다크 모드 adaptive는 별 ADR | baseline §B |
| D40 | AI 면책 문구 — NutritionPanel 하단 fixed 1줄 | baseline §C |
| D41 | 에러 메시지 카탈로그 — Phase 1·3·4 누적 그대로 동결 | baseline §D |
| D42 | package.json scripts dev:local·build:staging·build:prod 동결 | 09 §9.4.1 |
| D43 | 출시 PENDING 명시 (외부 작업 5항) | baseline §E·G |

## QA 결과 요약

**ALL PASS — Q1~Q10 매트릭스 10/10 + D39~D43 시행 5/5 + AC5.1·5.4 코드 측 PASS, FAIL 0건**. typecheck PASS, lint 0 errors (router.gen.ts Phase 3 누적 무해 warning). AC5.2(콘솔 검토 제출)·AC5.3(실 디바이스)은 외부 작업 PENDING.

## 누적 미해결 해소 (Phase 5 본 차)

| 항목 | 출처 | 해소 사유 |
|------|------|----------|
| SDK 패키지 경로 (`@apps-in-toss/web-framework` 미해결) | Phase 1~4 인계 | `46f0566` 적용 + Phase 5 typecheck PASS로 확정 |
| `useBackEvent` 하드웨어 백 | Phase 3 인계 #3 | Phase 4 ConfirmDialog `closeOnDimmerClick`로 이미 해결됨 |
| 디자인 토큰 hex 직접 사용 | Phase 2 인계 #7 | D39 일괄 교체 |
| AI 면책 문구 | 검수 가이드 §10.6 6번 | D40로 NutritionPanel 추가 |

## 누적 미해결 (Phase 6 진화 — 별 ADR 분리)

| 항목 | 출처 | 상태 |
|------|------|------|
| AbortSignal cast 2곳 | ADR-011 D13 | Phase 6 별 ADR |
| 무한 스크롤 | Phase 3 인계 #6 | Phase 6 별 ADR |
| 카드 측 삭제 UX (swipe·long-press) | Phase 4 ADR-013 D22 | Phase 6 별 ADR |
| 다중 동시 PATCH 큐 | Phase 4 v1 한계 | Phase 6 별 ADR |
| 전면 광고 wiring + 빈도 제한 | ADR-014 D30·D34 | Phase 6 별 ADR |
| Analytics SDK 통합 | ADR-014 D33 | Phase 6 별 ADR |
| 다크 모드 adaptive 토큰 | Phase 5 D39 보조 | Phase 6 별 ADR |

## 출시 외부 작업 PENDING (ADR-015 D43)

- 앱인토스 콘솔 등록 (앱 정보·아이콘·도메인 화이트리스트·고객센터·`adGroupId`).
- 백엔드 옵션 P 배포 (별 저장소 `AIReceipe`).
- `granite build` 산출물 100MB 이하 확인.
- staging 배포 + 실 디바이스 e2e (6기능).
- 콘솔 검토 요청 제출 → 응답 대기.

## Phase 6 인계 (출시 후 진화)

- AbortSignal cast 2곳 해소 검토 + 별 ADR.
- 무한 스크롤 + 카드 측 삭제 UX (사용자 데이터량/UX 진화).
- 다중 동시 PATCH 큐 (사용성 이슈 발생 시).
- 전면 광고 wiring + 빈도 제한 + Analytics SDK 통합 (광고/측정 진화).
- 다크 모드 adaptive 토큰 (`colorsByPreference.light/dark` 또는 `useColors()` hook 도입).
