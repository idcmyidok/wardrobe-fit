"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteUserAccount, setUserBanned, type AdminActionResult } from "@/server/admin/actions";

/** 사용자 한 줄의 정지·삭제 버튼. 삭제는 되돌릴 수 없어서 한 번 더 누르게 한다. */
export function UserActions({ userId, email, banned }: { userId: string; email: string; banned: boolean }) {
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
