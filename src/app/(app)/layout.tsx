import { AppHeader } from "@/components/layout/app-header";
import { GarmentDrawer } from "@/components/wardrobe/garment-drawer";
import { WardrobeProvider, WardrobeToast } from "@/components/wardrobe/wardrobe-store";

/**
 * 로그인 후 화면 공통 레이아웃. 옷 정보 Drawer와 알림은 어느 화면에서든 열리도록 여기에 둔다.
 * 3단계에서 인증 확인을 추가한다.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <WardrobeProvider>
      <AppHeader />
      {children}
      <GarmentDrawer />
      <WardrobeToast />
    </WardrobeProvider>
  );
}
