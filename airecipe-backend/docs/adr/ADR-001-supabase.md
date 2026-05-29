# 0001. Supabase를 영속성·인증 백엔드로 채택하고 Repository 패턴으로 격리

- 상태: 채택됨
- 날짜: 2026-05-21

## 맥락

Sprint 1은 레시피 저장/조회/즐겨찾기와 이메일+패스워드 인증이 필요하다. 자체 백엔드 서버·DB·인증 시스템을 구축하기엔 스프린트 범위가 과하다. 또한 비기능 요구사항으로 Repository/Service 패턴과 SOLID(특히 DIP)를 강제한다. 데이터 접근 기술이 Service·도메인 로직에 누출되면 추후 교체·테스트가 어렵다.

## 결정

1. 영속성·인증 백엔드로 **Supabase**(PostgreSQL + Auth + RLS)를 채택한다.
2. 데이터 접근은 **Repository 패턴**으로 격리한다. Service는 `RecipeRepository` 인터페이스에만 의존하고, `SupabaseRecipeRepository`가 구체 구현이다.
3. DB row(snake_case) ↔ API DTO(camelCase) 변환은 **Mapper**(`src/mappers/recipe-mapper.ts`)에 단일 위치로 모은다. DB row를 API로 그대로 흘리지 않는다.
4. 소유자 격리는 Postgres **RLS 정책**(auth.uid() = user_id)으로 DB 레벨에서 강제하고, 애플리케이션 레벨에서도 user_id 스코프로 이중 방어한다.

### 컬럼 ↔ DTO 매핑 표 (확정)

최상위 컬럼만 변환 대상이다. jsonb 컬럼(`ingredients`/`steps`/`nutrition`)은 내부를 camelCase로 저장하여 매핑 부담을 없앤다.

| DB 컬럼 (snake_case) | DTO 필드 (camelCase) | 비고 |
|----------------------|----------------------|------|
| `id` | `id` | 동일 |
| `user_id` | (없음) | **DTO에 노출 금지** — 서버 내부 격리용 |
| `dish_name` | `dishName` | 변환 |
| `description` | `description` | 동일 |
| `servings` | `servings` | 동일 |
| `cook_time_minutes` | `cookTimeMinutes` | 변환 |
| `difficulty` | `difficulty` | 동일 |
| `ingredients` (jsonb) | `ingredients` | camelCase로 저장됨, 그대로 |
| `steps` (jsonb) | `steps` | camelCase로 저장됨, 그대로 |
| `tips` (jsonb) | `tips` | string[], 그대로 |
| `nutrition` (jsonb) | `nutrition` | camelCase로 저장됨, 그대로 |
| `is_favorite` | `isFavorite` | 변환 |
| `created_at` | `createdAt` | 변환 (ISO8601 문자열) |

> Mapper 함수 `rowToRecipe()`(`src/mappers/recipe-mapper.ts`)는 위 표를 정확히 따른다. 표에 없는 필드를 응답에 넣거나 `user_id`를 노출하면 계약 위반이다. QA는 응답에서 snake_case 키와 `userId` 키 부재를 검증한다.

## 근거

- **Repository (DIP/SRP)**: Service가 Supabase 클라이언트에 직접 결합하면 단위 테스트에서 실 DB가 필요하다. 인터페이스 뒤로 격리하면 `FakeRecipeRepository` 주입으로 결정적 테스트가 가능하고, 향후 영속성 교체 시 Service 무수정.
- **Mapper (경계면 버그 예방)**: DB는 snake_case 관례, API 계약은 camelCase. 변환이 여러 곳에 흩어지면 필드 누락/오타가 경계면 버그가 된다. 단일 Mapper가 이를 한 곳에 집중시켜 QA가 검증할 지점을 명확히 한다.
- **RLS**: 애플리케이션 버그로 user_id 필터를 빠뜨려도 DB가 타인 데이터 접근을 차단 → 심층 방어.

## 대안

- **자체 Express/Prisma 백엔드**: 인증·인프라 구축 비용 과다. Sprint 1 범위 초과. 기각.
- **Repository 없이 Service에서 Supabase 직접 호출**: 코드량은 줄지만 테스트 어려움·결합도 증가. 비기능 요구(Repository 패턴)와 충돌. 기각.
- **Mapper 없이 DB row 직접 반환**: snake_case가 API에 노출되어 계약 위반·프론트 타입 불일치. 기각.

## 결과

- 트레이드오프: Repository/Mapper 도입으로 보일러플레이트가 증가한다. 그러나 테스트 용이성·경계면 안전성이 비기능 요구를 충족한다.
- 후속: jsonb 임베드(ingredients/steps/nutrition)는 검색 요구가 없어 정규화하지 않는다. Sprint 2에서 재료 기반 검색 도입 시 정규화 여부를 재검토한다.
- 관련: 데이터 모델·매핑 규칙은 `_workspace/01_architect_architecture.md` 5절.

## 후속 ADR

- [ADR-009](ADR-009-appsintoss-port-architecture.md) — 앱인토스 미니앱 포팅 시 본 ADR의 `recipes.user_id`(uuid)·RLS·Mapper를 모두 보존한다(옵션 P). 미니앱 식별자는 `profiles` 매핑 테이블로 internal uuid에 연결.
- [ADR-010](ADR-010-option-p-toss-user-mapping.md) — 옵션 P 구현 ADR. 본 ADR의 RLS는 **쿠키 경로(웹앱)에서만** 보존되고, 미니앱 헤더 경로는 service-role + Repository `.eq('user_id', ...)` 단일 방어로 격리한다. `recipes.user_id`의 `auth.users(id)` FK는 제거(두 출처 uuid 공존 위함). Mapper·camelCase 매핑 표는 그대로 살아남는다.
