"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteUserAccount, setUserBanned, setUserTester, type AdminActionResult } from "@/server/admin/actions";

/** 사용자 한 줄의 테스터 지정·정지·삭제 버튼. 삭제는 되돌릴 수 없어서 한 번 더 누르게 한다. */
export function UserActions({ userId, email, banned, tester }: { userId: string; email: string; banned: boolean; tester: boolean }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = (action: () => Promise<AdminActionResult>) =>
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (!result.ok) setError(result.error);
      setConfirming(false);
    });

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {confirming ? (
          <>
            <Button
              size="sm"
              className="border-negative text-negative"
              disabled={pending}
              aria-label={`${email} 정말 삭제`}
              onClick={() => run(() => deleteUserAccount(userId))}
            >
              정말 삭제
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
              취소
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              disabled={pending}
              aria-label={`${email} ${tester ? "테스터 해제" : "테스터 지정"}`}
              onClick={() => run(() => setUserTester(userId, !tester))}
            >
              {tester ? "테스터 해제" : "테스터 지정"}
            </Button>
            <Button
              size="sm"
              disabled={pending}
              aria-label={`${email} ${banned ? "정지 해제" : "정지"}`}
              onClick={() => run(() => setUserBanned(userId, !banned))}
            >
              {banned ? "정지 해제" : "정지"}
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} aria-label={`${email} 삭제`} onClick={() => setConfirming(true)}>
              삭제
            </Button>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-negative">
          {error}
        </p>
      )}
    </div>
  );
}
