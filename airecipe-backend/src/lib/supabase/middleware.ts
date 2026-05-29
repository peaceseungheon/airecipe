/**
 * 미들웨어용 Supabase 세션 갱신 헬퍼.
 * 매 요청마다 세션 쿠키를 갱신하여 서버 클라이언트가 최신 세션을 보게 한다.
 * 출처: @supabase/ssr 권장 패턴, _workspace/01_architect_architecture.md 6절.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * 보호 페이지 경로 prefix — 미인증 시 /auth/login 으로 리다이렉트한다 (계약 0.3 페이지 보호 표).
 * `/recipe/`는 저장된 레시피 상세(`/recipe/[id]`)를 보호하기 위함이다.
 */
const PROTECTED_PREFIXES = ["/my-recipes", "/recipe/"];

/**
 * 보호 prefix에 걸리지만 계약상 공개인 경로 (정확 일치).
 * `/recipe/generate`는 공개 generate API만 사용하므로 비로그인 허용(계약 0.3).
 */
const PUBLIC_EXCEPTIONS = ["/recipe/generate"];

export async function updateSession(request: NextRequest): Promise<NextResponse> {
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

  // getUser()가 세션 토큰을 검증·갱신한다. 호출하지 않으면 갱신되지 않음.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 보호 페이지 가드 (API Route는 자체적으로 401을 반환하므로 여기서 제외).
  const { pathname } = request.nextUrl;
  const isPublicException = PUBLIC_EXCEPTIONS.includes(pathname);
  const isProtected =
    !isPublicException && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
