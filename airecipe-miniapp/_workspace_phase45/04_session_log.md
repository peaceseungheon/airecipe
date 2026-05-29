# Phase 4.5 Session Log — 토스 광고 SDK 기반 작업

> 일자: 2026-05-25
> 입력: 사용자 — "변경사항 커밋하고, 토스 광고를 붙이려고 하니깐 기반 작업을 진행해줘"
> 실행: orchestrator(메인 세션, auto mode) — 팀 1개 동시 제약으로 architect/api-client/frontend/qa-as-orchestrator

## 타임라인

1. **Phase 4 중단 결정** — 사용자 우선순위가 즐겨찾기·삭제(Phase 4)에서 토스 광고로 전환. Phase 4 팀(`airecipe-miniapp-phase4`)에 shutdown_request 발송. architect는 normal 응답 후 종료. api-client/frontend/qa 3명은 미응답(idle만 반복) — TeamDelete 실패. 별 메시지로 정리 시도 중.

2. **Phase 3·4 워크스페이스 보존 + Phase 4.5 워크스페이스 생성**:
   - `_workspace_phase3/` (Phase 3 산출 git 등재 — Phase 3 시점에 보존이 누락되어 본 사이클에서 등재)
   - `_workspace_phase4_paused/` (Phase 4 미완 — `00_input/requirements.md` + `01_architect_phase4_baseline_partial.md`)
   - `_workspace/` (Phase 4.5 신규)
   - `.gitignore`에 `src/env.d.ts` 추가(plugin-env 자동 생성)
   - 커밋 `009ca2a` — 10 파일, 839 insertions

3. **토스 광고 SDK 외부 인터페이스 조사**:
   - `node_modules/@apps-in-toss/framework/dist/index.d.ts:192-248` — `InlineAd`, `loadFullScreenAd`, `showFullScreenAd` + `BannerSlotCallbacks` + InlineAd props 4종 enum
   - `node_modules/.pnpm/@apps-in-toss+types@2.6.0/.../dist/index.d.ts:309-353` — `LoadFullScreenAdParams`, `ShowFullScreenAdParams`, `ShowFullScreenAdEvent` union(7가지), `AdError`
   - 주의: `AdFailedToShow$1`은 `{ type: 'failedToShow' }`만 (error 필드 없음 — types@2.6.0 SSOT)

4. **Phase 4.5 요구사항 작성** — `_workspace/00_input/requirements.md` (5 출력 영역 + 11 위험·완화).

5. **baseline 작성 — orchestrator가 architect 역할 수행** — `_workspace/01_architect_phase45_baseline.md`:
   - §A TDS/SDK 실재성 검증 PASS
   - §B 13 결정 동결 (D25~D38)
   - §C 작업 분할 다이어그램 (16 단계)
   - §D 이벤트 정규화 매핑 (D32 상세)
   - §E 환경별 빌드 매트릭스
   - §F 시범 적용 위치 (D30 — my-recipes 빈+정상 양쪽)
   - §G QA 매트릭스 (G1~G9)
   - §H 멈춤 트리거
   - §I 비범위

6. **코드 작성 (병렬, 1회 메시지로 7 파일)**:
   - `src/lib/ads/types.ts` — `AdsAdapter` 인터페이스 + `InlineAdSlotProps` + `AdResult`
   - `src/lib/ads/adapter.noop.ts` (이후 `.tsx`로 rename) — placeholder 어댑터
   - `src/lib/ads/adapter.toss.ts` (이후 `.tsx`로 rename) — 실 SDK 어댑터 + 7 이벤트 정규화
   - `src/lib/ads/index.ts` — 환경 분기
   - `src/components/AppInlineAd.tsx`
   - `src/hooks/useFullScreenAd.ts`
   - `granite.config.ts` env 키 3개 추가
   - `src/env.d.ts` 수동 sync (D38)

7. **typecheck 1차 FAIL** — `.ts` 확장자에 JSX 작성. `adapter.{noop,toss}.ts` → `.tsx` rename.

8. **typecheck 2차 FAIL** — 2건:
   - `adapter.noop.tsx:13` AdResult 미사용 → import에서 제거.
   - `adapter.toss.tsx:132` `showEvent.error.message` 접근 — `AdFailedToShow$1` 타입에 error 필드 없음 → `Error('failedToShow')`로 정규화. 본 정정은 ADR-014 D32 + 11-ADS §11.1 주석에 명시 반영.

9. **typecheck 3차 PASS**.

10. **lint 1차 FAIL** — 21 errors, 모두 `.granite/**` 빌드 산출물에서. `eslint.config.mjs`의 ignores에 `**/.granite/**` 추가.

11. **lint 2차 PASS** — 0 errors, 1 warning (`router.gen.ts` 자동 생성 — Phase 3 누적 무해).

12. **QA 매트릭스 G1~G2b grep 검증 PASS** — 광고 SDK import는 `adapter.toss.tsx` 1행만, `adGroupId` 하드코딩 0건, `ADS_*` env 접근은 `index.ts` 3행만.

13. **시범 적용** — `src/pages/my-recipes.tsx`에 `<AppInlineAd slot="my-recipes-bottom" />` 2곳(빈 EmptyState 아래 + 정상 목록 pageInfo 아래). 로딩/에러 분기 미렌더 (G8).

14. **문서 작성**:
    - `docs/appsintoss-port/11-ADS.md` — 신규 SSOT 챕터 11.0~11.10
    - `docs/adr/ADR-014-toss-ads-integration.md` — D25~D38 결정 카탈로그 + 영향 + 롤백 조건
    - `src/lib/AGENTS.md` — 신규 (zod·ads 디렉토리 책임)
    - `src/components/AGENTS.md` — AppInlineAd 행 + 광고 SDK 직접 import 금지 규약 추가
    - `src/hooks/AGENTS.md` — useFullScreenAd 행 + 광고 SDK 직접 import 금지 규약 추가

15. **`_workspace/03_qa_report.md` 작성** — G1~G9 매트릭스 ALL PASS + 이벤트 정규화 검증 + 환경 분기 매트릭스 + 검수 정합성.

16. **CLAUDE.md "현재 단계" 갱신 + 변경 이력 추가** (다음 단계).

17. **커밋 + Phase 4 멤버 3명 최종 정리 시도** (다음 단계).

## 결정 사항 (D25~D38, ADR-014로 발행)

| ID | 결정 |
|----|------|
| D25 | 토스 공식 광고 SDK만 사용 |
| D26 | 어댑터 패턴 — SDK 직접 import는 adapter.toss.tsx 1곳만 |
| D27 | 환경 분기 — APP_ENV='local' OR ADS_ENABLED!=='true' → noop |
| D28 | 환경변수 3개 (ADS_ENABLED, ADS_INLINE_GROUP_ID, ADS_FULLSCREEN_GROUP_ID) |
| D29 | dev placeholder UI는 TDS View+Txt만 |
| D30 | 시범 적용 — /my-recipes 하단 1곳, 전면 광고 wiring 보류 |
| D31 | 컴포넌트/훅 인터페이스 (AppInlineAd, useFullScreenAd, AdResult) |
| D32 | 7 이벤트 정규화 매핑 |
| D33 | 콜백 로깅 — console.debug only |
| D34 | 빈도 제한·세션 한도 미적용 (별 ADR) |
| D35 | 11-ADS.md 신규 SSOT 챕터 |
| D36 | AGENTS.md 갱신 3건 |
| D37 | qa 검증 의무 — SDK import + adGroupId 하드코딩 grep |
| D38 | env.d.ts 자동 갱신 + 수동 sync 허용 |

## QA 결과 요약

ALL PASS, FAIL 0건. typecheck PASS, lint 0 errors. G1~G9 매트릭스 9/9 PASS. PENDING 3항(콘솔 adGroupId 발급, 전면 광고 wiring, Analytics 통합 — 외부 또는 별 ADR).

## Phase 4 인계 (재개 시점)

- `_workspace_phase4_paused/01_architect_phase4_baseline_partial.md` — 13 결정 사전 동결 + TDS 실재성 검증 5종 PASS + ADR-013 D19~D23 결정 카탈로그 + 멈춤 트리거 6항.
- **중요 정정**: ConfirmDialog props는 `leftButton`/`rightButton` ReactElement(ConfirmDialog.Button 권장) + `onClose`/`onExited` 필수. 요구사항의 `confirmText/cancelText/onConfirm/onCancel`는 SSOT 아님. 06 §6.5 갱신 필요.
- 재개 진입점: partial §I 체크리스트 6단계.

## Phase 5 인계 (Phase 4 완료 후)

- TDS 점검 + 콘솔 등록 + 검수 가이드 + 출시 정책 (09 §9.6 + appsintoss-publish-checklist 스킬).
- 무한 스크롤 / 디자인 토큰 일괄 교체 (Phase 3 누적 미해결).
- 광고 빈도 제한·Analytics 통합 (D33·D34 후속).

## 누적 미해결 (Phase 1~4.5)

| 항목 | 출처 | 상태 |
|------|------|------|
| SDK 패키지 경로 (`@apps-in-toss/web-framework` 미해결) | Phase 2 인계 #1 | dev server 실행 시점 검증 보류 |
| AbortSignal cast 2곳 | ADR-011 D13 | Phase 4·5 재평가 |
| `useBackEvent` 하드웨어 백 | Phase 3 인계 #3 | 별 ADR |
| 디자인 토큰 hex → adaptive 일괄 교체 | Phase 2 인계 #7 | 별 ADR (Phase 5 직전 권장) |
| 백엔드 옵션 P 배포 | 별 저장소 AIReceipe | 외부 작업 |
| 무한 스크롤 | Phase 3 인계 #6 | Phase 5 별 ADR |
| Phase 4 즐겨찾기·삭제·404 통일 | Phase 4 보류 | 재개 시 ADR-013 발행 |
| 콘솔 `adGroupId` 발급·승인 | Phase 4.5 PENDING | 외부 작업 |
| 전면 광고 wiring + 빈도 제한 | ADR-014 D30·D34 | 별 ADR |
| Analytics SDK 통합 | ADR-014 D33 | 별 ADR |
