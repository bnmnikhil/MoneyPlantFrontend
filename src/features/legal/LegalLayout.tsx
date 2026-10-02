import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { Logo } from "@/components/Logo";
import { LegalFooter } from "@/features/legal/LegalFooter";
import { legalDetails, unfilledLegalDetails } from "@/features/legal/details";

export type LegalSection = { id: string; title: string; body: ReactNode };

/**
 * Public page shell for the privacy policy and terms. Reachable signed in or
 * out, so it carries its own header rather than living inside AppShell.
 */
export function LegalLayout({
  title,
  summary,
  sections,
}: {
  title: string;
  summary: ReactNode;
  sections: LegalSection[];
}) {
  const unfilled = unfilledLegalDetails();

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-5 sm:px-6">
        <Link to="/" aria-label="GoldenBook home">
          <Logo />
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Home
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 sm:px-6">
        {unfilled.length > 0 && (
          <div
            role="note"
            className="mb-6 flex gap-2 rounded-md border border-orange-500/40 bg-orange-500/10 px-3 py-2 text-sm text-orange-200"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              Draft: operator details are not filled in yet ({unfilled.join(", ")}).
              This document is not in force.
            </span>
          </div>
        )}

        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Effective {legalDetails.effectiveDate} · version {legalDetails.termsVersion}
        </p>
        <div className="mt-6 rounded-lg border border-border bg-card/50 p-4 text-sm leading-relaxed text-muted-foreground">
          {summary}
        </div>

        <nav aria-label="Contents" className="mt-8">
          <ol className="grid gap-1 text-sm sm:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-muted-foreground hover:text-foreground">
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 space-y-10">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-6">
              <h2 className="text-lg font-semibold tracking-tight">
                {i + 1}. {s.title}
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2 [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:space-y-1.5">
                {s.body}
              </div>
            </section>
          ))}
        </div>
      </main>

      <LegalFooter className="mx-auto w-full max-w-3xl px-4 sm:px-6" />
    </div>
  );
}
