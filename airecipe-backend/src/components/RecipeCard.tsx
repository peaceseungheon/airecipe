/**
 * RecipeCard — 저장된 레시피 목록 카드 (presentational).
 *
 * 입력은 Recipe(저장됨, id 포함) — 목록/마이레시피에서 사용. 카드 클릭 시 /recipe/[id]로 이동.
 * 즐겨찾기/삭제 액션은 콜백으로 상위(useMyRecipes)에 위임.
 */
"use client";

import Link from "next/link";
import type { Recipe } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FavoriteButton } from "@/components/FavoriteButton";
import { difficultyLabel, formatCookTime } from "@/components/recipe-format";

interface RecipeCardProps {
  recipe: Recipe;
  /** 즐겨찾기 목표값 설정(멱등). 미지정 시 버튼 숨김. */
  onToggleFavorite?: (id: string, target: boolean) => Promise<void> | void;
  /** 삭제. 미지정 시 버튼 숨김. */
  onDelete?: (id: string) => Promise<void> | void;
}

export function RecipeCard({
  recipe,
  onToggleFavorite,
  onDelete,
}: RecipeCardProps) {
  return (
    <Card className="flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/recipe/${recipe.id}`}
            className="line-clamp-1 text-base font-semibold text-zinc-900 hover:text-orange-600 dark:text-zinc-50"
          >
            {recipe.dishName}
          </Link>
          {onToggleFavorite && (
            <FavoriteButton
              isFavorite={recipe.isFavorite}
              onToggle={(target) => onToggleFavorite(recipe.id, target)}
            />
          )}
        </div>

        {recipe.description && (
          <p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
            {recipe.description}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-1.5">
          <Badge variant={recipe.difficulty}>
            {difficultyLabel[recipe.difficulty]}
          </Badge>
          <Badge variant="muted">{recipe.servings}인분</Badge>
          <Badge variant="muted">
            {formatCookTime(recipe.cookTimeMinutes)}
          </Badge>
          <Badge variant="muted">{recipe.nutrition.calories}kcal</Badge>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Link
            href={`/recipe/${recipe.id}`}
            className="inline-flex h-8 flex-1 items-center justify-center rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            자세히 보기
          </Link>
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(recipe.id)}
              aria-label="레시피 삭제"
            >
              삭제
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
