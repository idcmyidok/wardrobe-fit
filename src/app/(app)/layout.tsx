import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OfflineBanner } from "@/components/feedback/offline-banner";
import { WardrobeSkeleton } from "@/components/feedback/wardrobe-skeleton";
import { AppHeader } from "@/components/layout/app-header";
import { GarmentDrawer } from "@/components/wardrobe/garment-drawer";
import { WardrobeProvider, WardrobeToast } from "@/components/wardrobe/wardrobe-store";
import { MOCK_GARMENTS } from "@/lib/mock/garments";
import { isAuthConfigured } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";
import { listMyGarments } from "@/server/garments/queries";

/**
 * 로그인 후 화면 공통 레이아웃. 옷 정보 Drawer와 알림은 어느 화면에서든 열리도록 여기에 둔다.
 * proxy가 먼저 튕겨 내지만, 여기서도 서버에서 사용자를 다시 확인한다.
 * 옷 목록은 여기서 한 번 읽어 모든 화면이 함께 쓴다.
 * Supabase 키가 없는 미리보기 배포에서만 로그인 없이 예시 데이터를 보여준다.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const configured = isAuthConfigured();
  const user = configured ? await getCurrentUser() : null;
  if (configured && !user) redirect("/");
  const email = user?.email ?? null;

  return (
    <>
      <OfflineBanner />
      {/* 옷 목록을 읽는 동안 머리글과 표 자리(Skeleton)를 먼저 보여 준다. */}
      <Suspense
        fallback={
          <>
            <AppHeader email={email} />
            <WardrobeSkeleton />
          </>
        }
      >
        <WardrobeData userId={user?.id ?? null} email={email}>
          {children}
        </WardrobeData>
      </Suspense>
    </>
  );
}

async function WardrobeData({ userId, email, children }: { userId: string | null; email: string | null; children: React.ReactNode }) {
  const garments = userId ? await listMyGarments() : MOCK_GARMENTS;
  return (
    <WardrobeProvider initialGarments={garments} userId={userId}>
      <AppHeader email={email} />
      {children}
      {/* 주소의 ?item=을 읽는다 */}
      <Suspense>
        <GarmentDrawer />
      </Suspense>
      <WardrobeToast />
    </WardrobeProvider>
  );
}
