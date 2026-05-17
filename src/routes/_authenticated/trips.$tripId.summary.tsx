import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/currencies";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/trips/$tripId/summary")({
  head: () => ({ meta: [{ title: "Trip summary — Voyage" }] }),
  component: Summary,
});

function Summary() {
  const { tripId } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["summary", tripId],
    queryFn: async () => {
      const [{ data: trip }, { data: expenses }, { data: cats }] = await Promise.all([
        supabase.from("trips").select("*").eq("id", tripId).single(),
        supabase.from("expenses").select("amount_in_trip_currency,category_id,kind,spent_at").eq("trip_id", tripId),
        supabase.from("categories").select("id,name,color"),
      ]);
      return { trip, expenses: expenses ?? [], cats: cats ?? [] };
    },
  });

  if (isLoading || !data?.trip) return <div className="text-muted-foreground">Loading…</div>;
  const { trip, expenses, cats } = data;
  const catById = Object.fromEntries(cats.map((c) => [c.id, c]));

  const byCat: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  let total = 0;
  for (const e of expenses) {
    const v = e.kind === "income" ? -Number(e.amount_in_trip_currency) : Number(e.amount_in_trip_currency);
    total += v;
    const k = e.category_id ?? "uncategorized";
    byCat[k] = (byCat[k] ?? 0) + v;
    const d = e.spent_at.slice(0, 10);
    byDay[d] = (byDay[d] ?? 0) + v;
  }
  const catEntries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const dayEntries = Object.entries(byDay).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const max = Math.max(1, ...catEntries.map(([, v]) => Math.abs(v)));

  return (
    <div>
      <Link to="/trips/$tripId" params={{ tripId }} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to trip
      </Link>
      <h1 className="text-2xl font-bold">{trip.name} — summary</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Total spent" value={formatMoney(total, trip.currency)} />
        <Stat label="Budget" value={formatMoney(Number(trip.budget_amount), trip.currency)} />
        <Stat
          label="Remaining"
          value={formatMoney(Number(trip.budget_amount) - total, trip.currency)}
          tone={Number(trip.budget_amount) - total < 0 ? "bad" : "good"}
        />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">By category</h2>
        {catEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No expenses yet.</p>
        ) : (
          <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-5">
            {catEntries.map(([id, v]) => {
              const cat = catById[id];
              const w = Math.round((Math.abs(v) / max) * 100);
              return (
                <div key={id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{cat?.name ?? "Uncategorized"}</span>
                    <span className="font-medium">{formatMoney(v, trip.currency)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-background/40">
                    <div className="h-full rounded-full" style={{ width: `${w}%`, backgroundColor: cat?.color ?? "var(--primary)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">By day</h2>
        {dayEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No expenses yet.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
            {dayEntries.map(([d, v], i) => (
              <div key={d} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? "border-t border-border/40" : ""}`}>
                <span className="text-sm text-muted-foreground">{d}</span>
                <span className="font-semibold">{formatMoney(v, trip.currency)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-2xl border border-border bg-card/70 p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tone === "bad" ? "text-destructive" : tone === "good" ? "text-[color:var(--success)]" : ""}`}>
        {value}
      </div>
    </div>
  );
}
