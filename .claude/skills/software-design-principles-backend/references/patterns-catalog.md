# 디자인 패턴 카탈로그 — 레시피 앱 구현 예시

SKILL.md의 패턴 표에서 구체적 구현이 필요할 때 로드한다. TypeScript/Next.js 맥락의 최소 예시.

## 목차
1. Repository
2. Adapter (AI Provider)
3. Strategy (추천 알고리즘)
4. Factory (프롬프트 빌더)
5. Facade (레시피 생성 유스케이스)
6. DTO / Mapper (경계면 변환)

---

## 1. Repository

데이터 접근을 도메인에서 분리. 영속성 구현(메모리/DB)을 교체 가능하게.

```ts
// src/repositories/recipe-repository.ts
export interface RecipeRepository {
  findById(id: string): Promise<Recipe | null>;
  search(query: RecipeQuery): Promise<Recipe[]>;
  save(recipe: Recipe): Promise<void>;
}
```

Service는 이 인터페이스에만 의존한다. 구체 구현(`PrismaRecipeRepository` 등)은 주입한다.

---

## 2. Adapter (AI Provider)

외부 SDK를 도메인 인터페이스로 감싼다. DIP의 핵심.

```ts
// src/lib/ai/ai-recipe-provider.ts
export interface AIRecipeProvider {
  generateRecipe(input: RecipeGenInput): Promise<GeneratedRecipe>;
  analyzeNutrition(recipe: Recipe): Promise<NutritionFacts>;
}

// src/lib/ai/claude-recipe-provider.ts
export class ClaudeRecipeProvider implements AIRecipeProvider {
  // Anthropic SDK 호출을 이 안에 격리. Service는 SDK를 모른다.
}
```

테스트에서는 `FakeAIRecipeProvider`를 주입해 결정적으로 검증한다.

---

## 3. Strategy (추천 알고리즘)

런타임에 교체 가능한 추천 방식. 분기가 2개 이상일 때만 도입.

```ts
export interface RecommendationStrategy {
  recommend(ctx: RecommendContext): Promise<Recipe[]>;
}
// IngredientBasedStrategy, NutritionBasedStrategy, PreferenceBasedStrategy
```

라우터/서비스가 사용자 의도에 따라 전략을 선택한다.

---

## 4. Factory (프롬프트 빌더)

조건에 따라 다른 Claude 프롬프트를 생성. 생성 로직이 복잡할 때.

```ts
// src/lib/ai/prompt-factory.ts
export function buildRecipePrompt(input: RecipeGenInput): PromptParts {
  // 시스템 프롬프트(캐싱 대상) + 사용자 변수부 분리해 반환
}
```

프롬프트 캐싱 적용 방식은 `ai-recipe-integration` 스킬 참조.

---

## 5. Facade (레시피 생성 유스케이스)

여러 하위 시스템을 묶는 단순 진입점. "레시피 생성" = AI 생성 + 영양 분석 + 저장.

```ts
// src/services/recipe-generation-service.ts
export class RecipeGenerationService {
  constructor(
    private ai: AIRecipeProvider,
    private repo: RecipeRepository,
  ) {}
  async generate(input: RecipeGenInput): Promise<Recipe> {
    const draft = await this.ai.generateRecipe(input);
    const nutrition = await this.ai.analyzeNutrition(draft);
    const recipe = { ...draft, nutrition };
    await this.repo.save(recipe);
    return recipe;
  }
}
```

Route Handler는 이 Facade만 호출한다 — 조합 로직이 Route에 새지 않는다.

---

## 6. DTO / Mapper (경계면 변환)

DB row(snake_case) ↔ API 응답(camelCase) ↔ UI 타입의 변환을 단일 위치에 모은다. 경계면 버그 예방의 핵심.

```ts
// src/mappers/recipe-mapper.ts
export function toRecipeDTO(row: RecipeRow): RecipeDTO {
  return {
    id: row.id,
    title: row.title,
    thumbnailUrl: row.thumbnail_url, // snake → camel 명시적 변환
    createdAt: row.created_at,
  };
}
```

규칙: API 응답은 항상 DTO를 반환한다. DB row를 그대로 흘리지 않는다. 프론트 타입 = DTO 타입(공유 `src/types/`).
