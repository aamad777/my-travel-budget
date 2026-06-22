import { createFileRoute, Outlet, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { authApi } from "@/lib/api";
import { Plane, LogOut, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const navigate = useNavigate();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;

    authApi
      .me()
      .then(() => {
        if (!mounted) return;
        setAuthed(true);
      })
      .catch(() => {
        authApi.logout();
        navigate({ to: "/login" });
      })
      .finally(() => {
        if (!mounted) return;
        setReady(true);
      });

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const signOut = async () => {
    authApi.logout();
    await router.invalidate();
    navigate({ to: "/login" });
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!authed) return null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border/40 bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link to="/trips" className="flex items-center gap-2 font-semibold">
            <Plane className="h-5 w-5 text-primary" /> Voyage
          </Link>

          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="icon" title="Settings">
              <Link to="/settings">
                <SettingsIcon className="h-4 w-4" />
              </Link>
            </Button>

            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}