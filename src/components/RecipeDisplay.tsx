/**
 * RecipeDisplay — 레시피 전체 표시 (재료/단계/팁/영양) (presentational).
 *
 * 입력은 GeneratedRecipe(미저장) 또는 Recipe(저장됨) 모두 허용 — 공통 필드만 사용한다.
 * 저장 여부에 따른 액션(저장 버튼/즐겨찾기)은 actions 슬롯으로 상위가 주입한다.
 * 이 컴포넌트는 id를 읽지 않는다(미저장/저장 혼용 안전 — 계약 불변식 2).
 */
import type { GeneratedRecipe, Recipe } from "@/types";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NutritionPanel } from "@/components/NutritionPanel";
import { difficultyLabel, formatCookTime } from "@/components/recipe-format";

interface RecipeDisplayProps {
  recipe: GeneratedRecipe | Recipe;
  /** 저장/즐겨찾기 등 액션 영역(헤더 우측). */
  actions?: React.ReactNode;
}

export function RecipeDisplay({ recipe, actions }: RecipeDisplayProps) {
  return (
    <article className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {recipe.dishName}
            </h1>
            {recipe.description && (
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                {recipe.description}
              </p>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={recipe.difficulty}>
            {difficultyLabel[recipe.difficulty]}
          </Badge>
          <Badge variant="muted">{recipe.servings}인분</Badge>
          <Badge variant="muted">
            조리 {formatCookTime(recipe.cookTimeMinutes)}
          </Badge>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>재료</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {recipe.ingredients.map((ing, i) => (
                  <li
                    key={`${ing.name}-${i}`}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <span className="text-zinc-800 dark:text-zinc-200">
                      {ing.name}
                    </span>
                    <span className="text-zinc-500">
                      {ing.quantity}
                      {ing.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>조리 순서</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                {[...recipe.steps]
                  .sort((a, b) => a.order - b.order)
                  .map((step) => (
                    <li key={step.order} className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-semibold text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                        {step.order}
                      </span>
                      <p className="pt-0.5 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
                        {step.instruction}
                      </p>
                    </li>
                  ))}
              </ol>
            </CardContent>
          </Card>

          {recipe.tips.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>요리 팁</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                  {recipe.tips.map((tip, i) => (
                    <li key={i}>{tip}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-1">
          <NutritionPanel nutrition={recipe.nutrition} />
        </div>
      </div>
    </article>
  );
}
