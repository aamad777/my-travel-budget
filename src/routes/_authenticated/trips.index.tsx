import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, MapPin, Calendar } from "lucide-react";
import { formatMoney } from "@/lib/currencies";
import { BudgetRing } from "@/routes/index";

export const Route = createFileRoute("/_authenticated/trips/")({
  head: () => ({ meta: [{ title: "My Trips — Voyage" }] }),
  component: TripsList,
});

type TripRow = {
  id: string;
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  budget_amount: number;
  currency: string;
};

function TripsList() {
  const { data: trips, isLoading } = useQuery({
    queryKey: ["trips"],
    queryFn: async (): Promise<Array<TripRow & { spent: number }>> => {
      const { data: tripRows, error } = await supabase
        .from("trips")
        .select("id,name,destination,start_date,end_date,budget_amount,currency")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const ids = (tripRows ?? []).map((t) => t.id);
      let spentByTrip: Record<string, number> = {};
      if (ids.length) {
        const { data: exp } = await supabase
          .from("expenses")
          .select("trip_id,amount_in_trip_currency,kind")
          .in("trip_id", ids);
        for (const e of exp ?? []) {
          const delta = e.kind === "income" ? -Number(e.amount_in_trip_currency) : Number(e.amount_in_trip_currency);
          spentByTrip[e.trip_id] = (spentByTrip[e.trip_id] ?? 0) + delta;
        }
      }
      return (tripRows ?? []).map((t) => ({ ...t, spent: spentByTrip[t.id] ?? 0 }));
    },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Trips</h1>
          <p className="text-sm text-muted-foreground">Pick a trip or start a new one.</p>
        </div>
        <Button asChild className="shadow-glow">
          <Link to="/trips/new"><Plus className="mr-1 h-4 w-4" /> New trip</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : !trips?.length ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
          <h2 className="text-lg font-semibold">No trips yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">Create your first trip to start tracking expenses.</p>
          <Button asChild className="mt-5">
            <Link to="/trips/new"><Plus className="mr-1 h-4 w-4" /> Create a trip</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {trips.map((t) => {
            const pct = t.budget_amount > 0 ? (t.spent / Number(t.budget_amount)) * 100 : 0;
            return (
              <Link
                key={t.id}
                to="/trips/$tripId"
                params={{ tripId: t.id }}
                className="group rounded-2xl border border-border bg-card/70 p-5 transition hover:shadow-glow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold group-hover:text-primary">{t.name}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {t.destination && (
                        <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {t.destination}</span>
                      )}
                      {(t.start_date || t.end_date) && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {t.start_date} {t.end_date ? `→ ${t.end_date}` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <BudgetRing
                    percent={pct}
                    label={`${Math.round(pct)}%`}
                  />
                </div>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Spent</span>
                  <span className="font-semibold">{formatMoney(t.spent, t.currency)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Budget</span>
                  <span>{formatMoney(Number(t.budget_amount), t.currency)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
