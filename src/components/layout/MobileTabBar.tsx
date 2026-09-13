import { NavLink } from "react-router-dom";
import { primaryNavItems } from "@/components/layout/nav";
import { cn } from "@/lib/utils";

/**
 * Mobile/tablet bottom tab bar (hidden on `lg`+). Shows the primary nav items;
 * Settings is available in the header's overflow menu.
 */
export function MobileTabBar() {
  return (
    <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {primaryNavItems.map((item) => {
        const Icon = item.icon;

        return (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
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
