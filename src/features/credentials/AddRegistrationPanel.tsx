import { useMemo, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BrokerMark } from "@/features/brokers/BrokerMark";
import { CredentialFields, DeveloperPortalLink } from "@/features/credentials/CredentialFields";
import { useSaveBrokerCredential } from "@/features/credentials/hooks";
import {
  DEFAULT_LABEL,
  addableBrokers,
  isComplete,
  labelProblem,
  labelsFor,
  toCredentialInput,
} from "@/features/credentials/model";
import type { BrokerCredential, BrokerDefinition } from "@/types/api";

/**
 * The one way to add a broker registration.
 *
 * It replaces two controls that used to do this job differently: a header menu
 * that spawned a draft card halfway down the page, and a per-broker "Add
 * another registration" button that was routinely misread as "add another
 * trading account". Making the broker a *field* rather than a menu collapses
 * both into one form — and a broker the user already has stays in the list,
 * because a second registration there is the same act as a first one elsewhere.
 *
 * Inline rather than a dialog on purpose: the one case that needs surrounding
 * context is naming a second registration, and that is exactly the case where
 * the names already in use should stay on screen.
 */
export function AddRegistrationPanel({
  definitions,
  credentials,
  preselectedBrokerId,
  onClose,
}: {
  definitions: BrokerDefinition[];
  credentials: BrokerCredential[];
  preselectedBrokerId?: string;
  onClose: () => void;
}) {
  const options = useMemo(() => addableBrokers(definitions), [definitions]);

  const [brokerId, setBrokerId] = useState(preselectedBrokerId ?? "");
  const [labelValue, setLabelValue] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  const save = useSaveBrokerCredential();
  const definition = options.find((option) => option.id === brokerId);

  const existingLabels = brokerId ? labelsFor(credentials, brokerId) : [];
  const needsName = existingLabels.length > 0;
  const nameProblem = needsName ? labelProblem(labelValue, existingLabels) : null;
  const label = needsName ? labelValue.trim() : DEFAULT_LABEL;

  const canSave =
    definition !== undefined && nameProblem === null && isComplete(definition, values);

  // The save hook is shared with every row on the page, so a spinner has to
  // check which registration is in flight rather than merely that one is.
  const saving =
    save.isPending &&
    save.variables?.brokerId === brokerId &&
    save.variables?.label === label;
  const failed =
    save.isError &&
    save.variables?.brokerId === brokerId &&
    save.variables?.label === label;

  function chooseBroker(next: string) {
    setBrokerId(next);
    // Values are per broker: a half-typed Kite key must not survive into an
    // Alice Blue form, where the same box means something else.
    setValues({});
    setLabelValue("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave || !definition) return;
    save.mutate(
      { brokerId: definition.id, label, ...toCredentialInput(values) },
      { onSuccess: onClose }
    );
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Add a broker registration"
      className="overflow-hidden rounded-lg border border-primary/35 bg-gradient-to-b from-primary/[0.07] to-card shadow-lg shadow-black/20"
    >
      <div className="flex items-center justify-between gap-3 border-b border-primary/25 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Plus className="size-4 text-primary" />
          Add a broker registration
        </h3>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          <X />
          Cancel
        </Button>
      </div>

      <div className="grid gap-4 p-4">
        <div className="space-y-1.5">
          <label htmlFor="add-registration-broker" className="text-sm font-medium text-foreground">
            Broker
          </label>
          <Select value={brokerId} onValueChange={chooseBroker}>
            <SelectTrigger id="add-registration-broker" className="sm:max-w-sm">
              <SelectValue placeholder="Choose a broker…" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => {
                const count = labelsFor(credentials, option.id).length;
                return (
                  <SelectItem
                    key={option.id}
                    value={option.id}
                    meta={
                      count === 0
                        ? "Not set up"
                        : count === 1
                          ? "1 registration"
                          : `${count} registrations`
                    }
                  >
                    <BrokerMark brokerId={option.id} displayName={option.displayName} size="sm" />
                    <span className="truncate">{option.displayName}</span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {!definition && (
            <p className="text-xs text-muted-foreground">
              Brokers you already use stay in the list — picking one adds a second developer
              app, not a second trading account.
            </p>
          )}
        </div>

        {definition && needsName && (
          <div className="space-y-1.5">
            <label
              htmlFor="add-registration-label"
              className="text-sm font-medium text-foreground"
            >
              Name this registration
            </label>
            <Input
              id="add-registration-label"
              value={labelValue}
              onChange={(e) => setLabelValue(e.target.value)}
              placeholder="Personal, HUF, Family…"
              autoComplete="off"
              spellCheck={false}
              className="sm:max-w-sm"
            />
            <p className="text-xs text-muted-foreground">
              {nameProblem === "taken"
                ? `${definition.displayName} already has a registration called “${labelValue.trim()}”.`
                : nameProblem === "invalid"
                  ? "Letters, digits, spaces, hyphens and underscores only, up to 32 characters."
                  : `${definition.displayName} already has ${existingLabels.map((l) => `“${l}”`).join(", ")}. A name keeps them apart — only you see it, and it is not the account name.`}
            </p>
          </div>
        )}

        {definition && (
          <CredentialFields
            definition={definition}
            idPrefix="add-registration"
            values={values}
            onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/40 px-4 py-3">
        {definition ? (
          <DeveloperPortalLink definition={definition} />
        ) : (
          <p className="text-xs text-muted-foreground">
            Pick a broker to see the fields it needs.
          </p>
        )}

        <div className="flex items-center gap-3">
          {failed && (
            <p className="text-sm text-destructive">
              Couldn&apos;t save those. Please check the values and try again.
            </p>
          )}
          <Button type="submit" disabled={!canSave || saving}>
            {saving && <Loader2 className="animate-spin" />}
            Save registration
          </Button>
        </div>
      </div>
    </form>
  );
}
