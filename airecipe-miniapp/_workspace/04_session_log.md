# Session Log — 진입 폴백 hotfix (4 root cause 확정 + 모두 fix)

> 일자: 2026-05-29
> 단계: 4 root cause 확정 + fix 적용 + 사용자 dev 검증 정상 동작 확인.

## 타임라인

1. 사용자 보고: "로그인 하고 어플 진입 시 NotFoundScreen '레시피를 찾을 수 없어요'가 뜨면서 아무것도 동작하지 않아. 닫기 버튼을 눌러도 동작하지 않아."
2. 사용자 추가 명령: 현재까지 작업 논리적 commit + 새 사이클 시작.
3. **commit 2개 정리** — Phase 5 보존(`chore: ...`) + Phase 6 구현(`feat: Phase 6 — ...`).
4. 분석 baseline 작성(`_workspace/01_architect_baseline.md`) — 7 가설 + 안전 fix 후보 + 사용자 확인 요청 4항.
5. 사용자 응답 — appName=airecipe(일치), 메인 메뉴 진입(정상), metro 에러 없음, 좌="고객센터 문의" 우="닫기".
6. **TDS ErrorPage 실 구현 검증**(`node_modules/.../ErrorPage.js`) — 좌측 카피 하드코딩 "고객센터 문의", 우측 404 시 "닫기"(400 시 "다시 입력하기").
7. root cause 확정: 기존 NotFoundScreen이 `onPressLeftButton={onBack}`만 바인딩 → 좌측 "고객센터 문의"에 onBack 잘못 매핑, 우측 "닫기"는 핸들러 없음.
8. fix 적용: NotFoundScreen props 확장 + `_404.tsx` 카피 분리 + 진단 로그.
9. QA report + 본 log 작성.

## 확정 사항

| 항목 | 결과 |
|------|------|
| 닫기 무동작 root cause | TDS ErrorPage 좌·우 버튼 카피 하드코딩 매핑 오류 (Phase 3 이래 누적) |
| fix | NotFoundScreen `onBack`을 `onPressRightButton`에 정확 바인딩 |
| SSOT 정정 | 06 §6.5 NotFoundScreen 행 — 카피 매핑 + props 확장 + 진화 인계 |
| 백워드 호환 | `src/pages/recipe/[id].tsx:130` 그대로 — default 카피 유지 |
| typecheck PASS, lint 0 errors | PASS (Phase 3 누적 router.gen.ts warning 1건만) |

## 본 root cause 확정 (진단 로그 차수)

`pages/_404.tsx` `__DEV__` `navigation.getState` JSON 출력으로:
```
routes[0] = { name: "/_404", path: "-miniapp" }
```
→ 진입 deep link `intoss://airecipe-miniapp`에서 SDK가 `granite.config.ts` `appName: 'airecipe'` 기반 prefix `intoss://airecipe` strip → 잔여 `"-miniapp"` → 라우트 미매칭 → wildcard `*` → `/_404` 폴백 확정.

**원인 commit**: `87625a4 chore: 앱 이름 변경` (`airecipe-miniapp` → `airecipe`).

**fix**: `granite.config.ts` appName 원복.

## 사용자 검증 결과

> "정상동작 확인함."

- 진입 시 홈 화면 정상 표시.
- 모든 라우트 정상 동작.
- typecheck PASS, lint 0 errors(Phase 3 누적 router.gen.ts warning 1건만).

## 산출 파일 (최종)

| 파일 | 변경 |
|------|------|
| `granite.config.ts` | appName `airecipe` → `airecipe-miniapp` 원복 |
| `src/components/NotFoundScreen.tsx` | TDS 카피 매핑 정정 + props 확장 |
| `pages/_404.tsx` | 진입 폴백 카피 분리 + try-catch + `__DEV__` 진단 로그 |
| `pages/{index,my-recipes,recipe/generate,recipe/[id],recipe/recommend}.tsx` | shim 5종 상대 경로 정정 |
| `src/router.gen.ts` | Granite plugin-router 정규 순서 재생성 |
| `docs/appsintoss-port/06-UI-MAPPING.md` | §6.5 NotFoundScreen 행 정정 + 변경 이력 |
| `_workspace/01_architect_baseline.md` | 분석 baseline (7 가설 + 안전 fix 후보) |
| `_workspace/03_qa_report.md` | 4 root cause 확정 + 산출 파일 + 검수 정책 인계 |
| `_workspace/04_session_log.md` | 본 문서 |

## 후속 작업

- CS deeplink 연동(좌측 "고객센터 문의" `onContactSupport` 활성화) — 별 ADR.
- 별 ADR 추가: 콘솔 등록 정보 ↔ 미니앱 코드 동기 정책(appName / deep link prefix / displayName 등).
- 본 사이클 종료 — `_workspace_phase6/` 그대로 보존 + 본 `_workspace/`도 hotfix 사이클로 commit 시 그대로 (다음 사이클 시작 시 보존명으로 이동).
