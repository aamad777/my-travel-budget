import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCIES } from "@/lib/currencies";
import { toast } from "sonner";
import { Trash2, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Voyage" }] }),
  component: SettingsPage,
});

export type ThemeKey = "sunset" | "ocean" | "forest" | "midnight" | "cherry" | "coral";

const THEMES: { key: ThemeKey; label: string; stops: string[] }[] = [
  { key: "sunset", label: "Pro Navy", stops: ["#0d1520", "#111c2e", "#1a2d4a", "#c8922a"] },
  { key: "ocean", label: "Ocean Deep", stops: ["#0c2340", "#1a4a6e", "#2d8a9e", "#5cbdb9"] },
  { key: "forest", label: "Forest & Moss", stops: ["#1a3c2a", "#2d5a3d", "#5a8a5c", "#a0c49d"] },
  {
    key: "midnight",
    label: "Midnight Indigo",
    stops: ["#0f1b3d", "#1e3a5f", "#3b6fa0", "#6c5ce7"],
  },
  { key: "cherry", label: "Cherry Blossom", stops: ["#c45c7c", "#e88aab", "#f8c8d8", "#fef0f5"] },
  { key: "coral", label: "Electric Coral", stops: ["#ff6b6b", "#ee5a70", "#c44569", "#574b90"] },
];

function setStoredTheme(key: ThemeKey) {
  try {
    localStorage.setItem("voyage-theme", key);
    document.documentElement.setAttribute("data-theme", key);
  } catch {
    /* ignore */
  }
}

function SettingsPage() {
  const qc = useQueryClient();
  const [theme, setTheme] = useState<ThemeKey>("sunset");

  useEffect(() => {
    try {
      const t = localStorage.getItem("voyage-theme") as ThemeKey | null;
      if (t && THEMES.some((th) => th.key === t)) setTheme(t);
    } catch {
      /* ignore */
    }
  }, []);

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

  // Sync form state from fetched profile (must be in useEffect to avoid re-render loops)
  useEffect(() => {
    if (!profile) return;
    if (profile.display_name) setName(profile.display_name);
    if (profile.default_currency) setCurrency(profile.default_currency);
  }, [profile]);

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Saved");
    },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      setNewCat("");
      toast.success("Category added");
    },
    onError: (e) => toast.error(e.message),
  });

  const delCat = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Deleted");
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        {profile?.email && <p className="text-sm text-muted-foreground">{profile.email}</p>}
      </div>

      <section className="rounded-2xl border border-border bg-card/70 p-6">
        <h2 className="text-lg font-semibold">Appearance</h2>
        <p className="text-sm text-muted-foreground">Pick a color theme for the app.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {THEMES.map((t) => {
            const active = theme === t.key;
            return (
              <button
                key={t.key}
                onClick={() => {
                  setTheme(t.key);
                  setStoredTheme(t.key);
                  toast.success(`Theme: ${t.label}`);
                }}
                className={`relative rounded-xl border p-3 text-left transition hover:scale-[1.02] ${
                  active
                    ? "border-primary ring-1 ring-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div
                  className="h-10 w-full rounded-lg"
                  style={{
                    background: `linear-gradient(135deg, ${t.stops[0]}, ${t.stops[1]} 50%, ${t.stops[2]})`,
                  }}
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-medium">{t.label}</span>
                  {active && <Check className="h-4 w-4 text-primary" />}
                </div>
              </button>
            );
          })}
        </div>
      </section>

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
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </SelectItem>
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
        <p className="text-sm text-muted-foreground">
          Add your own categories on top of the presets.
        </p>

        <div className="mt-4 space-y-2">
          {catsQ.data?.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-lg bg-background/40 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full" style={{ backgroundColor: c.color }} />
                <span>{c.name}</span>
                {c.is_preset && <span className="text-xs text-muted-foreground">preset</span>}
              </div>
              {!c.is_preset && (
                <button
                  onClick={() => delCat.mutate(c.id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-[1fr_80px_auto] items-end gap-2">
          <div>
            <Label htmlFor="nc">New category</Label>
            <Input
              id="nc"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              maxLength={40}
              placeholder="Coffee"
            />
          </div>
          <div>
            <Label htmlFor="col">Color</Label>
            <Input
              id="col"
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="h-10 p-1"
            />
          </div>
          <Button onClick={() => addCat.mutate()} disabled={addCat.isPending}>
            Add
          </Button>
        </div>
      </section>
    </div>
  );
}
