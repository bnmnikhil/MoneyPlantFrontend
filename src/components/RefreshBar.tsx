import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function relative(ms: number): string {
  if (!ms) return "—";
  const secs = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

/** "Last updated Xs ago" label + manual refresh button. Ticks every second. */
export function RefreshBar({
  updatedAt,
  isFetching,
  onRefresh,
}: {
  updatedAt: number;
  isFetching: boolean;
  onRefresh: () => void;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="tabular-nums">
        {isFetching ? "Updating…" : `Last updated ${relative(updatedAt)}`}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={isFetching}
        className="h-8"
      >
        <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
        Refresh
      </Button>
    </div>
  );
}
