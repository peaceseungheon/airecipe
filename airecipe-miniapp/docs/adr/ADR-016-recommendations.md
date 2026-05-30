# ADR-016 — Phase 6 테마 기반 요리 추천 (`POST /api/recommendations`)

> 전방 참조(2026-05-30): 본문이 인용하는 신규 페이지 `src/pages/recipe/recommend.tsx`·홈 확장 `src/pages/index.tsx`는 [ADR-018](./ADR-018-route-pages-consolidation.md)로 라우팅 루트 `pages/`로 통합됨. 아래 시점 기록은 보존한다.

- 상태: Accepted
- 일자: 2026-05-26
- 결정자: orchestrator(메인 세션 — architect 팀원 무산출로 통합 수행, Phase 4.5·5 선례)
- 관련 ADR: ADR-009(아키텍처), ADR-010~015(Phase 1~5)
- 관련 SSOT: `docs/appsintoss-port/01-FEATURES §1.7`, `03-API-CONTRACT §3.8`, `06-UI-MAPPING §6.10`, `07-ROUTING §7.3.6`, `10-SPRINT-PLAN §10.7`

## 컨텍스트

본 미니앱 `airecipe-miniapp`은 Phase 0~5(생성·영양·저장·목록·즐겨찾기·삭제·404 통일·광고 기반·출시 준비)를 완료. **Phase 6은 신규 기능 — 테마(상황·날씨) 기반 요리 추천 + 선택 → 기존 `/recipe/generate` 재사용**.

기존 SSOT(`01-FEATURES.md:317`)는 "추천·공유 → v1 범위 외"로 명시. 본 Phase 6에서 신규 기능 영역으로 SSOT 갱신.

도전 과제:
1. **백엔드 분리** — 미니앱 저장소는 백엔드를 보유하지 않으므로, 신규 엔드포인트는 별 저장소 `AIReceipe`에 인계되는 외부 작업.
2. **테마 분류 체계** — 자유 텍스트 vs 고정 카테고리. 검수 정책·캐싱·AI 프롬프트 인젝션 고려.
3. **응답 shape** — 토큰 비용·카드 UX 균형.
4. **인증** — 공개 vs 보호. 호출 빈도 제한·향후 개인화 고려.
5. **진입점·라우트** — 기존 `/recipe/*` 그룹과 일관성.

본 ADR은 이 5개 도전을 **9개 결정(D44~D52)**으로 동결한다.

## 결정 카탈로그 (D44~D52)

### D44 — 테마 분류 체계(고정 카테고리 v1)
- **결정**: `situation`(6종) + `weather`(5종) 두 축 고정. 둘 다 nullable이나 최소 1개 선택 필수(zod refine).
- **근거**: 자유 텍스트는 검수·인젝션·캐싱 모두 부담. 두 축으로 v1 출시 후 v2 확장.
- **시행 검증**: `recommendationThemeSchema.refine(v => v.situation || v.weather)`.
- **대안 기각**: 자유 텍스트(부담), 단일 축(요구사항 미충족).

### D45 — 응답 shape(요리명 + 짧은 설명 + 태그)
- **결정**: `{ items: Array<{ dishName, description, tags }>, meta }`. 이미지 URL 미포함.
- **근거**: 카드 표시 충분 + 토큰·CDN·저작권 비용 최소.
- **시행 검증**: zod `dishName.max(60)`, `description.max(120)`, `tags.max(5)`.
- **대안 기각**: 요리명만(빈약), +레시피 미리보기(생성 결과와 불일치 위험).

### D46 — 추천 개수(정확히 5개)
- **결정**: `items.length(5)`. 백엔드가 강제. 위반 시 zod fail → `INTERNAL_ERROR`.
- **근거**: UX 일관성 + 한 화면 가시 범위.
- **시행 검증**: `z.array(itemSchema).length(5)`.
- **롤백**: `.min(3).max(8)` 완화 합의 시.

### D47 — 인증(보호 — `X-Toss-User-Id` 필수)
- **결정**: 보호 엔드포인트. 401 자동 재시도 1회(05 §5.4 패턴).
- **근거**: 호출 빈도 제한·악용 차단 + 향후 개인화 기반.
- **시행 검증**: api-client `tossUserId: required`, `refreshTossUserId: optional`.
- **롤백 R1**: 공개로 전환 시 본 결정 supersede + 03 §3.8 표 갱신.

### D48 — 비-stream 응답
- **결정**: `Content-Type: application/json` 단일 응답.
- **근거**: 작은 JSON(~1KB)이라 점진 표시 불필요.
- **롤백 R2**: 응답 지연 시 `mode?: 'stream'` 옵션 추가.

### D49 — 라우트 `/recipe/recommend`
- **결정**: `pages/recipe/recommend.tsx`. `/recipe/*` 그룹 일관성.
- **시행 검증**: Granite `createRoute('/recipe/recommend', ...)`. router.gen.ts 자동.
- **대안 기각**: `/recommendations`(최상위 그룹 부담), `/recipe/recommendations`(URL 길이).

### D50 — 진입 CTA(홈 1개)
- **결정**: 홈 `pages/index.tsx`에 "오늘의 추천 받기" Button 1개. 마이 목록 미적용.
- **근거**: 시각 부담·광고 중복 회피.
- **시행 검증**: pages/index.tsx에 Button 1개 추가.

### D51 — 재추천 + 캐시(SWR-like, 테마 hash key)
- **결정**: useRecommendations 훅이 `{ theme }` deps + `refresh()` export. 테마 변경 시 자동 새 fetch + 이전 in-flight abort. 캐시는 메모리 내 테마 hash key.
- **근거**: 사용자 의도(동일 테마 새 추천 또는 다른 테마)에 자연스러운 트리거.
- **시행 검증**: AbortController cleanup + 새 fetch 발사 단계 검증(Q4).

### D52 — AI 면책 문구
- **결정**: 추천 결과 리스트 하단 1줄 — `Txt typography="st11" color={colors.grey600}`. Phase 5 D40 동일 패턴.
- **근거**: 검수 가이드 §10.6 6번 — AI 생성 결과 면책.

## 시행 결과 (Phase 6 본 사이클 — 미니앱 측)

| 산출 | 위치 | 변경량 |
|------|------|--------|
| 신규 zod 스키마 | `src/lib/zod/recommendations.ts` | 신규 |
| 신규 타입 | `src/types/api.ts` 확장 | +RecommendationsRequest/Response 등 |
| api-client 메서드 | `src/services/recipes.ts` 확장(또는 신규 파일) | +getRecommendations |
| 신규 컴포넌트 | `src/components/ThemePicker.tsx`, `RecommendationCard.tsx` | 신규 2 |
| 신규 훅 | `src/hooks/useRecommendations.ts` | 신규 |
| 신규 페이지 | `src/pages/recipe/recommend.tsx` | 신규 |
| 홈 확장 | `src/pages/index.tsx` | CTA 1개 추가 |
| SSOT 갱신 | 01-FEATURES §1.7, 03-API-CONTRACT §3.8, 06-UI-MAPPING §6.10, 07-ROUTING §7.3.6, 10-SPRINT-PLAN §10.7 | 신규 절 5종 |

## 외부 작업 PENDING (별 저장소 `AIReceipe`)

| 항목 | 비고 |
|------|------|
| `app/api/recommendations/route.ts` 구현 | AI 프롬프트 — Gemini/Claude. 응답 zod 검증. |
| 옵션 P 인증 미들웨어 적용 | `X-Toss-User-Id` 헤더 → internal uuid 매핑 재사용 |
| CORS 정책 — 본 엔드포인트 등록 | 화이트리스트 동일 |
| staging·prod 배포 | 환경별 |
| 미배포 상태 동작 | 401/404/CORS 실패 → ApiClientError 카탈로그로 사용자 안내 |

## 누적 미해결 (Phase 7 진화 — 별 ADR)

Phase 5 누적 + 본 Phase 미적용:

| 항목 | 출처 | 처리 방향 |
|------|------|----------|
| 다크 모드 adaptive 토큰 | ADR-015 D39 보조 | 별 ADR |
| AbortSignal cast 2곳 | ADR-011 D13 | 별 ADR |
| 무한 스크롤 | Phase 3 인계 | 별 ADR |
| 카드 측 삭제 UX | ADR-013 D22 | 별 ADR |
| 다중 동시 PATCH 큐 | Phase 4 v1 한계 | 별 ADR |
| 전면 광고 wiring | ADR-014 D30·D34 | 별 ADR |
| Analytics SDK | ADR-014 D33 | 별 ADR |
| 추천 자유 텍스트 입력 | D44 보조 | 별 ADR — 검수·캐싱 부담 검토 |
| 추천 이미지 URL | D45 보조 | 별 ADR — CDN·저작권 검토 |
| 개인화 추천 | D47 보조 | 별 ADR — 과거 저장 레시피 기반 |
| 추천 결과 광고 위치 | ADR-014 D34 후속 | 별 ADR |

## 롤백 시나리오

- **R1 — 인증 정책 변경**: 보호 → 공개 전환 시 본 ADR D47 supersede. 03 §3.8 인증 표 + api-client 호출부 갱신.
- **R2 — 스트리밍 추가**: 비-stream → stream 옵션 시 본 ADR D48 supersede. 08-STREAMING §8.x에 신규 청크 타입 추가.
- **R3 — 추천 개수 가변**: `length(5)` → 가변 시 본 ADR D46 supersede + zod·UI 슬롯 처리.

## 관련 문서

- 입력: `_workspace/00_input/requirements.md`
- baseline: `_workspace/01_architect_phase6_baseline.md`
- 01-FEATURES.md §1.7 (신설)
- 03-API-CONTRACT.md §3.8 (신설)
- 06-UI-MAPPING.md §6.10 (신설)
- 07-ROUTING.md §7.3.6 (신설)
- 10-SPRINT-PLAN.md §10.7 (신설)
