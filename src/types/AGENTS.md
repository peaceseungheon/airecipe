# src/types — 미니앱 공유 타입 SSOT

## 책임

백엔드 6 엔드포인트의 요청·응답·도메인 객체·Toss 식별자·환경변수 ambient 타입을 단일 정의로 보관한다. **본 디렉터리는 SSOT의 사본이며 자체 결정은 하지 않는다** — 응답 shape의 원천은 `docs/appsintoss-port/03-API-CONTRACT.md`와 별 저장소 `AIReceipe`의 백엔드 코드다.

## 파일

| 파일 | 역할 | SSOT |
|------|------|------|
| `recipe.ts` | `Difficulty`/`Ingredient`/`Step`/`Nutrition`/`GeneratedRecipe`/`Recipe` 도메인 타입. `GeneratedRecipe`(저장 전 — id 없음)와 `Recipe`(저장됨 — id·createdAt·isFavorite 포함)는 의도적으로 분리 | 03 §3.2.3, §3.3.3 |
| `api.ts` | `ApiResponse<T>`/`ApiListResponse<T>`/`ListMeta`/`ApiError`/`ApiErrorCode`(8종 enum) + 6 엔드포인트 요청·응답 타입 + `StreamChunk` discriminated union | 03 §3.1.1~3.1.2, §3.2~3.7 |
| `user.ts` | `TossUserId`(alias) + `TossUserIdentity` — 미니앱 한정 식별자 타입. 백엔드 웹의 `User { id, email }`은 들이지 않는다 | 05 §5.2.1, baseline §A.3 |
| `env.d.ts` | `ImportMetaEnv` ambient 타입 — `API_BASE_URL`/`APP_ENV`/`LOG_LEVEL` 3키만 선언 | 09 §9.1.1 |
| `index.ts` | barrel re-export | — |

## 규약

- **camelCase only** — snake_case 키를 응답·요청·도메인 타입에 절대 등장시키지 않는다 (03 §3.10 단언 #3).
- **`userId` 응답 키 금지** — 백엔드 응답에서 user_id는 격리용 내부 필드이며 미니앱 타입에 노출되면 ADR-001 Mapper 위반 (03 §3.10 단언 #4).
- **`GeneratedRecipe` ≠ `Recipe`** — 저장 전·후 객체를 같은 타입으로 합치지 않는다 (03 §3.10 단언 #5).
- **`FORBIDDEN`은 enum에만 보존** — Sprint 1에서는 발생하지 않으므로 미니앱 코드에 분기 작성 금지 (03 §3.10 단언 #7, ADR-005).
- **금지 환경변수 ambient 선언 금지** — `env.d.ts`에 `GEMINI_API_KEY`/`ANTHROPIC_API_KEY`/`SUPABASE_*`/AI Provider 키 어떤 것도 선언하면 키 침해 위험. 09 §9.1.1 표 3키만 유지.
- **백엔드 식별 내부 필드 등장 금지** — `profiles`/`internal_user_id`/service role 등은 미니앱이 알 필요 없는 백엔드 내부 사항 (05 §5.10, baseline §D).

## 진입점

- 다른 모듈은 barrel(`from '../types'`) 또는 개별 모듈(`from '../types/api'`)로 import한다.
- 새 타입 추가 시: 먼저 SSOT 챕터(03/05/09)에 정의가 있는지 확인 → 없으면 추측으로 추가하지 말고 architect에게 SendMessage하여 SSOT 갱신을 먼저 받는다.

## 변경 트리거

- 백엔드 03-API-CONTRACT 챕터 갱신 → 본 디렉터리 타입을 동기화.
- 응답 shape 위반 발견 시 → 본 타입을 변경하기 전에 baseline §G 트리거로 architect 통보. 미니앱 측 우회 변경 금지.

## 관련 ADR

- [ADR-001](../../docs/adr/ADR-001-supabase.md) — Mapper 표 (camelCase 단언의 근거).
- [ADR-005](../../docs/adr/ADR-005-ownership-violation-404.md) — `FORBIDDEN` 미발생 결정.
- [ADR-009](../../docs/adr/ADR-009-appsintoss-port-architecture.md) — `User` 타입 재정의 결정 (D2).
- [ADR-010](../../docs/adr/ADR-010-miniapp-phase1-conventions.md) — Phase 1 타입 동결 + `env.d.ts` ambient 선언.
