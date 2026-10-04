import { Route, Routes } from "react-router-dom";
import { AuthGuard } from "@/features/session/AuthGuard";
import { AppShell } from "@/components/layout/AppShell";
import { LandingPage } from "@/pages/LandingPage";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { PositionsPage } from "@/pages/PositionsPage";
import { HoldingsPage } from "@/pages/HoldingsPage";
import { PayoffPage } from "@/pages/PayoffPage";
import { RiskPage } from "@/pages/RiskPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PrivacyPage } from "@/pages/PrivacyPage";
import { TermsPage } from "@/pages/TermsPage";
import { StagingBanner } from "@/components/layout/StagingBanner";
import { isStagingEnvironment } from "@/lib/environment";

export default function App() {
  return (
    <>
      {isStagingEnvironment(import.meta.env.VITE_ENVIRONMENT) && <StagingBanner />}
      <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />

      {/* Authenticated shell */}
      <Route element={<AuthGuard />}>
        <Route element={<AppShell />}>
          <Route path="/app" element={<DashboardPage />} />
          <Route path="/app/positions" element={<PositionsPage />} />
          <Route path="/app/holdings" element={<HoldingsPage />} />
          <Route path="/app/payoff" element={<PayoffPage />} />
          <Route path="/app/risk" element={<RiskPage />} />
          <Route path="/app/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
