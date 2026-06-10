import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/currencies";
import { ArrowLeft, Target, Check, Star, Gift } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/trips/$tripId/summary")({
  head: () => ({ meta: [{ title: "Trip summary — Voyage" }] }),
  component: Summary,
});

type CatBudget = { id: string; category_id: string; amount: number };

function Summary() {
  const { tripId } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["summary", tripId],
    queryFn: async () => {
      const [{ data: trip }, { data: expenses }, { data: cats }, { data: budgets }] = await Promise.all([
        supabase.from("trips").select("*").eq("id", tripId).single(),
        supabase.from("expenses").select("amount_in_trip_currency,category_id,kind,spent_at").eq("trip_id", tripId),
        supabase.from("categories").select("id,name,color"),
        supabase.from("category_budgets").select("id,category_id,amount").eq("trip_id", tripId),
      ]);
      return { trip, expenses: expenses ?? [], cats: cats ?? [], budgets: (budgets ?? []) as CatBudget[] };
    },
  });

  if (isLoading || !data?.trip) return <div className="text-muted-foreground">Loading…</div>;
  const { trip, expenses, cats, budgets } = data;
  const catById = Object.fromEntries(cats.map((c) => [c.id, c]));
  const budgetByCat = Object.fromEntries(budgets.map((b) => [b.category_id, b]));

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

      <TripEndCard
        budget={Number(trip.budget_amount)}
        spent={total}
        currency={trip.currency}
        endDate={trip.end_date}
      />


      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">By category</h2>
        {catEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No expenses yet.</p>
        ) : (
          <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-5">
            {catEntries.map(([id, v]) => {
              const cat = catById[id];
              const w = Math.round((Math.abs(v) / max) * 100);
              const budget = budgetByCat[id];
              const limit = budget ? Number(budget.amount) : 0;
              const usagePct = limit > 0 ? Math.min(100, Math.round((Math.abs(v) / limit) * 100)) : 0;
              const overBudget = limit > 0 && Math.abs(v) > limit;
              return (
                <div key={id} className="animate-fade-in">
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{cat?.name ?? "Uncategorized"}</span>
                    <span className={`font-semibold ${overBudget ? "text-destructive" : ""}`}>{formatMoney(v, trip.currency)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-background/40">
                    <div className="h-full rounded-full transition-all" style={{ width: `${w}%`, backgroundColor: cat?.color ?? "var(--primary)" }} />
                  </div>
                  {cat && (
                    <BudgetLimitRow
                      tripId={tripId}
                      categoryId={id}
                      currency={trip.currency}
                      existing={budget}
                      spent={Math.abs(v)}
                      usagePct={usagePct}
                      overBudget={overBudget}
                    />
                  )}
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

function BudgetLimitRow({
  tripId, categoryId, currency, existing, spent, usagePct, overBudget,
}: {
  tripId: string;
  categoryId: string;
  currency: string;
  existing: CatBudget | undefined;
  spent: number;
  usagePct: number;
  overBudget: boolean;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(existing ? String(existing.amount) : "");

  useEffect(() => { setValue(existing ? String(existing.amount) : ""); }, [existing]);

  const saveMut = useMutation({
    mutationFn: async (amount: number) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      if (amount <= 0) {
        if (existing) {
          const { error } = await supabase.from("category_budgets").delete().eq("id", existing.id);
          if (error) throw error;
        }
        return;
      }
      const { error } = await supabase.from("category_budgets").upsert({
        id: existing?.id,
        user_id: u.user.id,
        trip_id: tripId,
        category_id: categoryId,
        amount,
      }, { onConflict: "trip_id,category_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["summary", tripId] });
      toast.success("Limit saved");
      setEditing(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const limit = existing ? Number(existing.amount) : 0;

  return (
    <div className="mt-2 flex items-center gap-2 text-xs">
      <Target className="h-3 w-3 text-muted-foreground" />
      {editing ? (
        <>
          <Input
            type="number"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`Limit in ${currency}`}
            className="h-7 w-28 text-xs"
            autoFocus
          />
          <Button
            size="sm"
            className="h-7 px-2"
            onClick={() => saveMut.mutate(parseFloat(value) || 0)}
            disabled={saveMut.isPending}
          >
            <Check className="h-3 w-3" />
          </Button>
          <button type="button" onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground">
            cancel
          </button>
        </>
      ) : limit > 0 ? (
        <>
          <span className={`flex-1 ${overBudget ? "text-destructive font-medium" : "text-muted-foreground"}`}>
            {formatMoney(spent, currency)} / {formatMoney(limit, currency)} ({usagePct}%)
          </span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-background/40">
            <div
              className={`h-full transition-all ${overBudget ? "bg-destructive" : "bg-primary"}`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          <button type="button" onClick={() => setEditing(true)} className="text-muted-foreground hover:text-foreground underline underline-offset-2">
            edit
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="text-muted-foreground hover:text-foreground underline underline-offset-2">
          Set budget limit
        </button>
      )}
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
