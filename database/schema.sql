-- ============================================================
-- PRIMORA - Production Database Schema
-- Version: 1.0.0
-- Last Updated: 2026-09-08
-- 
-- Cara pakai:
-- 1. Buka Supabase Dashboard → SQL Editor
-- 2. Copy-paste seluruh isi file ini
-- 3. Klik Run
-- 4. Database siap digunakan!
--
-- Catatan: Script ini aman dijalankan berulang kali (idempotent)
-- ============================================================

-- ============================================================
-- BAGIAN 1: BERSIHKAN TABEL LAMA (Jika ada)
-- ============================================================
DROP TABLE IF EXISTS public.progress_updates CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.services CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ============================================================
-- BAGIAN 2: BUAT TABEL-TABEL BARU
-- ============================================================

-- 1. CATEGORIES (Kategori Jasa)
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT DEFAULT '📦',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. SERVICES (Katalog Jasa)
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  base_price INT NOT NULL,
  estimated_hours INT DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. PROFILES (Data User - terhubung dengan auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT DEFAULT 'consumer' 
    CHECK (role IN ('consumer', 'worker', 'admin')),
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. ORDERS (Transaksi Order)
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' 
    CHECK (status IN ('pending', 'paid', 'in_progress', 'completed', 'cancelled')),
  total_price INT NOT NULL,
  account_email TEXT,
  account_password TEXT,
  current_percentage INT DEFAULT 0 
    CHECK (current_percentage >= 0 AND current_percentage <= 100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 5. PROGRESS_UPDATES (Tracking Progres Worker)
CREATE TABLE public.progress_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  percentage INT NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  screenshot_url TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- BAGIAN 3: INDEXES (Untuk performa query)
-- ============================================================
CREATE INDEX idx_orders_consumer ON public.orders(consumer_id);
CREATE INDEX idx_orders_worker ON public.orders(worker_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_service ON public.orders(service_id);
CREATE INDEX idx_progress_order ON public.progress_updates(order_id);
CREATE INDEX idx_services_category ON public.services(category);
CREATE INDEX idx_profiles_role ON public.profiles(role);

-- ============================================================
-- BAGIAN 4: TRIGGER AUTO-CREATE PROFILE
-- Fungsi ini otomatis membuat row di tabel profiles 
-- setiap kali ada user baru yang signup
-- ============================================================
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- BAGIAN 5: AKTIFKAN ROW LEVEL SECURITY (RLS)
-- WAJIB untuk production agar data user terlindungi
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- BAGIAN 6: KEBIJAKAN RLS (POLICIES)
-- ============================================================

-- PROFILES: Semua user bisa lihat profil, tapi hanya bisa edit punya sendiri
CREATE POLICY "profiles_select_all" 
  ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" 
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" 
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- SERVICES: Semua orang bisa lihat jasa yang aktif (publik)
CREATE POLICY "services_select_active" 
  ON public.services FOR SELECT USING (is_active = true);

-- CATEGORIES: Semua orang bisa lihat kategori yang aktif (publik)
CREATE POLICY "categories_select_active" 
  ON public.categories FOR SELECT USING (is_active = true);

-- ORDERS: 
-- - Consumer lihat order sendiri
-- - Worker lihat order yang ditugaskan ke mereka
-- - Admin lihat semua order
CREATE POLICY "orders_select_relevant" 
  ON public.orders FOR SELECT USING (
    auth.uid() = consumer_id OR 
    auth.uid() = worker_id OR 
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
CREATE POLICY "orders_insert_consumer" 
  ON public.orders FOR INSERT WITH CHECK (auth.uid() = consumer_id);
CREATE POLICY "orders_update_worker" 
  ON public.orders FOR UPDATE USING (auth.uid() = worker_id);
CREATE POLICY "orders_update_consumer" 
  ON public.orders FOR UPDATE USING (auth.uid() = consumer_id);
CREATE POLICY "orders_update_admin" 
  ON public.orders FOR UPDATE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- PROGRESS_UPDATES:
-- - Consumer & Worker bisa lihat progres order mereka
CREATE POLICY "progress_select_relevant" 
  ON public.progress_updates FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = progress_updates.order_id 
      AND (orders.consumer_id = auth.uid() OR orders.worker_id = auth.uid() OR 
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
    )
  );
-- - Hanya Worker yang ditugaskan bisa menambah progres
CREATE POLICY "progress_insert_worker" 
  ON public.progress_updates FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = progress_updates.order_id 
      AND orders.worker_id = auth.uid()
    )
  );

-- ============================================================
-- SELESAI! Database siap digunakan.
-- Jalankan seed.sql untuk data dummy (opsional)
-- ============================================================