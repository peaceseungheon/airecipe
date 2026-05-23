# src/hooks — React 훅 (Toss SDK 격리 진입점)

## 책임

`@apps-in-toss/web-framework` SDK 의존을 미니앱 전체에서 **단 한 곳**에 격리한다. 화면·services·다른 훅 어디서도 SDK를 직접 import하지 않고, 본 디렉터리의 훅이 노출한 도메인 인터페이스(`{ tossUserId, refresh }`)에만 의존한다 (DIP).

## 파일

| 파일 | 역할 | SSOT |
|------|------|------|
| `useTossUserId.tsx` | `getAnonymousKey()` 단일 격리 + 메모리 캐싱 + hash zod 검증 + Context Provider + 마스킹 헬퍼 | 05 §5.2.1, §5.2.3, §5.4, §5.10, 09 §9.5, baseline §A.7 |

## 노출 인터페이스

```ts
export interface TossUserIdContextValue {
  tossUserId: TossUserId | undefined;        // 발급 전엔 undefined
  refresh: () => Promise<TossUserId>;        // 401 시 SDK 재호출 → 새 hash 반환
}

export function TossUserIdProvider({ children }: PropsWithChildren): JSX.Element;
export function useTossUserId(): TossUserIdContextValue;     // Provider 누락 시 throw
export function formatTossUserIdMask(hash: TossUserId | undefined): string;  // 평문 노출 금지용 마스킹
```

## 규약 (강제)

- **SDK import는 파일 최상단 단일 줄** — `import { getAnonymousKey } from '@apps-in-toss/web-framework';`만 존재. 다른 어떤 모듈도 SDK를 import하지 않는다 (ADR-010 D4).
- **SDK 패키지 경로 미해결은 `@ts-expect-error` 1줄로 한시 통과** — 첫 `granite dev` 실행 시 모듈 미해결이면 즉시 architect에게 SendMessage → baseline §B.2 + ADR-010 D7 갱신 (ADR-010 §롤백 R1). 추측으로 다른 패키지(`@apps-in-toss/framework` 등)로 변경 금지.
- **hash zod 검증 의무** — `z.string().min(8).max(256)` (05 §5.2.3 라인 118, 백엔드 미들웨어와 동일). 부적합 hash는 캐시에 두지 않고 throw.
- **메모리 캐싱 (모듈 스코프)** — `let cachedTossUserId`. SecureStore 미도입 (ADR-010 D2). 콜드 스타트 시 동일 hash 가정.
- **`refresh()`는 새 hash를 직접 반환** — React Context state 비동기 갱신이 stale이라 api-client의 401 재시도(`refreshTossUserId: () => Promise<string>`)와 정합하려면 직접 반환 필요.
- **hash 평문 노출 금지** — UI/console.log에 hash를 직접 표시하지 않는다. `formatTossUserIdMask`만 사용 (09 §9.5 라인 221, 05 §5.10 라인 520).
- **마운트 시 캐시 우선** — `useEffect`에서 캐시 비어 있을 때만 SDK 호출 1회.

## 진입점

- `src/_app.tsx`에 `<TossUserIdProvider>`가 `AppContainer` 자식으로 마운트되어 있다.
- 화면·기타 훅은 `const { tossUserId, refresh } = useTossUserId();`로 사용.
- api-client 호출 시 `auth = { tossUserId, refreshTossUserId: refresh }`로 services에 주입.

## 변경 트리거

- SDK 패키지 경로 사양 변경 → 본 디렉터리의 import 1줄만 수정 (ADR-010 §롤백 R1).
- SecureStore 도입 결정 → 별 ADR로 ADR-010 D2 superseded. 캐시 구현부만 교체, 인터페이스(`{ tossUserId, refresh }`) 유지.
- `getAnonymousKey()` 가 콜드 스타트마다 다른 hash 반환 → ADR-010 §롤백 R2 발동. 백엔드 측 식별자 갱신 정책 재검토 (별 저장소 ADR).

## 비범위 (Phase 2 이후)

- 화면별 사용자 흐름 훅 (`useRecipeGenerate`/`useMyRecipes` 등) — Phase 2~4에서 추가. 각각 단일 책임, 본 디렉터리에 위치.

## 관련 ADR

- [ADR-009](../../docs/adr/ADR-009-appsintoss-port-architecture.md) — D2 Toss 식별자 전환.
- [ADR-010](../../docs/adr/ADR-010-miniapp-phase1-conventions.md) — D2 메모리 캐싱·D4 SDK 단일 격리·D7 패키지 경로 한시 통과.
