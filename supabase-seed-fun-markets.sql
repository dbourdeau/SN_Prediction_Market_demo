-- Seed: Example "For Fun" markets (run AFTER migration v7)
-- These are casual, non-business prediction markets for team engagement.
-- Replace the created_by UUID below with an admin user's ID from your profiles table.
-- You can find your admin user ID with:  SELECT id FROM profiles WHERE is_admin = true LIMIT 1;

-- !! IMPORTANT: Replace this UUID with your actual admin user ID !!
DO $$
DECLARE
    admin_id UUID;
BEGIN
    -- Auto-detect an admin user
    SELECT id INTO admin_id FROM profiles WHERE is_admin = true LIMIT 1;
    IF admin_id IS NULL THEN
        RAISE NOTICE 'No admin user found — skipping seed. Create an admin first.';
        RETURN;
    END IF;

    -- ==================== BINARY FUN MARKETS ====================

    INSERT INTO markets (title, description, category, market_type, probability, logit, q_yes, q_no, volume, traders, status, created_by, created_by_name, closes_at, trending, approved_by, approved_at, history)
    VALUES
    (
        'Will it snow at the Needham HQ before April 1st?',
        'Resolution: YES if measurable snowfall (>0.5 inches) is recorded at or near the Needham, MA office before April 1, 2026. Based on weather.gov data.',
        'fun', 'binary', 0.50, 0, 0, 0, 0, 0, 'active',
        admin_id, 'System Seed', '2026-04-01', false, admin_id, NOW(), ARRAY[0.50]
    ),
    (
        'Will the office coffee machine break down again this month?',
        'Resolution: YES if the main coffee machine on Floor 2 is out of service for more than 4 hours on any single day before end of month. Facilities ticket counts.',
        'fun', 'binary', 0.50, 0, 0, 0, 0, 0, 'active',
        admin_id, 'System Seed', '2026-03-31', false, admin_id, NOW(), ARRAY[0.50]
    ),
    (
        'Will the CEO mention AI in the next all-hands?',
        'Resolution: YES if the CEO uses the word "AI" or "artificial intelligence" during the next company-wide all-hands meeting. Based on meeting transcript/recording.',
        'fun', 'binary', 0.50, 0, 0, 0, 0, 0, 'active',
        admin_id, 'System Seed', '2026-06-30', true, admin_id, NOW(), ARRAY[0.50]
    ),
    (
        'Will a SharkNinja product appear on a late-night TV show before July?',
        'Resolution: YES if any SharkNinja product is shown, mentioned, or used as a prop on a major US late-night show (Tonight Show, Kimmel, Colbert, etc.) before July 1, 2026.',
        'fun', 'binary', 0.50, 0, 0, 0, 0, 0, 'active',
        admin_id, 'System Seed', '2026-07-01', false, admin_id, NOW(), ARRAY[0.50]
    ),
    (
        'Will more than 50 people join the prediction market by end of Q2?',
        'Resolution: YES if the total number of registered users on this platform exceeds 50 by June 30, 2026.',
        'fun', 'binary', 0.50, 0, 0, 0, 0, 0, 'active',
        admin_id, 'System Seed', '2026-06-30', true, admin_id, NOW(), ARRAY[0.50]
    );

    -- ==================== MULTI-OUTCOME FUN MARKETS ====================

    INSERT INTO markets (title, description, category, market_type, probability, logit, q_yes, q_no, volume, traders, status, created_by, created_by_name, closes_at, trending, approved_by, approved_at, history, options, q_values, probabilities)
    VALUES
    (
        'Which department will win the next hackathon?',
        'Resolution: Whichever department has the most members on the winning hackathon team. If tie, the department listed first wins. Based on official hackathon results.',
        'fun', 'multi', 0.20, 0, 0, 0, 0, 0, 'active',
        admin_id, 'System Seed', '2026-06-30', true, admin_id, NOW(),
        ARRAY[0.20, 0.20, 0.20, 0.20, 0.20]::float8[],
        '[{"id":0,"label":"Engineering"},{"id":1,"label":"Product Strategy"},{"id":2,"label":"IT & Analytics"},{"id":3,"label":"AI/ML Team"},{"id":4,"label":"Marketing"}]'::jsonb,
        '[0,0,0,0,0]'::jsonb,
        '[0.20,0.20,0.20,0.20,0.20]'::jsonb
    ),
    (
        'What will be the most popular lunch spot this Friday?',
        'Resolution: Based on an informal poll or the place with the most receipts/orders from SharkNinja employees this Friday. Honor system!',
        'fun', 'multi', 0.25, 0, 0, 0, 0, 0, 'active',
        admin_id, 'System Seed', '2026-03-21', false, admin_id, NOW(),
        ARRAY[0.25, 0.25, 0.25, 0.25]::float8[],
        '[{"id":0,"label":"Chipotle"},{"id":1,"label":"Sweetgreen"},{"id":2,"label":"Pizza"},{"id":3,"label":"Brought from home"}]'::jsonb,
        '[0,0,0,0]'::jsonb,
        '[0.25,0.25,0.25,0.25]'::jsonb
    ),
    (
        'Which new SharkNinja product will get the best Amazon reviews in 2026?',
        'Resolution: The product launched in 2026 with the highest average star rating on Amazon (minimum 100 reviews) as of Dec 31, 2026.',
        'fun', 'multi', 0.33, 0, 0, 0, 0, 0, 'active',
        admin_id, 'System Seed', '2026-12-31', false, admin_id, NOW(),
        ARRAY[0.33, 0.33, 0.34]::float8[],
        '[{"id":0,"label":"Ninja Luxe Cafe"},{"id":1,"label":"Shark AI Robot Vacuum"},{"id":2,"label":"Other 2026 launch"}]'::jsonb,
        '[0,0,0]'::jsonb,
        '[0.33,0.33,0.34]'::jsonb
    ),
    (
        'Who will be the top forecaster on this platform by end of Q2?',
        'Resolution: Whoever has the most points on the leaderboard at 11:59 PM ET on June 30, 2026. Void if fewer than 10 users have traded.',
        'fun', 'multi', 0.25, 0, 0, 0, 0, 0, 'active',
        admin_id, 'System Seed', '2026-06-30', true, admin_id, NOW(),
        ARRAY[0.25, 0.25, 0.25, 0.25]::float8[],
        '[{"id":0,"label":"Someone from Engineering"},{"id":1,"label":"Someone from Product"},{"id":2,"label":"Someone from Finance"},{"id":3,"label":"Dark horse (other dept)"}]'::jsonb,
        '[0,0,0,0]'::jsonb,
        '[0.25,0.25,0.25,0.25]'::jsonb
    );

END $$;
