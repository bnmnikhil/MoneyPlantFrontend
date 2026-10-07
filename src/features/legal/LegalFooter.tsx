import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { legalDetails } from "@/features/legal/details";

/**
 * The one footer for the public pages: landing, login and the legal pages render
 * it, so the disclosure and the links read the same everywhere. The signed-in app
 * has no footer (owner decision, 7 Oct 2026); its legal links are in the header's
 * More options menu.
 */
export function LegalFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "border-t border-border py-6 text-xs leading-relaxed text-muted-foreground",
        className,
      )}
    >
      <p className="text-pretty">
        GoldenBook is a read-only viewer: it places no orders and is not
        investment advice. All figures are estimates — your broker is the source
        of truth.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>© {new Date().getFullYear()} GoldenBook</span>
        <Link to="/privacy" className="hover:text-foreground">
          Privacy
        </Link>
        <Link to="/terms" className="hover:text-foreground">
          Terms
        </Link>
        <a href={`mailto:${legalDetails.contactEmail}`} className="hover:text-foreground">
          Contact
        </a>
      </div>
    </footer>
  );
}
