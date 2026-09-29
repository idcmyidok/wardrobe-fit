"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { encryptLegacyBodyProfiles } from "@/server/admin/actions";

/** 암호화 전에 평문으로 저장된 신체치수를 한 번에 암호화로 바꾼다(1.2.6). 끝나면 마이그레이션 19를 실행한다. */
export function BodyEncryption({ pending, keySet }: { pending: number | null; keySet: boolean }) {
  const [busy, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const run = () =>
    startTransition(async () => {
      setMessage(null);
      const r = await encryptLegacyBodyProfiles();
      setMessage(r.ok ? { ok: true, text: `${r.converted ?? 0}건을 암호화로 바꿨습니다.` } : { ok: false, text: r.error });
    });

  return (
    <div className="flex flex-col gap-2">
      <p className="text-base">
        {!keySet
          ? "서버에 BODY_ENCRYPTION_KEY가 없습니다. Vercel 환경 변수에 넣고 다시 배포해 주세요."
          : pending == null
            ? "상태를 읽지 못했습니다."
            : pending === 0
              ? "모든 신체치수가 암호화되어 있습니다."
              : `아직 암호화하지 않은 기록이 ${pending}건 있습니다.`}
      </p>
      {keySet && pending !== 0 && (
        <Button size="sm" className="self-start" disabled={busy} onClick={run}>
          {busy ? "바꾸는 중…" : "암호화로 바꾸기"}
        </Button>
      )}
      <p className="text-sm text-neutral-700">치수 값은 화면에 보이지 않고 서버 안에서만 옮깁니다. 다 바뀐 뒤 마이그레이션 19로 예전 칸을 지웁니다.</p>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-sm text-neutral-700" : "text-sm text-negative"}>
          {message.text}
        </p>
      )}
    </div>
  );
}
