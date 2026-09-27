"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MOCK_GARMENTS } from "@/lib/mock/garments";
import type { Garment } from "@/lib/types/domain";

/**
 * 로그인 후 화면이 함께 쓰는 옷장 상태. 지금은 mock 데이터를 메모리에 두고,
 * 4단계(DB 연결)에서 Server Action + 서버 조회로 바꾼다. 새로고침하면 처음 상태로 돌아간다.
 */

export type GarmentDraft = Omit<Garment, "id">;

interface Toast {
  message: string;
  undo?: () => void;
}

interface WardrobeStore {
  garments: Garment[];
  addGarment: (draft: GarmentDraft) => Garment;
  updateGarment: (id: string, patch: Partial<GarmentDraft>) => void;
  removeGarment: (id: string) => void;

  /** 옷 정보 Drawer. 어느 화면에서든 열 수 있다. */
  drawerId: string | null;
  openDrawer: (id: string) => void;
  closeDrawer: () => void;

  toast: Toast | null;
  showToast: (message: string, undo?: () => void) => void;

  /** AI 구매 판단 결과에서 "구매했어요"를 누르면 새 옷 추가 검토 폼으로 넘기는 값 */
  pendingDraft: GarmentDraft | null;
  setPendingDraft: (draft: GarmentDraft | null) => void;
}

const Ctx = createContext<WardrobeStore | null>(null);

const TOAST_MS = 5000;

export function WardrobeProvider({ children }: { children: React.ReactNode }) {
  const [garments, setGarments] = useState<Garment[]>(MOCK_GARMENTS);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [pendingDraft, setPendingDraft] = useState<GarmentDraft | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToast = useCallback((message: string, undo?: () => void) => {
    clearTimeout(toastTimer.current);
    setToast({ message, undo });
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const addGarment = useCallback((draft: GarmentDraft) => {
    const garment: Garment = { ...draft, id: `n${Date.now()}` };
    setGarments((list) => [...list, garment]);
    return garment;
  }, []);

  const updateGarment = useCallback((id: string, patch: Partial<GarmentDraft>) => {
    setGarments((list) => list.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }, []);

  const removeGarment = useCallback(
    (id: string) => {
      const index = garments.findIndex((g) => g.id === id);
      if (index === -1) return;
      const removed = garments[index];
      setGarments((list) => list.filter((g) => g.id !== id));
      setDrawerId((current) => (current === id ? null : current));
      showToast("삭제했습니다", () => {
        setGarments((list) => {
          const next = list.slice();
          next.splice(Math.min(index, next.length), 0, removed);
          return next;
        });
        setToast(null);
      });
    },
    [garments, showToast],
  );

  const value = useMemo<WardrobeStore>(
    () => ({
      garments,
      addGarment,
      updateGarment,
      removeGarment,
      drawerId,
      openDrawer: setDrawerId,
      closeDrawer: () => setDrawerId(null),
      toast,
      showToast,
      pendingDraft,
      setPendingDraft,
    }),
    [garments, addGarment, updateGarment, removeGarment, drawerId, toast, showToast, pendingDraft],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
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
      className="fixed bottom-6 left-6 z-55 flex items-center gap-5 bg-text px-4 py-3 text-base text-bg"
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
