
CREATE TABLE public.shopping_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  source text,
  note text,
  is_purchased boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_items TO authenticated;
GRANT ALL ON public.shopping_items TO service_role;
ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own select" ON public.shopping_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.shopping_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.shopping_items FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.shopping_items FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER shopping_items_updated_at BEFORE UPDATE ON public.shopping_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
