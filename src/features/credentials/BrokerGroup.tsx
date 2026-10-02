import { ExternalLink } from "lucide-react";
import { BrokerMark } from "@/features/brokers/BrokerMark";
import { RegistrationRow } from "@/features/credentials/RegistrationRow";
import type { BrokerGroupModel } from "@/features/credentials/model";

/** The bare host of a developer-portal URL, which is all the row needs to show. */
function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * One broker and the registrations stored under it.
 *
 * The header exists to give the broker a weight of its own. Before this the
 * page rendered broker, registration and account inside identically-styled
 * cards, so nothing in the layout said a registration belongs *to* a broker —
 * which is what made a short page read as a wall of boxes.
 */
export function BrokerGroup({ group }: { group: BrokerGroupModel }) {
  const { definition, registrations } = group;

  return (
    <section
      aria-label={definition.displayName}
      className="overflow-hidden rounded-lg border border-border bg-card"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-secondary/30 px-4 py-3">
        <BrokerMark brokerId={definition.id} displayName={definition.displayName} />
        <h2 className="text-sm font-semibold">{definition.displayName}</h2>
        {registrations.length > 1 && (
          <span className="text-xs text-muted-foreground">
            {registrations.length} registrations
          </span>
        )}
        <a
          href={definition.developerConsoleUrl}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {hostOf(definition.developerConsoleUrl)}
          <ExternalLink className="size-3" />
        </a>
      </div>

      {registrations.map((credential) => (
        <RegistrationRow
          key={`${credential.brokerId}:${credential.label}`}
          credential={credential}
          definition={definition}
        />
      ))}
    </section>
  );
}
