import { NextResponse } from "next/server";
import { isAuthConfigured } from "@/lib/supabase/config";
import { getAiProvider } from "@/server/ai/provider";

export const dynamic = "force-dynamic";

/**
 * 배포 상태 확인용. 환경 변수는 값이 아니라 "있는지"만 알려 준다(값은 절대 내보내지 않는다).
 * 미리보기 배포에서 로그인이 안 켜질 때 어느 변수가 빠졌는지 확인하는 데 쓴다.
 */
export function GET() {
  const has = (name: string) => Boolean(process.env[name]?.trim());
  return NextResponse.json(
    {
      auth: isAuthConfigured(),
      // 구매 판단기 AI 요약에 쓰일 모델(키가 없으면 null = 규칙 요약만)
      aiModel: getAiProvider()?.model ?? null,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: has("NEXT_PUBLIC_SUPABASE_URL"),
        NEXT_PUBLIC_SUPABASE_ANON_KEY: has("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: has("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
        NEXT_PUBLIC_SITE_URL: has("NEXT_PUBLIC_SITE_URL"),
        GEMINI_API_KEY: has("GEMINI_API_KEY"),
        ANTHROPIC_API_KEY: has("ANTHROPIC_API_KEY"),
      },
      deployment: {
        environment: process.env.VERCEL_ENV ?? null,
        branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
