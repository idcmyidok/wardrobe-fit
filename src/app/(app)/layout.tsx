import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OfflineBanner } from "@/components/feedback/offline-banner";
import { WardrobeSkeleton } from "@/components/feedback/wardrobe-skeleton";
import { AppHeader } from "@/components/layout/app-header";
import { SiteFooter } from "@/components/legal/site-footer";
import { GarmentDrawer } from "@/components/wardrobe/garment-drawer";
import { WardrobeProvider, WardrobeToast } from "@/components/wardrobe/wardrobe-store";
import { MOCK_GARMENTS } from "@/lib/mock/garments";
import type { ReleaseNoteEdits, ReleaseNoteImages } from "@/lib/release-notes";
import { getSupabaseEnv, isAuthConfigured } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";
import { isAdmin } from "@/server/admin/guard";
import { getReleaseNoteEdits, getReleaseNoteImages } from "@/server/release-notes/actions";
import { listMyGarments } from "@/server/garments/queries";
import { getMyBodyProfile } from "@/server/body/queries";
import { BodyProvider } from "@/components/body/body-store";
import { getUsdRate } from "@/server/settings/queries";
import { DEFAULT_USD_KRW } from "@/lib/format/price";

/**
 * 로그인 후 화면 공통 레이아웃. 옷 정보 Drawer와 알림은 어느 화면에서든 열리도록 여기에 둔다.
 * proxy가 먼저 튕겨 내지만, 여기서도 서버에서 사용자를 다시 확인한다.
 * 옷 목록은 여기서 한 번 읽어 모든 화면이 함께 쓴다.
 * Supabase 키가 없는 미리보기 배포에서만 로그인 없이 예시 데이터를 보여준다.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const configured = isAuthConfigured();
  const user = configured ? await getCurrentUser() : null;
  // 쿠키는 있는데 사용자를 확인할 수 없으면(정지·삭제된 계정 등) 쿠키를 지우러 간다.
  // "/"로 바로 보내면 proxy가 쿠키만 보고 다시 /wardrobe로 보내서 계속 돈다.
  if (configured && !user) redirect("/auth/signout");
  const email = user?.email ?? null;
  // 업데이트 노트 수정본도 여기서 먼저 읽어, 창을 열자마자 수정본이 나오게 한다(원래 노트가 잠깐 보이지 않게).
  const [admin, releaseNoteEdits, releaseNoteImages] = await Promise.all([user ? isAdmin(user.id) : false, user ? getReleaseNoteEdits() : {}, user ? getReleaseNoteImages() : {}]);

  return (
    // 내용이 짧아도 법적 고지가 화면 맨 아래에 오도록 세로로 채운다.
    <div className="flex min-h-dvh flex-col">
      <OfflineBanner />
      <div className="flex-1">
      {/* 옷 목록을 읽는 동안 머리글과 표 자리(Skeleton)를 먼저 보여 준다. */}
      <Suspense
        fallback={
          <>
            <AppHeader email={email} admin={admin} releaseNoteEdits={releaseNoteEdits} releaseNoteImages={releaseNoteImages} />
            <WardrobeSkeleton />
          </>
        }
      >
        <WardrobeData userId={user?.id ?? null} email={email} admin={admin} releaseNoteEdits={releaseNoteEdits} releaseNoteImages={releaseNoteImages}>
          {children}
        </WardrobeData>
      </Suspense>
      </div>
      {/* 머리글과 같은 좌우 여백으로 PC에서는 화면 왼쪽 끝에 맞춘다. */}
      <SiteFooter className="px-[clamp(16px,3vw,32px)] pt-6 pb-6" />
    </div>
  );
}

async function WardrobeData({
  userId,
  email,
  admin,
  releaseNoteEdits,
  releaseNoteImages,
  children,
}: {
  userId: string | null;
  email: string | null;
  admin: boolean;
  releaseNoteEdits: ReleaseNoteEdits;
  releaseNoteImages: ReleaseNoteImages;
  children: React.ReactNode;
}) {
  const [garments, body, usdRate] = userId
    ? await Promise.all([listMyGarments(), getMyBodyProfile(), getUsdRate()])
    : [MOCK_GARMENTS, null, DEFAULT_USD_KRW];
  return (
    <WardrobeProvider initialGarments={garments} userId={userId} supabaseEnv={userId ? getSupabaseEnv() : null} usdRate={usdRate}>
      {/* 내 치수: 예상 핏을 화면에서 계산하려고 옷 목록과 함께 읽는다. */}
      <BodyProvider initialProfile={body} signedIn={Boolean(userId)}>
        <AppHeader email={email} admin={admin} releaseNoteEdits={releaseNoteEdits} releaseNoteImages={releaseNoteImages} />
        {children}
        {/* 주소의 ?item=을 읽는다 */}
        <Suspense>
          <GarmentDrawer />
        </Suspense>
        <WardrobeToast />
      </BodyProvider>
    </WardrobeProvider>
  );
}
