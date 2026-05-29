# ADR-015 — Phase 5 출시 준비 (TDS 토큰화·AI 면책·검수 분리표)

- 상태: Accepted
- 일자: 2026-05-25
- 결정자: orchestrator(메인 세션 — 팀 1개 동시 제약으로 architect-as-orchestrator)
- 관련 ADR: ADR-009(아키텍처), ADR-010(Phase 1), ADR-011(Phase 2), ADR-012(Phase 3), ADR-013(Phase 4), ADR-014(Phase 4.5)
- 관련 SSOT: `docs/appsintoss-port/10-SPRINT-PLAN §10.6`, `09-ENV-CONFIG §9.5·§9.6`, `06-UI-MAPPING`, 검수 가이드 `checklist/app-nongame.md`

## 컨텍스트

본 미니앱 `airecipe-miniapp`은 Phase 0~4(스캐폴딩·인프라·생성+스트리밍·저장·목록·상세·즐겨찾기·삭제·404 통일) + Phase 4.5(토스 광고 기반)를 완료. **Phase 5는 출시 가능 상태 도달**이 목표.

도전 과제:
1. **TDS 컴포넌트 사용 검증** — 비게임 미니앱은 `@toss/tds-react-native` 사용이 검수 의무. raw `<Text/>` 사용 0건 필요.
2. **디자인 토큰 hex 직접 사용** 누적 — Phase 1~4 코드에 hex 60+곳. TDS `colors` 토큰으로 일괄 교체.
3. **AI 면책 문구** — 영양 정보·healthNote는 의료/건강 자문으로 오해 가능. 검수 가이드 §10.6 6번 위반 위험.
4. **콘솔 등록·디바이스 테스트·검수 제출** — 외부 작업으로 분리해 코드 측 PENDING 명시.
5. **누적 미해결** — SDK 패키지 경로/`useBackEvent`/AbortSignal cast/무한 스크롤 등 재평가.

본 ADR은 이 5개 도전을 5개 결정(D39~D43)으로 동결한다.

## 결정 카탈로그 (D39~D43)

### D39 — hex → TDS `colors` 토큰 일괄 교체 (light 모드 정확 동등치)
- **결정**: 모든 hex 색상(`'#FFFFFF'`/`'#F2F4F6'`/`'#4E5968'` 등)을 `@toss/tds-react-native`의 `colors` export 토큰(`colors.white`/`colors.grey100`/`colors.grey700` 등)으로 일괄 교체.
- **근거**: 검수 의무(09 §9.6 — TDS 의무). TDS `colors.*` light 모드 hex가 현 사용 hex와 정확 동등(`#f2f4f6 == colors.grey100`)이라 시각적 회귀 0.
- **시행 검증**: `grep -rn "['\"]#[0-9a-fA-F]{3,8}['\"]" src/ pages/` → 0건. `typecheck` PASS.
- **대안 기각**:
  - `colorsByPreference` 또는 `useAdaptiveColor` 도입 — 다크 모드 대응 가능하지만 본 사이클 비범위. 별 ADR(출시 후 진화).
  - hex 그대로 유지 — 검수 의무 위반 위험.
- **다크 모드 대응**: 별 ADR로 분리(Phase 6 진화). `colors.*` 토큰을 `colorsByPreference.light`/`colorsByPreference.dark` 또는 `useColors()` hook으로 교체.

### D40 — AI 면책 문구 추가 (NutritionPanel 하단 fixed)
- **결정**: `src/components/NutritionPanel.tsx` 최하단에 `Txt typography="st11" color={colors.grey600}`로 "AI가 생성한 참고용 정보예요. 의료·영양 자문이 아닙니다." 1줄 추가. 모든 영양 정보 렌더에서 항상 표시.
- **근거**: 검수 가이드 §10.6 6번 — AI 생성 콘텐츠가 의료·법률 자문으로 오해될 수 있는 헬스노트(`nutrition.healthNote`) 면책 필요. NutritionPanel은 모든 영양 정보 노출의 단일 위치라 추가가 1곳으로 충분.
- **시행 검증**: NutritionPanel 렌더 시점에 항상 노출(healthNote 유무와 독립). Phase 2/3/4의 화면 변경 0건.
- **대안 기각**:
  - 각 화면 측 추가 — 중복·누락 위험.
  - 모달/툴팁 — 사용자 능동적 행동 필요, 검수 가이드의 "명시" 요건 미달.

### D41 — 에러 메시지 카탈로그 동결 (Phase 1·3·4 누적 그대로)
- **결정**: 5개 mutation/query 훅(`useSaveRecipe`/`useMyRecipes`/`useToggleFavorite`/`useDeleteRecipe`/`useRecipeDetail`)의 KOREAN_ERROR_MESSAGE 매핑은 본 사이클 변경 0건으로 동결.
- **근거**: 사용자 친화적 한국어 메시지가 모든 코드에 일관되게 매핑됨(grep 검증). HTTP 상태/영문 그대로 노출 0건. 추가 보강 불필요.
- **시행 검증**: `grep -rn "['\"]\([A-Z_]+\)['\"]:" src/hooks/use*.ts` → ApiErrorCode 8종 모두 매핑.

### D42 — 환경별 빌드 스크립트 동결
- **결정**: `package.json`의 `dev:local`/`dev:staging`/`build:staging`/`build:prod` 4종 그대로 유지. 본 사이클 추가 변경 0건.
- **근거**: 09-ENV-CONFIG §9.4.1 패턴 준수. CI/CD 도입 시 동일 스크립트 사용 가능.

### D43 — 출시 PENDING 명시 (외부 작업 분리표)
- **결정**: 본 사이클은 **코드 측 검수 점검만** 수행. 다음 5개 항목은 외부 작업 또는 별 사이클로 분리:
  1. 앱인토스 콘솔 등록 (앱 정보·고객센터·홈페이지·도메인 화이트리스트·아이콘 URL·`adGroupId`).
  2. 백엔드 옵션 P 배포 확인 (별 저장소 `AIReceipe`).
  3. `granite build` 산출물 100MB 이하 확인.
  4. staging 배포 + 실 디바이스 e2e 테스트 (6기능).
  5. 콘솔 검토 요청 제출 → 반려 사유 응답 대기.
- **근거**: 본 저장소의 단일 책임(미니앱 클라이언트 코드)을 넘어선 작업은 외부 경로. 명시함으로써 출시 진행 가능 상태가 어디까지인지 합의 가능.

## 시행 결과 (Phase 5 본 사이클)

| 산출 | 위치 | 변경량 |
|------|------|--------|
| hex → TDS 토큰 교체 | 10 파일 | 60+ hex → 토큰 |
| AI 면책 문구 | `src/components/NutritionPanel.tsx` | +1 Txt |
| _404.tsx 교체 | `pages/_404.tsx` | raw Text → NotFoundScreen 재사용 |
| 누적 미해결 해소 | SDK 패키지 경로 | typecheck PASS로 확정 |
| 누적 미해결 해소 | `useBackEvent` 하드웨어 백 | Phase 4 ConfirmDialog `closeOnDimmerClick`로 이미 해결 (재확인) |
| 누적 미해결 해소 | 디자인 토큰 hex 직접 사용 | D39 일괄 교체로 해소 |
| QA 매트릭스 | `_workspace/03_qa_report.md` | Q1~Q10 모두 PASS |

## 누적 미해결 (Phase 6 진화 대상)

본 ADR로 해소되지 않은 항목 — 출시 후 별 ADR로 분리 처리:

| 항목 | 출처 | 처리 방향 |
|------|------|----------|
| AbortSignal cast 2곳 | ADR-011 D13 | 별 ADR — 해소 조건 (a)/(b)/(c) 재평가 |
| 무한 스크롤 | Phase 3 인계 #6 | 별 ADR — 사용자 데이터량 증가 후 |
| 카드 측 삭제 UX (swipe·long-press) | ADR-013 D22 | 별 ADR — UX 진화 |
| 다중 동시 PATCH 큐 | Phase 4 v1 한계 | 별 ADR — 사용성 이슈 발생 시 |
| 전면 광고 wiring + 빈도 제한 | ADR-014 D30·D34 | 별 ADR — 콘솔 발급 후 |
| Analytics SDK 통합 | ADR-014 D33 | 별 ADR — 측정 SDK 결정 후 |
| 다크 모드 adaptive 토큰 | D39 보조 | 별 ADR — UX 진화 |

## 롤백 시나리오

- **R1 — TDS colors 토큰 mismatch**: 시각적 회귀 발견 → 해당 토큰만 원 hex로 부분 롤백 + 매핑표 정정.
- **R2 — AI 면책 문구 위치 부적합**: 검수 반려 시 위치 이동(예: 별 박스로 분리) — 본 ADR D40 supersede.
- **R3 — pages/_404.tsx navigation 미해결**: Granite 폴백 컨텍스트에서 useNavigation이 동작하지 않을 경우 — onBack 없는 TDS ErrorPage 단독으로 대체.

## 관련 문서

- 사용자 입력: `_workspace/00_input/requirements.md`
- architect baseline: `_workspace/01_architect_phase5_baseline.md`
- QA report: `_workspace/03_qa_report.md`
- 06-UI-MAPPING §6.5: TDS 컴포넌트 매핑 (D39 시행 반영 예정)
- 09-ENV-CONFIG §9.5·§9.6: 보안 체크리스트·출시 정책
- 10-SPRINT-PLAN §10.6: Phase 5 수용 기준 AC5.1~AC5.4
