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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CURRENCIES, formatMoney } from "@/lib/currencies";
import { BudgetRing } from "@/routes/index";
import {
  Plus,
  Minus,
  ArrowLeft,
  BarChart3,
  Trash2,
  MapPin,
  Calendar,
  X,
  Search,
  SlidersHorizontal,
  Utensils,
  Bus,
  BedDouble,
  Ticket,
  ShoppingBag,
  Sparkles,
  Coffee,
  Beer,
  Plane,
  Car,
  Fuel,
  Train,
  Ship,
  Gift,
  HeartPulse,
  Stethoscope,
  Wifi,
  Phone,
  Film,
  Music,
  Camera,
  Dumbbell,
  PawPrint,
  Baby,
  Shirt,
  Wrench,
  Banknote,
  CreditCard,
  PiggyBank,
  Briefcase,
  GraduationCap,
  Tag,
  ChevronDown,
  ChevronUp,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

export const Route = createFileRoute("/_authenticated/trips/$tripId")({
  head: () => ({ meta: [{ title: "Trip — Voyage" }] }),
  component: TripDetail,
});

type ExpenseItem = {
  id: string;
  expense_id: string;
  description: string;
  amount: number;
};

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
  expense_items: ExpenseItem[] | null;
};

type Category = { id: string; name: string; icon: string; color: string; is_preset: boolean };

const CATEGORY_ICON_MAP: { match: RegExp; icon: LucideIcon }[] = [
  { match: /coffee|cafe|tea/i, icon: Coffee },
  { match: /beer|bar|drink|alcohol|wine|pub/i, icon: Beer },
  { match: /food|meal|restaurant|eat|dining|grocer/i, icon: Utensils },
  { match: /flight|plane|air/i, icon: Plane },
  { match: /train|rail|metro|subway/i, icon: Train },
  { match: /boat|ferry|cruise|ship/i, icon: Ship },
  { match: /fuel|gas|petrol/i, icon: Fuel },
  { match: /car|taxi|uber|rental|drive/i, icon: Car },
  { match: /bus|transport|transit|commut/i, icon: Bus },
  { match: /hotel|lodg|stay|hostel|airbnb|accommod|room/i, icon: BedDouble },
  { match: /activit|tour|ticket|event|attraction|museum/i, icon: Ticket },
  { match: /movie|cinema|film/i, icon: Film },
  { match: /music|concert/i, icon: Music },
  { match: /photo|camera/i, icon: Camera },
  { match: /shop|store|mall|market/i, icon: ShoppingBag },
  { match: /cloth|shirt|wear|fashion/i, icon: Shirt },
  { match: /gift|present/i, icon: Gift },
  { match: /health|medic|pharma/i, icon: HeartPulse },
  { match: /doctor|hospital|clinic/i, icon: Stethoscope },
  { match: /wifi|internet|data/i, icon: Wifi },
  { match: /phone|sim|call/i, icon: Phone },
  { match: /gym|fitness|sport/i, icon: Dumbbell },
  { match: /pet|dog|cat/i, icon: PawPrint },
  { match: /baby|kid|child/i, icon: Baby },
  { match: /repair|fix|service/i, icon: Wrench },
  { match: /cash|withdraw|atm|bank/i, icon: Banknote },
  { match: /card|fee/i, icon: CreditCard },
  { match: /saving|deposit/i, icon: PiggyBank },
  { match: /work|business|office/i, icon: Briefcase },
  { match: /school|educat|course|class/i, icon: GraduationCap },
  { match: /other|misc/i, icon: Sparkles },
];

function iconForCategory(name?: string | null): LucideIcon {
  if (!name) return Tag;
  for (const { match, icon } of CATEGORY_ICON_MAP) {
    if (match.test(name)) return icon;
  }
  return Tag;
}

function TripDetail() {
  const { tripId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const tripQuery = useQuery({
    queryKey: ["trip", tripId],
    queryFn: async () => {
      const { data, error } = await supabase.from("trips").select("*").eq("id", tripId).single();
      if (error) throw error;
      return data;
    },
  });

  const expensesQuery = useQuery({
    queryKey: ["expenses", tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select(
          "id,amount,currency,amount_in_trip_currency,fx_rate_to_trip,category_id,note,spent_at,kind,expense_items(id,expense_id,description,amount)",
        )
        .eq("trip_id", tripId)
        .order("spent_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Expense[];
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
    const byDay: Record<string, number> = {};
    for (const e of expenses) {
      const v = Number(e.amount_in_trip_currency);
      const delta = e.kind === "income" ? -v : v;
      spent += delta;
      if (e.kind === "expense") {
        const d = e.spent_at.slice(0, 10);
        byDay[d] = (byDay[d] ?? 0) + v;
      }
    }
    const mostSpentDay = Object.values(byDay).length ? Math.max(...Object.values(byDay)) : 0;
    return { spent, remaining: Number(trip?.budget_amount ?? 0) - spent, mostSpentDay };
  }, [expenses, trip]);

  const todayStats = useMemo(() => {
    if (!trip) return null;

    const todayStr = format(new Date(), "yyyy-MM-dd");

    const expensesUntilToday = expenses.filter((e) => {
      const expenseDateStr = e.spent_at.slice(0, 10);
      return expenseDateStr <= todayStr;
    });

    const spendUntilToday = expensesUntilToday.reduce((sum, e) => {
      const v = Number(e.amount_in_trip_currency);
      return sum + (e.kind === "income" ? -v : v);
    }, 0);

    let paceBudget = null;
    let daysPassed = 0;
    let totalDays = 0;
    let savingUntilToday = Number(trip.budget_amount) - spendUntilToday;

    if (trip.start_date && trip.end_date) {
      const start = new Date(trip.start_date);
      const end = new Date(trip.end_date);
      totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (totalDays > 0) {
        const dailyBudget = Number(trip.budget_amount) / totalDays;
        const today = new Date(todayStr);
        const daysFromStart =
          Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        daysPassed = Math.max(0, Math.min(totalDays, daysFromStart));
        paceBudget = dailyBudget * daysPassed;
        savingUntilToday = paceBudget - spendUntilToday;
      }
    }

    return {
      spendUntilToday,
      savingUntilToday,
      paceBudget,
      daysPassed,
      totalDays,
      hasDates: !!(trip.start_date && trip.end_date),
    };
  }, [expenses, trip]);

  const pct =
    trip && Number(trip.budget_amount) > 0 ? (totals.spent / Number(trip.budget_amount)) * 100 : 0;

  const [filter, setFilter] = useState<"all" | "expense" | "income">("all");
  const [searchText, setSearchText] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showRingDetails, setShowRingDetails] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  const filteredExpenses = useMemo(() => {
    const min = parseFloat(minAmount);
    const max = parseFloat(maxAmount);
    const q = searchText.trim().toLowerCase();
    return expenses.filter((e) => {
      if (filter !== "all" && e.kind !== filter) return false;
      const day = e.spent_at.slice(0, 10);
      if (dateFrom && day < dateFrom) return false;
      if (dateTo && day > dateTo) return false;
      const v = Math.abs(Number(e.amount_in_trip_currency));
      if (isFinite(min) && v < min) return false;
      if (isFinite(max) && v > max) return false;
      if (q) {
        const cat = e.category_id
          ? (categories.find((c) => c.id === e.category_id)?.name ?? "")
          : "";
        const hay = `${e.note ?? ""} ${cat} ${e.currency}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [expenses, filter, searchText, dateFrom, dateTo, minAmount, maxAmount, categories]);

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState<string>(trip?.currency ?? "USD");
  const [displayRate, setDisplayRate] = useState<number>(1);
  const [displayRateLoading, setDisplayRateLoading] = useState(false);
  const fetchFx = useServerFn(getFxRate);

  useEffect(() => {
    if (trip?.currency) setDisplayCurrency(trip.currency);
  }, [trip?.currency]);

  useEffect(() => {
    let cancelled = false;
    if (!trip?.currency || displayCurrency === trip.currency) {
      setDisplayRate(1);
      return;
    }
    setDisplayRateLoading(true);
    fetchFx({ data: { from: trip.currency, to: displayCurrency } })
      .then((r) => {
        if (!cancelled) setDisplayRate(r.rate);
      })
      .catch(() => {
        if (!cancelled) setDisplayRate(1);
      })
      .finally(() => {
        if (!cancelled) setDisplayRateLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [trip?.currency, displayCurrency, fetchFx]);

  const toDisplay = (v: number) => Math.round(v * displayRate * 100) / 100;

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

  const deleteItemMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expense_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses", tripId] });
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
      <Link
        to="/trips"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Trips
      </Link>

      <div className="rounded-3xl bg-card/80 p-6 shadow-glow">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{trip.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {trip.destination && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {trip.destination}
                </span>
              )}
              {(trip.start_date || trip.end_date) && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {trip.start_date} {trip.end_date && `→ ${trip.end_date}`}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            <Button asChild variant="ghost" size="icon" title="Buy list">
              <Link to="/trips/$tripId/buy" params={{ tripId }}>
                <ShoppingBag className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="icon" title="Summary">
              <Link to="/trips/$tripId/summary" params={{ tripId }}>
                <BarChart3 className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={deleteTrip} title="Delete trip">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center">
          {/* Total Spent - Main Ring (Clickable to Expand) */}
          <button
            type="button"
            onClick={() => setShowRingDetails((prev) => !prev)}
            className="flex flex-col items-center gap-1.5 focus:outline-none transition-transform hover:scale-105 active:scale-95 cursor-pointer"
            aria-label={showRingDetails ? "Hide stats details" : "Show more stats details"}
          >
            <div className="relative">
              <SmallRing
                percent={pct}
                label={formatMoney(toDisplay(totals.spent), displayCurrency)}
                color="var(--primary)"
              />
              <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow">
                {showRingDetails ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </div>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Total Spent
            </span>
          </button>

          {/* Collapsible stats */}
          {showRingDetails && (
            <div className="mt-4 flex w-full justify-around gap-2 animate-pop-in border-t border-border/20 pt-4">
              {/* Most-Spent Day */}
              <div className="flex flex-col items-center gap-1.5">
                <SmallRing
                  percent={
                    totals.spent > 0 ? Math.min(100, (totals.mostSpentDay / totals.spent) * 100) : 0
                  }
                  label={formatMoney(toDisplay(totals.mostSpentDay), displayCurrency)}
                  color="var(--secondary)"
                />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Best Day
                </span>
              </div>

              {/* Remaining */}
              <div className="flex flex-col items-center gap-1.5">
                <SmallRing
                  percent={
                    Number(trip.budget_amount) > 0
                      ? Math.min(
                          100,
                          (Math.abs(totals.remaining) / Number(trip.budget_amount)) * 100,
                        )
                      : 0
                  }
                  label={formatMoney(toDisplay(Math.abs(totals.remaining)), displayCurrency)}
                  color={totals.remaining >= 0 ? "var(--success)" : "var(--destructive)"}
                />
                <span
                  className={`text-[10px] uppercase tracking-wider ${
                    totals.remaining < 0 ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {totals.remaining >= 0 ? "Remaining" : "Over Budget"}
                </span>
              </div>
            </div>
          )}
        </div>

        {todayStats && (
          <div className="mt-6 border-t border-border/40 pt-4 w-full">
            <div className="flex items-center justify-between text-xs text-muted-foreground uppercase tracking-wider mb-2">
              <span>Status Until Today</span>
              {todayStats.hasDates && (
                <span>
                  Day {todayStats.daysPassed} of {todayStats.totalDays}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-background/40 p-3">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                  Spent until today
                </span>
                <span className="text-base font-semibold block mt-0.5">
                  {formatMoney(toDisplay(todayStats.spendUntilToday), displayCurrency)}
                </span>
                {todayStats.paceBudget !== null && (
                  <span className="text-[10px] text-muted-foreground">
                    of {formatMoney(toDisplay(todayStats.paceBudget), displayCurrency)} paced
                  </span>
                )}
              </div>
              <div className="rounded-2xl bg-background/40 p-3">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                  {todayStats.savingUntilToday >= 0 ? "Saved until today" : "Overspent until today"}
                </span>
                <span
                  className={`text-base font-semibold block mt-0.5 ${
                    todayStats.savingUntilToday >= 0
                      ? "text-[color:var(--success)]"
                      : "text-destructive"
                  }`}
                >
                  {formatMoney(toDisplay(Math.abs(todayStats.savingUntilToday)), displayCurrency)}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold mt-1 ${
                    todayStats.savingUntilToday >= 0
                      ? "bg-[color:var(--success)]/10 text-[color:var(--success)]"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {todayStats.savingUntilToday >= 0 ? "On track" : "Over budget"}
                </span>
              </div>
            </div>
          </div>
        )}

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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Activity</h2>
          <div className="flex items-center gap-2">
            <Select value={displayCurrency} onValueChange={setDisplayCurrency}>
              <SelectTrigger className="h-8 w-[100px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="inline-flex rounded-full border border-border bg-card/60 p-1 text-xs">
              {(["all", "expense", "income"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3 py-1 capitalize transition-colors ${
                    filter === f
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f === "all" ? "All" : f === "expense" ? "− Expenses" : "+ Income"}
                </button>
              ))}
            </div>
            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              className="h-8 gap-1 text-xs transition-all hover:scale-105 active:scale-95"
              onClick={() => setShowFilters((s) => !s)}
            >
              <SlidersHorizontal className="h-3 w-3" /> Search
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="mb-4 animate-pop-in rounded-2xl border border-border bg-card/60 p-3 space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search note, category, currency…"
                className="h-9 pl-9 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  From
                </Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  To
                </Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Min {trip.currency}
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  placeholder="0"
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Max {trip.currency}
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  placeholder="∞"
                  className="h-9 text-sm"
                />
              </div>
            </div>
            {(searchText || dateFrom || dateTo || minAmount || maxAmount) && (
              <button
                type="button"
                onClick={() => {
                  setSearchText("");
                  setDateFrom("");
                  setDateTo("");
                  setMinAmount("");
                  setMaxAmount("");
                }}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {displayCurrency !== trip.currency && (
          <div className="mb-2 text-xs text-muted-foreground">
            {displayRateLoading
              ? "Converting…"
              : `Showing in ${displayCurrency} · 1 ${trip.currency} = ${displayRate.toFixed(4)} ${displayCurrency}`}
          </div>
        )}
        {!filteredExpenses.length ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
            {expenses.length
              ? "Nothing matches this filter."
              : "No expenses yet. Tap + to add one."}
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map(([day, items]) => {
              const dayExpenses = items
                .filter((e) => e.kind === "expense")
                .reduce((s, e) => s + Number(e.amount_in_trip_currency), 0);
              const dayIncomes = items
                .filter((e) => e.kind === "income")
                .reduce((s, e) => s + Number(e.amount_in_trip_currency), 0);
              const isDayExpanded = expandedDays[day] ?? false;
              return (
                <div key={day} className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setExpandedDays((prev) => ({ ...prev, [day]: !prev[day] }))}
                    className="mb-2 flex w-full items-center justify-between text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-all active:scale-[0.99] cursor-pointer"
                  >
                    <span>{format(parseISO(day), "EEE, d MMM yyyy")}</span>
                    <span className="flex items-center gap-1.5 font-medium">
                      {dayIncomes > 0 && (
                        <span className="text-[color:var(--success)]">
                          +{formatMoney(toDisplay(dayIncomes), displayCurrency)}
                        </span>
                      )}
                      {dayIncomes > 0 && dayExpenses > 0 && (
                        <span className="text-muted-foreground/30">|</span>
                      )}
                      {dayExpenses > 0 ? (
                        <span>{formatMoney(toDisplay(dayExpenses), displayCurrency)}</span>
                      ) : (
                        dayIncomes === 0 && <span>{formatMoney(0, displayCurrency)}</span>
                      )}
                      {isDayExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5 ml-1 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 ml-1 text-muted-foreground" />
                      )}
                    </span>
                  </button>
                  {isDayExpanded && (
                    <div className="overflow-hidden rounded-2xl border border-border bg-card/60 animate-pop-in">
                      {items.map((e, i) => {
                        const cat = e.category_id ? catById[e.category_id] : null;
                        const Icon = iconForCategory(cat?.name);
                        const hasItems = !!e.expense_items && e.expense_items.length > 0;
                        const isOpen = expandedId === e.id;
                        return (
                          <div
                            key={e.id}
                            className={`animate-fade-in ${i > 0 ? "border-t border-border/40" : ""}`}
                          >
                            <div className="flex items-center gap-3 px-4 py-3">
                              <span
                                className="flex h-9 w-9 items-center justify-center rounded-full"
                                style={{
                                  backgroundColor: (cat?.color ?? "#5cbdb9") + "33",
                                  color: cat?.color ?? "#5cbdb9",
                                }}
                              >
                                <Icon className="h-4 w-4" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium">
                                  {e.note ||
                                    cat?.name ||
                                    (e.kind === "income" ? "Income" : "Expense")}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {cat?.name ?? "Uncategorized"}
                                  {e.currency !== trip.currency &&
                                    ` · ${formatMoney(Number(e.amount), e.currency)}`}
                                  {hasItems &&
                                    ` · ${e.expense_items!.length} item${e.expense_items!.length > 1 ? "s" : ""}`}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setExpandedId(isOpen ? null : e.id)}
                                className="flex items-center gap-1.5 font-semibold transition-all hover:text-primary active:scale-95 text-right cursor-pointer"
                                aria-label={isOpen ? "Hide breakdown" : "Add or view breakdown"}
                                title="Breakdown"
                              >
                                <span
                                  className={
                                    e.kind === "income" ? "text-[color:var(--success)]" : ""
                                  }
                                >
                                  {e.kind === "income" ? "+" : "−"}
                                  {formatMoney(
                                    toDisplay(Number(e.amount_in_trip_currency)),
                                    displayCurrency,
                                  )}
                                </span>
                                {isOpen ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                              </button>
                              <button
                                onClick={() => deleteMut.mutate(e.id)}
                                className="ml-1 rounded p-1 text-muted-foreground hover:text-destructive"
                                aria-label="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            {isOpen && (
                              <div className="px-4 pb-3">
                                <div className="ml-12 space-y-2 rounded-xl bg-muted/30 px-3 py-2 animate-pop-in">
                                  {e.expense_items?.map((item) => (
                                    <div
                                      key={item.id}
                                      className="flex items-center justify-between gap-2 text-xs animate-fade-in"
                                    >
                                      <span className="flex-1 truncate text-muted-foreground">
                                        {item.description}
                                      </span>
                                      <span className="font-medium">
                                        {formatMoney(Number(item.amount), e.currency)}
                                      </span>
                                      <button
                                        onClick={() => deleteItemMut.mutate(item.id)}
                                        className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                                        aria-label="Remove item"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ))}
                                  <InlineItemAdder expenseId={e.id} currency={e.currency} />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SmallRing({ percent, label, color }: { percent: number; label: string; color: string }) {
  const p = Math.max(0, Math.min(100, percent));
  const r = 44;
  const c = 2 * Math.PI * r;
  const offset = c - (p / 100) * c;
  return (
    <div className="relative h-28 w-28">
      <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={r}
          stroke="currentColor"
          strokeOpacity="0.12"
          strokeWidth="9"
          fill="none"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          stroke={color}
          strokeWidth="9"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: "stroke-dashoffset 700ms cubic-bezier(0.4,0,0.2,1)",
            filter: `drop-shadow(0 0 6px ${color}88)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-1">
        <span
          className="text-[11px] font-bold leading-tight text-center break-all"
          style={{ color }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
function QuickAddSheet({
  kind,
  open,
  setOpen,
  tripId,
  tripCurrency,
  categories,
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
  const [items, setItems] = useState<{ description: string; amount: string }[]>([]);
  const [tappedChip, setTappedChip] = useState<number | null>(null);
  const [tappedCategory, setTappedCategory] = useState<string | null>(null);

  const isExpense = kind === "expense";

  useEffect(() => {
    let cancelled = false;
    if (currency === previewCurrency) {
      setPreviewRate(1);
      return;
    }
    setPreviewLoading(true);
    fetchFx({ data: { from: currency, to: previewCurrency } })
      .then((r) => {
        if (!cancelled) setPreviewRate(r.rate);
      })
      .catch(() => {
        if (!cancelled) setPreviewRate(null);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currency, previewCurrency, fetchFx]);

  const previewAmount = useMemo(() => {
    const n = parseFloat(amount);
    if (!isFinite(n) || n <= 0 || previewRate == null) return null;
    return Math.round(n * previewRate * 100) / 100;
  }, [amount, previewRate]);

  const itemsTotal = useMemo(() => {
    return items.reduce((s, it) => {
      const v = parseFloat(it.amount);
      return s + (isFinite(v) && v > 0 ? v : 0);
    }, 0);
  }, [items]);

  const addItem = () => setItems((prev) => [...prev, { description: "", amount: "" }]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: "description" | "amount", value: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

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
      const { data: inserted, error } = await supabase
        .from("expenses")
        .insert({
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
        })
        .select("id")
        .single();
      if (error) throw error;

      const validItems = items.filter((it) => it.description.trim() && parseFloat(it.amount) > 0);
      if (validItems.length > 0) {
        const { error: itemErr } = await supabase.from("expense_items").insert(
          validItems.map((it) => ({
            expense_id: inserted.id,
            user_id: u.user!.id,
            description: it.description.trim(),
            amount: parseFloat(it.amount),
          })),
        );
        if (itemErr) throw itemErr;
      }

      qc.invalidateQueries({ queryKey: ["expenses", tripId] });
      qc.invalidateQueries({ queryKey: ["trips"] });
      toast.success(isExpense ? "Expense added" : "Income added");
      setAmount("");
      setNote("");
      setItems([]);
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
          className={`h-14 text-base transition-all hover:scale-[1.03] active:scale-95 ${isExpense ? "shadow-glow" : ""}`}
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quick amount chips for faster entry */}
          <div className="flex flex-wrap gap-2">
            {[5, 10, 20, 50, 100].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  const cur = parseFloat(amount);
                  const next = (isFinite(cur) ? cur : 0) + v;
                  setAmount(String(Math.round(next * 100) / 100));
                  setTappedChip(v);
                  setTimeout(() => setTappedChip(null), 400);
                }}
                className={`rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium transition-all hover:scale-105 hover:bg-primary hover:text-primary-foreground active:scale-95 ${tappedChip === v ? "animate-tap-bounce" : ""}`}
              >
                +{v}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAmount("")}
              className="rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
            >
              Clear
            </button>
          </div>

          <div className="rounded-xl border border-border bg-card/40 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Convert to
              </Label>
              <Select value={previewCurrency} onValueChange={setPreviewCurrency}>
                <SelectTrigger className="h-8 w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-lg font-semibold">
              {previewAmount != null ? (
                <>= {formatMoney(previewAmount, previewCurrency)}</>
              ) : (
                <span className="text-muted-foreground text-sm">
                  {previewLoading ? "Fetching rate…" : "Enter an amount to see equivalent"}
                </span>
              )}
            </div>
            {previewRate != null && currency !== previewCurrency && (
              <div className="mt-1 text-xs text-muted-foreground">
                1 {currency} = {previewRate.toFixed(4)} {previewCurrency}
              </div>
            )}
          </div>

          <div>
            <Label>Category</Label>
            <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {categories.map((c) => {
                const active = categoryId === c.id;
                const Icon = iconForCategory(c.name);
                const color = c.color ?? "#5cbdb9";
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCategoryId(c.id);
                      setTappedCategory(c.id);
                      setTimeout(() => setTappedCategory(null), 400);
                    }}
                    className={`group flex flex-col items-center gap-1 rounded-xl border p-2 text-[11px] font-medium transition-all hover:scale-105 active:scale-95 animate-fade-in ${
                      active
                        ? "border-transparent shadow-glow"
                        : "border-border bg-card/60 hover:border-primary/50"
                    } ${tappedCategory === c.id ? "animate-tap-bounce" : ""}`}
                    style={active ? { backgroundColor: color + "22", color } : undefined}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full transition-transform ${active ? "scale-110" : "group-hover:scale-110"}`}
                      style={{ backgroundColor: color + "33", color }}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="truncate max-w-full">
                      {c.name}
                      {!c.is_preset && " ✦"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              rows={2}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What was this for?"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Breakdown (optional)</Label>
              <span className="text-xs text-muted-foreground">
                {itemsTotal > 0 ? `Items total: ${formatMoney(itemsTotal, currency)}` : ""}
              </span>
            </div>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_100px_32px] gap-2">
                  <Input
                    placeholder="e.g. tomatoes, bag..."
                    value={it.description}
                    onChange={(e) => updateItem(idx, "description", e.target.value)}
                  />
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={it.amount}
                    onChange={(e) => updateItem(idx, "amount", e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={addItem} className="text-xs">
              <Plus className="mr-1 h-3 w-3" /> Add item
            </Button>
            {itemsTotal > 0 &&
              parseFloat(amount) > 0 &&
              Math.abs(itemsTotal - parseFloat(amount)) > 0.01 && (
                <div className="text-xs text-amber-400">
                  Item total ({formatMoney(itemsTotal, currency)}) doesn't match entered amount (
                  {formatMoney(parseFloat(amount), currency)})
                </div>
              )}
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

function InlineItemAdder({ expenseId, currency }: { expenseId: string; currency: string }) {
  const qc = useQueryClient();
  const [desc, setDesc] = useState("");
  const [amt, setAmt] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    const n = parseFloat(amt);
    if (!desc.trim() || !isFinite(n) || n <= 0) return toast.error("Enter description and amount");
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("expense_items").insert({
        expense_id: expenseId,
        user_id: u.user.id,
        description: desc.trim(),
        amount: n,
      });
      if (error) throw error;
      setDesc("");
      setAmt("");
      qc.invalidateQueries({ queryKey: ["expenses"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2 pt-1">
      <Input
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder={`Add item in ${currency}…`}
        className="h-7 flex-1 text-xs"
      />
      <Input
        value={amt}
        onChange={(e) => setAmt(e.target.value)}
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        placeholder="0.00"
        className="h-7 w-20 text-xs"
      />
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="h-7 px-2"
        onClick={add}
        disabled={saving}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}
