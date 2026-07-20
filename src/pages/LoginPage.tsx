import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

/** Google's "G" mark (official four-color logo). */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.64h6.2a5.3 5.3 0 0 1-2.3 3.48v2.9h3.72c2.18-2 3.44-4.96 3.44-8.57Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.1 0 5.7-1.03 7.62-2.79l-3.72-2.9c-1.03.7-2.35 1.1-3.9 1.1-3 0-5.55-2.03-6.46-4.76H1.7v2.99A11.5 11.5 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.54 14.65a6.9 6.9 0 0 1 0-4.3V7.36H1.7a11.5 11.5 0 0 0 0 10.28l3.84-2.99Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.69 0 3.2.58 4.4 1.72l3.3-3.3C17.7 1.2 15.1 0 12 0A11.5 11.5 0 0 0 1.7 6.36l3.84 2.99C6.45 6.78 9 4.75 12 4.75Z"
      />
    </svg>
  );
}

export function LoginPage() {
  return (
    <div className="relative flex min-h-svh items-center justify-center bg-background px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[360px] bg-[radial-gradient(55%_100%_at_50%_0%,hsl(var(--primary)/0.12),transparent_70%)]"
      />
      <Card className="relative z-10 w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-7 px-8 py-10 text-center">
          <Logo size={40} />

          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold tracking-tight">
              Sign in to MoneyPlant
            </h1>
            <p className="text-sm text-muted-foreground">
              Continue to your trading terminal.
            </p>
          </div>

          <Button
            size="lg"
            variant="outline"
            className="w-full bg-card"
            onClick={() => {
              window.location.href = "/api/me";
            }}
          >
            <GoogleIcon />
            Continue with Google
          </Button>

          <p className="text-xs text-muted-foreground">
            Private system. Access restricted.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
