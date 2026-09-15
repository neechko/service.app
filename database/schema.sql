-- ============================================================
-- PRIMORA - DATABASE SCHEMA (UPDATED v2.1)
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

-- Tabel Profiles (Metrik worker & rating)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role TEXT DEFAULT 'consumer' CHECK (role IN ('consumer', 'worker', 'admin')),
  phone TEXT,
  email TEXT,
  avatar_url TEXT,
  -- Kolom untuk Worker Management
  seniority_level TEXT DEFAULT 'junior' CHECK (seniority_level IN ('junior', 'mid', 'senior')),
  max_capacity INTEGER DEFAULT 3,
  current_active_orders INTEGER DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  is_on_leave BOOLEAN DEFAULT false,
  leave_until TIMESTAMP WITH TIME ZONE,
  average_rating NUMERIC DEFAULT 0.0,
  total_reviews INTEGER DEFAULT 0,
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

-- ✅ Tabel Service Tiers / Packages
CREATE TABLE IF NOT EXISTS public.service_tiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_modifier NUMERIC DEFAULT 1.0, -- e.g., 1.0 = 100%, 1.5 = 150%
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel Orders (Dengan kolom total_estimated_hours)
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
  -- Kolom untuk Automated Deadline Tracker
  assigned_at TIMESTAMP WITH TIME ZONE,
  expected_completion_at TIMESTAMP WITH TIME ZONE,
  -- ✅ Kolom Baru: Total jam dari package yang dipilih customer
  total_estimated_hours INTEGER DEFAULT 1,
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

-- ✅ Tabel Reviews / Ulasan
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE UNIQUE, -- 1 order = 1 review
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- ID Worker
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 3. INDEXES (Untuk Performa Query)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_seniority ON public.profiles(seniority_level, is_available);
CREATE INDEX IF NOT EXISTS idx_orders_consumer ON public.orders(consumer_id);
CREATE INDEX IF NOT EXISTS idx_orders_worker ON public.orders(worker_id);
CREATE INDEX IF NOT EXISTS idx_orders_service ON public.orders(service_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_progress_order ON public.progress_updates(order_id);
CREATE INDEX IF NOT EXISTS idx_messages_order ON public.messages(order_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_service ON public.reviews(service_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON public.reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_order ON public.reviews(order_id);

-- ============================================================
-- 4. TRIGGERS
-- ============================================================

-- A. Otomatis buat Profile saat User Daftar
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

-- B. ✅ Otomatis Hitung Ulang Beban Kerja Worker (Load)
CREATE OR REPLACE FUNCTION sync_worker_active_orders()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.worker_id IS NOT NULL AND NEW.status NOT IN ('completed', 'cancelled') THEN
      UPDATE public.profiles SET current_active_orders = current_active_orders + 1 WHERE id = NEW.worker_id;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.worker_id IS DISTINCT FROM NEW.worker_id THEN
      IF OLD.worker_id IS NOT NULL THEN
        UPDATE public.profiles SET current_active_orders = GREATEST(0, current_active_orders - 1) WHERE id = OLD.worker_id;
      END IF;
      IF NEW.worker_id IS NOT NULL AND NEW.status NOT IN ('completed', 'cancelled') THEN
        UPDATE public.profiles SET current_active_orders = current_active_orders + 1 WHERE id = NEW.worker_id;
      END IF;
    END IF;

    IF OLD.worker_id IS NOT NULL AND OLD.status NOT IN ('completed', 'cancelled') AND NEW.status IN ('completed', 'cancelled') THEN
      UPDATE public.profiles SET current_active_orders = GREATEST(0, current_active_orders - 1) WHERE id = NEW.worker_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trigger_sync_worker_active_orders ON public.orders;
CREATE TRIGGER trigger_sync_worker_active_orders
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION sync_worker_active_orders();

-- C. ✅ Otomatis Hitung Deadline Order saat Worker Di-assign
--    Menggunakan total_estimated_hours dari order (bukan hanya dari service)
CREATE OR REPLACE FUNCTION set_order_deadline()
RETURNS TRIGGER AS $$
DECLARE est_hours INTEGER;
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.worker_id IS DISTINCT FROM NEW.worker_id AND NEW.worker_id IS NOT NULL) 
     OR (TG_OP = 'UPDATE' AND NEW.worker_id IS NOT NULL AND NEW.status IN ('paid', 'in_progress') AND OLD.assigned_at IS NULL) THEN
    
    -- PRIORITAS: Gunakan total_estimated_hours dari order. Jika kosong, ambil dari service.
    est_hours := COALESCE(NEW.total_estimated_hours, (SELECT estimated_hours FROM public.services WHERE id = NEW.service_id), 1);
    
    NEW.assigned_at = NOW();
    NEW.expected_completion_at = NOW() + (est_hours || ' hours')::INTERVAL;
  END IF;
  
  IF TG_OP = 'UPDATE' AND NEW.status IN ('completed', 'cancelled') THEN
    NEW.expected_completion_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trigger_set_order_deadline ON public.orders;
CREATE TRIGGER trigger_set_order_deadline
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION set_order_deadline();

-- D. ✅ Otomatis Update Rating & Total Review Worker
CREATE OR REPLACE FUNCTION update_worker_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET 
    total_reviews = total_reviews + 1,
    average_rating = ((COALESCE(average_rating, 0) * total_reviews) + NEW.rating) / (total_reviews + 1)
  WHERE id = NEW.reviewee_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trigger_update_worker_rating ON public.reviews;
CREATE TRIGGER trigger_update_worker_rating
AFTER INSERT ON public.reviews
FOR EACH ROW EXECUTE FUNCTION update_worker_rating();

-- E. ✅ Otomatis isi service_id di reviews berdasarkan order_id
CREATE OR REPLACE FUNCTION set_review_service_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.service_id IS NULL AND NEW.order_id IS NOT NULL THEN
    SELECT service_id INTO NEW.service_id FROM public.orders WHERE id = NEW.order_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trigger_set_review_service_id ON public.reviews;
CREATE TRIGGER trigger_set_review_service_id
BEFORE INSERT ON public.reviews
FOR EACH ROW EXECUTE FUNCTION set_review_service_id();

-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS) - ENABLE
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. RLS POLICIES - PROFILES
-- ============================================================
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins and users can update profiles" ON public.profiles;

CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- User bisa edit diri sendiri, ATAU Admin bisa edit user mana pun
CREATE POLICY "Admins and users can update profiles" ON public.profiles FOR UPDATE
USING (
  auth.uid() = id OR 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  auth.uid() = id OR 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- ============================================================
-- 7. RLS POLICIES - CATEGORIES & SERVICES
-- ============================================================
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.categories;
DROP POLICY IF EXISTS "Services are viewable by everyone" ON public.services;
CREATE POLICY "Categories are viewable by everyone" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Services are viewable by everyone" ON public.services FOR SELECT USING (true);

-- ============================================================
-- 8. RLS POLICIES - SERVICE TIERS (Packages)
-- ============================================================
DROP POLICY IF EXISTS "Service tiers viewable by everyone" ON public.service_tiers;
DROP POLICY IF EXISTS "Admins can manage service tiers" ON public.service_tiers;
CREATE POLICY "Service tiers viewable by everyone" ON public.service_tiers FOR SELECT USING (true);
CREATE POLICY "Admins can manage service tiers" ON public.service_tiers FOR ALL USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- ============================================================
-- 9. RLS POLICIES - ORDERS
-- ============================================================
DROP POLICY IF EXISTS "Orders viewable by participants" ON public.orders;
DROP POLICY IF EXISTS "Consumers can insert own orders" ON public.orders;
DROP POLICY IF EXISTS "Consumers can update their own orders" ON public.orders;
DROP POLICY IF EXISTS "Workers and admins can update active orders" ON public.orders;

CREATE POLICY "Orders viewable by participants" ON public.orders FOR SELECT USING (
  auth.uid() = consumer_id OR auth.uid() = worker_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Consumers can insert own orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = consumer_id);
CREATE POLICY "Consumers can update their own orders" ON public.orders FOR UPDATE USING (auth.uid() = consumer_id) WITH CHECK (auth.uid() = consumer_id);
CREATE POLICY "Workers and admins can update active orders" ON public.orders FOR UPDATE USING (
  (worker_id = auth.uid() AND status != 'cancelled' AND status != 'completed') OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
) WITH CHECK (
  (worker_id = auth.uid() AND status != 'cancelled' AND status != 'completed') OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- ============================================================
-- 10. RLS POLICIES - PROGRESS UPDATES & MESSAGES
-- ============================================================
DROP POLICY IF EXISTS "Progress viewable by participants" ON public.progress_updates;
DROP POLICY IF EXISTS "Workers and admins can insert progress" ON public.progress_updates;
CREATE POLICY "Progress viewable by participants" ON public.progress_updates FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = progress_updates.order_id AND (orders.consumer_id = auth.uid() OR orders.worker_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'))
);
CREATE POLICY "Workers and admins can insert progress" ON public.progress_updates FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = progress_updates.order_id AND (orders.worker_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'))
);

DROP POLICY IF EXISTS "Messages viewable by participants" ON public.messages;
DROP POLICY IF EXISTS "Participants can insert messages" ON public.messages;
CREATE POLICY "Messages viewable by participants" ON public.messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = messages.order_id AND (orders.consumer_id = auth.uid() OR orders.worker_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'))
);
CREATE POLICY "Participants can insert messages" ON public.messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.orders WHERE orders.id = messages.order_id AND (orders.consumer_id = auth.uid() OR orders.worker_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'))
);

-- ============================================================
-- 11. RLS POLICIES - REVIEWS (Ulasan)
-- ============================================================
DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON public.reviews;
DROP POLICY IF EXISTS "Consumers can insert own review" ON public.reviews;
CREATE POLICY "Reviews are viewable by everyone" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Consumers can insert own review" ON public.reviews FOR INSERT WITH CHECK (
  auth.uid() = reviewer_id AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'consumer'
);

-- ============================================================
-- 12. STORAGE BUCKETS POLICIES
-- ============================================================
-- (Pastikan bucket 'screenshots' dan 'avatars' sudah dibuat manual di dashboard sebagai Public)

DROP POLICY IF EXISTS "Screenshots are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own screenshots" ON storage.objects;
CREATE POLICY "Screenshots are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'screenshots');
CREATE POLICY "Authenticated users can upload screenshots" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'screenshots' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update their own screenshots" ON storage.objects FOR UPDATE USING (bucket_id = 'screenshots' AND auth.role() = 'authenticated');
CREATE POLICY "Users can delete their own screenshots" ON storage.objects FOR DELETE USING (bucket_id = 'screenshots' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;
CREATE POLICY "Avatars are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Authenticated users can upload avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update their own avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Users can delete their own avatars" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- ============================================================
-- END OF SCHEMA
-- ============================================================