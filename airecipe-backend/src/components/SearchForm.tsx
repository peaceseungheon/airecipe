/**
 * SearchForm — 요리 이름(+인분) 입력 폼 (presentational + 제출 콜백).
 * 데이터 페칭 책임 없음 — onSubmit으로 상위(생성 훅 보유)에 위임.
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

interface SearchFormProps {
  /** 요리 이름과 인분을 상위로 전달. */
  onSubmit: (dishName: string, servings: number) => void;
  /** 진행 중이면 입력/버튼 비활성화 + 스피너. */
  pending?: boolean;
  defaultDishName?: string;
  defaultServings?: number;
  submitLabel?: string;
}

export function SearchForm({
  onSubmit,
  pending = false,
  defaultDishName = "",
  defaultServings = 2,
  submitLabel = "레시피 생성",
}: SearchFormProps) {
  const [dishName, setDishName] = useState(defaultDishName);
  const [servings, setServings] = useState(defaultServings);

  const trimmed = dishName.trim();
  const canSubmit = trimmed.length > 0 && !pending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit(trimmed, servings);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
      <Input
        value={dishName}
        onChange={(e) => setDishName(e.target.value)}
        placeholder="만들고 싶은 요리 이름 (예: 김치찌개)"
        maxLength={100}
        disabled={pending}
        aria-label="요리 이름"
        className="flex-1"
      />
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="servings">
          인분
        </label>
        <Input
          id="servings"
          type="number"
          min={1}
          max={20}
          value={servings}
          onChange={(e) =>
            setServings(Math.max(1, Math.min(20, Number(e.target.value) || 1)))
          }
          disabled={pending}
          className="w-20"
        />
        <span className="text-sm text-zinc-500">인분</span>
      </div>
      <Button type="submit" disabled={!canSubmit} className="sm:w-40">
        {pending ? <Spinner /> : submitLabel}
      </Button>
    </form>
  );
}
