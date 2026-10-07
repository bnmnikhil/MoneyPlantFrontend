import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Topbar } from "@/components/layout/Topbar";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { BrokerSessionBanner } from "@/features/session/BrokerSessionBanner";
import { useBrokerDefinitions } from "@/features/brokers/hooks";
import { BuilderHostContext } from "@/features/strategy-builder/builderHost";
import { BuilderPage } from "@/pages/BuilderPage";
import type { PayoffResponse } from "@/types/api";
import {
  BROKER_SESSION_LOST_EVENT,
  type BrokerSessionLostDetail,
} from "@/lib/api";

export function AppShell() {
  // Installs backend-owned broker labels for every authenticated feature. A
  // failed metadata request does not blank portfolio data; labels fall back to
  // the broker id and Settings exposes the load failure explicitly.
  useBrokerDefinitions();
  const [sessionLost, setSessionLost] = useState<BrokerSessionLostDetail | null>(
    null
  );

  // The strategy builder is its own page, but it stays mounted once opened so
  // draft trades survive moving between pages (it used to live inside Payoff
  // for the same reason). It is not mounted at all until first visited.
  const location = useLocation();
  const navigate = useNavigate();
  const onBuilder = location.pathname === "/app/builder";
  const [builderMounted, setBuilderMounted] = useState(onBuilder);
  const [builderPrefill, setBuilderPrefill] = useState<PayoffResponse | null>(null);
  useEffect(() => { if (onBuilder) setBuilderMounted(true); }, [onBuilder]);
  const openInBuilder = useCallback((baseline: PayoffResponse) => {
    setBuilderPrefill(baseline);
    setBuilderMounted(true);
    navigate("/app/builder");
  }, [navigate]);
  const builderHost = useMemo(() => ({ openInBuilder }), [openInBuilder]);

  // Pages that fit the window (.page-fit) size themselves from where the page
  // content actually starts: the staging banner, the header (which can wrap) and
  // the main area's padding all vary, so this is measured, not assumed.
  const mainRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const update = () => {
      const style = getComputedStyle(main);
      const top = main.getBoundingClientRect().top + window.scrollY + parseFloat(style.paddingTop);
      main.style.setProperty("--fit-top", `${Math.round(top)}px`);
      main.style.setProperty("--fit-bottom", style.paddingBottom);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    window.addEventListener("resize", update);
    return () => { observer.disconnect(); window.removeEventListener("resize", update); };
  }, []);

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

        <main ref={mainRef} id="main-content" tabIndex={-1} className="flex-1 px-4 pb-24 pt-4 outline-none sm:px-6 lg:px-7 lg:pb-7">
          <div className="mx-auto w-full space-y-4">
            {sessionLost && (
              <BrokerSessionBanner
                brokerId={sessionLost.brokerId}
                code={sessionLost.code}
              />
            )}
            <BuilderHostContext.Provider value={builderHost}>
              <Outlet />
              {builderMounted && <div hidden={!onBuilder}>
                <BuilderPage prefill={builderPrefill} active={onBuilder} />
              </div>}
            </BuilderHostContext.Provider>
          </div>
        </main>
      </div>

      <MobileTabBar />
    </div>
  );
}
