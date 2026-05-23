# src/lib/zod — 응답 런타임 검증 스키마

## 책임

백엔드 응답을 화면에 도달하기 전 **런타임으로 검증**하여 SSOT 위반(snake_case 누출·필드 누락·키 변경)을 즉시 차단한다. zod 스키마는 `src/types`의 정적 타입과 1:1 대응하며, factory 패턴으로 래핑·목록 응답을 합성한다.

## 파일

| 파일 | 스키마 | SSOT |
|------|--------|------|
| `api.ts` | `apiErrorCodeSchema`(8종 enum) / `apiErrorSchema` / `listMetaSchema` / `apiResponseSchema<T>(inner)` / `apiListResponseSchema<T>(inner)` (factory) | 03 §3.1.1~3.1.2 |
| `recipe.ts` | `difficultySchema` / `ingredientSchema` / `stepSchema` / `nutritionSchema` / `generatedRecipeSchema`(`ingredients` min 1, `steps` min 1) / `recipeSchema = generatedRecipeSchema.extend({ id, isFavorite, createdAt })` | 03 §3.2.3, §3.3.3 + 03 §3.5.2 zod 인용 |
| `index.ts` | barrel re-export | — |

## 규약

- **raw 응답에 적용한다** — `apiFetch`는 `apiResponseSchema(...)` 또는 `apiListResponseSchema(...)`로 `{ data, meta? }` 자체를 검증한다. unwrap된 도메인 객체에 적용하면 래핑 자체 위반(03 §3.10 단언 #1)을 잡지 못한다 (ADR-010 D5).
- **SSOT 그대로 옮긴다** — 응답 측 zod에 03 SSOT 외 추가 제약(예: `servings` 양수)을 부과하지 않는다. 백엔드 응답에 미니앱이 임의 제약을 거는 것은 부적절. qa report §9.1 정합.
- **factory는 `<T extends z.ZodType>` 제네릭** — 도메인 스키마를 inject 받아 합성. 인스턴스 1회 캐싱이 필요하면 호출 측에서 처리.
- **검증 실패는 `INTERNAL_ERROR`로 throw** — `api-client`가 `safeParse` 후 실패 시 `ApiClientError('INTERNAL_ERROR', '서버 응답 형식이 올바르지 않아요.')`를 throw한다. 백엔드 회귀를 사용자에게 노출하지 않는다.

## 진입점

- 사용 위치는 `src/services/recipes.ts`의 6 함수만. 화면·훅이 zod를 직접 import하지 않는다 (SRP).
- 새 스키마 추가 시 03 챕터에 응답 정의가 있는지 먼저 확인.

## 변경 트리거

- 백엔드 응답에 새 필드 추가 → 03 챕터 갱신 후 본 디렉터리 스키마 갱신.
- zod 메이저 버전 업데이트 → ADR-010 D1·롤백 R3 트리거. `package.json` 재검토.

## 비범위 (Phase 2 이후)

- `StreamChunk` zod 스키마 — Phase 2 (08-STREAMING) `src/lib/zod/stream.ts`(가칭)로 별도 추가. Phase 1은 타입 선언만 (`src/types/api.ts`의 discriminated union).

## 관련 ADR

- [ADR-010](../../../docs/adr/ADR-010-miniapp-phase1-conventions.md) — D1 zod=dependencies + 모든 응답 검증.
