"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MUSINSA_BOOKMARKLET } from "@/lib/import/musinsa-bookmarklet";
import { guideDevice, type GuideDevice } from "@/lib/import/order-guide-device";

/**
 * 무신사 주문내역을 상품번호까지 복사하는 방법(북마크 버튼) 안내.
 * 주문 가져오기(/wardrobe/import-orders)와 주문내역 훈수(/roast/orders) 붙여넣기 화면이 같이 쓴다.
 */

const noSubscribe = () => () => {};

const PERIOD_TIP =
  "검색창을 눌러 검색 기간을 최대(5년)로 늘린 뒤 맨 아래까지 스크롤하면 예전 주문까지 모두 가져올 수 있어요.";

/** 접속한 기기에 맞는 가져오기 방법 하나만 보여 준다. 다른 기기 방법도 눌러서 볼 수 있다. */
export function OrderGuide({ startLabel = "시작" }: { startLabel?: string }) {
  const detected = useSyncExternalStore(
    noSubscribe,
    () => guideDevice(navigator.userAgent, navigator.maxTouchPoints),
    () => null,
  );
  const [other, setOther] = useState(false);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const bookmark = useRef<HTMLAnchorElement>(null);

  const device: GuideDevice | null = !detected
    ? null
    : !other
      ? detected
      : detected === "pc"
        ? "android-chrome"
        : "pc";
  // React는 javascript: 주소를 href로 넣지 못하게 막아서 직접 넣는다.
  useEffect(() => {
    bookmark.current?.setAttribute("href", MUSINSA_BOOKMARKLET);
  }, [device]);

  if (!device) return null;
  const pc = device === "pc";
  const safari = device === "ios-safari";

  async function copyBookmark() {
    try {
      await navigator.clipboard.writeText(MUSINSA_BOOKMARKLET);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {pc ? (
        <>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-base text-pretty">
            <li>
              아래 <b>무신사 주문 복사</b> 버튼을 브라우저의 즐겨찾기 막대로
              끌어다 놓아요. 처음 한 번만 하면 돼요.
            </li>
            <li>무신사 마이페이지의 주문내역을 열어요. {PERIOD_TIP}</li>
            <li>
              주문내역 화면에서 즐겨찾기에 넣은 <b>무신사 주문 복사</b>를
              눌러요. 상품번호까지 함께 복사돼요.
            </li>
            <li>복사한 글을 아래 칸에 붙여 넣고 <b>{startLabel}</b> 버튼을 눌러요.</li>
          </ol>
          <a
            ref={bookmark}
            className="btn btn-secondary min-h-10 self-start"
            onClick={(e) => e.preventDefault()}
          >
            무신사 주문 복사
          </a>
        </>
      ) : (
        <>
          {device === "mobile-other" && (
            <p className="border border-accent-700 px-3 py-2 text-sm text-accent-700 text-pretty">
              휴대폰에서는 크롬과 사파리에서만 쓸 수 있어요. 이 화면 주소를
              크롬이나 사파리에서 열어 주세요.
            </p>
          )}
          {device !== "mobile-other" && (
            <p className="text-sm text-neutral-700 text-pretty">
              휴대폰에서는 크롬·사파리에서만 쓸 수 있어요. 무신사 앱이 아닌
              웹사이트에서 해요.
            </p>
          )}
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-base text-pretty">
            <li>
              아래 <b>북마크 주소 복사</b>를 눌러요.
            </li>
            {safari ? (
              <li>
                사파리 아래 주소창의 <b>왼쪽 버튼</b>을 눌러 메뉴를 열고{" "}
                <b>북마크에 추가</b>를 눌러요. 그다음 주소창 <b>가운데</b>를
                누르면 나오는 <b>책 모양 아이콘 → 북마크</b>에서 방금 만든
                북마크를 길게 눌러
                <b> 편집</b>하고, 이름은 <b>무신사복사</b>, 주소는 지운 뒤
                복사한 글을 붙여 넣어요. 처음 한 번만 하면 돼요.
              </li>
            ) : (
              <li>
                크롬에서 이 화면을 북마크에 추가해요(<b>⋮ → ☆</b>). 그다음{" "}
                <b>⋮ → 북마크</b>에서 방금 만든 북마크를 <b>수정</b>해 이름은
                <b> 무신사복사</b>, URL은 지운 뒤 복사한 글을 붙여 넣어요. 처음
                한 번만 하면 돼요.
              </li>
            )}
            <li>
              {safari ? "사파리" : "크롬"}로{" "}
              <a
                href="https://www.musinsa.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline underline-offset-2"
              >
                musinsa.com
              </a>
              에 로그인해 마이페이지의 주문내역을 열어요. {PERIOD_TIP}
            </li>
            <li>
              {safari ? (
                <>
                  주소창 가운데를 눌러 <b>책 모양 아이콘 → 북마크</b>를 열고{" "}
                  <b>무신사복사</b>를 눌러요. 주소창에 입력해서 열면 사파리가
                  실행을 막으니 꼭 북마크 목록에서 눌러 주세요.
                </>
              ) : (
                <>
                  주소창에 <b>무신사복사</b>를 입력하고 목록에 뜬 북마크(별
                  표시)를 눌러요.
                </>
              )}
            </li>
            <li>
              화면에 <b>복사하기</b> 버튼이 뜨면 눌러요. 이 화면으로 돌아와 아래
              칸에 붙여 넣고 <b>{startLabel}</b> 버튼을 눌러요.
            </li>
          </ol>
          <button
            type="button"
            className="btn btn-secondary min-h-11 self-start"
            onClick={copyBookmark}
          >
            북마크 주소 복사
          </button>
          {copied === "ok" && (
            <p className="text-sm text-neutral-700">
              복사했어요. 북마크 주소에 붙여 넣어 주세요.
            </p>
          )}
          {copied === "fail" && (
            <label className="flex flex-col gap-1 text-sm text-neutral-700">
              자동 복사가 막혀 있어요. 아래 글을 길게 눌러 모두 선택해 복사해
              주세요.
              <textarea
                className="input font-mono text-xs"
                rows={3}
                readOnly
                value={MUSINSA_BOOKMARKLET}
                onFocus={(e) => e.currentTarget.select()}
              />
            </label>
          )}
        </>
      )}
      <button
        type="button"
        className="btn btn-ghost self-start text-sm"
        onClick={() => setOther((v) => !v)}
      >
        {pc ? "휴대폰 방법 보기" : "PC 방법 보기"}
      </button>
    </div>
  );
}
