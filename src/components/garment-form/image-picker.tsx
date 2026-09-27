"use client";

import { useId, useRef, useState } from "react";
import type { ImageChange } from "@/components/wardrobe/wardrobe-store";
import { cn } from "@/lib/cn";

/**
 * 옷 사진 고르기. 저장할 때 브라우저에서 줄여 올린다(원본은 올리지 않음).
 * value: File(새 사진) / null(제거) / undefined(기존 사진 그대로)
 */
export function ImagePicker({
  currentUrl,
  value,
  onChange,
  placeholder = "사진 끌어다 놓기",
  className,
  frameClassName,
}: {
  currentUrl: string | null;
  value: ImageChange;
  onChange: (value: ImageChange) => void;
  placeholder?: string;
  className?: string;
  frameClassName?: string;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  // 미리보기 URL은 고를 때 만든다. 부모가 값을 바꾸면(제거, 초기화) 더는 쓰지 않는다.
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);

  const shown = value instanceof File ? (preview?.file === value ? preview.url : null) : value === null ? null : currentUrl;
  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview({ file, url: URL.createObjectURL(file) });
    onChange(file);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files);
        }}
        className={cn(
          "relative flex aspect-[4/5] cursor-pointer items-end overflow-hidden rounded-md bg-neutral-200 p-2.5 text-xs text-neutral-700",
          dragging && "ring-2 ring-text",
          frameClassName,
        )}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="옷 사진 미리보기" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          placeholder
        )}
      </label>
      <input
        ref={input}
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap gap-1">
        <button type="button" className="btn btn-ghost text-sm" onClick={() => input.current?.click()}>
          {shown ? "변경" : "사진 선택"}
        </button>
        {shown && (
          <button type="button" className="btn btn-ghost text-sm text-neutral-700" onClick={() => onChange(currentUrl ? null : undefined)}>
            제거
          </button>
        )}
      </div>
    </div>
  );
}
