/**
 * 홈(/) — 공개 페이지.
 * 검색 입력(요리 이름) → /recipe/generate로 dishName 쿼리와 함께 이동.
 * 로그인 사용자에게는 최근 저장 레시피 미리보기를 노출(useMyRecipes).
 */
"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { SearchForm } from "@/components/SearchForm";
import { RecipeCard } from "@/components/RecipeCard";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/useAuth";
import { useMyRecipes } from "@/hooks/useMyRecipes";

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const handleSearch = (dishName: string, servings: number) => {
    const params = new URLSearchParams({
      dishName,
      servings: String(servings),
    });
    router.push(`/recipe/generate?${params.toString()}`);
  };

  return (
    <div className="space-y-12">
      <section className="space-y-6 py-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          무엇을 요리할까요?
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          요리 이름만 입력하면 AI가 재료·조리법·영양 정보까지 만들어 드립니다.
        </p>
        <div className="mx-auto max-w-2xl text-left">
          <SearchForm onSubmit={handleSearch} submitLabel="레시피 만들기" />
        </div>
      </section>

      {!authLoading && user && <RecentRecipes />}

      {!authLoading && !user && (
        <section className="rounded-xl border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500">
            <Link
              href="/auth/login"
              className="font-medium text-orange-600 hover:underline"
            >
              로그인
            </Link>
            하면 생성한 레시피를 저장하고 즐겨찾기할 수 있어요.
          </p>
        </section>
      )}
    </div>
  );
}

/** 로그인 사용자의 최근 저장 레시피 미리보기(최대 6개). */
function RecentRecipes() {
  const { recipes, isLoading, setFavorite, remove } = useMyRecipes({
    pageSize: 6,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner className="text-orange-500" />
      </div>
    );
  }

  if (recipes.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">최근 저장한 레시피</h2>
        <Link
          href="/my-recipes"
          className="text-sm font-medium text-orange-600 hover:underline"
        >
          전체 보기
        </Link>
      </div>
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
    </section>
  );
}
