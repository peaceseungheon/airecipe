/**
 * /auth/login — 로그인 (공개 페이지, 계약 0.3).
 * 로그인 성공 시 ?redirect 또는 /로 이동. middleware가 로그인 상태에서 /auth/* 접근을 /로 가드.
 */
"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/useAuth";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuth();

  const redirectTo = searchParams.get("redirect") || "/";

  const handleSuccess = () => {
    router.push(redirectTo);
    router.refresh(); // 서버 컴포넌트/middleware가 새 세션 쿠키를 인식하도록.
  };

  return (
    <div className="mx-auto max-w-md py-8">
      <Card>
        <CardHeader>
          <CardTitle>로그인</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AuthForm mode="login" onSubmit={signIn} onSuccess={handleSuccess} />
          <p className="text-center text-sm text-zinc-500">
            계정이 없으신가요?{" "}
            <Link
              href="/auth/signup"
              className="font-medium text-orange-600 hover:underline"
            >
              회원가입
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Spinner className="text-orange-500" />
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
