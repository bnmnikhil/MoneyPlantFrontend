import { useState } from "react";
import { CheckCircle2, Circle, Loader2, Trash2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brokerLabel } from "@/components/BrokerBadge";
import {
  useDeleteBrokerCredential,
  useSaveBrokerCredential,
} from "@/features/credentials/hooks";
import type { BrokerCredential } from "@/types/api";

/** What each broker calls the two values, so the labels match their console. */
const FIELD_NAMES: Record<string, { key: string; secret: string }> = {
  kite: { key: "API key", secret: "API secret" },
  aliceblue: { key: "App code", secret: "API secret" },
  paytm: { key: "API key", secret: "API secret" },
};

/** Where to go and get them. */
const CONSOLES: Record<string, string> = {
  kite: "developers.kite.trade",
  aliceblue: "Alice Blue developer portal",
  paytm: "developer.paytmmoney.com",
};

/** Mirrors the backend's path-segment constraint, so the error arrives before the request. */
const LABEL_PATTERN = /^[A-Za-z0-9 _-]{1,32}$/;

/**
 * One developer-app registration at one broker.
 *
 * A registration is not an account. One registration can authorise several
 * logins at that broker, and each of those becomes its own connection — so most
 * users need exactly one card per broker, and a second only if they genuinely
 * registered a second app.
 *
 * `draft` renders the same card as an unsaved new registration: the label
 * becomes editable, because it is the one field that cannot be changed
 * afterwards without deleting the row.
 */
export function BrokerCredentialCard({
  credential,
  draft = false,
  onCancel,
}: {
  credential: BrokerCredential;
  draft?: boolean;
  onCancel?: () => void;
}) {
  const { brokerId, label, apiKey, configured } = credential;
  const names = FIELD_NAMES[brokerId] ?? { key: "API key", secret: "API secret" };

  const [labelValue, setLabelValue] = useState(draft ? "" : label);
  const [keyValue, setKeyValue] = useState(apiKey ?? "");
  const [secretValue, setSecretValue] = useState("");

  const save = useSaveBrokerCredential();
  const remove = useDeleteBrokerCredential();

  const labelOk = !draft || LABEL_PATTERN.test(labelValue.trim());
  // Both values are always required, even on an update. The secret is never sent
  // back down, so there is nothing to leave unchanged — a form that accepted a
  // blank secret would have to mean "keep the old one", and that is exactly the
  // ambiguity write-only storage exists to avoid.
  const canSave = keyValue.trim() !== "" && secretValue.trim() !== "" && labelOk;

  // Both mutations are shared hook instances, so a spinner has to check the
  // registration and not merely the broker — otherwise saving one row spins
  // every row at that broker.
  const isThis = (v?: { brokerId: string; label: string }) =>
    v?.brokerId === brokerId && v?.label === (draft ? labelValue.trim() : label);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    save.mutate(
      {
        brokerId,
        label: draft ? labelValue.trim() : label,
        apiKey: keyValue.trim(),
        apiSecret: secretValue.trim(),
      },
      {
        onSuccess: () => {
          setSecretValue("");
          onCancel?.();     // a saved draft is now a real row, rendered from the query
        },
      }
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          {brokerLabel(brokerId)}
          {/*
            The name is only worth showing once it distinguishes something. Every
            user starts with a single "default" registration, and labelling it
            would imply a choice they have not made.
          */}
          {!draft && label !== "default" && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
              {label}
            </span>
          )}
          {draft ? (
            <span className="text-xs font-normal text-muted-foreground">
              New registration
            </span>
          ) : configured ? (
            <span className="flex items-center gap-1 text-xs font-normal text-emerald-500">
              <CheckCircle2 className="size-3.5" />
              Stored
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
              <Circle className="size-3.5" />
              Not configured
            </span>
          )}
        </CardTitle>

        {draft ? (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X />
            Cancel
          </Button>
        ) : (
          configured && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => remove.mutate({ brokerId, label })}
              disabled={remove.isPending}
            >
              {remove.isPending && isThis(remove.variables) ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Trash2 />
              )}
              Remove
            </Button>
          )
        )}
      </CardHeader>

      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          {draft && (
            <div className="space-y-1.5">
              <label
                htmlFor={`${brokerId}-label`}
                className="text-sm font-medium text-foreground"
              >
                Name this registration
              </label>
              <Input
                id={`${brokerId}-label`}
                value={labelValue}
                onChange={(e) => setLabelValue(e.target.value)}
                placeholder="Personal, HUF, Family…"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">
                {labelValue.trim() !== "" && !labelOk
                  ? "Letters, digits, spaces, hyphens and underscores only, up to 32 characters."
                  : "Only you see this. It tells your registrations apart — it is not the account name."}
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor={`${brokerId}-${label}-key`}
                className="text-sm font-medium text-foreground"
              >
                {names.key}
              </label>
              <Input
                id={`${brokerId}-${label}-key`}
                value={keyValue}
                onChange={(e) => setKeyValue(e.target.value)}
                placeholder={`From ${CONSOLES[brokerId] ?? "the broker's console"}`}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor={`${brokerId}-${label}-secret`}
                className="text-sm font-medium text-foreground"
              >
                {names.secret}
              </label>
              <Input
                id={`${brokerId}-${label}-secret`}
                type="password"
                value={secretValue}
                onChange={(e) => setSecretValue(e.target.value)}
                // Empty rather than a row of dots. A masked value would imply
                // the stored secret can be revealed; it cannot, by design.
                placeholder={configured ? "Stored — enter it again to replace" : ""}
                autoComplete="new-password"
                spellCheck={false}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={!canSave || save.isPending}>
              {save.isPending && isThis(save.variables) && (
                <Loader2 className="animate-spin" />
              )}
              {draft ? "Add" : configured ? "Replace" : "Save"}
            </Button>

            {save.isError && isThis(save.variables) && (
              <p className="text-sm text-destructive">
                Couldn&apos;t save those. Please check both values and try again.
              </p>
            )}
            {remove.isError && isThis(remove.variables) && (
              <p className="text-sm text-destructive">Couldn&apos;t remove that one.</p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
