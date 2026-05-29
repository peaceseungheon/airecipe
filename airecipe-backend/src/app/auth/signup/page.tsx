/**
 * /auth/signup — 회원가입 (공개 페이지, 계약 0.3).
 * 가입 성공 시 /로 이동. (이메일 확인이 필요한 프로젝트 설정이면 세션이 없을 수 있으나,
 * onAuthStateChange가 상태를 갱신한다.) middleware가 로그인 상태의 /auth/* 접근을 /로 가드.
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

export default function SignupPage() {
  const router = useRouter();
  const { signUp } = useAuth();

  const handleSuccess = () => {
    router.push("/");
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-md py-8">
      <Card>
        <CardHeader>
          <CardTitle>회원가입</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AuthForm mode="signup" onSubmit={signUp} onSuccess={handleSuccess} />
          <p className="text-center text-sm text-zinc-500">
            이미 계정이 있으신가요?{" "}
            <Link
              href="/auth/login"
              className="font-medium text-orange-600 hover:underline"
            >
              로그인
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
