/**
 * 공용 UI 유틸리티.
 * `cn`: clsx + tailwind-merge — 조건부 클래스 병합 시 Tailwind 충돌(예: px-2 vs px-4)을 해결한다.
 * shadcn/ui 패턴과 동일한 시그니처.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
