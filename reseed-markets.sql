-- ============================================================
-- RESET & RESEED: Clear all data, reload with strategic markets
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Clear all transactional data
DELETE FROM notifications;
DELETE FROM comments;
DELETE FROM predictions;
DELETE FROM markets;

-- 2. Reset user balances
UPDATE profiles SET balance = 1000, points = 0;

-- 3. Seed strategic prediction markets for SharkNinja 2026
INSERT INTO markets (title, description, category, probability, logit, q_yes, q_no, volume, traders, status, trending, created_by_name, created_at, closes_at, history) VALUES

-- PRODUCT LAUNCH
(
    'Will the Shark FlexBreeze portable fan exceed 500K units sold in its first quarter?',
    'The FlexBreeze is our Q2 2026 hero launch targeting the premium portable fan market. First-quarter sell-through above 500K units would make it our fastest consumer launch ever. Consider retail placement commitments, influencer pipeline, and summer timing.',
    'product_launch', 0.65, 0.62, 0, 0, 0, 0, 'active', true,
    'Product Strategy', '2026-03-10', '2026-09-30',
    ARRAY[0.50, 0.55, 0.58, 0.60, 0.62, 0.63, 0.64, 0.65]
),
(
    'Will Ninja launch a consumer-grade outdoor pizza oven before Black Friday 2026?',
    'Internal roadmaps have hinted at outdoor cooking expansion. A pizza oven would pit us against Ooni and Gozney in a fast-growing category. This market predicts whether we will have a shipping SKU in retail or DTC before Black Friday (Nov 27, 2026).',
    'product_launch', 0.35, -0.62, 0, 0, 0, 0, 'active', false,
    'Product Development', '2026-03-01', '2026-11-27',
    ARRAY[0.25, 0.28, 0.30, 0.32, 0.33, 0.34, 0.35]
),
(
    'Will Shark SpeedStyle be available in 5+ EU countries by end of Q3 2026?',
    'The SpeedStyle hair dryer has been US/UK only. EU expansion requires CE compliance, localized packaging, and retail partnerships. This market predicts whether we achieve distribution in at least 5 EU member countries by September 30, 2026.',
    'product_launch', 0.55, 0.20, 0, 0, 0, 0, 'active', false,
    'International', '2026-02-20', '2026-09-30',
    ARRAY[0.40, 0.42, 0.45, 0.48, 0.50, 0.52, 0.55]
),

-- SALES & REVENUE
(
    'Will SharkNinja total revenue exceed $5B in fiscal year 2026?',
    'SharkNinja reported ~$4.6B in FY2025. Hitting $5B requires ~9% YoY growth driven by new launches, international expansion, and DTC channel growth. Macro headwinds (tariffs, consumer spending) could slow momentum.',
    'sales', 0.60, 0.41, 0, 0, 0, 0, 'active', true,
    'Finance', '2026-01-15', '2027-02-28',
    ARRAY[0.55, 0.56, 0.57, 0.58, 0.59, 0.60]
),
(
    'Will Amazon Prime Day 2026 SharkNinja sales exceed $60M globally?',
    'Prime Day is our single biggest sales event. In 2025 we did approximately $50M across all Amazon marketplaces. Exceeding $60M requires strong hero ASINs, deal placement, and international Amazon growth.',
    'sales', 0.50, 0.0, 0, 0, 0, 0, 'active', true,
    'E-Commerce', '2026-03-01', '2026-07-31',
    ARRAY[0.45, 0.47, 0.48, 0.49, 0.50]
),
(
    'Will DTC (direct-to-consumer) revenue share exceed 20% of total revenue in 2026?',
    'SharkNinja has been investing heavily in sharkninja.com, owned apps, and DTC channels. Growing DTC reduces retail margin compression and gives us better customer data. Historically DTC has been ~15% of revenue.',
    'sales', 0.40, -0.41, 0, 0, 0, 0, 'active', false,
    'E-Commerce', '2026-02-01', '2026-12-31',
    ARRAY[0.35, 0.36, 0.37, 0.38, 0.39, 0.40]
),

-- COMPETITOR INTELLIGENCE
(
    'Will Dyson launch a robot vacuum priced under $500 by end of 2026?',
    'Dyson has been rumored to re-enter the robot vacuum market after discontinuing the 360 line. A sub-$500 entry would directly compete with Shark''s Ion and Matrix lines. Watch for CES announcements and FCC filings.',
    'competitor', 0.30, -0.85, 0, 0, 0, 0, 'active', true,
    'Competitive Intelligence', '2026-01-20', '2026-12-31',
    ARRAY[0.35, 0.33, 0.32, 0.31, 0.30]
),
(
    'Will a major tech company (Apple, Google, Samsung) announce a kitchen appliance in 2026?',
    'Smart home convergence continues. Apple has patents on cooking devices, Samsung already has smart fridges. A credible kitchen appliance announcement from big tech would signal category disruption and impact our innovation roadmap.',
    'competitor', 0.20, -1.39, 0, 0, 0, 0, 'active', false,
    'Competitive Intelligence', '2026-03-05', '2026-12-31',
    ARRAY[0.15, 0.17, 0.18, 0.19, 0.20]
),
(
    'Will Tineco or Roborock surpass Shark in US robot vacuum market share by Q4 2026?',
    'Chinese brands Tineco and Roborock have been gaining share rapidly through aggressive Amazon pricing and TikTok marketing. Shark currently holds ~18% US robot vacuum market share. Track NPD/Circana monthly data.',
    'competitor', 0.45, -0.20, 0, 0, 0, 0, 'active', true,
    'Competitive Intelligence', '2026-02-15', '2026-12-31',
    ARRAY[0.35, 0.38, 0.40, 0.42, 0.44, 0.45]
),

-- STRATEGY
(
    'Will SharkNinja announce a major acquisition (>$100M) in 2026?',
    'SharkNinja has historically grown organically, but leadership has discussed M&A to accelerate entry into adjacent categories (outdoor, commercial, wellness). A deal above $100M would be transformative. Consider our cash position and debt capacity.',
    'strategy', 0.25, -1.10, 0, 0, 0, 0, 'active', false,
    'Corporate Strategy', '2026-02-01', '2026-12-31',
    ARRAY[0.20, 0.22, 0.23, 0.24, 0.25]
),
(
    'Will SharkNinja open a flagship retail store or branded experience center in 2026?',
    'Several DTC brands have moved into physical retail (Dyson Demo stores, Apple Stores). A SharkNinja-branded store would showcase the full ecosystem. This market predicts whether we announce or open at least one branded retail location.',
    'strategy', 0.15, -1.73, 0, 0, 0, 0, 'active', false,
    'Corporate Strategy', '2026-03-10', '2026-12-31',
    ARRAY[0.10, 0.12, 0.13, 0.14, 0.15]
),
(
    'Will US tariffs on Chinese-manufactured goods increase above 25% in 2026, impacting SharkNinja supply chain?',
    'Trade policy uncertainty directly impacts our COGS and margin structure. SharkNinja manufactures primarily in China and Vietnam. New tariffs above 25% on relevant categories would require pricing action or accelerated supply chain diversification.',
    'strategy', 0.55, 0.20, 0, 0, 0, 0, 'active', true,
    'Supply Chain', '2026-01-10', '2026-12-31',
    ARRAY[0.45, 0.48, 0.50, 0.52, 0.53, 0.55]
),

-- INNOVATION
(
    'Will SharkNinja ship an AI-powered product feature (on-device or cloud) to consumers in 2026?',
    'AI integration in appliances is the next frontier — think auto-recipe adjustment, predictive maintenance alerts, or computer-vision cleaning optimization. This market predicts whether at least one shipping product includes a marketed AI feature by end of 2026.',
    'innovation', 0.70, 0.85, 0, 0, 0, 0, 'active', true,
    'AI/ML Team', '2026-02-25', '2026-12-31',
    ARRAY[0.55, 0.58, 0.60, 0.63, 0.65, 0.68, 0.70]
),
(
    'Will Ninja Creami maintain its #1 position in frozen treat makers on Amazon through 2026?',
    'Ninja Creami has been the viral breakout hit. Competitors are flooding the category with lower-priced alternatives. Can we maintain the #1 best-seller rank in the frozen treat maker category through the full calendar year?',
    'innovation', 0.60, 0.41, 0, 0, 0, 0, 'active', true,
    'Product Marketing', '2026-01-05', '2026-12-31',
    ARRAY[0.70, 0.68, 0.66, 0.64, 0.62, 0.60]
),
(
    'Will SharkNinja file more than 200 patents in 2026?',
    'Innovation velocity is a key strategic metric. We filed approximately 180 patents in 2025. Exceeding 200 in 2026 would signal accelerating R&D output. Track quarterly filing cadence with the IP team.',
    'innovation', 0.45, -0.20, 0, 0, 0, 0, 'active', false,
    'R&D / IP', '2026-03-15', '2027-01-31',
    ARRAY[0.40, 0.42, 0.43, 0.44, 0.45]
);
