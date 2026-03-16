-- ============================================================
-- SharkNinja Prediction Market - Supabase Schema Setup
-- Run this in Supabase SQL Editor (supabase.com → SQL Editor)
-- ============================================================

-- 1. PROFILES TABLE (extends Supabase auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    department TEXT NOT NULL DEFAULT 'General',
    avatar TEXT NOT NULL DEFAULT 'XX',
    balance INTEGER NOT NULL DEFAULT 500,
    points INTEGER NOT NULL DEFAULT 0,
    accuracy REAL NOT NULL DEFAULT 0,
    trades INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. MARKETS TABLE
CREATE TABLE markets (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'strategy',
    probability REAL NOT NULL DEFAULT 0.50,
    volume INTEGER NOT NULL DEFAULT 0,
    traders INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    trending BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES profiles(id),
    created_by_name TEXT NOT NULL DEFAULT 'Unknown',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closes_at DATE NOT NULL,
    history REAL[] NOT NULL DEFAULT ARRAY[0.50]
);

-- 3. PREDICTIONS TABLE
CREATE TABLE predictions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('yes', 'no')),
    amount INTEGER NOT NULL CHECK (amount >= 10),
    entry_prob REAL NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, market_id)  -- one prediction per user per market
);

-- 4. COMMENTS TABLE
CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Profiles: anyone logged in can read all profiles, users can update their own
CREATE POLICY "Profiles are viewable by authenticated users" ON profiles
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Markets: anyone logged in can read, anyone can create
CREATE POLICY "Markets are viewable by authenticated users" ON markets
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create markets" ON markets
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Market creators can update their markets" ON markets
    FOR UPDATE TO authenticated USING (true);

-- Predictions: anyone logged in can read all, users create their own
CREATE POLICY "Predictions are viewable by authenticated users" ON predictions
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create own predictions" ON predictions
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Comments: anyone logged in can read all, users create their own
CREATE POLICY "Comments are viewable by authenticated users" ON comments
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create own comments" ON comments
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP (trigger)
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, avatar)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        UPPER(LEFT(COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), 1) ||
              LEFT(REVERSE(split_part(COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), ' ', 2)), 1))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- SEED DATA: Mock markets
-- ============================================================

-- We'll insert these with created_by as NULL (system-generated markets)
INSERT INTO markets (title, description, category, probability, volume, traders, status, trending, created_by_name, created_at, closes_at, history) VALUES
(
    'Will the new Shark FlexBreeze fan exceed 500K units in Q3 2026?',
    'The FlexBreeze portable fan is launching in May 2026. This market predicts whether first-quarter sales will surpass 500,000 units across all channels (DTC, Amazon, retail partners).',
    'product_launch', 0.72, 1847, 156, 'active', true,
    'Sarah M. (Product Strategy)', '2026-02-15', '2026-09-30',
    ARRAY[0.45, 0.48, 0.52, 0.55, 0.58, 0.62, 0.65, 0.68, 0.70, 0.72]
),
(
    'Will Dyson launch a competing robot vacuum under $400 by end of 2026?',
    'Dyson has been rumored to enter the budget robot vacuum segment. This market predicts whether they will announce and ship a sub-$400 robot vacuum before December 31, 2026.',
    'competitor', 0.38, 923, 89, 'active', true,
    'Tom H. (Competitive Intelligence)', '2026-01-20', '2026-12-31',
    ARRAY[0.55, 0.52, 0.48, 0.45, 0.42, 0.40, 0.38, 0.35, 0.36, 0.38]
),
(
    'Will Ninja Creami sales exceed $200M revenue in 2026?',
    'The Ninja Creami continues to be a viral sensation. Will total 2026 revenue across all Creami SKUs surpass $200 million?',
    'sales', 0.85, 2341, 203, 'active', true,
    'Rachel W. (Finance)', '2026-01-05', '2026-12-31',
    ARRAY[0.70, 0.73, 0.75, 0.78, 0.80, 0.82, 0.83, 0.84, 0.85, 0.85]
),
(
    'Will SharkNinja enter the outdoor grilling category by Q4 2026?',
    'There have been internal discussions about expanding into outdoor cooking. This market predicts whether we will announce a grilling/outdoor cooking product line.',
    'strategy', 0.45, 678, 72, 'active', false,
    'Paul N. (Corporate Strategy)', '2026-02-01', '2026-10-01',
    ARRAY[0.30, 0.35, 0.40, 0.42, 0.44, 0.45, 0.43, 0.44, 0.45, 0.45]
),
(
    'Will our DTC website revenue share exceed 25% of total revenue in 2026?',
    'SharkNinja has been investing heavily in direct-to-consumer channels. Will DTC website revenue exceed 25% of total company revenue?',
    'sales', 0.58, 1102, 94, 'active', false,
    'Elena V. (E-commerce)', '2026-01-15', '2026-12-31',
    ARRAY[0.40, 0.42, 0.45, 0.48, 0.50, 0.52, 0.54, 0.56, 0.57, 0.58]
),
(
    'Will iRobot (Amazon) release a self-emptying mop-vacuum combo under $500?',
    'Amazon''s iRobot division has been quiet. This market predicts whether they''ll release a combined mop-vacuum with self-emptying base at a sub-$500 price point in 2026.',
    'competitor', 0.52, 756, 67, 'active', false,
    'Tom H. (Competitive Intelligence)', '2026-02-10', '2026-12-31',
    ARRAY[0.60, 0.58, 0.55, 0.53, 0.52, 0.51, 0.50, 0.51, 0.52, 0.52]
),
(
    'Will SharkNinja achieve carbon-neutral manufacturing by end of 2027?',
    'Leadership announced sustainability goals. Will we hit carbon-neutral status across all manufacturing facilities by December 2027?',
    'strategy', 0.31, 445, 51, 'active', false,
    'Jessica L. (Sustainability)', '2026-02-20', '2027-12-31',
    ARRAY[0.25, 0.27, 0.28, 0.29, 0.30, 0.30, 0.31, 0.31, 0.31, 0.31]
),
(
    'Will AI-powered recipe suggestions in Ninja appliances drive 10% higher NPS?',
    'The new AI recipe feature is rolling out across Ninja kitchen appliances. Will it result in a 10+ point NPS improvement in customer satisfaction surveys?',
    'innovation', 0.64, 892, 78, 'active', true,
    'Alex C. (AI/ML Team)', '2026-02-25', '2026-09-30',
    ARRAY[0.50, 0.52, 0.55, 0.57, 0.58, 0.60, 0.61, 0.62, 0.63, 0.64]
),
(
    'Will Amazon Prime Day 2026 sales exceed $50M for SharkNinja?',
    'Prime Day is our biggest single sales event. Will total SharkNinja sales across all Amazon marketplaces exceed $50M during Prime Day 2026?',
    'sales', 0.76, 1567, 134, 'active', false,
    'Kevin B. (E-commerce)', '2026-03-01', '2026-07-31',
    ARRAY[0.65, 0.67, 0.69, 0.70, 0.72, 0.73, 0.74, 0.75, 0.75, 0.76]
),
(
    'Will Shark beauty products launch in EU markets by Q2 2026?',
    'The Shark beauty line (FlexStyle, SpeedStyle) has been US-focused. Will we officially launch in at least 3 EU countries by end of Q2 2026?',
    'product_launch', 0.67, 934, 88, 'active', false,
    'Claire B. (International)', '2026-01-25', '2026-06-30',
    ARRAY[0.50, 0.53, 0.55, 0.58, 0.60, 0.62, 0.63, 0.65, 0.66, 0.67]
);

-- Seed comments (using market IDs, no user_id since these are system seed data)
-- We'll store seed comments directly in a separate approach via the app
