/**
 * /my-recipes — 마이 레시피 목록 (보호 페이지, 로그인 필요 — 계약 0.3).
 * 즐겨찾기 필터 토글. middleware가 미인증 접근을 /auth/login으로 가드한다.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { RecipeCard } from "@/components/RecipeCard";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useMyRecipes } from "@/hooks/useMyRecipes";
import { toErrorMessage } from "@/hooks/api-client";

export default function MyRecipesPage() {
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const { recipes, isLoading, error, setFavorite, remove } = useMyRecipes({
    favorite: favoriteOnly,
    pageSize: 50,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">마이 레시피</h1>
        <div className="inline-flex rounded-lg border border-zinc-300 p-0.5 dark:border-zinc-700">
          <FilterTab
            active={!favoriteOnly}
            onClick={() => setFavoriteOnly(false)}
          >
            전체
          </FilterTab>
          <FilterTab
            active={favoriteOnly}
            onClick={() => setFavoriteOnly(true)}
          >
            즐겨찾기
          </FilterTab>
        </div>
      </div>

      {error ? <Alert variant="error">{toErrorMessage(error)}</Alert> : null}

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner className="text-orange-500" />
        </div>
      )}

      {!isLoading && !error && recipes.length === 0 && (
        <div className="space-y-4 rounded-xl border border-dashed border-zinc-300 py-12 text-center dark:border-zinc-700">
          <p className="text-zinc-500">
            {favoriteOnly
              ? "즐겨찾기한 레시피가 없습니다."
              : "저장된 레시피가 없습니다."}
          </p>
          <Link
            href="/recipe/generate"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-orange-600 px-4 text-sm font-medium text-white hover:bg-orange-700"
          >
            레시피 생성하기
          </Link>
        </div>
      )}

      {!isLoading && recipes.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onToggleFavorite={setFavorite}
              onDelete={remove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1 text-sm font-medium transition-colors",
        active
          ? "bg-orange-600 text-white"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
      )}
    >
      {children}
    </button>
  );
}
