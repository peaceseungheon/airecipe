# Phase 6 — 테마 기반 요리 추천 + 선택→레시피 생성 (요구사항)

> 일자: 2026-05-26
> 입력자: 사용자 — "상황별, 날씨별 등 테마에 따라 요리들을 사용자에게 추천해주고 사용자가 선택한 요리에 대한 레시피 생성 기능을 만들고 싶어."
> 선택된 접근: **A안 — 백엔드 신규 엔드포인트** (`POST /api/recommendations`). 백엔드 구현은 별 저장소 `AIReceipe`에 인계(외부 작업), 본 사이클은 **미니앱 측 SSOT 갱신 + 프론트엔드 구현 + zod 계약**.

---

## 1. 배경

- Phase 5(출시 준비) 완료. 6개 기능(생성·영양·저장·목록·즐겨찾기·삭제) 동결됨.
- 신규 기능: 테마(상황·날씨 등) 기반 요리 추천 + 선택 → 기존 `/recipe/generate` 재사용.
- `docs/appsintoss-port/01-FEATURES.md:317`에 "추천·공유 → v1 범위 외"로 명시 → 본 Phase 6에서 신규 기능 영역으로 SSOT 갱신 필요.

---

## 2. 사용자 흐름 (제안)

```
사용자 진입(/recommendations)
  ↓
테마 선택 UI (예: 상황 카테고리 + 날씨 카테고리)
  ↓
"추천받기" 액션 → POST /api/recommendations { theme }
  ↓
추천 결과 카드 리스트 N개 표시 (요리명 + 짧은 설명)
  ↓
사용자가 카드 탭 → /recipe/generate?dishName=<선택>
  ↓
기존 생성 화면으로 dishName prefilled → 기존 SSE 플로우 재사용
```

---

## 3. 출력 영역 (본 저장소 측)

### 3.1 SSOT 갱신 (architect)
- `docs/appsintoss-port/01-FEATURES.md` — 기능 g) "테마 기반 추천" 절 신설. 사용자 흐름·수용 기준·관련 API·관련 화면·관련 컴포넌트 명시. §1.7 또는 §1.8로 추가하고 v1 외 표기 정정.
- `docs/appsintoss-port/03-API-CONTRACT.md` — `POST /api/recommendations` 엔드포인트 §3.8 신설(또는 마지막 절). 요청·응답·에러·CORS 계약 동결.
- `docs/appsintoss-port/06-UI-MAPPING.md` — 신규 컴포넌트(`ThemePicker`, `RecommendationCard`, `RecommendationList`) 매핑 추가.
- `docs/appsintoss-port/07-ROUTING.md` — `/recommendations` 라우트(또는 `/recipe/recommend`) 추가 + 진입점(예: `/` 홈 또는 마이 목록에서 진입) 결정.
- `docs/appsintoss-port/10-SPRINT-PLAN.md` — Phase 6 AC6.* 수용 기준 추가.
- `docs/adr/ADR-016-recommendations.md` (신규) — 본 사이클 결정 카탈로그.

### 3.2 api-client (api-client 에이전트)
- `src/services/api-client.ts` — `getRecommendations(theme, signal)` 메서드 추가. baseURL + `X-Toss-User-Id` 헤더(공개냐 보호냐는 architect 결정) + zod 검증 + 401 재시도 동일 패턴 + `ApiErrorCode` 매핑 재사용.
- `src/lib/zod/recommendations.ts` (신규 또는 기존 zod 파일에 추가) — 요청·응답 스키마.
- 응답 shape이 stream인지 비-stream인지 architect 결정(생성과 달리 추천은 비-stream이 자연스러움).

### 3.3 frontend (frontend 에이전트)
- `src/components/ThemePicker.tsx` (신규) — 상황·날씨 등 테마 선택 UI. TDS `Chip`/`SegmentedControl`/`Select` 등 실재 컴포넌트 매핑은 architect의 06 갱신을 따름.
- `src/components/RecommendationCard.tsx` (신규) — 추천 요리 카드. 요리명·설명·태그 표시. 탭 시 onSelect 콜백.
- `src/components/RecommendationList.tsx` (신규 — 선택) 또는 페이지에서 인라인 렌더링.
- `src/hooks/useRecommendations.ts` (신규) — api-client 호출 훅. 로딩·에러·재시도 + AbortController.
- `src/pages/recommendations.tsx` 또는 `src/pages/recipe/recommend.tsx` (신규) — 진입 화면. 테마 선택 → 추천 결과 → 카드 탭 시 `/recipe/generate?dishName=...` 네비.
- `src/pages/recipe/generate.tsx` (확장) — Granite route param `dishName` 수신해 SearchForm prefilled. 기존 SSE 플로우 재사용.
- `src/pages/index.tsx` 또는 별 진입점에 "테마 추천" CTA 추가(architect 결정).

### 3.4 QA (qa 에이전트)
- 통합 정합성 점검:
  - 요청·응답 shape ↔ api-client ↔ frontend ↔ zod 일치.
  - 401/네트워크/AbortError 에러 처리 일관.
  - 카드 탭 → 생성 화면 dishName prefill 동작.
  - 테마 변경 시 이전 in-flight abort.
  - 로딩·에러·빈 결과 상태 분기 완비.
  - TDS 컴포넌트 실재성 (`@toss/tds-react-native` 표본 검증).
  - hex 직접 사용 0건(Phase 5 D39 준수).
  - AI 면책 문구 필요성(추천도 AI 생성이므로 검토 필요 — architect 결정).
- 검수 정책 영향(개인정보·광고·정책) 점검.
- typecheck PASS, lint 0 errors.

---

## 4. 미해결 결정 사항 (architect 판단)

| 항목 | 옵션 | 비고 |
|------|------|------|
| 테마 분류 체계 | (1) 고정 카테고리(상황·날씨·시간·인원·식이) (2) 사용자 자유 입력 (3) 혼합 | UX 단순성과 추천 품질 균형 |
| 테마 입력 UX | Chip/SegmentedControl/Select/Form | 06 갱신 + TDS 실재성 검증 |
| 추천 개수 | 3·5·10·N | 카드 리스트 길이 + 응답 토큰 비용 |
| 응답 shape | 요리명만 / 요리명+설명 / +태그 / +이미지 URL | v1은 단순한 게 좋음 |
| 인증 | 공개(헤더 없이) / 보호(`X-Toss-User-Id` 필수) | 사용자별 맞춤이면 보호, 일반 추천이면 공개 |
| 스트리밍 | 비-stream 단일 응답 / SSE 점진 카드 노출 | v1은 비-stream이 단순 |
| 진입점 | `/recommendations` / `/recipe/recommend` / 홈에 묶기 | 07-ROUTING 갱신 |
| 재추천 (re-roll) | 동일 테마로 다시 호출 / 캐시 / 새 카드 N개 | UX 결정 |
| 추천 결과 캐시 | client SWR 캐시 / 비-캐시 / per-theme key | 비용 vs 신선도 |
| 카드 탭 데이터 | dishName만 / dishName+추천 컨텍스트 | generate API 호환 |
| AI 면책 문구 | 추천 결과에도 노출? | Phase 5 D40 정책 확장 검토 |
| 광고 | 추천 결과 하단에 InlineAd? | ADR-014 D34 광고 위치 정책 |

---

## 5. 산출 기대물

1. **architect**: `_workspace/01_architect_phase6_baseline.md` — 위 결정 사항 동결 + SSOT 갱신 인용 위치 확정 + ADR-016 발행.
2. **api-client**: `src/services/api-client.ts` 메서드 추가 + zod 스키마 + `_workspace/02_api_client_summary.md`.
3. **frontend**: 페이지·컴포넌트·훅 + `src/pages/recipe/generate.tsx` 확장 + `_workspace/02_frontend_summary.md`.
4. **qa**: `_workspace/03_qa_report.md` — Q1~Qn 매트릭스 + AC6.* 점검 + 미해결 인계.
5. **session log**: `_workspace/04_session_log.md` — 타임라인 + 결정 + QA 결과.

---

## 6. 제약 사항

- **백엔드 구현은 본 사이클 외 작업** — 별 저장소 `AIReceipe`에 인계. 본 저장소는 미니앱 측 코드 + SSOT 계약 동결까지.
- **백엔드 미배포 상태에서는 추천 호출 401/404** — typecheck/lint PASS + 코드 측 정합성으로 완료 판정. 실 송출 검증은 외부 작업 PENDING(ADR-015 D43 패턴 재사용).
- **TDS 의무** — `@toss/tds-react-native` 사용. raw `Text`/`View` 금지(Phase 5 정책).
- **hex 직접 사용 금지** — `colors.*` 토큰만(Phase 5 D39).
- **에러 메시지 한국어** — 기존 KOREAN_ERROR_MESSAGE 매핑 패턴 재사용.
- **`X-Toss-User-Id` 노출 금지** — 헤더·로깅 마스킹.

---

## 7. 참조 SSOT

- `docs/appsintoss-port/03-API-CONTRACT.md` — 기존 6 엔드포인트 계약 패턴(§3.1 공통 규약 + §3.2~§3.7 개별).
- `docs/appsintoss-port/06-UI-MAPPING.md` — TDS 매핑 + Phase 5 §6.1 colors 토큰 규약.
- `docs/appsintoss-port/07-ROUTING.md` — Granite 파일 라우팅 + dynamic segment.
- `docs/adr/ADR-009` — 기본 아키텍처. `ADR-010~015` — Phase별 결정 누적.
- `_workspace_phase5/04_session_log.md` — 직전 사이클 산출.
