import { useState } from "react";
import { CheckCircle2, Circle, Loader2, Trash2 } from "lucide-react";
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

export function BrokerCredentialCard({ credential }: { credential: BrokerCredential }) {
  const { brokerId, apiKey, configured } = credential;
  const names = FIELD_NAMES[brokerId] ?? { key: "API key", secret: "API secret" };

  const [keyValue, setKeyValue] = useState(apiKey ?? "");
  const [secretValue, setSecretValue] = useState("");

  const save = useSaveBrokerCredential();
  const remove = useDeleteBrokerCredential();

  // Both values are always required, even on an update. The secret is never sent
  // back down, so there is nothing to leave unchanged — a form that accepted a
  // blank secret would have to mean "keep the old one", and that is exactly the
  // ambiguity write-only storage exists to avoid.
  const canSave = keyValue.trim() !== "" && secretValue.trim() !== "";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    save.mutate(
      { brokerId, apiKey: keyValue.trim(), apiSecret: secretValue.trim() },
      { onSuccess: () => setSecretValue("") }
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          {brokerLabel(brokerId)}
          {configured ? (
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

        {configured && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => remove.mutate(brokerId)}
            disabled={remove.isPending}
          >
            {remove.isPending && remove.variables === brokerId ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Trash2 />
            )}
            Remove
          </Button>
        )}
      </CardHeader>

      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor={`${brokerId}-key`}
                className="text-sm font-medium text-foreground"
              >
                {names.key}
              </label>
              <Input
                id={`${brokerId}-key`}
                value={keyValue}
                onChange={(e) => setKeyValue(e.target.value)}
                placeholder={`From ${CONSOLES[brokerId] ?? "the broker's console"}`}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor={`${brokerId}-secret`}
                className="text-sm font-medium text-foreground"
              >
                {names.secret}
              </label>
              <Input
                id={`${brokerId}-secret`}
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
              {save.isPending && save.variables?.brokerId === brokerId && (
                <Loader2 className="animate-spin" />
              )}
              {configured ? "Replace" : "Save"}
            </Button>

            {save.isError && save.variables?.brokerId === brokerId && (
              <p className="text-sm text-destructive">
                Couldn&apos;t save those. Please check both values and try again.
              </p>
            )}
            {remove.isError && remove.variables === brokerId && (
              <p className="text-sm text-destructive">Couldn&apos;t remove that one.</p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
