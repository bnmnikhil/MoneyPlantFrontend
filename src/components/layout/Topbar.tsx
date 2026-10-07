import { Link, NavLink } from "react-router-dom";
import { ChevronDown, KeyRound, LogOut, Loader2, MoreHorizontal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/Logo";
import { primaryNavItems } from "@/components/layout/nav";
import { BrokerStatusChips } from "@/features/session/BrokerStatusChips";
import { useBrokerStatus, useLogout, useMe } from "@/features/session/hooks";
import { legalDetails } from "@/features/legal/details";
import { cn } from "@/lib/utils";

function initials(name?: string) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function Topbar() {
  const { data: me } = useMe();
  const logout = useLogout();
  const status = useBrokerStatus();
  const brokerIds = new Set([
    ...status.brokers,
    ...status.connections.map((connection) => connection.brokerId),
  ]);
  const connectedIds = new Set(
    status.connections.filter((connection) => connection.connected).map((connection) => connection.brokerId)
  );
  const allConnected = brokerIds.size > 0 && connectedIds.size === brokerIds.size &&
    status.connections.every((connection) => connection.connected);
  const statusLabel = status.isPending ? "Checking" : status.isError ? "Unavailable" :
    allConnected ? "Live" : status.anyConnected ? "Partial" : "Offline";
  const dotClass = status.isPending || status.isError ? "bg-muted-foreground" :
    allConnected ? "bg-profit" : "bg-orange-400";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded focus:bg-card focus:p-3">
        Skip to content
      </a>
      <div className="flex min-h-[3.75rem] items-center gap-3 px-4 sm:px-6 lg:min-h-[3.5rem] lg:gap-6 lg:px-7">
        <Link to="/app" aria-label="GoldenBook overview" className="shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Logo variant="header" size={32} className="hidden sm:inline-flex lg:[&>span]:hidden xl:[&>span]:inline" />
          <Logo variant="header" size={32} showWordmark={false} className="sm:hidden" />
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex xl:gap-2">
          {primaryNavItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}
              className={({ isActive }) => cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:px-4 lg:text-base",
                isActive ? "workspace-nav-active" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-3 xl:gap-6">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="flex h-9 items-center gap-2 rounded-md border border-border bg-background/50 px-3 text-sm outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring xl:text-base">
                {status.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <span className={cn("size-3 rounded-full", dotClass)} />}
                <span>Brokers {status.isPending || status.isError ? "—" : `${connectedIds.size}/${brokerIds.size}`}</span>
                <ChevronDown className="size-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="app-workspace w-80 max-w-[calc(100vw-2rem)]">
              <DropdownMenuLabel>Broker connections</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {status.isError ? (
                <DropdownMenuItem onSelect={() => { void status.refetch(); }}>Couldn't check brokers · Retry</DropdownMenuItem>
              ) : (
                <div className="px-2 py-3">
                  <BrokerStatusChips menu className="flex-col items-start" />
                  {!status.isPending && brokerIds.size === 0 && <p className="text-sm text-muted-foreground">No brokers configured yet.</p>}
                </div>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link to="/app/settings"><KeyRound />Manage broker connections</Link></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="hidden items-center gap-2 border-l border-border pl-4 text-sm lg:flex xl:pl-6 xl:text-base"
            title="Broker session status. Each page reports its own data freshness." aria-label={`Broker sessions: ${statusLabel}`}>
            <span className={cn("size-3 rounded-full", dotClass)} />
            {statusLabel}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Account menu" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                <Avatar className="size-8 border border-primary/40 md:size-9">
                  {me?.picture && <AvatarImage src={me.picture} alt={me.name} referrerPolicy="no-referrer" />}
                  <AvatarFallback className="bg-primary/15 text-base font-semibold text-primary">{initials(me?.name)}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="app-workspace w-60">
              <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
                <span className="text-sm font-medium">{me?.name ?? "—"}</span>
                <span className="truncate text-xs text-muted-foreground">{me?.email ?? ""}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link to="/app/settings"><KeyRound />Broker settings</Link></DropdownMenuItem>
              <DropdownMenuItem onSelect={(event) => { event.preventDefault(); logout.mutate(); }} disabled={logout.isPending} className="text-loss focus:text-loss">
                {logout.isPending ? <Loader2 className="animate-spin" /> : <LogOut />}Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="More options" className="grid size-9 place-items-center rounded-md text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                <MoreHorizontal className="size-6" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="app-workspace w-56">
              <DropdownMenuItem asChild><Link to="/app/settings"><KeyRound />Broker settings</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>Option chain · Coming soon</DropdownMenuItem>
              <DropdownMenuItem disabled>Alerts · Coming soon</DropdownMenuItem>
              {/* The signed-in pages have no footer, so the legal links live here. */}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link to="/privacy">Privacy</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/terms">Terms</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><a href={`mailto:${legalDetails.contactEmail}`}>Contact · {legalDetails.contactEmail}</a></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
