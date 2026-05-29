/** Badge — 작은 상태/메타 라벨 (presentational). */
import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "easy" | "medium" | "hard" | "muted";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  easy: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  medium:
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  hard: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  muted: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
