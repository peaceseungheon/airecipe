/** Label — 폼 라벨 프리미티브 (presentational). */
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          "text-sm font-medium text-zinc-700 dark:text-zinc-300",
          className,
        )}
        {...props}
      />
    );
  },
);
Label.displayName = "Label";
