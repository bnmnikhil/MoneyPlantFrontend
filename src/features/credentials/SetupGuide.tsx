import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Copy, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeveloperPortalLink } from "@/features/credentials/CredentialFields";
import type { BrokerDefinition } from "@/types/api";

/**
 * How to get this broker's key and secret, shown once the broker is chosen (N14).
 *
 * Every user registers their own developer app at each broker, and nobody walks
 * them through it, so this is the whole of the onboarding for that step. The text
 * comes from the backend catalogue; nothing here names a broker.
 *
 * Order matters: the notes come first so a cost or a wait is seen before step 1,
 * not discovered at the end. The redirect URL sits under the steps rather than in
 * them, because it differs per host (production, staging, a laptop).
 */
export function SetupGuide({
  definition,
  defaultOpen,
}: {
  definition: BrokerDefinition;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  const setup = definition.setup;
  if (!setup) return null;

  return (
    <section
      aria-label={`How to get these from ${definition.displayName}`}
      className="rounded-md border border-border bg-background/40"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2 text-left"
      >
        <span className="flex min-w-0 flex-wrap items-center gap-x-2">
          {open ? (
            <ChevronDown className="size-4 shrink-0 text-primary" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-primary" />
          )}
          <span className="text-sm font-semibold">
            How to get these from {definition.displayName}
          </span>
          {!open && (
            <span className="text-xs text-muted-foreground">
              {setup.steps.length} steps{definition.redirectUrl ? " · redirect URL" : ""}
            </span>
          )}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div id={contentId} className="space-y-4 border-t border-border p-4">
          {setup.notes.length > 0 && (
            <div className="space-y-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Before you start
              </p>
              <ul className="space-y-1">
                {setup.notes.map((note) => (
                  <li key={note} className="flex gap-2 text-sm">
                    <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ol className="space-y-2.5">
            {setup.steps.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <span className="min-w-0 pt-0.5">
                  {step}
                  {index === 0 && (
                    <span className="mt-1 block">
                      <DeveloperPortalLink definition={definition} />
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>

          {definition.redirectUrl && (
            <RedirectUrl url={definition.redirectUrl} brokerName={definition.displayName} />
          )}
        </div>
      )}
    </section>
  );
}

function RedirectUrl({ url, brokerName }: { url: string; brokerName: string }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // No clipboard access (an insecure origin, or a refused permission): select
      // the text so a manual copy is one keystroke.
      input.current?.select();
    }
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        Redirect URL: paste this at {brokerName}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          ref={input}
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 font-mono text-sm"
        />
        <Button type="button" variant="outline" onClick={copy} className="h-10 shrink-0">
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">It must match exactly.</p>
    </div>
  );
}
