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

/** Broker (Kite) connection status. Polled so the top-bar chip stays fresh. */
export function useKiteStatus() {
  const q = useQuery({
    queryKey: sessionKeys.status,
    queryFn: api.sessionStatus,
    staleTime: 20_000,
    refetchInterval: 60_000,
  });

  const kiteConnected =
    q.data?.brokers?.find((b) => b.id === "kite")?.connected ?? false;

  /** Any broker at all. With multi-broker this, not kiteConnected, is what
   *  decides whether to show the "connect a broker" empty state. */
  const anyConnected = q.data?.brokers?.some((b) => b.connected) ?? false;

  return { ...q, kiteConnected, anyConnected };
}
/**
 * Kick off the Kite (broker) connect flow:
 * GET /api/session/login-url -> { url } -> full-page redirect to Zerodha.
 */
export function useConnectKite() {
  return useMutation({
    mutationFn: api.loginUrl,
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
