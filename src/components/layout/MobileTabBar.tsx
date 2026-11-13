import { NavLink, useLocation } from "react-router-dom";
import { alsoActive, primaryNavItems, visibleNavItems } from "@/components/layout/nav";
import { useResearchAvailable } from "@/features/research/hooks";
import { cn } from "@/lib/utils";

/**
 * Mobile/tablet bottom tab bar (hidden on `lg`+). Shows the primary nav items;
 * Settings is available in the header's overflow menu.
 */
export function MobileTabBar() {
  const { pathname } = useLocation();
  const tabs = visibleNavItems(primaryNavItems, useResearchAvailable());
  return (
    <nav aria-label="Main navigation" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }} className="fixed inset-x-0 bottom-0 z-40 grid border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {tabs.map((item) => {
        const Icon = item.icon;

        return (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                isActive || alsoActive(item, pathname) ? "text-primary" : "text-muted-foreground"
              )
            }
          >
            <Icon className="size-5" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
