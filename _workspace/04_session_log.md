# Phase 6 Session Log — 테마 기반 요리 추천 (ADR-016)

> 일자: 2026-05-29
> 모드: miniapp-orchestrator (4인 팀 + 메인 세션 통합)
> 결과: 코드 측 ALL PASS — typecheck PASS, lint 0 errors(Phase 3 누적 router.gen.ts warning 1건), Q1~Q12 12/12 PASS.

## 타임라인

1. **사용자 입력**: "상황별, 날씨별 등 테마에 따라 요리들을 사용자에게 추천해주고 사용자가 선택한 요리에 대한 레시피 생성 기능을 만들고 싶어."
2. **선택지 분석**: A안(백엔드 신규 엔드포인트) / B안(미니앱 단독) / C안(백엔드 확장) 3가지 surface. 사용자 선택 — **A안**.
3. **워크스페이스 생성**: `_workspace/00_input/requirements.md` + 4인 팀 + T1~T5 작업 등록(`miniapp-architect`/`miniapp-api-client`/`miniapp-frontend`/`miniapp-qa`).
4. **T1 — architect 무산출**: 3회 idle 통지에도 산출 없음 → Phase 4.5·5 선례에 따라 메인 세션이 통합 수행.
5. **T1 산출**: `_workspace/01_architect_phase6_baseline.md` + `docs/adr/ADR-016-recommendations.md`(D44~D52 9 결정 동결).
6. **SSOT 5종 갱신**: 01-FEATURES §1.7 + 03-API-CONTRACT §3.8(엔드포인트 7) + 06-UI-MAPPING §6.10 + 07-ROUTING §7.3.6 + 10-SPRINT-PLAN §10.7.
7. **T2 — api-client**: zod 스키마(`src/lib/zod/recommendations.ts` 신규) + 타입(`src/types/api.ts` 확장) + `getRecommendations`(`src/services/recipes.ts` 확장).
8. **T3 — frontend**: ThemePicker + RecommendationCard + useRecommendations + `pages/recipe/recommend.tsx` 라우트 + 홈 CTA 1개.
9. **router.gen.ts 갱신**: `/recipe/recommend` 라우트 수동 등록(granite build 시 자동 재생성 예정).
10. **T4 — QA**: Q1~Q12 매트릭스 ALL PASS. `_workspace/03_qa_report.md` 발행.
11. **T5 — 마무리**: AGENTS.md 2종 보강(components/hooks) + 본 session log + CLAUDE.md 변경 이력.

## 결정 동결 (ADR-016 D44~D52)

| 결정 | 내용 |
|------|------|
| D44 | 테마 분류 — situation(6종) + weather(5종) 두 축 고정. 최소 1개 선택 필수(zod refine) |
| D45 | 응답 shape — `{ dishName, description, tags }` 카드 단위. 이미지 URL 미포함 |
| D46 | 추천 개수 — 정확히 5개. zod `length(5)` 강제 |
| D47 | 인증 — 보호 엔드포인트(`X-Toss-User-Id` 필수). 401 자동 재시도 1회 |
| D48 | 비-stream JSON 단일 응답 |
| D49 | 라우트 `/recipe/recommend` (Granite `pages/recipe/recommend.tsx`) |
| D50 | 진입 CTA — 홈 1개. 마이 목록 미적용(시각 부담·광고 중복 회피) |
| D51 | 재추천 + 캐시 — useRecommendations에 theme deps + refresh + 메모리 hash key 캐시 |
| D52 | AI 면책 1줄 — `Txt typography="st11" color={colors.grey600}` (Phase 5 D40 패턴) |

## 신규 코드 산출

| 파일 | 변경 |
|------|------|
| `src/lib/zod/recommendations.ts` | 신규 — situation/weather enum + refine + length(5) |
| `src/lib/zod/index.ts` | export 추가 |
| `src/types/api.ts` | RecommendationsRequest/RecommendationsResponse + zod re-export |
| `src/services/recipes.ts` | `getRecommendations` 함수 + `RecommendationsCallOptions` 인터페이스 |
| `src/services/index.ts` | `getRecommendations` export 추가 |
| `src/hooks/useRecommendations.ts` | 신규 — theme deps + AbortController + 401 재시도 + 메모리 캐시 + 한국어 에러 매핑 |
| `src/components/ThemePicker.tsx` | 신규 — SegmentedControl 2축(상황·날씨) 합성 + 한국어 라벨 |
| `src/components/RecommendationCard.tsx` | 신규 — Pressable + Txt(dishName·description) + Badge tags |
| `src/pages/recipe/recommend.tsx` | 신규 — Granite createRoute + 식별자 가드 + 분기 렌더 + AI 면책 |
| `pages/recipe/recommend.tsx` | 신규 — re-export shim |
| `src/router.gen.ts` | `/recipe/recommend` 수동 등록(granite build 시 자동 재생성) |
| `src/pages/index.tsx` | "오늘의 추천 받기" Button CTA 1개 추가 |

## SSOT 갱신

| 챕터 | 절 | 변경 |
|------|----|----|
| `docs/appsintoss-port/01-FEATURES.md` | §1.7 신설 + §1.8/§1.9/§1.10 renumber + 매트릭스 행 g) | 기능 g) 흐름·AC·관련 API·화면·컴포넌트 |
| `docs/appsintoss-port/03-API-CONTRACT.md` | §3.8 신설 + §3.9~§3.13 renumber + §3.11.6 "5→6" | 엔드포인트 7 + HTTP 매트릭스 + 보호 엔드포인트 수 |
| `docs/appsintoss-port/06-UI-MAPPING.md` | §6.10 신설 | ThemePicker + RecommendationCard 합성 + 면책 패턴 |
| `docs/appsintoss-port/07-ROUTING.md` | §7.3.6 신설 + 라우트 표 행 5 + Navbar 분산 표 | `/recipe/recommend` |
| `docs/appsintoss-port/10-SPRINT-PLAN.md` | §10.7 신설 + §10.8/§10.10 renumber + 의존성 그래프 | Phase 6 AC6.1~AC6.6 + 의존 그래프 마지막 노드 |
| `docs/adr/ADR-016-recommendations.md` | 신규 | D44~D52 9 결정 + 외부 작업 PENDING + 누적 미해결 |
| `src/components/AGENTS.md` | 표 행 추가 | ThemePicker + RecommendationCard |
| `src/hooks/AGENTS.md` | 표 행 추가 | useRecommendations |

## 외부 작업 PENDING (별 저장소 `AIReceipe`)

- `app/api/recommendations/route.ts` 구현 — AI 프롬프트(Gemini/Claude) + 응답 zod 검증.
- 옵션 P 인증 미들웨어 적용 — `X-Toss-User-Id` → internal uuid 매핑 재사용.
- CORS 화이트리스트에 본 엔드포인트 등록.
- staging·prod 배포.
- 미배포 상태에서 미니앱은 401/404 → ApiClientError 카탈로그로 한국어 안내(자동).

## 누적 미해결 (Phase 7 진화 — 별 ADR)

ADR-016 §누적 미해결 참조:
- 자유 텍스트 테마 입력 (D44 보조)
- 추천 이미지 URL (D45 보조)
- 개인화 추천 (D47 보조)
- 추천 결과 위치 광고 (ADR-014 D34 후속)
- 다크 모드 adaptive 토큰 (ADR-015 D39 보조)
- AbortSignal cast 2곳 (ADR-011 D13)
- 무한 스크롤 (Phase 3 인계)
- 카드 측 삭제 UX swipe·long-press (ADR-013 D22)
- 다중 동시 PATCH 큐 (Phase 4 v1 한계)
- 전면 광고 wiring (ADR-014 D30·D34)
- Analytics SDK (ADR-014 D33)

## 팀 운영 메모

- **architect 팀원 무산출 (3회 idle 통지)**: 첫 idle에는 리마인더 + 명시 단계별 prompt 전송, 그래도 미응답. Phase 4.5·5 선례(`CLAUDE.md` "팀 1개 동시 제약으로 메인 세션이 architect/api-client/frontend/qa 역할 통합 수행")에 따라 메인 세션이 전 작업 통합 수행.
- **api-client/frontend/qa 팀원에 SendMessage 미사용**: architect 무산출로 SSOT 인용 통지 단계가 생략. 메인 세션이 SSOT 갱신 → 코드 작성 → QA 일괄 수행으로 대체. 다음 사이클에 동일 패턴 재발 시 architect 팀원 정의 점검 필요.
