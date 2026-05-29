# 0006. pageSize 상한 초과를 거부(400) 대신 50으로 clamp

- 상태: 채택됨
- 날짜: 2026-05-21

## 맥락

`GET /api/recipes`의 `pageSize`는 계약 2.1에서 "기본 20, 최대 50"으로 정의되었다. backend는 이를 zod `.max(50)`으로 구현하여 `pageSize > 50`이면 `400 VALIDATION_ERROR`를 반환한다. QA가 "최대 50"의 의도가 거부(400)인지 clamp(50으로 잘라 200 반환)인지 명확화를 요청했다. 둘 다 계약 2.3(잘못된 쿼리 400) 범위라 위반은 아니나, 해석이 갈려 SSOT 확정이 필요하다.

## 결정

`pageSize > 50`은 거부하지 않고 **50으로 clamp**하여 `200 OK`로 응답한다.
- 응답 `meta.pageSize`에 실제 적용된 값(<=50)을 반환한다.
- 단, `page`/`pageSize`가 **숫자가 아니거나 < 1**이면 `400 VALIDATION_ERROR`. clamp는 상한 초과에만 적용한다.

## 근거

- **목록 API 관용**: `pageSize`는 사용자 자유 입력이 아니라 클라이언트가 구성하는 페이징 파라미터다. "상한까지 제공"이 일반적 관용이며, 상한 초과를 깨짐 없이 흡수한다.
- **결합 감소**: 400으로 거부하면 프론트가 서버 상한값을 미리 알고 맞춰야 하는 결합이 생긴다. clamp는 프론트가 상한을 몰라도 안전하게 동작하고, `meta.pageSize`로 적용값을 회신한다.
- **상한 변경 안전성**: 향후 상한을 50→100으로 올려도 기존 프론트가 깨지지 않는다.
- **잘못된 입력은 여전히 400**: 음수/0/비숫자는 의미상 오류이므로 clamp 대상이 아니라 검증 실패다. clamp의 적용 범위를 "상한 초과"로 한정해 모호성을 제거한다.

## 대안

- **현행 `.max(50)` → 400 거부**: 단순하나 프론트-서버 상한 결합 + 상한 변경 시 프론트 깨짐 리스크. 기각.
- **상한 없이 무제한 허용**: 대량 조회로 DB/응답 부하. 기각.

## 결과

- 계약 정정: 2.1(clamp 정책 명시), 2.3(상한 초과는 400 아닌 clamp; 비숫자/음수/0만 400).
- backend: `recipeQuerySchema`의 `pageSize`를 `.max(50)`(거부)에서 `Math.min(n, 50)` clamp로 변경. 음수/0/비숫자 검증(`.int().min(1)` 등)은 유지하여 400.
- 응답 `meta.pageSize`는 항상 실제 적용값(<=50)을 반영(이미 계약 2.2 meta에 포함).
- QA: pageSize=100 요청 시 200 + meta.pageSize=50 검증. pageSize=0/-1/abc는 400 검증.
- 관련: 계약 2.1/2.3, ListRecipesQuery(src/types/api.ts) — coercion 책임은 GET route(기존 주석).
- 부가 확정(같은 schema): `favorite`는 `z.enum(["true","false"]).transform(v => v === "true")`로 검증한다. `z.coerce.boolean()`은 `?favorite=false`를 true로 오인하므로 금지. 잘못된 값은 400. 계약 2.1에 반영.
