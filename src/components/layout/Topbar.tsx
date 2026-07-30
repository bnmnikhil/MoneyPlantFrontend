import { LogOut, Loader2 } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/Logo";
import { BrokerStatusChips } from "@/features/session/BrokerStatusChips";
import { useLogout, useMe } from "@/features/session/hooks";

function initials(name?: string) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function Topbar() {
  const { data: me } = useMe();
  const logout = useLogout();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
      {/* Mobile brand (sidebar is hidden on small screens) */}
      <div className="md:hidden">
        <Logo showWordmark={false} />
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <BrokerStatusChips />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-full outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Avatar>
                {me?.picture && (
                  <AvatarImage src={me.picture} alt={me.name} referrerPolicy="no-referrer" />
                )}
                <AvatarFallback>{initials(me?.name)}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
              <span className="text-sm font-medium">{me?.name ?? "—"}</span>
              <span className="truncate text-xs text-muted-foreground">
                {me?.email ?? ""}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                logout.mutate();
              }}
              disabled={logout.isPending}
              className="text-loss focus:text-loss"
            >
              {logout.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <LogOut />
              )}
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
