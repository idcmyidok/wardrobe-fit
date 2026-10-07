"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ImagePrepareError, prepareGarmentImage } from "@/lib/images/prepare-image";
import { GARMENT_IMAGE_BUCKET, uploadGarmentImages } from "@/lib/images/upload-garment-image";
import { goToSignIn, stashDraft } from "@/lib/session-expiry";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { SupabasePublicEnv } from "@/lib/supabase/config";
import { DEFAULT_USD_KRW } from "@/lib/format/price";
import type { Garment } from "@/lib/types/domain";
import {
  createGarment,
  deleteGarment,
  deleteGarments,
  restoreGarment,
  restoreGarments,
  setGarmentImage,
  updateGarment as updateGarmentAction,
  type GarmentActionResult,
} from "@/server/garments/actions";

/**
 * 로그인 후 화면이 함께 쓰는 옷장 상태. 첫 목록은 서버(layout)에서 읽어 오고,
 * 등록·수정·삭제는 Server Action으로 DB에 저장한 뒤 돌려받은 값으로 화면을 바꾼다.
 * Supabase 키가 없는 미리보기 배포(userId 없음)에서는 예시 데이터를 메모리에서만 바꾼다.
 */

export type GarmentDraft = Omit<Garment, "id">;
export type PendingDraft = GarmentDraft & { heldId?: string };

/** 사진 변경: File이면 새 사진, null이면 제거, undefined면 그대로 */
export type ImageChange = File | null | undefined;

/** warning: 옷은 저장했지만 사진을 올리지 못한 경우의 안내 */
export type SaveResult = { ok: true; garment: Garment; warning?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

interface Toast {
  message: string;
  undo?: () => void;
}

interface WardrobeStore {
  /** 옷장 옷(구매 보류 옷 제외). 분석·구매 판단 비교·코디가 쓴다. */
  garments: Garment[];
  /** 구매 보류 옷(아직 안 산 옷). 구매 판단기 아래 목록에만 보인다. */
  heldGarments: Garment[];
  /** 옷장 옷과 보류 옷 모두(옷 정보 열기용) */
  allGarments: Garment[];
  /** 1달러 = N원(관리자 설정). 달러 가격 정렬·합계에 쓴다. */
  usdRate: number;
  /** 로그인해 DB에 저장하는 상태인지(false면 예시 데이터 미리보기) */
  signedIn: boolean;
  /** sourceImportId: 링크 분석으로 등록할 때 그 분석 기록 id */
  addGarment: (draft: GarmentDraft, image?: ImageChange, sourceImportId?: string | null) => Promise<SaveResult>;
  updateGarment: (id: string, patch: Partial<GarmentDraft>, image?: ImageChange) => Promise<SaveResult>;
  /** 성공하면 true. 실패하면 알림을 띄우고 false */
  removeGarment: (id: string) => Promise<boolean>;
  /** 여러 벌 삭제(옷장의 선택 삭제). 성공하면 true, 실패하면 알림을 띄우고 false */
  removeGarments: (ids: string[]) => Promise<boolean>;

  /**
   * 옷 정보 열기. 넓은 화면은 지금 주소에 ?item={id}를 붙여 Drawer로 열고(뒤로가기로 닫힘),
   * 좁은 화면(모바일)은 상세 페이지 /wardrobe/{id}로 이동한다. 열린 옷은 useOpenGarmentId()로 읽는다.
   */
  openDrawer: (id: string) => void;
  closeDrawer: () => void;
  /** 다른 화면에서 옷 정보를 열며 이동할 주소(등록 직후 등) */
  garmentHref: (id: string) => string;

  toast: Toast | null;
  showToast: (message: string, undo?: () => void) => void;

  /**
   * AI 구매 판단 결과에서 "구매했어요"를 누르면 새 옷 추가 검토 폼으로 넘기는 값.
   * heldId가 있으면 구매 보류 옷을 옷장으로 옮기는 중이다(저장하면 그 행을 옷장 옷으로 바꾼다).
   */
  pendingDraft: PendingDraft | null;
  setPendingDraft: (draft: PendingDraft | null) => void;
}

const Ctx = createContext<WardrobeStore | null>(null);

const TOAST_MS = 5000;

const IMAGE_ERRORS: Record<ImagePrepareError["code"], string> = {
  not_image: "사진 파일만 올릴 수 있습니다.",
  too_large: "30MB 이하 사진만 올릴 수 있습니다.",
  decode_failed: "사진을 읽지 못했습니다. 다른 사진을 골라 주세요.",
  encode_failed: "사진을 줄이지 못했습니다. 다른 사진을 골라 주세요.",
};

/** 서버에 보낼 입력. 화면용 필드(id, 사진 URL)는 뺀다. */
const toInput = (g: GarmentDraft) => ({
  categoryId: g.categoryId,
  subcategoryId: g.subcategoryId,
  brand: g.brand,
  productName: g.productName,
  sizeLabel: g.sizeLabel,
  colorName: g.colorName,
  seasons: g.seasons,
  purchasedOn: g.purchasedOn,
  purchasePrice: g.purchasePrice,
  currency: g.currency ?? "KRW",
  held: g.held ?? false,
  fitCheckId: g.fitCheckId ?? null,
  productUrl: g.productUrl,
  measurements: g.measurements,
  fitReview: g.fitReview,
  shoeFit: g.shoeFit,
  userFit: g.userFit ?? null,
});

const fromAction = (r: GarmentActionResult): SaveResult =>
  r.ok ? { ok: true, garment: r.data } : { ok: false, error: r.error, fieldErrors: r.fieldErrors };

export const NETWORK_ERROR = "연결이 불안정합니다. 입력한 내용은 유지됩니다.";

/**
 * Server Action 호출. 연결이 끊겨 요청 자체가 실패하면 입력을 지우지 않도록 오류 결과로 바꾸고,
 * 로그인이 풀렸으면 로그인 화면으로 보낸다(draft가 있으면 보관).
 */
async function call<T>(action: () => Promise<GarmentActionResult<T>>, draft?: GarmentDraft): Promise<GarmentActionResult<T>> {
  let result: GarmentActionResult<T>;
  try {
    result = await action();
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
  if (!result.ok && result.code === "signed_out") {
    if (draft) stashDraft(draft);
    goToSignIn();
  }
  return result;
}

export function WardrobeProvider({
  children,
  initialGarments,
  userId,
  supabaseEnv = null,
  usdRate = DEFAULT_USD_KRW,
}: {
  /** 1달러 = N원(관리자 설정) */
  usdRate?: number;
  children: React.ReactNode;
  initialGarments: Garment[];
  /** 로그인한 사용자 id. null이면 미리보기 모드 */
  userId: string | null;
  /** 서버가 실행 중에 읽은 Supabase 공개 설정(URL, anon key) */
  supabaseEnv?: SupabasePublicEnv | null;
}) {
  const [allGarments, setGarments] = useState<Garment[]>(initialGarments);
  const garments = useMemo(() => allGarments.filter((g) => !g.held), [allGarments]);
  const heldGarments = useMemo(() => allGarments.filter((g) => g.held), [allGarments]);
  const router = useRouter();
  // 이 화면에서 Drawer를 열며 쌓은 기록. 닫을 때 그 기록을 되돌려(history.back) 뒤로가기와 같게 만든다.
  const pushedItem = useRef<string | null>(null);

  const openDrawer = useCallback(
    (id: string) => {
      if (isNarrowScreen()) {
        router.push(`/wardrobe/${id}`);
        return;
      }
      const url = new URL(window.location.href);
      if (url.searchParams.get("item") === id) return;
      const replace = url.searchParams.has("item");
      url.searchParams.set("item", id);
      if (replace) window.history.replaceState(null, "", url);
      else window.history.pushState(null, "", url);
      if (!replace) pushedItem.current = id;
    },
    [router],
  );

  const closeDrawer = useCallback(() => {
    const url = new URL(window.location.href);
    const id = url.searchParams.get("item");
    if (!id) return;
    if (pushedItem.current === id) {
      pushedItem.current = null;
      window.history.back();
      return;
    }
    url.searchParams.delete("item");
    window.history.replaceState(null, "", url);
  }, []);

  const garmentHref = useCallback((id: string) => (isNarrowScreen() ? `/wardrobe/${id}` : `/wardrobe?item=${id}`), []);
  const [toast, setToast] = useState<Toast | null>(null);
  const [pendingDraft, setPendingDraft] = useState<PendingDraft | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToast = useCallback((message: string, undo?: () => void) => {
    clearTimeout(toastTimer.current);
    setToast({ message, undo });
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const replace = useCallback((garment: Garment) => {
    setGarments((list) => (list.some((g) => g.id === garment.id) ? list.map((g) => (g.id === garment.id ? garment : g)) : [...list, garment]));
  }, []);

  /** 사진을 줄여 올리고 옷에 연결한다. 실패하면 옷은 그대로 두고 오류 문구를 돌려준다. */
  const applyImage = useCallback(
    async (garment: Garment, image: ImageChange): Promise<SaveResult> => {
      if (image === undefined) return { ok: true, garment };
      if (!userId) {
        // 미리보기: 브라우저 안에서만 보여준다.
        const url = image ? URL.createObjectURL(image) : null;
        return { ok: true, garment: { ...garment, imageUrl: url, thumbUrl: url } };
      }
      if (image === null) return fromAction(await call(() => setGarmentImage(garment.id, null)));

      const supabase = createSupabaseBrowserClient(supabaseEnv);
      if (!supabase) return { ok: false, error: "사진을 올릴 수 없습니다." };
      try {
        const prepared = await prepareGarmentImage(image);
        const paths = await uploadGarmentImages(supabase, userId, garment.id, prepared);
        const result = await call(() => setGarmentImage(garment.id, paths));
        if (!result.ok) await supabase.storage.from(GARMENT_IMAGE_BUCKET).remove([paths.imagePath, paths.thumbPath]);
        return fromAction(result);
      } catch (e) {
        return { ok: false, error: e instanceof ImagePrepareError ? IMAGE_ERRORS[e.code] : "사진을 올리지 못했습니다." };
      }
    },
    [userId, supabaseEnv],
  );

  const addGarment = useCallback(
    async (draft: GarmentDraft, image?: ImageChange, sourceImportId?: string | null): Promise<SaveResult> => {
      let created: Garment;
      if (userId) {
        const result = await call(() => createGarment({ ...toInput(draft), sourceImportId }), draft);
        if (!result.ok) return fromAction(result);
        created = result.data;
      } else {
        created = { ...draft, id: `n${Date.now()}` };
      }
      replace(created);
      const withImage = await applyImage(created, image);
      if (!withImage.ok) return { ok: true, garment: created, warning: `옷은 등록했지만 ${withImage.error}` };
      replace(withImage.garment);
      return withImage;
    },
    [userId, replace, applyImage],
  );

  const updateGarment = useCallback(
    async (id: string, patch: Partial<GarmentDraft>, image?: ImageChange): Promise<SaveResult> => {
      const current = allGarments.find((g) => g.id === id);
      if (!current) return { ok: false, error: "옷을 찾을 수 없습니다." };
      const next = { ...current, ...patch };

      let saved: Garment = next;
      if (userId) {
        const result = await call(() => updateGarmentAction(id, toInput(next)));
        if (!result.ok) return fromAction(result);
        saved = result.data;
      }
      replace(saved);
      const withImage = await applyImage(saved, image);
      if (!withImage.ok) return withImage;
      replace(withImage.garment);
      return withImage;
    },
    [allGarments, userId, replace, applyImage],
  );

  const removeGarment = useCallback(
    async (id: string) => {
      const index = allGarments.findIndex((g) => g.id === id);
      if (index === -1) return false;
      const removed = allGarments[index];
      if (userId) {
        const result = await call(() => deleteGarment(id));
        if (!result.ok) {
          showToast(result.error);
          return false;
        }
      }
      setGarments((list) => list.filter((g) => g.id !== id));
      if (new URLSearchParams(window.location.search).get("item") === id) closeDrawer();
      showToast("삭제했습니다", async () => {
        setToast(null);
        let restored = removed;
        if (userId) {
          const result = await call(() => restoreGarment(id));
          if (!result.ok) {
            showToast(result.error);
            return;
          }
          restored = result.data;
        }
        setGarments((list) => {
          const next = list.filter((g) => g.id !== id);
          next.splice(Math.min(index, next.length), 0, restored);
          return next;
        });
      });
      return true;
    },
    [allGarments, userId, showToast, closeDrawer],
  );

  const removeGarments = useCallback(
    async (ids: string[]) => {
      const wanted = new Set(ids);
      // 되살릴 때 원래 자리로 돌려놓으려고 목록에서의 위치를 기억해 둔다.
      const removed = allGarments.map((g, index) => ({ g, index })).filter(({ g }) => wanted.has(g.id));
      if (!removed.length) return false;
      let doneIds = removed.map(({ g }) => g.id);
      if (userId) {
        const result = await call(() => deleteGarments(doneIds));
        if (!result.ok) {
          showToast(result.error);
          return false;
        }
        doneIds = result.data.ids;
      }
      const done = new Set(doneIds);
      setGarments((list) => list.filter((g) => !done.has(g.id)));
      const open = new URLSearchParams(window.location.search).get("item");
      if (open && done.has(open)) closeDrawer();
      showToast(`${done.size}벌을 삭제했습니다`, async () => {
        setToast(null);
        let restored = new Map(removed.filter(({ g }) => done.has(g.id)).map(({ g }) => [g.id, g]));
        if (userId) {
          const result = await call(() => restoreGarments(doneIds));
          if (!result.ok) {
            showToast(result.error);
            return;
          }
          restored = new Map(result.data.map((g) => [g.id, g]));
        }
        setGarments((list) => {
          const next = list.filter((g) => !restored.has(g.id));
          for (const { g, index } of removed) {
            const back = restored.get(g.id);
            if (back) next.splice(Math.min(index, next.length), 0, back);
          }
          return next;
        });
      });
      return true;
    },
    [allGarments, userId, showToast, closeDrawer],
  );

  const value = useMemo<WardrobeStore>(
    () => ({
      garments,
      heldGarments,
      allGarments,
      usdRate,
      signedIn: Boolean(userId),
      addGarment,
      updateGarment,
      removeGarment,
      removeGarments,
      openDrawer,
      closeDrawer,
      garmentHref,
      toast,
      showToast,
      pendingDraft,
      setPendingDraft,
    }),
    [garments, heldGarments, allGarments, usdRate, userId, addGarment, updateGarment, removeGarment, removeGarments, openDrawer, closeDrawer, garmentHref, toast, showToast, pendingDraft],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** 모바일 기준 폭(PROJECT_SPEC.md 12단계: 768px 미만) */
const isNarrowScreen = () => window.matchMedia("(max-width: 767px)").matches;

/** Drawer로 열린 옷 id(?item=). useSearchParams를 쓰므로 Suspense 안에서만 쓴다. */
export function useOpenGarmentId(): string | null {
  return useSearchParams().get("item");
}

export function useWardrobe(): WardrobeStore {
  const store = useContext(Ctx);
  if (!store) throw new Error("useWardrobe는 WardrobeProvider 안에서만 쓸 수 있습니다.");
  return store;
}

/** 화면 하단 왼쪽 알림. 완료 알림과 실행 취소 전용(PROJECT_SPEC.md 6.9). */
export function WardrobeToast() {
  const { toast } = useWardrobe();
  if (!toast) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-[max(1.5rem,env(safe-area-inset-left))] z-55 flex items-center gap-5 bg-text px-4 py-3 text-base text-bg"
    >
      <span>{toast.message}</span>
      {toast.undo && (
        <button type="button" onClick={toast.undo} className="cursor-pointer font-semibold text-accent-300">
          실행 취소
        </button>
      )}
    </div>
  );
}
