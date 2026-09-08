-- ============================================================
-- PRIMORA - Seed Data (Dummy Data for Development)
-- 
-- How to use:
-- 1. Run schema.sql first
-- 2. Copy-paste this file into SQL Editor
-- 3. Click Run
-- ============================================================

-- Categories Data
INSERT INTO public.categories (name, slug, icon, description) VALUES
  ('Spiral Abyss', 'abyss', NULL, 'Spiral Abyss challenges with various floors'),
  ('AR Boost', 'ar_boost', NULL, 'Boost your Adventure Rank'),
  ('Chest Unpacking', 'chest', NULL, 'Open chests in selected regions'),
  ('Event', 'event', NULL, 'Complete latest events'),
  ('Daily Commission', 'daily', NULL, 'Complete daily commissions'),
  ('Quest', 'quest', NULL, 'Complete specific quests'),
  ('Others', 'other', NULL, 'Other services')
ON CONFLICT (slug) DO NOTHING;

-- Services Data
INSERT INTO public.services (name, category, description, base_price, estimated_hours) VALUES
  ('Spiral Abyss Floor 12 (36 Stars)', 'abyss', 'Clear all chambers in Floor 12 with minimum 36 stars', 150000, 3),
  ('Spiral Abyss Floor 11 (36 Stars)', 'abyss', 'Clear all chambers in Floor 11 with minimum 36 stars', 100000, 2),
  ('Spiral Abyss Floor 10 (36 Stars)', 'abyss', 'Clear all chambers in Floor 10 with minimum 36 stars', 80000, 2),
  ('Adventure Rank 55-60', 'ar_boost', 'Boost AR from 55 to 60 including unlock all quests', 200000, 5),
  ('Adventure Rank 45-55', 'ar_boost', 'Boost AR from 45 to 55', 150000, 4),
  ('Adventure Rank 35-45', 'ar_boost', 'Boost AR from 35 to 45', 120000, 3),
  ('Chest Unpacking 100 Chests', 'chest', 'Open 100 chests in selected region', 100000, 4),
  ('Chest Unpacking 50 Chests', 'chest', 'Open 50 chests in selected region', 60000, 2),
  ('Chest Unpacking 25 Chests', 'chest', 'Open 25 chests in selected region', 35000, 1),
  ('Event Completion', 'event', 'Complete all quests and challenges in latest event', 75000, 2),
  ('Event Partial Completion', 'event', 'Complete specific event challenges', 50000, 1),
  ('Daily Commission 1 Month', 'daily', 'Complete daily commissions for 1 full month', 250000, 24),
  ('Daily Commission 1 Week', 'daily', 'Complete daily commissions for 1 week', 70000, 6),
  ('Daily Commission 3 Days', 'daily', 'Complete daily commissions for 3 days', 25000, 2),
  ('Archon Quest Completion', 'quest', 'Complete all available Archon Quests', 180000, 8),
  ('World Quest Bundle (5 Quests)', 'quest', 'Complete 5 selected world quests', 120000, 4),
  ('World Quest Bundle (3 Quests)', 'quest', 'Complete 3 selected world quests', 80000, 2),
  ('Story Quest Completion', 'quest', 'Complete all available story quests', 90000, 3),
  ('Character Build Consultation', 'other', 'Get advice on character builds and team compositions', 50000, 1),
  ('Account Review', 'other', 'Comprehensive account review with improvement suggestions', 75000, 2)
ON CONFLICT DO NOTHING;

-- ============================================================
-- DONE! Dummy data has been added.
-- ============================================================