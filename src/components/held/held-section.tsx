"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { buttonClassName } from "@/components/ui/button";
import { useOpenGarmentId, useWardrobe } from "@/components/wardrobe/wardrobe-store";
import { DEFAULT_SORT, nextSort, sortGarments, type ColumnSort } from "@/components/wardrobe/filter-state";
import { WardrobeTable, type GarmentSelection } from "@/components/wardrobe/wardrobe-table";
import { cn } from "@/lib/cn";
import { CATEGORIES, COUNT_UNIT } from "@/lib/constants/categories";
import type { CategoryId } from "@/lib/types/domain";

/**
 * 구매 판단기 아래 "구매 보류 옷": 아직 안 산 옷을 옷장과 따로 모아 둔다.
 * 표는 내 옷장과 같고(시즌·구매일 없음, "가격"), 행을 누르면 옷 정보가 열린다(수정, "구매했어요 → 옷장으로").
 * 옷 삭제는 내 옷장과 같이 체크해서 한꺼번에 지운다(5초 안에 실행 취소).
 */
export function HeldSection() {
  const { heldGarments, openDrawer, removeGarments, usdRate } = useWardrobe();
  const drawerId = useOpenGarmentId();
  const [sorts, setSorts] = useState<Partial<Record<CategoryId, ColumnSort>>>({});
  const [deleting, setDeleting] = useState(false);
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removing, setRemoving] = useState(false);

  const checkedIds = useMemo(() => heldGarments.filter((g) => checked.has(g.id)).map((g) => g.id), [heldGarments, checked]);
  const selection = useMemo<GarmentSelection | undefined>(
    () =>
      deleting
        ? {
            selected: checked,
            onToggle: (id) =>
              setChecked((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              }),
          }
        : undefined,
    [deleting, checked],
  );
  const exitDeleting = () => {
    setDeleting(false);
    setChecked(new Set());
    setConfirmDelete(false);
  };
  const removeChecked = async () => {
    setRemoving(true);
    const ok = await removeGarments(checkedIds);
    setRemoving(false);
    setConfirmDelete(false);
    if (ok) exitDeleting();
  };

  // 최근에 담은 옷이 위로(기본 정렬). 헤더를 누르면 그 열로 정렬한다.
  const groups = CATEGORIES.map((category) => ({
    ...category,
    items: sortGarments(
      heldGarments.filter((g) => g.categoryId === category.id).reverse(),
      sorts[category.id] ?? DEFAULT_SORT,
      usdRate,
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <section id="held" aria-labelledby="held-title" className="mt-12 scroll-mt-20 border-t border-divider pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3 pb-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2.5">
            <h2 id="held-title" className="text-xl">
              구매 보류 옷
            </h2>
            <span className="font-mono text-base text-neutral-700 tabular-nums">{heldGarments.length}벌</span>
          </div>
          <p className="text-sm text-neutral-700">
            살까 말까 고민 중인 옷을 옷장과 따로 모아 둡니다. 옷을 누르면 정보를 고치거나, 샀을 때 옷장으로 옮길 수 있어요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {heldGarments.length > 0 && (
            <button
              type="button"
              aria-pressed={deleting}
              onClick={() => (deleting ? exitDeleting() : setDeleting(true))}
              className={cn("btn min-h-9 px-3 text-sm", deleting ? "btn-secondary" : "btn-danger")}
            >
              {deleting ? "삭제 취소" : "옷 삭제"}
            </button>
          )}
          <Link href="/wardrobe/new?held=1" className={buttonClassName({ variant: "primary" })}>
            + 구매 보류 옷 추가
          </Link>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="border-t border-neutral-300 py-8 text-base text-neutral-700">
          아직 구매 보류 옷이 없습니다. 판단 결과 아래 &ldquo;구매 보류 옷에 추가&rdquo;를 누르거나 위 버튼으로 직접 담을 수 있어요.
        </p>
      ) : (
        groups.map((group) => (
          <div key={group.id} className="pt-5">
            <div className="flex items-baseline gap-2.5 pb-2">
              <h3 className="text-lg">{group.name}</h3>
              <span className="font-mono text-base text-neutral-700 tabular-nums">
                {group.items.length}
                {COUNT_UNIT[group.id]}
              </span>
            </div>
            <WardrobeTable
              held
              categoryId={group.id}
              items={group.items}
              sort={sorts[group.id] ?? DEFAULT_SORT}
              onSort={(key) => setSorts((s) => ({ ...s, [group.id]: nextSort(s[group.id] ?? DEFAULT_SORT, key) }))}
              selectedId={drawerId}
              onOpen={openDrawer}
              view={deleting ? "simple" : undefined}
              selection={selection}
            />
          </div>
        ))
      )}

      {deleting && <div aria-hidden className="h-20" />}
      {deleting && (
        <div className="fixed right-[max(clamp(16px,3vw,32px),env(safe-area-inset-right))] bottom-[calc(max(1rem,env(safe-area-inset-bottom))+4.25rem)] md:bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-40 flex items-center gap-2">
          <button type="button" className="btn btn-secondary bg-bg" onClick={exitDeleting}>
            취소
          </button>
          <button
            type="button"
            disabled={checkedIds.length === 0}
            onClick={() => setConfirmDelete(true)}
            className={cn(
              "btn min-h-11 px-5 font-semibold",
              checkedIds.length === 0
                ? "bg-neutral-300 text-neutral-600 disabled:opacity-100"
                : "btn-danger shadow-[0_4px_14px_color-mix(in_srgb,var(--negative)_35%,transparent)]",
            )}
          >
            선택 삭제하기{checkedIds.length > 0 && ` (${checkedIds.length})`}
          </button>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[color-mix(in_srgb,var(--n-900)_50%,transparent)] p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="held-delete-title"
            onKeyDown={(e) => e.key === "Escape" && setConfirmDelete(false)}
            className="flex w-[min(440px,100%)] flex-col gap-3 rounded-lg border border-border bg-bg p-4"
          >
            <div id="held-delete-title" className="text-lg font-semibold">
              구매 보류 옷 {checkedIds.length}벌을 삭제할까요?
            </div>
            <div className="text-base text-neutral-800">고른 옷의 실측과 메모가 함께 삭제됩니다. 5초 안에는 실행 취소할 수 있습니다.</div>
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" autoFocus onClick={() => setConfirmDelete(false)}>
                취소
              </button>
              <button type="button" className="btn btn-danger" disabled={removing} onClick={removeChecked}>
                {removing ? "삭제 중…" : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
