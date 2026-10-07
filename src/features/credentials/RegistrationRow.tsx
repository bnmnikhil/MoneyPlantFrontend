import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Link2, Loader2, Pencil, Trash2, Unlink, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CredentialFields, DeveloperPortalLink } from "@/features/credentials/CredentialFields";
import {
  useDeleteBrokerCredential,
  useSaveBrokerCredential,
} from "@/features/credentials/hooks";
import { accountsFor, isComplete, toCredentialInput } from "@/features/credentials/model";
import { useBrokerStatus, useConnectBroker, useDisconnectBroker } from "@/features/session/hooks";
import type { BrokerCredential, BrokerDefinition } from "@/types/api";

/** The last four characters of a key, enough to tell two registrations apart. */
function keyHint(apiKey: string | null) {
  if (!apiKey) return null;
  return apiKey.length <= 4 ? apiKey : `····${apiKey.slice(-4)}`;
}

/**
 * Disconnects one account (C5). Two clicks: the first turns the icon into a "Disconnect?"
 * confirmation that lapses after a few seconds, because reconnecting some brokers (Paytm's
 * password and OTP) is real effort and a stray click should not cost that.
 */
function DisconnectButton({ connectionId, accountLabel }: { connectionId: string; accountLabel: string }) {
  const disconnect = useDisconnectBroker();
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(timer);
  }, [armed]);

  if (disconnect.isPending) {
    return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" />Disconnecting…</span>;
  }
  return <>
    <button
      type="button"
      onClick={() => (armed ? disconnect.mutate(connectionId) : setArmed(true))}
      className={armed
        ? "rounded border border-loss/50 px-2 py-0.5 text-xs font-medium text-loss hover:bg-loss/10"
        : "grid size-6 place-items-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"}
      aria-label={armed ? `Confirm: disconnect ${accountLabel}` : `Disconnect ${accountLabel}`}
      title={armed ? undefined : "Disconnect this account"}
    >
      {armed ? "Disconnect?" : <Unlink className="size-3.5" />}
    </button>
    {disconnect.isError && <span role="status" className="text-xs text-loss">Couldn't disconnect. Try again.</span>}
  </>;
}

/**
 * One saved registration: what it is, which accounts it authorised, what you
 * can do to it.
 *
 * A row rather than a card, because a registration is not a peer of the broker
 * above it. Editing expands in place instead of switching the row into a
 * different object.
 */
export function RegistrationRow({
  credential,
  definition,
}: {
  credential: BrokerCredential;
  definition: BrokerDefinition;
}) {
  const { brokerId, label, apiKey, clientId } = credential;
  const { connections } = useBrokerStatus();
  const accounts = accountsFor(connections, brokerId, label);

  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  const save = useSaveBrokerCredential();
  const remove = useDeleteBrokerCredential();
  const connect = useConnectBroker();

  // All three mutations are shared across every row, so each spinner has to
  // check the registration and not merely the broker — otherwise saving one row
  // spins every row at that broker.
  const isThis = (v?: { brokerId: string; label: string }) =>
    v?.brokerId === brokerId && v?.label === label;
  const connecting =
    connect.isPending &&
    connect.variables?.brokerId === brokerId &&
    connect.variables?.label === label;

  // Both values are always required, even on an update. The secret is never
  // sent back down, so there is nothing to leave unchanged — a form accepting a
  // blank secret would have to mean "keep the old one", and that is exactly the
  // ambiguity write-only storage exists to avoid.
  const canSave = isComplete(definition, values);

  function startEditing() {
    // The key and the client id are identifiers and come back; the secret never does.
    setValues({ apiKey: apiKey ?? "", ...(clientId ? { clientId } : {}) });
    setEditing(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    save.mutate(
      { brokerId, label, ...toCredentialInput(values) },
      {
        onSuccess: () => {
          setValues({});
          setEditing(false);
        },
      }
    );
  }

  const hint = keyHint(apiKey);

  return (
    <div className="border-t border-border/60 px-4 py-3 first:border-t-0">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_auto] sm:items-center">
        {/*
          Name and key only. The "secret is stored, re-enter to replace" note
          used to repeat on every row; it is the same sentence each time and
          the page already says it once at the foot.
        */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {hint && (
            <Badge variant="outline" className="font-normal text-muted-foreground">
              {definition.credentialFields?.[0]?.label ?? "Key"} {hint}
            </Badge>
          )}
          {clientId && (
            <Badge variant="outline" className="font-normal text-muted-foreground">
              {definition.credentialFields?.find((f) => f.key === "clientId")?.label ?? "Client ID"} {clientId}
            </Badge>
          )}
        </div>

        <div className="flex min-w-0 flex-wrap items-start gap-1.5 sm:flex-col sm:items-start">
          {accounts.length === 0 ? (
            <Badge variant="outline" className="font-normal text-muted-foreground">
              No account linked yet
            </Badge>
          ) : (
            accounts.map((account) =>
              <span key={account.connectionId} className="inline-flex items-center gap-1">
                {account.state === "connected" ? (
                  <Badge variant="success" className="font-normal">
                    <CheckCircle2 className="size-3" />
                    {account.accountLabel} connected
                  </Badge>
                ) : (
                  <Badge variant="warning" className="font-normal">
                    <AlertTriangle className="size-3" />
                    {account.accountLabel} needs reconnect
                  </Badge>
                )}
                <DisconnectButton connectionId={account.connectionId} accountLabel={account.accountLabel} />
              </span>
            )
          )}
        </div>

        <div className="flex items-center gap-1 sm:justify-self-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => connect.mutate({ brokerId, label })}
            disabled={connecting}
          >
            {connecting ? <Loader2 className="animate-spin" /> : <Link2 />}
            {connecting ? "Redirecting…" : accounts.length === 0 ? "Connect" : "Connect another"}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label={editing ? `Stop editing ${label}` : `Replace credentials for ${label}`}
            disabled={save.isPending}
            onClick={() => (editing ? (setEditing(false), setValues({})) : startEditing())}
          >
            {editing ? <X /> : <Pencil />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label={`Remove registration ${label}`}
            onClick={() => remove.mutate({ brokerId, label })}
            disabled={remove.isPending}
          >
            {remove.isPending && isThis(remove.variables) ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Trash2 />
            )}
          </Button>
        </div>
      </div>

      {editing && (
        <form onSubmit={submit} className="mt-4 space-y-4 rounded-md border border-border bg-background/40 p-4">
          <CredentialFields
            definition={definition}
            idPrefix={`edit-${brokerId}-${label}`}
            values={values}
            onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
            storedKeys={(definition.credentialFields ?? [])
              .filter((field) => field.secret)
              .map((field) => field.key)}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <DeveloperPortalLink definition={definition} />
            <div className="flex items-center gap-3">
              {save.isError && isThis(save.variables) && (
                <p className="text-sm text-destructive">
                  Couldn&apos;t save those. Please check the values and try again.
                </p>
              )}
              <Button type="submit" size="sm" disabled={!canSave || save.isPending}>
                {save.isPending && isThis(save.variables) && <Loader2 className="animate-spin" />}
                Replace
              </Button>
            </div>
          </div>
        </form>
      )}

      {remove.isError && isThis(remove.variables) && (
        <p className="mt-2 text-sm text-destructive">Couldn&apos;t remove that one.</p>
      )}
    </div>
  );
}
