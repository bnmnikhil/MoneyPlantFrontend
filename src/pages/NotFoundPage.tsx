import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <p className="text-5xl font-semibold tracking-tight text-muted-foreground/50">
        404
      </p>
      <p className="text-sm text-muted-foreground">
        This page doesn&apos;t exist.
      </p>
      <Button asChild variant="outline" size="sm">
        <Link to="/app">Back to dashboard</Link>
      </Button>
    </div>
  );
}
