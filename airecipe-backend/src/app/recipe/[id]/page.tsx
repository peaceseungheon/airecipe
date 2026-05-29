/**
 * /recipe/[id] — 저장된 레시피 상세 (보호 페이지, 로그인 필요 — 계약 0.3).
 * proxy(구 middleware 컨벤션, ADR-007)가 미인증 접근을 /auth/login으로 가드한다.
 *
 * 표시 대상은 Recipe(저장됨, id 포함). 즐겨찾기/삭제 액션 제공.
 * 단건 조회는 useRecipe → GET /api/recipes/[id] (계약 2.5)를 직접 호출 — 딥링크/새로고침 지원.
 */
"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RecipeDisplay } from "@/components/RecipeDisplay";
import { FavoriteButton } from "@/components/FavoriteButton";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { useRecipe } from "@/hooks/useRecipe";
import { toErrorMessage } from "@/hooks/api-client";

export default function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { recipe, isLoading, notFound, error, setFavorite, remove } =
    useRecipe(id);

  const handleDelete = async () => {
    await remove();
    router.push("/my-recipes");
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="text-orange-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="error">{toErrorMessage(error)}</Alert>
        <Link href="/my-recipes" className="text-sm text-orange-600 hover:underline">
          마이 레시피로 돌아가기
        </Link>
      </div>
    );
  }

  if (notFound || !recipe) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-zinc-500">레시피를 찾을 수 없습니다.</p>
        <Link
          href="/my-recipes"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-orange-600 px-4 text-sm font-medium text-white hover:bg-orange-700"
        >
          마이 레시피로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <RecipeDisplay
      recipe={recipe}
      actions={
        <div className="flex items-center gap-2">
          <FavoriteButton
            isFavorite={recipe.isFavorite}
            onToggle={(target) => setFavorite(target)}
          />
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            삭제
          </Button>
        </div>
      }
    />
  );
}
