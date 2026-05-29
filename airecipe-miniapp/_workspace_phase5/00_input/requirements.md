# Phase 5 — 출시 준비 (TDS 점검·콘솔 등록·검수 체크리스트) — 요구사항

> 사용자 입력: "phase 5 진행." (2026-05-25)
> 진입 조건: Phase 4(즐겨찾기·삭제·404 통일) 완료 — Q1~Q9 + D19~D24 + AC4.1~AC4.4 ALL PASS, typecheck PASS, lint 0 errors.

---

## 0. 진입 컨텍스트

| 항목 | 상태 |
|------|------|
| Phase 1 (인프라) | 완료 (ADR-010) |
| Phase 2 (생성·SSE) | 완료 (ADR-011) |
| Phase 3 (저장·목록·상세) | 완료 (ADR-012) |
| Phase 4 (즐겨찾기·삭제·404) | 완료 (ADR-013) |
| Phase 4.5 (토스 광고 기반) | 완료 (ADR-014) |
| Phase 5 (출시 준비) | **본 차** |

SSOT: `10-SPRINT-PLAN §10.6` + `09-ENV-CONFIG §9.5·§9.6` + `06-UI-MAPPING` (TDS 의무) + 검수 가이드 `checklist/app-nongame.md`.

## 1. 출력 영역 (Phase 5 산출물)

### A. TDS 컴포넌트 사용 검증 (코드 측)
- 모든 화면이 `@toss/tds-react-native` 컴포넌트 사용 — 직접 `View`/`Text` 사용 grep 점검.
- 커스텀 색상은 TDS 토큰으로 — `colors.adaptive*` 또는 `colors.palette*`. hex 직접 사용 감사 + 가능한 한 교체.
- 본 사이클 범위: 신규 작성 코드의 hex 직접 사용을 adaptive 토큰으로 일괄 교체(별 ADR 회피 — Phase 5 안에 통합).

### B. granite.config.ts·플러그인 검증 (코드 측)
- `appName` RFC-1123 (`aireceipe`) 적합성.
- `permissions: []` 최소 권한 유지.
- `brand.displayName`/`primaryColor`/`icon` 콘솔 등록 정보와 일치 점검 (코드 측 일관성만, 콘솔 등록은 외부).
- env 키 정합 (`API_BASE_URL`/`APP_ENV`/`LOG_LEVEL`/`ADS_*`).

### C. 보안·환경변수 검증 (코드 측)
- 미니앱 번들에 AI Provider API 키·Supabase service role 키 부재 (`grep` 검증).
- `API_BASE_URL` 기본값이 HTTPS 외 환경(local만 HTTP) 분리.
- `X-Toss-User-Id` 평문 노출 0건 (UI/console.log 검사).
- `formatTossUserIdMask` 사용 누락 검증.

### D. 에러 처리 일관성 점검 (코드 측)
- 401·404·429·502·503 모든 경로 한국어 사용자 친화 UI 매핑 검증.
- 5xx 토스트 메시지 누락 점검.
- 404는 `<NotFoundScreen onBack={...} />` 단일 컴포넌트 (ADR-012 D16).

### E. AI 면책 문구 추가 (코드 측)
- `nutrition.healthNote` 또는 영양 정보 표시 화면에 "본 정보는 AI가 생성한 참고용이며, 의료 자문이 아닙니다." 면책 문구 추가 (검수 가이드 §10.6 6번).
- 위치: `src/pages/recipe/[id].tsx` 상세 화면 영양 정보 섹션 하단 또는 `src/pages/recipe/generate.tsx` 결과 표시 화면.

### F. 검수 체크리스트 매핑 (문서 측)
- AC5.1~AC5.4 각 항목에 대해 코드 측 통과/외부 작업 분리표 작성.
- 출시 정책(`intro/guide.md`) 미해당 카테고리(디지털 자산·도박·자금세탁) 확인.
- 콘솔 등록(고객센터 URL·홈페이지·도메인 화이트리스트·아이콘) PENDING 명시.

### G. 누적 미해결 재평가 (해결 가능 항목)
- **SDK 패키지 경로 미해결** (`@apps-in-toss/web-framework` ts-expect-error 1줄) — dev server 실행 가능 시점 검증 (ADR-010 §R1).
- **AbortSignal cast 2곳** — ADR-011 D13 해소 조건 (a)/(b)/(c) 재평가. 현 v1 유지 가능.
- **디자인 토큰 hex 직접 사용** — E와 통합 처리.

### H. 별 ADR로 분리 (Phase 5 비범위)
- 무한 스크롤 (Phase 3 인계 #6).
- 카드 측 삭제 UX (swipe·long-press) (Phase 4 ADR-013 D22).
- 다중 동시 PATCH 큐 (Phase 4 v1 한계).
- 콘솔 `adGroupId` 발급·승인 (Phase 4.5 외부).
- 전면 광고 wiring + 빈도 제한 (ADR-014 D30·D34).
- Analytics SDK 통합 (ADR-014 D33).
- 백엔드 옵션 P 배포 검증 (별 저장소).

## 2. 결정 후보 (D39~)

본 Phase에서 동결할 결정 카탈로그 초안 (architect가 baseline에 확정):

| ID | 결정 후보 | 영향 |
|----|-----------|------|
| D39 | hex 색상 → TDS adaptive 토큰 교체 정책 (전면/부분 + 적용 범위) | 06-UI-MAPPING 갱신 |
| D40 | AI 면책 문구 형식·표시 위치 (영양 섹션 하단 / `healthNote` 통합) | 검수 통과 + UX |
| D41 | 에러 메시지 카탈로그 (api-client `ApiErrorCode` 8종) — 현 구현 그대로 동결 / 보강 | 사용자 경험 일관성 |
| D42 | 환경별 빌드 스크립트 (`dev:local`/`build:staging`/`build:prod`) | CI/CD 준비 |
| D43 | 출시 PENDING 항목 명시 (콘솔·외부 작업 분리) | 출시 진행 가능성 |

## 3. 수용 기준 (AC5.1~AC5.4)

| AC | 내용 | 본 사이클 검증 가능? |
|----|------|-------------------|
| AC5.1 | 검수 가이드(비게임) 체크리스트 항목 모두 통과 | 코드 측 PASS / 콘솔 PENDING |
| AC5.2 | 콘솔 "검토 요청" 제출 → 반려 사유 없음 | **외부 작업 PENDING** |
| AC5.3 | 토스앱 5.246.0+ 미니앱 진입·홈 화면 등록 | **외부 작업 PENDING** (실 디바이스 테스트) |
| AC5.4 | 사용자 6기능 e2e 무결성 | 코드 경로 PASS / 실 디바이스 PENDING |

## 4. 멈춤 트리거 (architect 사전)

- TDS 컴포넌트 매핑 실제와 다름 발견 → 즉시 점검 중단 + 06-UI-MAPPING 정정 우선.
- hex 직접 사용 일괄 교체 중 시각적 디그레이드 의심 → 부분 적용 후 별 ADR.
- 보안 grep에서 API 키 흔적 발견 → 즉시 작업 중단 + 사용자 보고 + 키 즉시 폐기 권고.
- 에러 메시지에서 영문/HTTP 상태 그대로 노출 발견 → 즉시 교체.

## 5. 진행 방식 (Phase 4·4.5 답습)

팀 1개 동시 제약 + 작업 성격이 점검·문서 중심이므로 메인 세션 orchestrator-as-everything 패턴:
1. architect 역할: baseline 작성 (검수 체크리스트 매핑 + D39~D43 동결).
2. 점검 작업: TDS/보안/에러/AI 면책/디자인 토큰.
3. QA 역할: 매트릭스 작성 + AC 검증.
4. 문서 마무리: ADR-015 + 06/09 갱신 + AGENTS.md 갱신 + CLAUDE.md 갱신.
5. 커밋.

본 사이클은 **출시 가능 상태 도달 + PENDING 항목 명시**가 목표. 콘솔/디바이스 검수는 외부 작업으로 분리.
