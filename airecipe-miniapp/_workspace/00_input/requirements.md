# 요구사항 — BottomTabBar 전 화면 노출

## 사용자 요청 (2026-05-30)
"@airecipe-miniapp/src/components/BottomTabBar.tsx 모든 화면에서 보였으면 좋겠어."

## 범위
- 현재: BottomTabBar 노출은 `/`·`/my-recipes`만 (ADR-017 D56).
- 목표: 모든 화면에서 하단 탭바 노출 — `/recipe/generate`, `/recipe/recommend`, `/recipe/[id]`, `/_404` 추가.

## 제약/결정 포인트
- BottomTabBar props 현재 `active: 'home'|'my'` (필수). 비-탭 화면은 활성 탭 없음 → 비활성 상태('none' 등) 허용 필요.
- ADR-017 D56(노출 범위 제한)을 대체하는 새 결정 + ADR 갱신.
- SafeArea/paddingBottom 정합: 각 페이지 스크롤 콘텐츠 하단 탭바 겹침 방지.
- 서브 화면(generate/recommend/[id])은 push 네비게이션 + 자체 PageNavbar 백버튼 보유 → 탭 누름 시 navigate(재포커스, D55) 유지.
- 백엔드 무변경. api-client/zod/types 무변경.

## 완료 기준
- 5개 페이지 + _404 전부 BottomTabBar 노출.
- typecheck/lint PASS, QA 통합 정합성 PASS.
