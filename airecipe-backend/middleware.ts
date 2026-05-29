/**
 * 페이지 보호 미들웨어 — 계약 0.3의 "페이지 보호" 표와 일치해야 한다(불변식).
 *
 * 보호(로그인 필요): /recipe/[id], /my-recipes  → 미인증 시 /auth/login?redirect=... 로 이동
 * 공개: /, /recipe/generate, /auth/login, /auth/signup
 * 인증 상태로 /auth/* 접근 시 / 로 이동.
 *
 * @supabase/ssr 미들웨어 패턴: 요청 쿠키로 세션을 읽고, 갱신된 쿠키를 응답에 반영한다.
 * 세션 검증의 진실 원천은 서버(Route Handler / RLS)이며, 미들웨어는 페이지 가드용.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** 보호 경로 판정: /my-recipes, /recipe/[id] (단 /recipe/generate는 공개) */
function isProtectedPath(pathname: string): boolean {
  if (pathname === "/my-recipes" || pathname.startsWith("/my-recipes/")) {
    return true;
  }
  if (pathname === "/recipe/generate" || pathname.startsWith("/recipe/generate/")) {
    return false; // 생성은 공개
  }
  // /recipe/[id] — 그 외 /recipe/* 는 보호
  if (pathname.startsWith("/recipe/")) return true;
  return false;
}

function isAuthPath(pathname: string): boolean {
  return pathname === "/auth/login" || pathname === "/auth/signup";
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // 미인증이 보호 페이지 접근 → 로그인으로(원래 목적지를 redirect 쿼리로 보존).
  if (!user && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // 로그인 상태로 인증 페이지 접근 → 홈으로.
  if (user && isAuthPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // 계약 표와 일치: 보호/인증 페이지 + 세션 갱신 대상. 정적 자산/이미지/api는 제외.
  matcher: [
    "/my-recipes/:path*",
    "/recipe/:path*",
    "/auth/login",
    "/auth/signup",
  ],
};
