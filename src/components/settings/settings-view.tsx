"use client";

import Link from "next/link";
import { useActionState } from "react";
import { SubmitButton } from "@/components/auth/auth-panel";
import { UsageNote } from "@/components/usage/usage-note";
import { DELETE_CONFIRM_WORD } from "@/lib/account";
import { deleteMyAccount, type DeleteAccountState } from "@/server/account/actions";

/** 계정 설정: 계정 정보, 오늘 사용량, 회원 탈퇴. email이 null이면 로그인하지 않은 미리보기다. */
export function SettingsView({ email, createdAt }: { email: string | null; createdAt: string | null }) {
  const [state, action] = useActionState<DeleteAccountState, FormData>(deleteMyAccount, {});
  return (
    <main className="mx-auto max-w-190 px-[clamp(16px,3vw,32px)] pt-6 pb-16">
      <Link href="/wardrobe" className="btn btn-ghost mb-2 text-sm">
        ← 내 옷장
      </Link>
      <div className="border-b border-divider pb-4">
        <h1 className="text-title">계정 설정</h1>
      </div>

      <section className="flex flex-col gap-3 border-b border-neutral-300 py-7">
        <h2 className="text-lg">계정</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-base">
          <dt className="text-neutral-700">이메일</dt>
          <dd className="break-all">{email ?? "로그인하지 않은 미리보기"}</dd>
          {createdAt && (
            <>
              <dt className="text-neutral-700">가입일</dt>
              <dd className="font-mono tabular-nums">{createdAt.slice(0, 10)}</dd>
            </>
          )}
        </dl>
        <UsageNote kind="fit" />
      </section>

      {email && (
        <section className="flex flex-col gap-3 py-7">
          <h2 className="text-lg">회원 탈퇴</h2>
          <p className="text-base text-neutral-800">
            탈퇴하면 계정과 옷장 기록, 사진, 구매 판단 기록이 바로 삭제되고 되살릴 수 없습니다. 자세한 내용은{" "}
            <Link href="/privacy" className="underline underline-offset-2">
              개인정보처리방침
            </Link>
            에 있습니다.
          </p>
          <form action={action} className="flex max-w-100 flex-col gap-3" noValidate>
            <div className="field">
              <label htmlFor="delete-confirm">확인을 위해 &ldquo;{DELETE_CONFIRM_WORD}&rdquo;라고 적어 주세요</label>
              <input id="delete-confirm" name="confirm" className="input min-h-11" autoComplete="off" aria-invalid={Boolean(state.error)} />
            </div>
            {state.error && (
              <p role="alert" className="border-l-2 border-negative pl-3 text-base text-negative">
                {state.error}
              </p>
            )}
            <SubmitButton label="계정과 모든 기록 삭제" pendingLabel="삭제하는 중…" />
          </form>
        </section>
      )}
    </main>
  );
}
