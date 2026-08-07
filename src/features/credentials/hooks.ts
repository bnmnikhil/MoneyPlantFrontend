import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { sessionKeys } from "@/features/session/hooks";
import type { BrokerCredentialInput } from "@/types/api";

export const credentialKeys = {
  all: ["broker-credentials"] as const,
};

/**
 * Every broker the build supports, with this user's credential state.
 *
 * Unconfigured brokers are included — they are what the form is offered for —
 * so this list is registry-wide, unlike `brokers` on /api/session/status, which
 * is now scoped to what the user has actually configured.
 */
export function useBrokerCredentials() {
  return useQuery({
    queryKey: credentialKeys.all,
    queryFn: api.brokerCredentials,
    staleTime: 30_000,
  });
}

/**
 * Both mutations invalidate the session status as well as the credential list.
 *
 * That is not incidental: `brokers` on /api/session/status is derived from these
 * rows, so saving the first credential is what makes a Connect button appear,
 * and deleting the last one is what makes it go away. Without this the dashboard
 * would keep offering a broker the user just removed until the 60s poll caught up.
 */
export function useSaveBrokerCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ brokerId, label, ...body }:
      BrokerCredentialInput & { brokerId: string; label: string }) =>
      api.saveBrokerCredential(brokerId, label, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: credentialKeys.all });
      qc.invalidateQueries({ queryKey: sessionKeys.status });
    },
  });
}

export function useDeleteBrokerCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ brokerId, label }: { brokerId: string; label: string }) =>
      api.deleteBrokerCredential(brokerId, label),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: credentialKeys.all });
      qc.invalidateQueries({ queryKey: sessionKeys.status });
    },
  });
}
