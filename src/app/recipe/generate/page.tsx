/**
 * /recipe/generate — 공개 페이지. 레시피 생성 폼 + 스트리밍 결과 실시간 표시.
 *
 * 흐름:
 *  1. 폼 제출 → useRecipeGenerate.generate({ dishName, servings, stream:true })
 *  2. 스트리밍 중 progressText 실시간 표시(text 청크)
 *  3. recipe 청크 도착 → RecipeDisplay로 최종 GeneratedRecipe 렌더
 *  4. 로그인 시 "저장" → useMyRecipes.save → /recipe/[id]로 이동
 *     비로그인 시 로그인 유도(생성은 공개, 저장만 인증 — 계약 0.3)
 *
 * 결과는 GeneratedRecipe(미저장, id 없음). 저장 전에는 id에 접근하지 않는다.
 */
"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { SearchForm } from "@/components/SearchForm";
import { RecipeDisplay } from "@/components/RecipeDisplay";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useRecipeGenerate } from "@/hooks/useRecipeGenerate";
import { useMyRecipes } from "@/hooks/useMyRecipes";
import { useAuth } from "@/hooks/useAuth";
import { toErrorMessage } from "@/hooks/api-client";

function GenerateInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { save } = useMyRecipes();
  const { status, progressText, recipe, error, generate } =
    useRecipeGenerate();

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 홈에서 dishName 쿼리로 진입 시 자동 생성 1회.
  const initialDish = searchParams.get("dishName")?.trim() ?? "";
  const initialServings = Number(searchParams.get("servings")) || 2;

  useEffect(() => {
    if (initialDish) {
      generate({
        dishName: initialDish,
        servings: initialServings,
        stream: true,
      });
    }
    // 최초 마운트 시 쿼리 기반 1회 생성. generate는 안정 참조.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (dishName: string, servings: number) => {
    setSaveError(null);
    generate({ dishName, servings, stream: true });
  };

  const handleSave = async () => {
    if (!recipe) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await save(recipe);
      router.push(`/recipe/${saved.id}`);
    } catch (err) {
      setSaveError(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const isStreaming = status === "streaming";

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">레시피 생성</h1>
        <p className="text-sm text-zinc-500">
          요리 이름을 입력하면 AI가 레시피와 영양 정보를 만들어 드립니다.
        </p>
      </header>

      <SearchForm
        onSubmit={handleSubmit}
        pending={isStreaming}
        defaultDishName={initialDish}
        defaultServings={initialServings}
      />

      {isStreaming && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Spinner className="text-orange-500" />
            <span>레시피를 생성하고 있어요…</span>
          </div>
          {progressText && (
            <p className="whitespace-pre-wrap rounded-lg bg-zinc-100 p-4 text-sm leading-relaxed text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {progressText}
            </p>
          )}
        </section>
      )}

      {status === "error" && error && <Alert variant="error">{error}</Alert>}

      {recipe && (
        <section className="space-y-4">
          <RecipeDisplay
            recipe={recipe}
            actions={
              user ? (
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Spinner /> : "레시피 저장"}
                </Button>
              ) : (
                <Link
                  href="/auth/login"
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-orange-600 px-4 text-sm font-medium text-white hover:bg-orange-700"
                >
                  로그인하고 저장
                </Link>
              )
            }
          />
          {saveError && <Alert variant="error">{saveError}</Alert>}
        </section>
      )}
    </div>
  );
}

export default function GeneratePage() {
  // useSearchParams는 Suspense 경계가 필요.
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <Spinner className="text-orange-500" />
        </div>
      }
    >
      <GenerateInner />
    </Suspense>
  );
}
