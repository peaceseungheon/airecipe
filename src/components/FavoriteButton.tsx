/**
 * FavoriteButton — 즐겨찾기 토글 버튼 (presentational + 콜백).
 *
 * 계약(PATCH /favorite): 토글이 아니라 목표값 명시(멱등). 이 버튼은 현재값의
 * 반대값을 onToggle(targetValue)로 전달한다. 실제 API 호출/낙관적 업데이트는
 * 상위(useMyRecipes.setFavorite)가 담당 — 컴포넌트는 표현과 사용자 의도 전달만.
 */
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  isFavorite: boolean;
  /** 목표값(현재의 반대)을 전달. 비동기 실패 시 throw하면 버튼이 표시값을 되돌린다. */
  onToggle: (target: boolean) => Promise<void> | void;
  className?: string;
}

export function FavoriteButton({
  isFavorite,
  onToggle,
  className,
}: FavoriteButtonProps) {
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    if (pending) return;
    setPending(true);
    try {
      await onToggle(!isFavorite);
    } catch {
      // 상위(SWR)가 rollback. 여기서는 추가 처리 없음.
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}
      title={isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors",
        "hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className={cn(
          "h-5 w-5 transition-colors",
          isFavorite
            ? "fill-orange-500 stroke-orange-500"
            : "fill-none stroke-zinc-400",
        )}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11.48 3.5a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
      </svg>
    </button>
  );
}
