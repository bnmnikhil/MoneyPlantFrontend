import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { BrokerSessionBanner } from "@/features/session/BrokerSessionBanner";
import {
  BROKER_SESSION_LOST_EVENT,
  type BrokerSessionLostDetail,
} from "@/lib/api";

const COLLAPSE_KEY = "moneyplant:sidebar-collapsed";

export function AppShell() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === "1"
  );
  const [sessionLost, setSessionLost] = useState<BrokerSessionLostDetail | null>(
    null
  );

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  // Surface the banner whenever any /api call reports a broker that needs
  // authorising. Carries the brokerId so the banner names the right one.
  useEffect(() => {
    const onLost = (e: Event) => {
      setSessionLost((e as CustomEvent<BrokerSessionLostDetail>).detail);
    };
    window.addEventListener(BROKER_SESSION_LOST_EVENT, onLost);
    return () => window.removeEventListener(BROKER_SESSION_LOST_EVENT, onLost);
  }, []);

  return (
    <div className="flex min-h-svh bg-background">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />

        <main className="flex-1 px-4 pb-24 pt-6 sm:px-6 md:pb-8 lg:px-8">
          <div className="mx-auto w-full max-w-6xl space-y-6">
            {sessionLost && (
              <BrokerSessionBanner
                brokerId={sessionLost.brokerId}
                code={sessionLost.code}
              />
            )}
            <Outlet />
          </div>
        </main>
      </div>

      <MobileTabBar />
    </div>
  );
}
