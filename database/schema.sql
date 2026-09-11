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

-- Tabel Messages (Chat)
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
CREATE INDEX IF NOT EXISTS idx_orders_consumer ON public.orders(consumer_id);
CREATE INDEX IF NOT EXISTS idx_orders_worker ON public.orders(worker_id);
CREATE INDEX IF NOT EXISTS idx_orders_service ON public.orders(service_id);
CREATE INDEX IF NOT EXISTS idx_progress_order ON public.progress_updates(order_id);
CREATE INDEX IF NOT EXISTS idx_messages_order ON public.messages(order_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);

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
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Categories & Services Policies (Public Read)
CREATE POLICY "Categories are viewable by everyone" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Services are viewable by everyone" ON public.services FOR SELECT USING (true);

-- Orders Policies
CREATE POLICY "Orders viewable by participants" ON public.orders FOR SELECT USING (
  auth.uid() = consumer_id OR auth.uid() = worker_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Consumers can insert own orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = consumer_id);
CREATE POLICY "Participants can update orders" ON public.orders FOR UPDATE USING (
  auth.uid() = consumer_id OR auth.uid() = worker_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Progress Updates Policies
CREATE POLICY "Progress viewable by participants" ON public.progress_updates FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = progress_updates.order_id AND (orders.consumer_id = auth.uid() OR orders.worker_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'))
);
CREATE POLICY "Workers and admins can insert progress" ON public.progress_updates FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = progress_updates.order_id AND (orders.worker_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'))
);

-- Messages Policies
CREATE POLICY "Messages viewable by participants" ON public.messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = messages.order_id AND (orders.consumer_id = auth.uid() OR orders.worker_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'))
);
CREATE POLICY "Participants can insert messages" ON public.messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.orders WHERE orders.id = messages.order_id AND (orders.consumer_id = auth.uid() OR orders.worker_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'))
);