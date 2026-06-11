import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCIES, formatMoney } from "@/lib/currencies";
import { ArrowLeft, Plus, Trash2, ShoppingBag, Check, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/trips/$tripId/buy")({
  head: () => ({ meta: [{ title: "Buy list — Voyage" }] }),
  component: BuyList,
});

type Item = {
  id: string;
  name: string;
  price: number;
  currency: string;
  source: string | null;
  note: string | null;
  is_purchased: boolean;
};

function BuyList() {
  const { tripId } = Route.useParams();
  const qc = useQueryClient();

  const tripQuery = useQuery({
    queryKey: ["trip", tripId],
    queryFn: async () => {
      const { data, error } = await supabase.from("trips").select("*").eq("id", tripId).single();
      if (error) throw error;
      return data;
    },
  });

  const itemsQuery = useQuery({
    queryKey: ["shopping_items", tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shopping_items")
        .select("id,name,price,currency,source,note,is_purchased")
        .eq("trip_id", tripId)
        .order("is_purchased", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  const trip = tripQuery.data;
  const items = itemsQuery.data ?? [];

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<string>(trip?.currency ?? "USD");
  const [source, setSource] = useState("");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);

  const totals = useMemo(() => {
    let pending = 0, bought = 0;
    for (const i of items) {
      const v = Number(i.price);
      if (i.is_purchased) bought += v; else pending += v;
    }
    return { pending, bought };
  }, [items]);

  const addMut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("shopping_items").insert({
        user_id: u.user.id,
        trip_id: tripId,
        name: name.trim(),
        price: parseFloat(price) || 0,
        currency,
        source: source.trim() || null,
        note: note.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setName(""); setPrice(""); setSource(""); setNote("");
      qc.invalidateQueries({ queryKey: ["shopping_items", tripId] });
      toast.success("Item added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, val }: { id: string; val: boolean }) => {
      const { error } = await supabase.from("shopping_items").update({ is_purchased: val }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping_items", tripId] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shopping_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping_items", tripId] }),
  });

  if (!trip) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div>
      <Link to="/trips/$tripId" params={{ tripId }} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to trip
      </Link>

      <div className="rounded-3xl bg-card/80 p-6 shadow-glow">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary/15 p-3"><ShoppingBag className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold">Buy list</h1>
            <p className="text-xs text-muted-foreground">Plan what you want to buy on this trip</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card/60 p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">To buy</div>
            <div className="mt-1 text-xl font-semibold">{formatMoney(totals.pending, trip.currency)}</div>
          </div>
          <div className="rounded-2xl border border-border bg-card/60 p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Bought</div>
            <div className="mt-1 text-xl font-semibold text-primary">{formatMoney(totals.bought, trip.currency)}</div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card/60 p-4">
        <div className="mb-3 text-sm font-semibold">Add an item</div>
        <div className="grid gap-3">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Item name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunglasses" className="h-10" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Price</Label>
              <Input type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className="h-10" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">From where</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Shop, market, website…" className="h-10" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Size, color, brand…" className="h-10" />
          </div>
          <Button
            disabled={!name.trim() || adding || addMut.isPending}
            onClick={async () => {
              setAdding(true);
              await addMut.mutateAsync().catch(() => {});
              setTimeout(() => setAdding(false), 400);
            }}
            className={`h-11 gap-2 ${adding ? "animate-tap-bounce" : ""}`}
          >
            <Plus className="h-4 w-4" /> Add to list
          </Button>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
            Nothing on your buy list yet.
          </div>
        ) : (
          items.map((i) => (
            <div
              key={i.id}
              className={`flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-3 transition-all ${i.is_purchased ? "opacity-60" : ""}`}
            >
              <button
                onClick={() => toggleMut.mutate({ id: i.id, val: !i.is_purchased })}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all active:scale-90 ${
                  i.is_purchased ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"
                }`}
                title={i.is_purchased ? "Mark as not bought" : "Mark as bought"}
              >
                {i.is_purchased && <Check className="h-4 w-4" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className={`truncate text-sm font-medium ${i.is_purchased ? "line-through" : ""}`}>{i.name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  {i.source && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{i.source}</span>}
                  {i.note && <span className="truncate">· {i.note}</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{formatMoney(Number(i.price), i.currency)}</div>
              </div>
              <button
                onClick={() => deleteMut.mutate(i.id)}
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
