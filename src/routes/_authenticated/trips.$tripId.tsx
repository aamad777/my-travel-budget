import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getFxRate } from "@/lib/fx.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { CURRENCIES, formatMoney } from "@/lib/currencies";
import { BudgetRing } from "@/routes/index";
import { Plus, Minus, ArrowLeft, BarChart3, Trash2, MapPin, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

export const Route = createFileRoute("/_authenticated/trips/$tripId")({
  head: () => ({ meta: [{ title: "Trip — Voyage" }] }),
  component: TripDetail,
});

type Expense = {
  id: string;
  amount: number;
  currency: string;
  amount_in_trip_currency: number;
  fx_rate_to_trip: number;
  category_id: string | null;
  note: string | null;
  spent_at: string;
  kind: "expense" | "income";
};

type Category = { id: string; name: string; icon: string; color: string; is_preset: boolean };

function TripDetail() {
  const { tripId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const tripQuery = useQuery({
    queryKey: ["trip", tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .eq("id", tripId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const expensesQuery = useQuery({
    queryKey: ["expenses", tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id,amount,currency,amount_in_trip_currency,fx_rate_to_trip,category_id,note,spent_at,kind")
        .eq("trip_id", tripId)
        .order("spent_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Expense[];
    },
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name,icon,color,is_preset")
        .order("is_preset", { ascending: false })
        .order("name");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  const trip = tripQuery.data;
  const expenses = expensesQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];

  const totals = useMemo(() => {
    let spent = 0;
    for (const e of expenses) {
      const v = Number(e.amount_in_trip_currency);
      spent += e.kind === "income" ? -v : v;
    }
    return { spent, remaining: (Number(trip?.budget_amount ?? 0) - spent) };
  }, [expenses, trip]);

  const pct = trip && Number(trip.budget_amount) > 0
    ? (totals.spent / Number(trip.budget_amount)) * 100 : 0;

  const [filter, setFilter] = useState<"all" | "expense" | "income">("all");

  const filteredExpenses = useMemo(
    () => (filter === "all" ? expenses : expenses.filter((e) => e.kind === filter)),
    [expenses, filter],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const e of filteredExpenses) {
      const day = e.spent_at.slice(0, 10);
      const list = map.get(day) ?? [];
      list.push(e);
      map.set(day, list);
    }
    return Array.from(map.entries());
  }, [filteredExpenses]);

  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const [open, setOpen] = useState<null | "expense" | "income">(null);

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses", tripId] });
      qc.invalidateQueries({ queryKey: ["trips"] });
      toast.success("Deleted");
    },
  });

  const deleteTrip = async () => {
    if (!confirm("Delete this trip and all its expenses?")) return;
    const { error } = await supabase.from("trips").delete().eq("id", tripId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["trips"] });
    toast.success("Trip deleted");
    navigate({ to: "/trips" });
  };

  if (tripQuery.isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (!trip) return <div>Trip not found.</div>;

  return (
    <div>
      <Link to="/trips" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Trips
      </Link>

      <div className="rounded-3xl bg-card/80 p-6 shadow-glow">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{trip.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {trip.destination && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{trip.destination}</span>}
              {(trip.start_date || trip.end_date) && (
                <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{trip.start_date} {trip.end_date && `→ ${trip.end_date}`}</span>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            <Button asChild variant="ghost" size="icon" title="Summary">
              <Link to="/trips/$tripId/summary" params={{ tripId }}><BarChart3 className="h-4 w-4" /></Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={deleteTrip} title="Delete trip">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center gap-2">
          <BudgetRing
            percent={pct}
            label={formatMoney(totals.spent, trip.currency)}
            sub={`of ${formatMoney(Number(trip.budget_amount), trip.currency)}`}
          />
          <div className={`text-sm ${totals.remaining < 0 ? "text-destructive" : "text-muted-foreground"}`}>
            {totals.remaining < 0 ? "Over budget by " : "Remaining: "}
            <span className="font-semibold">{formatMoney(Math.abs(totals.remaining), trip.currency)}</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <QuickAddSheet
            kind="expense"
            open={open === "expense"}
            setOpen={(v) => setOpen(v ? "expense" : null)}
            tripId={tripId}
            tripCurrency={trip.currency}
            categories={categories}
          />
          <QuickAddSheet
            kind="income"
            open={open === "income"}
            setOpen={(v) => setOpen(v ? "income" : null)}
            tripId={tripId}
            tripCurrency={trip.currency}
            categories={categories}
          />
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Activity</h2>
          <div className="inline-flex rounded-full border border-border bg-card/60 p-1 text-xs">
            {(["all", "expense", "income"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 capitalize transition-colors ${
                  filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "all" ? "All" : f === "expense" ? "− Expenses" : "+ Income"}
              </button>
            ))}
          </div>
        </div>
        {!filteredExpenses.length ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
            {expenses.length ? "Nothing matches this filter." : "No expenses yet. Tap + to add one."}
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map(([day, items]) => {
              const dayTotal = items.reduce(
                (s, e) => s + (e.kind === "income" ? -Number(e.amount_in_trip_currency) : Number(e.amount_in_trip_currency)),
                0,
              );
              return (
                <div key={day}>
                  <div className="mb-2 flex items-baseline justify-between text-xs uppercase tracking-wider text-muted-foreground">
                    <span>{format(parseISO(day), "EEE, d MMM yyyy")}</span>
                    <span>{formatMoney(dayTotal, trip.currency)}</span>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
                    {items.map((e, i) => {
                      const cat = e.category_id ? catById[e.category_id] : null;
                      return (
                        <div key={e.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-border/40" : ""}`}>
                          <span
                            className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold"
                            style={{ backgroundColor: (cat?.color ?? "#5cbdb9") + "33", color: cat?.color ?? "#5cbdb9" }}
                          >
                            {cat?.name?.[0] ?? "·"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{e.note || cat?.name || (e.kind === "income" ? "Income" : "Expense")}</div>
                            <div className="text-xs text-muted-foreground">
                              {cat?.name ?? "Uncategorized"}
                              {e.currency !== trip.currency && ` · ${formatMoney(Number(e.amount), e.currency)}`}
                            </div>
                          </div>
                          <div className={`font-semibold ${e.kind === "income" ? "text-[color:var(--success)]" : ""}`}>
                            {e.kind === "income" ? "+" : "−"}
                            {formatMoney(Number(e.amount_in_trip_currency), trip.currency)}
                          </div>
                          <button
                            onClick={() => deleteMut.mutate(e.id)}
                            className="ml-1 rounded p-1 text-muted-foreground hover:text-destructive"
                            aria-label="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function QuickAddSheet({
  kind, open, setOpen, tripId, tripCurrency, categories,
}: {
  kind: "expense" | "income";
  open: boolean;
  setOpen: (v: boolean) => void;
  tripId: string;
  tripCurrency: string;
  categories: Category[];
}) {
  const qc = useQueryClient();
  const fetchFx = useServerFn(getFxRate);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(tripCurrency);
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [previewCurrency, setPreviewCurrency] = useState(tripCurrency);
  const [previewRate, setPreviewRate] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const isExpense = kind === "expense";

  // Live conversion preview: convert entered amount (in `currency`) into `previewCurrency`.
  useEffect(() => {
    let cancelled = false;
    if (currency === previewCurrency) {
      setPreviewRate(1);
      return;
    }
    setPreviewLoading(true);
    fetchFx({ data: { from: currency, to: previewCurrency } })
      .then((r) => { if (!cancelled) setPreviewRate(r.rate); })
      .catch(() => { if (!cancelled) setPreviewRate(null); })
      .finally(() => { if (!cancelled) setPreviewLoading(false); });
    return () => { cancelled = true; };
  }, [currency, previewCurrency, fetchFx]);

  const previewAmount = useMemo(() => {
    const n = parseFloat(amount);
    if (!isFinite(n) || n <= 0 || previewRate == null) return null;
    return Math.round(n * previewRate * 100) / 100;
  }, [amount, previewRate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseFloat(amount);
    if (!isFinite(n) || n <= 0) return toast.error("Enter an amount greater than 0");
    setSaving(true);
    try {
      let rate = 1;
      if (currency !== tripCurrency) {
        const r = await fetchFx({ data: { from: currency, to: tripCurrency } });
        rate = r.rate;
        if (r.source === "fallback") toast.warning("Couldn't fetch live FX rate — using 1:1.");
      }
      const converted = Math.round(n * rate * 100) / 100;
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("expenses").insert({
        trip_id: tripId,
        user_id: u.user.id,
        amount: n,
        currency,
        fx_rate_to_trip: rate,
        amount_in_trip_currency: converted,
        category_id: categoryId || null,
        note: note.trim() || null,
        spent_at: new Date(date + "T12:00:00").toISOString(),
        kind,
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["expenses", tripId] });
      qc.invalidateQueries({ queryKey: ["trips"] });
      toast.success(isExpense ? "Expense added" : "Income added");
      setAmount(""); setNote("");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="lg"
          variant={isExpense ? "default" : "outline"}
          className={isExpense ? "h-14 text-base shadow-glow" : "h-14 text-base"}
        >
          {isExpense ? <Plus className="mr-2 h-5 w-5" /> : <Minus className="mr-2 h-5 w-5" />}
          {isExpense ? "Add expense" : "Add income"}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>{isExpense ? "Add expense" : "Add income / refund"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={submit} className="mt-4 space-y-4 pb-6">
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div>
              <Label htmlFor="amt">Amount</Label>
              <Input
                id="amt"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-2xl font-semibold"
              />
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/40 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Convert to</Label>
              <Select value={previewCurrency} onValueChange={setPreviewCurrency}>
                <SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-lg font-semibold">
              {previewAmount != null
                ? <>= {formatMoney(previewAmount, previewCurrency)}</>
                : <span className="text-muted-foreground text-sm">{previewLoading ? "Fetching rate…" : "Enter an amount to see equivalent"}</span>}
            </div>
            {previewRate != null && currency !== previewCurrency && (
              <div className="mt-1 text-xs text-muted-foreground">
                1 {currency} = {previewRate.toFixed(4)} {previewCurrency}
              </div>
            )}
          </div>


          <div>
            <Label>Category</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {categories.map((c) => {
                const active = categoryId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryId(c.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? "border-transparent text-primary-foreground shadow-sm"
                        : "border-border bg-card/60 text-foreground hover:bg-card"
                    }`}
                    style={active ? { backgroundColor: c.color ?? "var(--primary)" } : undefined}
                  >
                    {c.name}{!c.is_preset && " ✦"}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea id="note" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was this for?" />
          </div>

          <div>
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={saving}>
            {saving ? "Saving…" : isExpense ? "Add expense" : "Add income"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
