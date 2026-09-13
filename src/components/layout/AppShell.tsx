import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Topbar } from "@/components/layout/Topbar";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { BrokerSessionBanner } from "@/features/session/BrokerSessionBanner";
import {
  BROKER_SESSION_LOST_EVENT,
  type BrokerSessionLostDetail,
} from "@/lib/api";

export function AppShell() {
  const [sessionLost, setSessionLost] = useState<BrokerSessionLostDetail | null>(
    null
  );

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
    <div className="app-workspace flex min-h-svh bg-background">
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />

        <main id="main-content" tabIndex={-1} className="flex-1 px-4 pb-24 pt-4 outline-none sm:px-6 lg:px-7 lg:pb-7">
          <div className="mx-auto w-full space-y-4">
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
