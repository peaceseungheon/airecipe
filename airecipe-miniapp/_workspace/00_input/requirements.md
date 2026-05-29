# 요구사항 — 하단 탭바 도입 ([홈 / 마이 레시피])

> 출처: monorepo 루트 `airecipe-router` → `miniapp-orchestrator` 위임. 기준 디렉토리 `airecipe-miniapp/`. 백엔드 변경 불필요.
> 날짜: 2026-05-29

## 사용자 요청 (원문)
"내 레시피 저장 목록을 조회할 수 있는 탭을 만들어줘."

→ 라우터 코드 확인 + 사용자 확정 결과: **하단 탭바(bottom tab navigator) 방식**으로 [홈 / 마이 레시피] 2탭 상시 노출.

## 확정된 컨텍스트 (재구현 금지)
- 저장 목록 화면 `src/pages/my-recipes.tsx` (`/my-recipes`)는 **이미 완성**됨 — 목록·필터(전체/즐겨찾기)·페이지네이션·낙관적 즐겨찾기·빈상태·인라인광고. **재구현 금지, 화면 로직 변경 최소화.**
- 백엔드 `GET /api/recipes` 이미 구현·동작. **API/계약/zod/api-client 변경 불필요** (api-client 팀원 사실상 no-op).
- 현재 마이 진입 경로는 홈(`src/pages/index.tsx`) `PageNavbar.AccessoryTextButton "마이 레시피"` 단일 버튼뿐. 하단 탭바 없음.
- `07-ROUTING.md §7.8`: "v1 탭바 없음, 향후 화면 수 증가 시 하단 탭 도입 검토" → **본 작업이 그 도입.**

## 요구사항
1. Granite/React Navigation 기반 하단 탭 네비게이터 도입 → [홈][마이 레시피] 2탭 상시 노출. TDS 의무·검수 정책 준수(아이콘·라벨).
2. 기존 스택 라우트(`/recipe/generate`, `/recipe/[id]`, `/recipe/recommend`)와의 관계 정리 — 상세/생성/추천 진입 시 탭바 유지 vs 숨김을 architect가 Granite/TDS 실제 API로 결정.
3. 홈의 "마이 레시피" 텍스트 버튼은 탭바와 중복 — 제거 또는 유지 결정.
4. `_app.tsx` 컨테이너 / `router.gen.ts` / `pages/` 구조 영향 반영.
5. ADR 신규 발행(하단 탭 도입) + `07-ROUTING.md §7.8` 갱신 + `CLAUDE.md` "현재 단계" 동기 갱신.

## 핵심 제약 (블로커 우선)
- **[블로커] Granite 하단 탭 지원 검증 우선**: Granite는 파일 기반 라우팅 위 React Navigation으로 동작. 하단 탭 네비게이터가 Granite에서 1급으로 지원되는지 `granite-rn-development` 스킬 + 공식 문서로 **먼저** 검증. 제한적이면 대안(커스텀 하단 탭 컴포넌트 + `navigation`)을 architect가 결정하고 ADR에 근거 기록. 이 검증 전 frontend 구현 착수 금지(Phase 3 게이트).
- **TDS 실재성**: 존재하지 않는 TDS 탭 컴포넌트 가정 금지. AppsInToss MCP/패키지로 표본 검증.
- ⚠️ **정합성 경고 (진입 폴백 회귀 위험)**: `granite.config.ts`의 `appName`이 현재 `'airecipe'`인데, 직전 hotfix(`_workspace_hotfix_entry_fallback/`) 기록은 `'airecipe-miniapp'`로 원복했다고 명시 — 불일치. 하단 탭은 네비게이션 진입점을 바꾸므로 진입 폴백(_404) 버그 재발 가능. architect/QA가 deep link prefix ↔ appName ↔ 초기 라우트 정합을 반드시 교차 확인.
- typecheck/lint 통과 + miniapp-qa 경계면 정합성 검증 완료가 완료 기준.
