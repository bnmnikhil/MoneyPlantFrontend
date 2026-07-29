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
 * Connection state for every broker the backend knows about.
 *
 * The list comes from BrokerRegistry, so a new broker appears here with no
 * frontend change at all — which is the point of the 1f refactor.
 */
export function useBrokerStatus() {
  const q = useQuery({
    queryKey: sessionKeys.status,
    queryFn: api.sessionStatus,
    staleTime: 20_000,
    refetchInterval: 60_000,
  });

  const brokers = q.data?.brokers ?? [];

  return {
    ...q,
    brokers,
    anyConnected: brokers.some((b) => b.connected),
    disconnected: brokers.filter((b) => !b.connected),
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
