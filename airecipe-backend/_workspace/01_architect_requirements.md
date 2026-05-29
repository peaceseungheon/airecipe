# 01. 기능 명세 + 도메인 모델 (Sprint 1)

> 단일 진실 공급원(SSOT)의 요구사항 측면. 코드 타입은 `src/types/`, API 계약은 `01_architect_api_contract.md` 참조.

## 1. 기능 명세

### F1. 레시피 상세 생성
- 입력: 요리 이름(`dishName`, 필수), 선택적 옵션(인분 `servings`, 난이도 선호 등 Sprint 1에서는 `dishName`만 필수)
- 처리: Claude AI가 재료/조리순서/팁/조리시간/난이도/인분을 생성
- 동시에 F2(영양 분석)를 함께 수행하여 단일 응답으로 반환
- 비로그인 사용자도 생성은 가능. 저장(F3)만 로그인 필요.

### F2. 영양 정보 분석
- 레시피 생성과 함께 자동 수행 (별도 호출 아님 — Facade로 묶음)
- 1인분 기준 칼로리, 주요 영양소(탄수화물/단백질/지방/식이섬유), 건강 포인트

### F3. 레시피 저장·즐겨찾기
- Supabase Auth(email+password)로 인증
- 생성된 레시피를 저장(POST), 내 레시피 목록 조회(GET)
- 즐겨찾기 토글(PATCH), 삭제(DELETE)
- 모든 저장/조회는 인증 필수 + 소유자(owner) 격리

## 2. 도메인 모델

### 핵심 엔티티

| 엔티티 | 설명 | 영속성 |
|--------|------|--------|
| `Recipe` | 레시피 집합체(루트). 재료/단계/영양/메타 포함 | 저장 시 `recipes` 테이블 |
| `Ingredient` | 재료 1건 (이름, 양, 단위) | `recipes.ingredients` (jsonb) |
| `RecipeStep` | 조리 단계 1건 (순서, 설명) | `recipes.steps` (jsonb) |
| `NutritionInfo` | 1인분 기준 영양 정보 | `recipes.nutrition` (jsonb) |
| `User` | Supabase Auth 사용자 | `auth.users` (Supabase 관리) |
| `SavedRecipe` | 사용자가 저장한 레시피 인스턴스 | `recipes` row (user_id FK) |

> 설계 결정: Sprint 1에서 `Recipe`는 집합체 루트로 다루며 `Ingredient`/`RecipeStep`/`NutritionInfo`는 값 객체로 jsonb 컬럼에 임베드한다. 정규화(별도 테이블)는 검색/필터가 도입되는 Sprint 2에서 재검토. 근거: 현재 요구사항에 재료 단위 검색이 없어 정규화는 YAGNI.

### 엔티티 관계
```
User (1) ──< (N) SavedRecipe(= Recipe row)
Recipe (1) ──── (1) NutritionInfo   [임베드]
Recipe (1) ──< (N) Ingredient        [임베드]
Recipe (1) ──< (N) RecipeStep        [임베드]
```

### 필드 정의 (도메인 → 코드 타입은 src/types/recipe.ts)

**Recipe**
- `id: string` (uuid, 저장 전에는 미존재 → 생성 응답엔 없음)
- `dishName: string` — 요리 이름
- `description: string` — 한 줄 요리 소개
- `servings: number` — 몇 인분
- `cookTimeMinutes: number` — 예상 조리 시간(분)
- `difficulty: 'easy' | 'medium' | 'hard'`
- `ingredients: Ingredient[]`
- `steps: RecipeStep[]`
- `tips: string[]` — 요리 팁(선택, 빈 배열 가능)
- `nutrition: NutritionInfo`
- `isFavorite: boolean` — 저장된 레시피만 의미 있음(생성 결과엔 false 기본)
- `createdAt: string` (ISO8601, 저장 후 부여)
- `userId: string` (저장 후 부여, 응답에서는 노출 안 함)

**Ingredient**
- `name: string`
- `quantity: number`
- `unit: string` — 'g', 'ml', '개', '큰술' 등 자유 문자열

**RecipeStep**
- `order: number` — 1부터 시작
- `instruction: string`

**NutritionInfo** (1인분 기준)
- `calories: number` (kcal)
- `carbohydrates: number` (g)
- `protein: number` (g)
- `fat: number` (g)
- `fiber: number` (g)
- `healthNote: string` — 건강 포인트 설명

**User** (Supabase Auth, 코드 타입은 src/types/user.ts)
- `id: string`
- `email: string`

## 3. 상태 전이

### 레시피 생애주기
```
[입력 dishName]
   → POST /api/recipes/generate
   → (스트리밍/JSON) GeneratedRecipe (id 없음, 미저장 상태)
   → 사용자가 "저장" 클릭 (로그인 필요)
   → POST /api/recipes  (저장 → id, createdAt 부여, isFavorite=false)
   → 저장됨(Saved)
        ├─ PATCH /favorite → isFavorite 토글
        └─ DELETE → 삭제됨(소멸)
```

핵심 구분: **생성된 레시피(GeneratedRecipe, id 없음)** vs **저장된 레시피(Recipe, id 있음)**. 이 둘은 타입으로 구분되어야 프론트가 "저장 전/후"를 혼동하지 않는다.

## 4. 비기능 요구사항 반영
- SOLID + Repository/Service/Adapter/Facade/Strategy/Mapper 패턴 (ADR로 근거 기록)
- TypeScript strict
- AI 호출 실패/타임아웃, Supabase 오류 graceful handling (통일된 ApiError 형식)
- 스트리밍: 레시피 생성에 SSE 스트리밍 적용 (계약서에 청크 형식 명시)
