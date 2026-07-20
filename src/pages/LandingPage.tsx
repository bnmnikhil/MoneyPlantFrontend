import { Link } from "react-router-dom";
import {
  ArrowRight,
  Activity,
  Send,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

const features: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Activity,
    title: "Live Greeks & IV analytics",
    body: "Track delta, theta and implied volatility across your open option positions in real time.",
  },
  {
    icon: Send,
    title: "Telegram alerts",
    body: "Get pushed the moment a position breaches your risk thresholds — no need to stare at screens.",
  },
  {
    icon: ShieldCheck,
    title: "Risk-guarded execution",
    body: "Every order passes margin and exposure checks before it reaches the exchange.",
  },
];

export function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* subtle top glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,hsl(var(--primary)/0.12),transparent_70%)]"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <Button asChild variant="ghost" size="sm">
          <Link to="/login">Sign in</Link>
        </Button>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-6">
        {/* Hero */}
        <section className="flex flex-col items-center gap-6 pt-20 text-center sm:pt-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            NSE F&amp;O · Zerodha Kite
          </span>
          <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            MoneyPlant
          </h1>
          <p className="max-w-xl text-balance text-lg text-muted-foreground text-pretty">
            Systematic options selling with risk control — a private terminal for
            monitoring positions, Greeks and margins, with guardrails on every
            trade.
          </p>
          <Button asChild size="lg" className="mt-2">
            <Link to="/login">
              Sign in
              <ArrowRight />
            </Link>
          </Button>
        </section>

        {/* Feature cards */}
        <section className="mt-20 grid gap-4 sm:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-xl border border-border bg-card/50 p-6"
            >
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/12 text-primary ring-1 ring-inset ring-primary/25 [&_svg]:size-5">
                <Icon />
              </span>
              <h3 className="mt-4 text-sm font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
                {body}
              </p>
            </div>
          ))}
        </section>
      </main>

      <footer className="relative z-10 mx-auto mt-24 flex w-full max-w-6xl items-center justify-between border-t border-border px-6 py-6 text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} MoneyPlant</span>
        <span>Private system</span>
      </footer>
    </div>
  );
}
