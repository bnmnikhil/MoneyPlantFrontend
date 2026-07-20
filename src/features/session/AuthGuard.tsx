import { Navigate, Outlet } from "react-router-dom";
import { isUnauthorized } from "@/lib/api";
import { useMe } from "@/features/session/hooks";
import { Logo } from "@/components/Logo";

/**
 * Gate for all authenticated routes. Resolves GET /api/me:
 *  - loading  -> brand splash
 *  - 401      -> (api layer already redirects; render <Navigate> as a safety net)
 *  - success  -> render the nested routes
 */
export function AuthGuard() {
  const { data, isLoading, isError, error } = useMe();

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Logo showWordmark={false} size={40} />
          <div className="h-1 w-24 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    if (isUnauthorized(error)) {
      return <Navigate to="/login" replace />;
    }
    // Non-auth failure (server/network). Bounce to login as the safe default.
    return <Navigate to="/login" replace />;
  }

  if (!data) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
