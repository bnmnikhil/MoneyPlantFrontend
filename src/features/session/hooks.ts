import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const sessionKeys = {
  me: ["me"] as const,
  status: ["session", "status"] as const,
};

/** Current signed-in app user. 401 is handled globally (redirect to /login). */
export function useMe() {
  return useQuery({
    queryKey: sessionKeys.me,
    queryFn: api.me,
    staleTime: 5 * 60_000,
  });
}

/**
 * Which broker accounts are linked, and which brokers could still be linked.
 *
 * The broker list comes from BrokerRegistry, so a new broker appears here with
 * no frontend change at all — which is the point of the 1f refactor.
 *
 * `connections` is per *account*, not per broker: someone with two Kite
 * accounts gets two entries, distinguished by accountLabel. `disconnected` is
 * derived rather than sent, because "a broker with no connection" is a question
 * about the join between the two arrays and nothing the backend needs to
 * pre-compute.
 */
export function useBrokerStatus() {
  const q = useQuery({
    queryKey: sessionKeys.status,
    queryFn: api.sessionStatus,
    staleTime: 20_000,
    refetchInterval: 60_000,
  });

  const brokers = q.data?.brokers ?? [];
  const connections = q.data?.connections ?? [];

  return {
    ...q,
    brokers,
    connections,
    anyConnected: connections.some((c) => c.connected),
    disconnected: brokers.filter(
      (id) => !connections.some((c) => c.brokerId === id && c.connected)
    ),
  };
}

/**
 * Start a broker's login flow: GET /api/session/login-url?brokerId= -> { url }
 * -> full-page redirect.
 *
 * The brokerId is the mutation variable rather than a hook argument, so one
 * instance can serve a list of brokers and `variables` tells you which one is
 * mid-flight for per-button spinners.
 */
export function useConnectBroker() {
  return useMutation({
    mutationFn: (brokerId: string) => api.loginUrl(brokerId),
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
  });
}

/** Sign out of the app, then hard-redirect to /login. */
export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      qc.clear();
      window.location.assign("/login");
    },
  });
}
