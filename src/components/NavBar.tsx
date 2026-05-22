/**
 * NavBar — 글로벌 네비게이션 (presentational + 인증 상태 소비).
 * useAuth로 로그인 상태에 따라 메뉴/버튼을 분기한다.
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export function NavBar() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-50"
        >
          <span aria-hidden>🍳</span>
          <span>AI 레시피</span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/recipe/generate"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            레시피 생성
          </Link>

          {!loading && user && (
            <Link
              href="/my-recipes"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              마이 레시피
            </Link>
          )}

          {!loading &&
            (user ? (
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                로그아웃
              </Button>
            ) : (
              <Link
                href="/auth/login"
                className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700"
              >
                로그인
              </Link>
            ))}
        </div>
      </nav>
    </header>
  );
}
