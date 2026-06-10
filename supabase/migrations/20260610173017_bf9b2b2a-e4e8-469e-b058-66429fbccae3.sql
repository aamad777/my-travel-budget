CREATE TABLE public.category_budgets (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null,
  trip_id uuid not null references public.trips(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  amount numeric not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique(trip_id, category_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_budgets TO authenticated;
GRANT ALL ON public.category_budgets TO service_role;
ALTER TABLE public.category_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cb select own" ON public.category_budgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cb insert own" ON public.category_budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cb update own" ON public.category_budgets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "cb delete own" ON public.category_budgets FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER set_category_budgets_updated_at BEFORE UPDATE ON public.category_budgets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();