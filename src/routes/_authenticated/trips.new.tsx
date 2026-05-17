import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCIES } from "@/lib/currencies";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/trips/new")({
  head: () => ({ meta: [{ title: "New Trip — Voyage" }] }),
  component: NewTrip,
});

function NewTrip() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setLoading(false); return toast.error("Not signed in"); }
    const budgetNum = parseFloat(budget) || 0;
    const { data, error } = await supabase
      .from("trips")
      .insert({
        user_id: u.user.id,
        name: name.trim(),
        destination: destination.trim() || null,
        start_date: start || null,
        end_date: end || null,
        budget_amount: budgetNum,
        currency,
      })
      .select("id")
      .single();
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Trip created!");
    navigate({ to: "/trips/$tripId", params: { tripId: data!.id } });
  };

  return (
    <div className="mx-auto max-w-xl">
      <Link to="/trips" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to trips
      </Link>
      <h1 className="text-2xl font-bold">New trip</h1>
      <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-border bg-card/70 p-6">
        <div>
          <Label htmlFor="name">Trip name *</Label>
          <Input id="name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tokyo 2026" />
        </div>
        <div>
          <Label htmlFor="dest">Destination</Label>
          <Input id="dest" maxLength={120} value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Tokyo, Japan" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="start">Start date</Label>
            <Input id="start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="end">End date</Label>
            <Input id="end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-[1fr_140px] gap-3">
          <div>
            <Label htmlFor="budget">Budget *</Label>
            <Input id="budget" type="number" min="0" step="0.01" required value={budget} onChange={(e) => setBudget(e.target.value)} />
          </div>
          <div>
            <Label>Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.code} — {c.symbol}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating…" : "Create trip"}
        </Button>
      </form>
    </div>
  );
}
