"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { guideDevice } from "@/lib/import/order-guide-device";
import { musinsaProductBookmarklet } from "@/lib/import/musinsa-product-bookmarklet";

/**
 * 무신사가 링크 직접 읽기를 막았을 때 보여 주는 안내.
 * 무신사 상품 페이지에서 북마크 버튼을 누르면 상품 정보가 이 화면으로 넘어온다.
 */

const noSubscribe = () => () => {};

export function MusinsaProductGuide() {
  const device = useSyncExternalStore(
    noSubscribe,
    () => guideDevice(navigator.userAgent, navigator.maxTouchPoints),
    () => null,
  );
  const bookmark = useRef<HTMLAnchorElement>(null);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  // React는 javascript: 주소를 href로 넣지 못하게 막아서 직접 넣는다.
  useEffect(() => {
    bookmark.current?.setAttribute("href", musinsaProductBookmarklet(window.location.origin));
  }, [device]);

  if (!device) return null;
  const pc = device === "pc";

  async function copyBookmark() {
    try {
      await navigator.clipboard.writeText(musinsaProductBookmarklet(window.location.origin));
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
  }

  return (
    <div className="mt-1 flex flex-col gap-2.5 border-t border-divider pt-3">
      <div className="text-base font-semibold">무신사 페이지에서 바로 불러오기</div>
      {pc ? (
        <>
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-base text-pretty">
            <li>
              아래 <b>무신사 상품 불러오기</b> 버튼을 브라우저의 즐겨찾기 막대로 끌어다 놓아요. 처음 한 번만 하면 돼요.
            </li>
            <li>무신사에서 옷 상품 페이지를 열고, 즐겨찾기의 <b>무신사 상품 불러오기</b>를 눌러요.</li>
            <li>새 창이 열리면서 상품 정보가 자동으로 채워져요.</li>
          </ol>
          <a ref={bookmark} className="btn btn-secondary min-h-10 self-start" onClick={(e) => e.preventDefault()}>
            무신사 상품 불러오기
          </a>
        </>
      ) : (
        <>
          <p className="text-sm text-neutral-700 text-pretty">휴대폰에서는 크롬·사파리에서만 쓸 수 있어요. 무신사 앱이 아닌 웹사이트에서 해요.</p>
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-base text-pretty">
            <li>아래 <b>북마크 주소 복사</b>를 눌러요.</li>
            <li>
              이 화면을 북마크에 추가한 뒤(크롬 <b>⋮ → ☆</b>, 사파리 주소창 왼쪽 버튼 → <b>북마크에 추가</b>) 그 북마크를 편집해 이름은 <b>무신사상품</b>, 주소는 지우고 복사한 글을 붙여 넣어요. 처음 한 번만 하면 돼요.
            </li>
            <li>무신사 웹 상품 페이지에서 주소창에 <b>무신사상품</b>을 검색하거나 북마크 목록에서 눌러요.</li>
          </ol>
          <button type="button" className="btn btn-secondary min-h-10 self-start" onClick={copyBookmark}>
            북마크 주소 복사
          </button>
          {copied === "ok" && <p className="text-sm text-neutral-700">복사했어요. 북마크 주소 칸에 붙여 넣어 주세요.</p>}
          {copied === "fail" && <p className="text-sm text-accent-700">자동 복사가 막혀 있어요. 브라우저 설정을 확인해 주세요.</p>}
        </>
      )}
    </div>
  );
}
