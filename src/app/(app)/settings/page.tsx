import { SettingsView } from "@/components/settings/settings-view";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata = { title: "계정 설정 · Wardrobe Fit" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  return <SettingsView email={user?.email ?? null} createdAt={user?.created_at ?? null} />;
}
