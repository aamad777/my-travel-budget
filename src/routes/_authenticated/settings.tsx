import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCIES } from "@/lib/currencies";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Voyage" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();

  const profileQ = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id,display_name,default_currency")
        .eq("id", u.user.id)
        .maybeSingle();
      if (error) throw error;
      return { ...data, email: u.user.email };
    },
  });

  const catsQ = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name,color,is_preset,user_id")
        .order("is_preset", { ascending: false })
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [newCat, setNewCat] = useState("");
  const [newColor, setNewColor] = useState("#5cbdb9");

  const profile = profileQ.data;
  if (profile && name === "" && profile.display_name) setName(profile.display_name);
  if (profile && currency === "USD" && profile.default_currency) setCurrency(profile.default_currency);

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles").upsert({
        id: u.user.id,
        display_name: name.trim() || null,
        default_currency: currency,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profile"] }); toast.success("Saved"); },
    onError: (e) => toast.error(e.message),
  });

  const addCat = useMutation({
    mutationFn: async () => {
      if (!newCat.trim()) throw new Error("Name required");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("categories").insert({
        user_id: u.user!.id,
        name: newCat.trim(),
        color: newColor,
        is_preset: false,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories"] }); setNewCat(""); toast.success("Category added"); },
    onError: (e) => toast.error(e.message),
  });

  const delCat = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories"] }); toast.success("Deleted"); },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        {profile?.email && <p className="text-sm text-muted-foreground">{profile.email}</p>}
      </div>

      <section className="rounded-2xl border border-border bg-card/70 p-6">
        <h2 className="text-lg font-semibold">Profile</h2>
        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="dn">Display name</Label>
            <Input id="dn" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          <div>
            <Label>Default currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
            {saveProfile.isPending ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card/70 p-6">
        <h2 className="text-lg font-semibold">Categories</h2>
        <p className="text-sm text-muted-foreground">Add your own categories on top of the presets.</p>

        <div className="mt-4 space-y-2">
          {catsQ.data?.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg bg-background/40 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full" style={{ backgroundColor: c.color }} />
                <span>{c.name}</span>
                {c.is_preset && <span className="text-xs text-muted-foreground">preset</span>}
              </div>
              {!c.is_preset && (
                <button onClick={() => delCat.mutate(c.id)} className="text-muted-foreground hover:text-destructive" aria-label="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-[1fr_80px_auto] items-end gap-2">
          <div>
            <Label htmlFor="nc">New category</Label>
            <Input id="nc" value={newCat} onChange={(e) => setNewCat(e.target.value)} maxLength={40} placeholder="Coffee" />
          </div>
          <div>
            <Label htmlFor="col">Color</Label>
            <Input id="col" type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="h-10 p-1" />
          </div>
          <Button onClick={() => addCat.mutate()} disabled={addCat.isPending}>Add</Button>
        </div>
      </section>
    </div>
  );
}
