"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useWardrobe } from "@/components/wardrobe/wardrobe-store";
import type { BodyKey } from "@/lib/constants/body";
import { computeBodyFit, computeCalibration, type BodyFitGarment, type BodyFitResult, type BodyProfile, type Calibration, type FitOverrides } from "@/lib/fit/body-fit";
import { goToSignIn } from "@/lib/session-expiry";
import { deleteBodyProfile, saveBodyProfile, saveFitOverrides, type BodyActionResult } from "@/server/body/actions";

/**
 * 내 치수 상태. 첫 값은 서버(layout)에서 읽고, 저장은 Server Action으로 한다.
 * 예상 핏은 저장하지 않고 화면에서 바로 계산한다(내 치수를 고치면 모든 표가 바로 바뀐다).
 * 미리보기 모드(로그인 없음)에서는 메모리에서만 바꾼다.
 */

export interface BodyDraft {
  values: Partial<Record<BodyKey, number | null>>;
  uncertain: BodyKey[];
  consent?: boolean;
}

type Result = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

interface BodyStore {
  /** null이면 아직 동의·저장 전 */
  profile: BodyProfile | null;
  calibration: Calibration;
  save: (draft: BodyDraft) => Promise<Result>;
  saveOverrides: (overrides: FitOverrides) => Promise<Result>;
  remove: () => Promise<Result>;
}

const Ctx = createContext<BodyStore | null>(null);

const NETWORK_ERROR = "연결이 불안정합니다. 잠시 후 다시 시도해 주세요.";

async function call<T>(action: () => Promise<BodyActionResult<T>>): Promise<BodyActionResult<T>> {
  try {
    const result = await action();
    if (!result.ok && result.code === "signed_out") goToSignIn();
    return result;
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
}

export function BodyProvider({ children, initialProfile, signedIn }: { children: React.ReactNode; initialProfile: BodyProfile | null; signedIn: boolean }) {
  const [profile, setProfile] = useState<BodyProfile | null>(initialProfile);
  const { garments } = useWardrobe();
  const calibration = useMemo(() => (profile ? computeCalibration(profile, garments) : {}), [profile, garments]);

  const save = useCallback(
    async (draft: BodyDraft): Promise<Result> => {
      if (!signedIn) {
        const values = Object.fromEntries(Object.entries(draft.values).filter(([, v]) => v != null)) as BodyProfile["values"];
        setProfile((p) => ({ values, uncertain: draft.uncertain, overrides: p?.overrides ?? {}, updatedAt: new Date().toISOString() }));
        return { ok: true };
      }
      const r = await call(() => saveBodyProfile(draft));
      if (!r.ok) return { ok: false, error: r.error, fieldErrors: r.fieldErrors };
      setProfile(r.data);
      return { ok: true };
    },
    [signedIn],
  );

  const saveOverrides = useCallback(
    async (overrides: FitOverrides): Promise<Result> => {
      if (!signedIn) {
        setProfile((p) => (p ? { ...p, overrides } : p));
        return { ok: true };
      }
      const r = await call(() => saveFitOverrides(overrides));
      if (!r.ok) return { ok: false, error: r.error };
      setProfile(r.data);
      return { ok: true };
    },
    [signedIn],
  );

  const remove = useCallback(async (): Promise<Result> => {
    if (signedIn) {
      const r = await call(() => deleteBodyProfile());
      if (!r.ok) return { ok: false, error: r.error };
    }
    setProfile(null);
    return { ok: true };
  }, [signedIn]);

  const value = useMemo(() => ({ profile, calibration, save, saveOverrides, remove }), [profile, calibration, save, saveOverrides, remove]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBody(): BodyStore {
  const store = useContext(Ctx);
  if (!store) throw new Error("useBody는 BodyProvider 안에서만 쓸 수 있습니다.");
  return store;
}

/** 옷 한 벌의 예상 핏. 내 치수가 없으면 null */
export function useBodyFit(garment: BodyFitGarment | null): BodyFitResult | null {
  const { profile, calibration } = useBody();
  return useMemo(() => (garment && profile ? computeBodyFit(garment, profile, calibration) : null), [garment, profile, calibration]);
}
