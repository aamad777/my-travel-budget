import { createFileRoute, Link } from "@tanstack/react-router";
import { Plane, Wallet, Globe2, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Voyage — Trip Budget Tracker" },
      {
        name: "description",
        content: "Plan trip budgets and track every expense in any currency. Sign up free.",
      },
      { property: "og:title", content: "Voyage — Trip Budget Tracker" },
      {
        property: "og:description",
        content: "Plan trip budgets and track every expense in any currency.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold">
          <Plane className="h-6 w-6 text-primary" />
          <span>Voyage</span>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link to="/login" className="text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
          <Link
            to="/signup"
            className="rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground shadow-glow hover:opacity-95"
          >
            Get started
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-12">
        <section className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-primary">
              Trip budgets, simplified
            </p>
            <h1 className="mt-3 text-5xl font-bold leading-tight md:text-6xl">
              Know what you spent, <span className="text-primary">to the cent.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base text-muted-foreground md:text-lg">
              Set a budget for each trip, then add expenses in a tap. Multi-currency built in. See
              where your money's going while you're still on the road.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/signup"
                className="rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground shadow-glow hover:opacity-95"
              >
                Create your first trip
              </Link>
              <Link
                to="/login"
                className="rounded-full border border-border px-6 py-3 font-medium hover:bg-card"
              >
                I already have an account
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-3xl bg-card/80 p-6 shadow-glow backdrop-blur">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Lisbon · 8 days</span>
                <span>€1,200 budget</span>
              </div>
              <div className="my-6 flex items-center justify-center">
                <BudgetRing percent={42} label="€504" sub="spent of €1,200" />
              </div>
              <div className="space-y-2">
                {[
                  { c: "Food", a: "€18.50", n: "Pastéis de nata x6" },
                  { c: "Transport", a: "€9.00", n: "Tram day pass" },
                  { c: "Lodging", a: "€140.00", n: "Alfama guesthouse" },
                ].map((r) => (
                  <div
                    key={r.n}
                    className="flex items-center justify-between rounded-xl bg-background/40 px-4 py-2 text-sm"
                  >
                    <div>
                      <div className="font-medium">{r.n}</div>
                      <div className="text-xs text-muted-foreground">{r.c}</div>
                    </div>
                    <div className="font-semibold">{r.a}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-24 grid gap-6 md:grid-cols-3">
          {[
            {
              I: Wallet,
              t: "Quick + / − entry",
              d: "Drop in an expense or refund in seconds. Notes optional.",
            },
            {
              I: Globe2,
              t: "Any currency",
              d: "Spend in yen, see totals in euros. We handle the conversion.",
            },
            {
              I: BarChart3,
              t: "Live breakdowns",
              d: "Per-day and per-category totals so nothing surprises you later.",
            },
          ].map(({ I, t, d }) => (
            <div key={t} className="rounded-2xl border border-border bg-card/50 p-6">
              <I className="h-6 w-6 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border/40 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Voyage. Built for travelers who want to spend smart.
      </footer>
    </div>
  );
}

export function BudgetRing({
  percent,
  label,
  sub,
}: {
  percent: number;
  label: string;
  sub?: string;
}) {
  const p = Math.max(0, Math.min(100, percent));
  const r = 70;
  const c = 2 * Math.PI * r;
  const offset = c - (p / 100) * c;
  return (
    <div className="relative h-44 w-44">
      <svg viewBox="0 0 160 160" className="h-44 w-44 -rotate-90">
        <circle
          cx="80"
          cy="80"
          r={r}
          stroke="currentColor"
          strokeOpacity="0.15"
          strokeWidth="14"
          fill="none"
        />
        <circle
          cx="80"
          cy="80"
          r={r}
          stroke="var(--primary)"
          strokeWidth="14"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-bold">{label}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}
