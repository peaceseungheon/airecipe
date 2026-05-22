# src/hooks/ — 데이터 페칭/상태 훅

페이지·컴포넌트가 소비하는 데이터/상태 훅을 둔다. 모든 훅은 `@/types`의 **공유 타입**을 import하고, 래핑된 응답(`{ data, meta? }`)을 unwrap하여 컴포넌트엔 깔끔한 형태로 전달한다(ADR-003, nextjs-fullstack 스킬).

## 핵심 규약
- **임의 제네릭 캐스팅 금지.** 응답 shape은 계약(`_workspace/01_architect_api_contract.md`)의 실제 타입(`ApiResponse<T>`/`ApiListResponse<T>`)을 사용한다. unwrap·에러 정규화는 `api-client.ts` 한 곳에서.
- **에러는 코드로 분기.** `ApiClientError.code`(계약 0.2의 `ApiErrorCode` + `NETWORK_ERROR`)로 분기 가능. 컴포넌트는 `toErrorMessage()`로 표시 메시지를 얻는다.
- **서버 상태는 SWR, 클라이언트 상태는 React(ADR-003).** 목록/저장/즐겨찾기/삭제는 SWR. 생성 폼·스트리밍 진행은 로컬 `useState`.
- **즐겨찾기는 멱등 목표값(계약 4)** → SWR 낙관적 업데이트(`optimisticData` + `rollbackOnError`)와 일치.

## 파일
| 파일 | 책임 | 소비 API |
|------|------|---------|
| `api-client.ts` | fetch 래퍼 — `{data}`/`{data,meta}` unwrap, `ApiClientError` 정규화, SWR fetcher | (공통) |
| `useRecipeGenerate.ts` | 생성 호출 + **SSE 스트리밍**(StreamChunk) 소비. 스트리밍/비스트리밍 모두 지원 | POST /api/recipes/generate |
| `useMyRecipes.ts` | 목록(SWR)·저장·즐겨찾기(멱등)·삭제. 저장/변경 후 캐시 mutate | GET·POST /api/recipes, PATCH /[id]/favorite, DELETE /[id] |
| `useRecipe.ts` | 단건 조회(SWR, 딥링크 지원) + 즐겨찾기/삭제(목록 캐시 무효화) | GET·DELETE /api/recipes/[id], PATCH /[id]/favorite |
| `useAuth.ts` | Supabase Auth(email+password) 상태·로그인/회원가입/로그아웃 | Supabase Auth (`@/lib/supabase/client`) |

## 스트리밍 처리 (useRecipeGenerate)
- `stream:true`면 `fetch` + `ReadableStream`으로 SSE를 소비(SWR 아님 — 1회 요청/응답 모델 부적합).
- 백엔드 wire 형식: `event: <type>\ndata: <json>\n\n` (`src/lib/sse.ts`). 파서는 `\n\n`으로 이벤트를 분리하고 `data:` 라인의 JSON을 `StreamChunk`로 해석.
- 청크 분기: `meta`(시작) → `text`(점진 누적, 선택 UI) → `recipe`(**최종 GeneratedRecipe**) → `done`. **에러는 HTTP 200 + `error` 청크**(계약 1.3)이므로 청크 타입으로 분기한다.
- 결과는 `GeneratedRecipe`(미저장, id 없음). 저장은 `useMyRecipes.save`로 별도.

## 주의사항
- 모든 훅은 클라이언트 전용(`"use client"`). 보호 페이지의 1차 가드는 `proxy.ts`(구 middleware 컨벤션, ADR-007)가, 데이터 접근의 진실 원천은 서버(RLS)가 담당.
- **`useRecipe`는 단건 `GET /api/recipes/[id]`(계약 2.5/ADR-004)를 직접 호출**한다(목록 캐시 의존 제거 — 딥링크/새로고침 지원). 소유권 정책(ADR-005): 없음/타인 소유/잘못된 id는 모두 404로 수렴 → `notFound`로 분리 노출(403 없음). favorite/delete 성공 시 목록 캐시(`/api/recipes*`)를 무효화해 정합 유지.
