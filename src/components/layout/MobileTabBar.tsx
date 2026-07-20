import { NavLink } from "react-router-dom";
import { navItems } from "@/components/layout/nav";
import { cn } from "@/lib/utils";

/**
 * Mobile bottom tab bar (hidden on `md`+). Shows the primary nav items;
 * "Soon" placeholders render disabled.
 */
export function MobileTabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-card/95 backdrop-blur md:hidden">
      {navItems.map((item) => {
        const Icon = item.icon;

        if (item.soon) {
          return (
            <div
              key={item.label}
              aria-disabled
              className="flex cursor-not-allowed flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground/45"
            >
              <Icon className="size-5" />
              <span>Soon</span>
            </div>
          );
        }

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
