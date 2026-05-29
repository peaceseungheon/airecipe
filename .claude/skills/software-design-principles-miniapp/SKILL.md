---
name: software-design-principles-miniapp
description: "airecipe-miniapp(RN+Granite+TDS) 코드를 작성·리뷰할 때 SOLID 원칙과 디자인 패턴을 적용하는 가이드. 컴포넌트 분리, 의존성 역전(API 클라이언트·Toss SDK 어댑터), 단일 호출 경로(Wrapper), 전략(에러 매핑)·팩토리(zod 검증) 선택 기준을 제공한다. 새 모듈·훅·컴포넌트를 설계하거나, 아키텍처 결정을 내리거나, 코드 구조를 리뷰할 때 반드시 이 스킬을 사용할 것. 패턴 적용 여부를 판단할 때도 사용."
---

# 소프트웨어 설계 원칙 적용 가이드 (airecipe-miniapp)

이 스킬은 RN 미니앱 코드에 SOLID와 디자인 패턴을 **목적에 맞게** 적용하기 위한 판단 기준을 제공한다. 패턴을 위한 패턴은 부채다. 각 패턴은 해결하는 구체적 문제가 있을 때만 도입한다.

## 핵심 철학: 패턴은 문제에 대한 답이다

먼저 문제(변경의 축, 중복, 결합)를 식별하고, 그 문제를 해결하는 패턴을 선택한다. 패턴 도입 시 "왜"를 ADR로 남긴다 (`technical-documentation` 스킬).

오버엔지니어링 신호 — 다음이면 패턴을 빼라:
- 구현체가 하나뿐인 인터페이스 (미래의 가상 확장을 위한 것)
- 한 번만 호출되는 팩토리
- 분기가 2개뿐인데 전략 패턴으로 추상화

## SOLID — RN 미니앱 맥락

| 원칙 | 이 프로젝트에서의 적용 |
|------|----------------------|
| **SRP** | `src/services/api-client.ts`는 HTTP I/O만, 에러 매핑은 별 모듈, 화면은 표현 또는 컨테이너 중 하나만. 훅은 단일 책임. |
| **OCP** | 새 백엔드 엔드포인트 추가 시 api-client에 메서드만 추가. 화면·훅 구조에 영향 없음. |
| **LSP** | api-client의 모든 메서드는 동일한 에러 카테고리 계약(`AUTH_FAILED`/`NETWORK_ERROR`/`NOT_FOUND` 등)을 위반 없이 만족. |
| **ISP** | 거대 `ApiClient` 인터페이스보다 도메인별 분리 가능 (예: `RecipeApi`, `UserApi`). 단, 분리는 호출 패턴이 다를 때만. |
| **DIP** | 화면은 직접 `fetch()`가 아니라 api-client 메서드에 의존. Toss SDK도 `useTossUserId` 훅 뒤로 격리. |

## 레이어 아키텍처 (의존성 방향)

```
[pages (Granite)]
       │
       ▼
[src/components (TDS)] ◀─── [src/screens] (선택, 화면 단위 분리)
       │
       ▼
[src/hooks]          ── useTossUserId, useRecipeGenerate, useMyRecipes ...
       │
       ▼
[src/services/api-client]   ── 단일 HTTPS 호출 경로
       │
       ▼
   (외부)              ── 백엔드(별 저장소) HTTPS API + Toss SDK
```

규칙: 의존성은 항상 안쪽(도메인)을 향한다. 화면 컴포넌트가 직접 `@apps-in-toss/framework`·`fetch`·`zod`를 사용하지 않게 — api-client·훅을 통과한다.

## 패턴 선택 — 빠른 판단

이 미니앱에서 자주 쓰이는 패턴과 트리거.

| 패턴 | 언제 도입하는가 | 이 앱의 예시 |
|------|---------------|------------|
| **Wrapper (Facade)** | 외부 호출에 일관된 진입점 | `api-client.ts`가 모든 백엔드 호출의 단일 wrapper. URL·헤더·에러 매핑·재시도를 한 곳에. |
| **Adapter** | 외부 SDK를 도메인 타입으로 감쌈 | Toss `getAnonymousKey()`를 `useTossUserId` 훅으로 추상화. RN SSE 어댑터(fetch ReadableStream → 청크 타입 분기). |
| **Strategy** | 런타임에 교체 가능한 알고리즘이 2개 이상 | 에러 카테고리별 한국어 메시지 매핑(다국어 도입 시 strategy로). |
| **Factory** | 생성 로직이 복잡하거나 조건부 | zod 스키마 빌더 (응답 종류별). 청크 파서 (`meta`/`text`/`recipe`/`error`/`done`). |
| **DTO / Mapper** | 외부 데이터를 도메인 타입으로 정규화 | snake_case 응답 → camelCase 도메인 (백엔드가 camelCase로 통일했다면 mapper 생략 가능, 03-API-CONTRACT 확인). |
| **Observer / Reducer** | 비동기 스트림 누적 상태 | SSE `text` 청크 누적 + `recipe` 최종 전환. useReducer 권장. |

## 적용 절차

1. 변경의 축을 식별 — 무엇이 자주 바뀌는가? (백엔드 응답? 에러 매핑? Toss SDK 버전?)
2. 그 축을 추상 뒤로 격리 — 인터페이스 + 구현체.
3. 구현체가 현재 하나뿐이면 추상화를 보류하고 주석으로 확장 지점만 표시. 두 번째 구현체가 생길 때 추상화.
4. 패턴 도입을 ADR로 기록.

## RN 컴포넌트 특유 고려

- **TDS 우선**: 커스텀 컴포넌트는 TDS 위에 컴포지션으로. 직접 `View/Text` 스타일링은 TDS 미커버 영역만.
- **단일 책임**: 거대 화면 컴포넌트(>200줄)는 분리 — Container(상태/데이터)와 Presentational(props만 받는 표현)로.
- **메모이제이션**: 큰 리스트(`RecipeCard` 목록)는 `React.memo`·`FlatList` keyExtractor 적용. 그러나 미세 최적화는 측정 후에만.
- **에러 경계**: 화면 단위로 ErrorBoundary 부착. api-client 에러 카테고리를 한국어 UI로.

## 코드 리뷰 시 점검

- 화면 컴포넌트가 직접 `fetch`/`@apps-in-toss/framework`를 호출하고 있지 않은가 (DIP 위반).
- api-client 응답을 화면이 임의로 unwrap·rename하고 있지 않은가 (SSOT 위반).
- 구현체 하나짜리 불필요한 추상화가 없는가 (오버엔지니어링).
- TDS로 표현 가능한 부분을 커스텀 View/Text로 만들고 있지 않은가 (검수 위험).
- 에러 카테고리가 한 곳(api-client)에서만 정의되는가, 화면마다 다르게 처리하고 있지 않은가.
