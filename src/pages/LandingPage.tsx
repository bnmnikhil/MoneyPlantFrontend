import { Link } from "react-router-dom";
import {
  ArrowRight,
  Gauge,
  KeyRound,
  Layers,
  Lock,
  ShieldCheck,
  TrendingUp,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { LegalFooter } from "@/features/legal/LegalFooter";

/*
 * Every line on this page is a claim a stranger will hold us to, and the terms
 * of use promise read-only and not-advice. Describe only what ships; when a
 * feature is added or removed, this copy changes in the same PR.
 */

const features: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Layers,
    title: "Every broker, one screen",
    body: "Positions, holdings and margins from Zerodha Kite, Alice Blue and Paytm Money, account by account — with P&L since entry and today's move side by side.",
  },
  {
    icon: TrendingUp,
    title: "Payoff of what you actually hold",
    body: "Expiry payoff charts built from your live positions, per account and underlying: breakevens, maximum profit and loss, optionally with the shares you own.",
  },
  {
    icon: Gauge,
    title: "Margin and risk, explained",
    body: "A bottom-up SPAN-and-exposure estimate for each position, shown beside your broker's actual bill, plus exposure grouped by expiry.",
  },
  {
    icon: Wrench,
    title: "Strategy Builder",
    body: "Try adjustments before you trade: start from your positions or a template, edit legs and see the new payoff. Live premiums need an Alice Blue connection.",
  },
];

const steps: { title: string; body: string }[] = [
  {
    title: "Sign in with Google",
    body: "No new password. Your Google account is only used to identify you.",
  },
  {
    title: "Create your own API app at each broker",
    body: "GoldenBook has no shared broker app — each user registers their own. Kite Connect's personal tier is free; Alice Blue's team must activate the app; Paytm Money asks for your password and OTP at every login.",
  },
  {
    title: "Paste the key and secret, then connect",
    body: "Do it once per app in Settings. Broker logins expire daily, so you reconnect each trading day.",
  },
];

const limits = [
  "Figures are estimates. The margin estimate usually runs below your broker's bill; your broker is the source of truth.",
  "Payoff charts mixing several expiries are a single simplified scenario, and are labelled as such.",
  "No Greeks, implied-volatility history or alerts yet.",
];

export function LandingPage() {
  return (
    <div className="relative flex min-h-svh flex-col bg-background">
      {/* subtle top glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,hsl(var(--primary)/0.12),transparent_70%)]"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <Button asChild variant="ghost" size="sm">
          <Link to="/login">Sign in</Link>
        </Button>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 sm:px-6">
        {/* Hero */}
        <section className="flex flex-col items-center gap-6 pt-16 text-center sm:pt-24">
          <span className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            NSE F&amp;O · Zerodha Kite · Alice Blue · Paytm Money
          </span>
          <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            All your F&amp;O positions, on one screen
          </h1>
          <p className="max-w-2xl text-balance text-lg text-muted-foreground">
            GoldenBook brings your positions, holdings and margins from every
            broker together, and charts the payoff of what you actually hold.
            It is read-only: it never places an order.
          </p>
          <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link to="/login">
                Sign in with Google
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <a href="#setup">What setup involves</a>
            </Button>
          </div>
        </section>

        {/*
         * Product preview. Captured from the real app against broker-sim, never
         * from a user's book; retake it when the payoff page changes visibly.
         */}
        <figure className="relative mt-14 sm:mt-16">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-[10%] -top-8 bottom-1/3 rounded-full bg-primary/15 blur-3xl"
          />
          <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/50">
            <div aria-hidden className="flex items-center gap-1.5 border-b border-border px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
              <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
              <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
            </div>
            {/* Phones get the app's own narrow layout, cropped to the figures and the chart, so the numbers stay legible. */}
            <picture>
              <source media="(max-width: 639px)" srcSet="/landing/payoff-phone.webp" width={1336} height={1708} />
              <img
                src="/landing/payoff.webp"
                width={2400}
                height={1500}
                decoding="async"
                alt="GoldenBook's payoff page for a BANKNIFTY iron condor: spot, maximum profit and loss, two breakevens and the expiry payoff chart."
                className="block h-auto w-full"
              />
            </picture>
          </div>
          <figcaption className="mt-3 text-center text-xs text-muted-foreground">
            Simulated account and prices. The expiry payoff of an iron condor held in one account.
          </figcaption>
        </figure>

        {/* Features */}
        <section aria-labelledby="features" className="mt-20">
          <h2 id="features" className="sr-only">
            What GoldenBook does
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {features.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-xl border border-border bg-card/50 p-6">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/12 text-primary ring-1 ring-inset ring-primary/25 [&_svg]:size-5">
                  <Icon />
                </span>
                <h3 className="mt-4 text-sm font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground text-pretty">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Read-only by design */}
        <section aria-labelledby="safety" className="mt-20 grid gap-8 lg:grid-cols-[1fr_1.4fr] lg:items-start">
          <div>
            <h2 id="safety" className="text-2xl font-semibold tracking-tight">
              Read-only, by design
            </h2>
            <p className="mt-2 text-sm text-muted-foreground text-pretty">
              GoldenBook looks at your accounts. It cannot act on them.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-3">
            <li className="rounded-xl border border-border bg-card/50 p-5">
              <ShieldCheck className="size-5 text-primary" />
              <p className="mt-3 text-sm font-semibold">No orders, no money movement</p>
              <p className="mt-1 text-sm text-muted-foreground">There is no code in GoldenBook that places, modifies or cancels an order.</p>
            </li>
            <li className="rounded-xl border border-border bg-card/50 p-5">
              <Lock className="size-5 text-primary" />
              <p className="mt-3 text-sm font-semibold">Secrets encrypted</p>
              <p className="mt-1 text-sm text-muted-foreground">API secrets and broker tokens are sealed with AES-256-GCM, under a key kept outside the database.</p>
            </li>
            <li className="rounded-xl border border-border bg-card/50 p-5">
              <KeyRound className="size-5 text-primary" />
              <p className="mt-3 text-sm font-semibold">Yours alone</p>
              <p className="mt-1 text-sm text-muted-foreground">Only you see your data. Delete your credentials whenever you like.</p>
            </li>
          </ul>
        </section>

        {/* Setup */}
        <section id="setup" aria-labelledby="setup-title" className="mt-20 scroll-mt-6">
          <h2 id="setup-title" className="text-2xl font-semibold tracking-tight">
            What setup involves
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground text-pretty">
            A one-time job per broker, done mostly on the broker's own developer
            site. Alice Blue's activation can take a while, so start there.
          </p>
          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="rounded-xl border border-border bg-card/50 p-5">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/12 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/25">
                  {i + 1}
                </span>
                <p className="mt-3 text-sm font-semibold">{s.title}</p>
                <p className="mt-1 text-sm text-muted-foreground text-pretty">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Honest limits */}
        <section aria-labelledby="limits" className="mt-20 rounded-xl border border-border bg-card/30 p-6">
          <h2 id="limits" className="text-sm font-semibold">
            Good to know
          </h2>
          <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            {limits.map((l) => (
              <li key={l} className="ml-5 list-disc text-pretty">
                {l}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-20 flex flex-col items-center gap-4 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">See your whole book at a glance</h2>
          <Button asChild size="lg">
            <Link to="/login">
              Sign in with Google
              <ArrowRight />
            </Link>
          </Button>
        </section>
      </main>

      <LegalFooter className="relative z-10 mx-auto mt-24 w-full max-w-6xl px-4 sm:px-6" />
    </div>
  );
}
