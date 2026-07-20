import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { ConnectKiteBanner } from "@/features/session/ConnectKiteBanner";

const COLLAPSE_KEY = "moneyplant:sidebar-collapsed";

export function AppShell() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === "1"
  );
  const [kiteExpired, setKiteExpired] = useState(false);

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  // Surface the Connect Kite banner whenever any /api call reports an expired
  // broker session (dispatched from the global fetch wrapper).
  useEffect(() => {
    const onExpired = () => setKiteExpired(true);
    window.addEventListener("moneyplant:kite-expired", onExpired);
    return () => window.removeEventListener("moneyplant:kite-expired", onExpired);
  }, []);

  return (
    <div className="flex min-h-svh bg-background">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />

        <main className="flex-1 px-4 pb-24 pt-6 sm:px-6 md:pb-8 lg:px-8">
          <div className="mx-auto w-full max-w-6xl space-y-6">
            {kiteExpired && <ConnectKiteBanner />}
            <Outlet />
          </div>
        </main>
      </div>

      <MobileTabBar />
    </div>
  );
}
