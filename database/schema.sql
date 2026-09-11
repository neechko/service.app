-- ============================================================
-- SERVICE.APP - DATABASE SCHEMA
-- Game Boosting Service Platform
-- Last Updated: September 2026
-- ============================================================

-- ============================================================
-- 1. EXTENSIONS & SETUP
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 2. TABLES DEFINITION
-- ============================================================

-- Tabel Profiles (Terkait dengan Auth Users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role TEXT DEFAULT 'consumer' CHECK (role IN ('consumer', 'worker', 'admin')),
  phone TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel Services
CREATE TABLE IF NOT EXISTS public.services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT REFERENCES public.categories(slug),
  description TEXT,
  base_price INTEGER NOT NULL DEFAULT 0,
  estimated_hours INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  consumer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  worker_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE NOT NULL,
  total_price INTEGER NOT NULL DEFAULT 0,
  game_uid TEXT,
  game_server TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'in_progress', 'completed', 'cancelled')),
  current_percentage INTEGER DEFAULT 0,
  cancel_reason TEXT,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel Progress Updates
CREATE TABLE IF NOT EXISTS public.progress_updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  percentage INTEGER NOT NULL,
  screenshot_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel Messages (Chat per Order)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 3. INDEXES (Untuk Performa Query)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_orders_consumer ON public.orders(consumer_id);
CREATE INDEX IF NOT EXISTS idx_orders_worker ON public.orders(worker_id);
CREATE INDEX IF NOT EXISTS idx_orders_service ON public.orders(service_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_progress_order ON public.progress_updates(order_id);
CREATE INDEX IF NOT EXISTS idx_messages_order ON public.messages(order_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages(created_at);

-- ============================================================
-- 4. TRIGGERS (Otomatis buat Profile saat User Daftar)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, phone, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(new.raw_user_meta_data->>'role', 'consumer'),
    new.raw_user_meta_data->>'phone',
    new.email
  );
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS) - ENABLE
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. RLS POLICIES - PROFILES
-- ============================================================
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- 7. RLS POLICIES - CATEGORIES & SERVICES (Public Read)
-- ============================================================
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.categories;
DROP POLICY IF EXISTS "Services are viewable by everyone" ON public.services;

CREATE POLICY "Categories are viewable by everyone" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Services are viewable by everyone" ON public.services FOR SELECT USING (true);

-- ============================================================
-- 8. RLS POLICIES - ORDERS (DIPERKETAT)
-- ============================================================
DROP POLICY IF EXISTS "Orders viewable by participants" ON public.orders;
DROP POLICY IF EXISTS "Consumers can insert own orders" ON public.orders;
DROP POLICY IF EXISTS "Participants can update orders" ON public.orders;
DROP POLICY IF EXISTS "Allow consumers to update their own orders" ON public.orders;
DROP POLICY IF EXISTS "Allow workers and admins to update order progress" ON public.orders;

-- Consumer bisa melihat order mereka sendiri
CREATE POLICY "Orders viewable by participants" ON public.orders FOR SELECT USING (
  auth.uid() = consumer_id OR 
  auth.uid() = worker_id OR 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Consumer bisa membuat order baru
CREATE POLICY "Consumers can insert own orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = consumer_id);

-- Consumer bisa update order mereka (termasuk cancel)
CREATE POLICY "Consumers can update their own orders" ON public.orders FOR UPDATE 
USING (auth.uid() = consumer_id) 
WITH CHECK (auth.uid() = consumer_id);

-- ✅ DIPERKETAT: Worker & Admin hanya bisa update order AKTIF (bukan cancelled/completed)
CREATE POLICY "Workers and admins can update active orders" ON public.orders FOR UPDATE
USING (
  (worker_id = auth.uid() AND status != 'cancelled' AND status != 'completed') OR
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (worker_id = auth.uid() AND status != 'cancelled' AND status != 'completed') OR
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- ============================================================
-- 9. RLS POLICIES - PROGRESS UPDATES
-- ============================================================
DROP POLICY IF EXISTS "Progress viewable by participants" ON public.progress_updates;
DROP POLICY IF EXISTS "Workers and admins can insert progress" ON public.progress_updates;
DROP POLICY IF EXISTS "Allow workers and admins to insert progress" ON public.progress_updates;
DROP POLICY IF EXISTS "Allow participants to view progress" ON public.progress_updates;

-- Consumer, Worker, dan Admin bisa melihat progres
CREATE POLICY "Progress viewable by participants" ON public.progress_updates FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = progress_updates.order_id 
    AND (
      orders.consumer_id = auth.uid() OR 
      orders.worker_id = auth.uid() OR 
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    )
  )
);

-- Hanya Worker yang ditugaskan ATAU Admin yang bisa insert progres
CREATE POLICY "Workers and admins can insert progress" ON public.progress_updates FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = progress_updates.order_id 
    AND (
      orders.worker_id = auth.uid() OR 
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    )
  )
);

-- ============================================================
-- 10. RLS POLICIES - MESSAGES (Chat)
-- ============================================================
DROP POLICY IF EXISTS "Messages viewable by participants" ON public.messages;
DROP POLICY IF EXISTS "Participants can insert messages" ON public.messages;
DROP POLICY IF EXISTS "messages_select_relevant" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_relevant" ON public.messages;

-- Hanya participant order (Consumer, Worker yang ditugaskan, Admin) yang bisa melihat chat
CREATE POLICY "Messages viewable by participants" ON public.messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = messages.order_id 
    AND (
      orders.consumer_id = auth.uid() OR 
      orders.worker_id = auth.uid() OR 
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    )
  )
);

-- Hanya participant yang bisa mengirim pesan (sender harus sesuai auth.uid())
CREATE POLICY "Participants can insert messages" ON public.messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = messages.order_id 
    AND (
      orders.consumer_id = auth.uid() OR 
      orders.worker_id = auth.uid() OR 
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    )
  )
);

-- ============================================================
-- 11. STORAGE BUCKETS (Manual Setup Required)
-- ============================================================
-- CATATAN PENTING: SQL TIDAK BISA membuat storage bucket secara otomatis.
-- Anda HARUS membuat bucket berikut secara manual di Supabase Dashboard:
--
-- 1. Bucket: "screenshots"
--    - Type: Public
--    - Digunakan untuk: Progress updates (bukti screenshot dari worker/admin)
--
-- 2. Bucket: "avatars"  
--    - Type: Public
--    - Digunakan untuk: Foto profil user
--
-- Setelah bucket dibuat, jalankan policy storage di bawah ini:
-- ============================================================

-- Storage Policies untuk bucket 'screenshots'
-- (Pastikan bucket 'screenshots' sudah dibuat dan berstatus Public)
DROP POLICY IF EXISTS "Screenshots are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload screenshots" ON storage.objects;

CREATE POLICY "Screenshots are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'screenshots');

CREATE POLICY "Authenticated users can upload screenshots" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'screenshots' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own screenshots" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'screenshots' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own screenshots" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'screenshots' AND auth.role() = 'authenticated');

-- Storage Policies untuk bucket 'avatars'
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;

CREATE POLICY "Avatars are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can upload avatars" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own avatars" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own avatars" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- ============================================================
-- END OF SCHEMA
-- ============================================================