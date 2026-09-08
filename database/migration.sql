-- ============================================================
-- MIGRATION: Tambah Constraints ke Tabel Existing
-- ============================================================
-- Migration (Jika Ada Data Penting)
-- Ini akan menambahkan constraints yang hilang ke tabel yang sudah ada, tanpa menghapus data.
-- Gunakan ini jika:

-- Ada data penting (services, categories) yang tidak ingin dihapus
-- Database sudah live dan ada user aktif
-- ============================================================

-- 1. CATEGORIES: Tambah UNIQUE constraints
ALTER TABLE public.categories 
  ADD CONSTRAINT IF NOT EXISTS categories_name_key UNIQUE (name),
  ADD CONSTRAINT IF NOT EXISTS categories_slug_key UNIQUE (slug);

-- 2. PROFILES: Tambah PRIMARY KEY, FOREIGN KEY, dan CHECK constraint
ALTER TABLE public.profiles
  ADD CONSTRAINT IF NOT EXISTS profiles_pkey PRIMARY KEY (id),
  ADD CONSTRAINT IF NOT EXISTS profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT IF NOT EXISTS profiles_role_check CHECK (role = ANY (ARRAY['consumer'::text, 'worker'::text, 'admin'::text]));

-- 3. ORDERS: Tambah PRIMARY KEY, FOREIGN KEYs, dan CHECK constraints
ALTER TABLE public.orders
  ADD CONSTRAINT IF NOT EXISTS orders_pkey PRIMARY KEY (id),
  ADD CONSTRAINT IF NOT EXISTS orders_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT IF NOT EXISTS orders_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT IF NOT EXISTS orders_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL,
  ADD CONSTRAINT IF NOT EXISTS orders_status_check CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])),
  ADD CONSTRAINT IF NOT EXISTS orders_percentage_check CHECK (current_percentage >= 0 AND current_percentage <= 100);

-- 4. PROGRESS UPDATES: Tambah PRIMARY KEY, FOREIGN KEY, dan CHECK constraint
ALTER TABLE public.progress_updates
  ADD CONSTRAINT IF NOT EXISTS progress_updates_pkey PRIMARY KEY (id),
  ADD CONSTRAINT IF NOT EXISTS progress_updates_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE,
  ADD CONSTRAINT IF NOT EXISTS progress_updates_percentage_check CHECK (percentage >= 0 AND percentage <= 100);

-- 5. SERVICES: Tambah PRIMARY KEY
ALTER TABLE public.services
  ADD CONSTRAINT IF NOT EXISTS services_pkey PRIMARY KEY (id);

-- 6. Tambah INDEXES untuk performa
CREATE INDEX IF NOT EXISTS idx_orders_consumer ON public.orders(consumer_id);
CREATE INDEX IF NOT EXISTS idx_orders_worker ON public.orders(worker_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_service ON public.orders(service_id);
CREATE INDEX IF NOT EXISTS idx_progress_order ON public.progress_updates(order_id);
CREATE INDEX IF NOT EXISTS idx_services_category ON public.services(category);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 7. Setup Trigger (sama seperti script sebelumnya)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, phone)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(new.raw_user_meta_data->>'role', 'consumer'),
    new.raw_user_meta_data->>'phone'
  );
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Enable RLS dan buat policies (sama seperti script sebelumnya)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama
DO $$ 
DECLARE pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname, tablename FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename IN ('profiles','orders','progress_updates','services','categories')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Buat policy baru
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "orders_select_relevant" ON public.orders FOR SELECT USING (
  auth.uid() = consumer_id OR auth.uid() = worker_id OR 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "orders_insert_consumer" ON public.orders FOR INSERT WITH CHECK (auth.uid() = consumer_id);
CREATE POLICY "orders_update_worker" ON public.orders FOR UPDATE USING (auth.uid() = worker_id);
CREATE POLICY "orders_update_admin" ON public.orders FOR UPDATE USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "progress_select_relevant" ON public.progress_updates FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders WHERE orders.id = progress_updates.order_id 
    AND (orders.consumer_id = auth.uid() OR orders.worker_id = auth.uid() OR 
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
  )
);
CREATE POLICY "progress_insert_worker" ON public.progress_updates FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders WHERE orders.id = progress_updates.order_id 
    AND orders.worker_id = auth.uid()
  )
);

CREATE POLICY "services_select_all" ON public.services FOR SELECT USING (true);
CREATE POLICY "categories_select_all" ON public.categories FOR SELECT USING (true);