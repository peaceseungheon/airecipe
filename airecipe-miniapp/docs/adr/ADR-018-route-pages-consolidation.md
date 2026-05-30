# 018. 라우트 구현을 라우팅 루트 `pages/`로 통합하고 `src/pages/` shim 계층 제거

- 상태: 채택됨
- 날짜: 2026-05-30
- 범위: 미니앱 클라이언트
- 영향 코드: `pages/{index,my-recipes}.tsx`, `pages/recipe/{generate,recommend,[id]}.tsx`(실구현으로 승격), `src/pages/**`(삭제), `pages/AGENTS.md`(신규)
- 변경 0(불변): `src/router.gen.ts`(자동 생성), `require.context.ts`, `src/_app.tsx`, api-client/hooks/components/zod/types

## 맥락

Granite 파일 기반 라우팅의 실제 라우팅 루트는 **미니앱 루트 `pages/`** 다. 근거:

- `require.context.ts`(루트)가 `require.context('./pages')` — 자기 위치 기준 루트 `pages/`를 스캔.
- 자동 생성 `src/router.gen.ts`가 `import { Route as _IndexRoute } from '../pages/'` 식으로 루트 `pages/`에서 Route를 import.
- `src/_app.tsx`가 `import { context } from '../require.context'`로 그 컨텍스트를 소비.

그럼에도 초기 스캐폴딩(ADR-010~012) 이래 **실구현은 `src/pages/`에 두고, 루트 `pages/`에는 재노출 shim**(`export { Route } from '../src/pages/...'`)만 두는 2계층 구조를 써 왔다. 즉 라우팅 루트와 구현 위치가 분리돼 있었다.

이 분리는 다음 문제를 만든다:

1. **이중 진실(2계층)** — 새 화면을 추가할 때 `src/pages/`(구현) + `pages/`(shim) 두 곳을 짝지어 관리해야 한다. 한쪽만 만들면 라우트가 깨지거나 dead 구현이 남는다.
2. **fragile 경로 결합** — 진입 폴백 hotfix(2026-05-29)에서 shim이 `from 'pages/index'`(tsc `baseUrl=src` 의존 절대 경로)였던 게 fragile로 드러나 `from '../src/pages/...'` 상대 경로로 정정한 전례가 있다. shim 자체가 결함 표면적이다.
3. **불필요한 간접화** — shim은 Route 1개를 그대로 재export할 뿐 아무 변환도 하지 않는다. 단일 사용처(`router.gen.ts`)만을 위한 추상화이고, 중복이 실제로 나타나 도입한 계층이 아니다.

한편 `pages/_404.tsx`는 처음부터 shim이 아니라 **루트 `pages/`에 직접 구현**(`import { NotFoundScreen } from '../src/components/NotFoundScreen'`)돼 있었다. 즉 "구현을 라우팅 루트에 직접 둔다"는 패턴은 이미 한 파일에서 검증돼 있었고, 나머지 5개 라우트만 예외적으로 shim을 거치고 있었다.

## 결정

`src/pages/`의 라우트 구현 5개를 라우팅 루트 `pages/`로 **끌어올려 실구현으로 승격**하고, shim 계층과 `src/pages/` 디렉터리를 **제거**한다. 이후 라우트 구현의 정본 위치는 **루트 `pages/`** 단일 계층이다.

- shim(`export { Route } from '../src/pages/...'`) 5개 파일을 각 `src/pages/` 원본의 실제 내용으로 교체한다.
- 화면 내부의 형제 디렉터리 import는 깊이를 한 단계 보정한다 — `src/pages/`(미니앱 루트 기준 depth 2~3)에서 `pages/`(depth 1~2)로 한 단계 얕아지므로 `src/` 형제 참조는 `../src/`/`../../src/` 형태가 된다. 이는 이미 `_404.tsx`가 쓰는 정답 패턴(`../src/components/...`)과 동일하다.
- `src/pages/` 디렉터리(`AGENTS.md` 포함)를 통째로 삭제한다. `src/pages/AGENTS.md`의 내용은 헤더·링크 깊이를 보정해 `pages/AGENTS.md`로 이관한다.
- `src/router.gen.ts`는 **손대지 않는다** — 이미 `../pages/`를 가리키므로 통합 후에도 유효하며, 자동 생성 파일이라 수동 수정 금지 규약(ADR-010 §6.4)을 유지한다.

이로써 ADR-010/011/012 등이 명시했던 "라우트 **구현 위치는 `src/pages/`**" 관례를 **대체**한다. 라우트 경로 = 파일 경로 규약(07 §7.4), `createRoute` export 패턴, TDS 의무, 식별자 가드 등 그 외 모든 라우팅 규약은 **변경 없이 유지**되며, 단지 파일이 사는 디렉터리만 `src/pages/` → `pages/`로 바뀐다.

## 근거

- **단일 진실 계층**: 라우팅 루트와 구현 위치를 일치시키면 화면 추가 시 한 곳(`pages/<path>.tsx`)만 만들면 된다. shim 짝맞춤 누락 클래스의 버그가 구조적으로 사라진다.
- **추상화는 중복이 실제로 나타날 때**: shim은 변환 없는 1:1 재export로, 단일 사용처만을 위한 간접화였다. 제거가 곧 단순화다(불필요한 계층 삭제).
- **기존 검증된 패턴 채택**: `_404.tsx`가 이미 루트 `pages/`에서 `../src/components/...`로 형제를 참조하며 정상 동작 중이다. 본 결정은 새 패턴을 만드는 게 아니라 이미 옳은 한 파일의 패턴으로 나머지를 정렬한다.
- **Granite 메커니즘상 안전**: `require.context('./pages')`와 `router.gen.ts`의 `from '../pages/'`는 본디 루트 `pages/`를 가리킨다. 구현을 루트로 올려도 라우트 등록 메커니즘은 그대로다. `router.gen.ts`는 재생성해도 동일 출력(라우트 경로 4개 불변)이라 회귀 위험이 없다.

## 대안

- **현행 유지(shim 2계층)**: 화면 추가마다 두 파일 짝맞춤 부담과 fragile 경로 결합을 계속 안는다. 간접화가 어떤 변환도 제공하지 않으므로 유지 명분이 없다. 기각.
- **반대 방향 — 구현을 `src/pages/`로 두고 라우팅 루트를 `src/pages/`로 바꾼다**: `require.context.ts`·`router.gen.ts`(자동 생성)·Granite 빌더 설정을 모두 바꿔야 하고, 자동 생성 파일을 거스르는 변경이라 회귀 위험이 크다. 라우팅 루트를 옮길 합리적 이득이 없다. 기각.
- **shim만 남기고 구현도 유지(no-op)**: 사용자 요구("`src/pages/` 파일들을 라우팅 루트 `pages/`에 통합")에 반한다. 기각.

## 결과

- **이득**: 라우트 구현 단일 계층. 화면 추가 절차 단순화(한 파일). fragile shim 경로 결합 제거. `_404.tsx`와 나머지 라우트의 패턴 일관성.
- **트레이드오프**: ADR-010/011/012/013/014/016/017 및 `06-UI-MAPPING`/`10-SPRINT-PLAN`의 본문이 `src/pages/...` 경로를 인용한다. 과거 결정 서술은 시점 기록으로 보존하되, 각 ADR 상단에 본 ADR로의 전방 참조 주석을 추가하고, **현재 상태를 서술하는 살아있는 문서**(루트/미니앱 `AGENTS.md`, `CLAUDE.md`, `06`/`10`/`11`)의 경로 표기를 `pages/`로 갱신한다.
- **회귀 기준**: `pnpm typecheck` 0 errors(누적 `router.gen.ts` lint warning 1건은 ADR-010 §6.4의 알려진 자동 생성 한계로 무관). 라우트 4개(`/`, `/recipe/generate`, `/my-recipes`, `/recipe/[id]`) 등록 불변. `recipe/recommend`는 `_app.tsx` context로 자동 등록(스택 화면).
- **영향 챕터**: 07-ROUTING(라우트=파일 경로 규약은 불변, 디렉터리만 `pages/`로 정합), 06-UI-MAPPING(코드 인용 경로), 10-SPRINT-PLAN(산출물 경로), 11-ADS(grep 가드 경로).
- **검수 영향 없음**: 라우트 경로·딥링크(`intoss://airecipe-miniapp/<path>`)·도메인 화이트리스트 불변. 콘솔 등록에 영향 없음.

## 참조

- [ADR-010](./ADR-010-miniapp-phase1-conventions.md) §6.4 — `router.gen.ts` 자동 생성·수동 수정 금지(본 통합 후에도 유지).
- [ADR-012](./ADR-012-miniapp-phase3-routing-cache-404.md) D14·D16 — Phase 3 라우트 파일 위치(`src/pages/`)를 본 ADR이 `pages/`로 대체.
- [ADR-017](./ADR-017-bottom-tab-navigation.md) — BottomTabBar 마운트 화면(`index`/`my-recipes`)의 디렉터리 이관 대상.
- [07-ROUTING.md](../appsintoss-port/07-ROUTING.md) §7.2~7.4 — 파일 기반 라우팅·라우트=파일 경로 매핑(규약 불변).
- [pages/AGENTS.md](../../pages/AGENTS.md) — 라우트 디렉터리 책임·규약(본 ADR로 `src/pages/AGENTS.md`에서 이관).
