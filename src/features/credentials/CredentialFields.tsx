import { ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { credentialFields } from "@/features/brokers/catalog";
import type { BrokerDefinition } from "@/types/api";

/**
 * The inputs one broker's registration needs, rendered from the catalogue.
 *
 * Shared by the Add panel and the inline Replace form so the two cannot drift.
 * Nothing here knows the name of a single field: `label`, `secret` and
 * `required` all come from `BrokerDefinition.credentialFields`, which is why
 * Alice Blue's first box says "App code" and Kite's says "API key" without a
 * broker-id switch anywhere.
 */
export function CredentialFields({
  definition,
  idPrefix,
  values,
  onChange,
  storedKeys = [],
}: {
  definition: BrokerDefinition;
  /** Unique per rendered form — two forms can be open at once. */
  idPrefix: string;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  /** Field keys that already hold a saved secret, so the box can say so. */
  storedKeys?: string[];
}) {
  const fields = credentialFields(definition);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((field) => {
        const id = `${idPrefix}-${field.key}`;
        const stored = storedKeys.includes(field.key);

        return (
          <div key={field.key} className="space-y-1.5">
            <label htmlFor={id} className="text-sm font-medium text-foreground">
              {field.label}
            </label>
            <Input
              id={id}
              type={field.secret ? "password" : "text"}
              value={values[field.key] ?? ""}
              onChange={(e) => onChange(field.key, e.target.value)}
              // Empty rather than a row of dots. A masked value would imply the
              // stored secret can be revealed; it cannot, by design.
              placeholder={
                field.secret
                  ? stored
                    ? "Stored — enter it again to replace"
                    : ""
                  : `From ${definition.displayName}`
              }
              autoComplete={field.secret ? "new-password" : "off"}
              spellCheck={false}
            />
          </div>
        );
      })}
    </div>
  );
}

/** Where to get the values above. Same link wherever the fields are rendered. */
export function DeveloperPortalLink({ definition }: { definition: BrokerDefinition }) {
  return (
    <a
      href={definition.developerConsoleUrl}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-xs text-primary underline-offset-4 hover:underline"
    >
      Open {definition.displayName} developer portal
      <ExternalLink className="size-3" />
    </a>
  );
}
