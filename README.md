# SharkPool — SharkNinja Internal Prediction Market

SharkPool is a prediction market platform built for SharkNinja employees to forecast business outcomes, product launches, competitive moves, and strategic decisions. Users trade virtual tokens on the likelihood of future events, surfacing collective intelligence across the organization.

Built as a lightweight single-page app for the SharkNinja AI Hackathon 2026.

## Quick Start

1. Open `index.html` in a browser (or serve via any static file server)
2. Sign up with your email and department
3. You start with **500 tokens** — use them to trade on markets
4. Correct predictions earn tokens; create your own markets for others to trade on

No build step, no Node.js, no bundler. The app runs entirely in the browser with Supabase as the backend.

## Architecture

```
index.html          → Single HTML entry point (Tailwind CDN, dark mode CSS)
js/
  data.js           → Constants: categories, market templates, avatars, departments
  amm.js            → LMSR automated market maker (pricing engine)
  supabase.js       → Supabase client, Auth helpers, DB/RPC wrappers, realtime subscriptions
  state.js          → Central state management (AppState singleton)
  components.js     → Reusable UI components (header, cards, charts, tour)
  pages.js          → Page renderers (dashboard, markets, market detail, admin, etc.)
  app.js            → Render loop, event handlers, init
supabase-setup.sql  → Initial schema (profiles, markets, predictions, comments)
supabase-migration-v2..v13.sql → Incremental schema migrations
```

Scripts load in order: `data.js → amm.js → supabase.js → state.js → components.js → pages.js → app.js`. Each file builds on globals from the previous ones.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS, HTML, Tailwind CSS (CDN) |
| Backend | Supabase (Postgres, Auth, Realtime, RLS, RPC) |
| Pricing | LMSR (Logarithmic Market Scoring Rule) with `b=200` |
| Hosting | Any static file server (no build step) |

## How the Market Maker Works

SharkPool uses an **LMSR (Logarithmic Market Scoring Rule)** automated market maker — the same algorithm used by Polymarket and Metaculus.

### Key concepts

- **Liquidity parameter `b=200`**: Controls price sensitivity. A 50-token trade moves the price ~0.6%. Higher `b` = more stable prices.
- **Binary markets**: Two share pools (`q_yes`, `q_no`). Price = `sigmoid((q_yes - q_no) / b)`.
- **Multi-outcome markets**: N share pools. Prices = `softmax(q_values / b)`. Probabilities always sum to 1.
- **Cost function**: `C(q) = b * ln(Σ exp(q_i / b))`. The cost of a trade = `C(after) - C(before)`.
- **Shares for budget**: Uses binary search (60 iterations) since the cost function is monotonic.
- **Payouts**: Winning shares pay 1 token each. If you buy 80 YES shares for 50 tokens and YES wins, you profit 30 tokens.

### Example trade

Starting state: `q_yes=0, q_no=0` → price = 50%.
- User buys 50 tokens of YES → gets ~73 shares → new price shifts to ~56%
- If YES wins: user gets 73 tokens (23 profit)
- If NO wins: user loses their 50 tokens

## Database Schema

### Tables

| Table | Description |
|-------|------------|
| `profiles` | User accounts (extends `auth.users`). Balance, points, department, avatar, `is_admin` flag |
| `markets` | Prediction markets. Title, description, category, probability, LMSR state (`q_yes`/`q_no` or `q_values`), history, status |
| `predictions` | User positions. Direction, amount, shares, entry price, status (`active`/`won`/`lost`/`sold`/`void`), option_index for multi |
| `comments` | Market discussion threads. Soft-delete via `deleted_at` |
| `notifications` | User notifications (market resolution, payouts, closing-soon alerts) |
| `transactions` | Token ledger (buys, sells, payouts, bonuses, admin adjustments) |
| `watchlist` | User market watchlist (user_id + market_id) |
| `audit_log` | Admin action log (who did what, when) |

### Key columns on `markets`

| Column | Purpose |
|--------|---------|
| `q_yes` / `q_no` | LMSR share quantities (binary markets) |
| `q_values` | LMSR share quantities array (multi-outcome markets) |
| `options` | JSONB array of `{label}` objects (multi-outcome markets) |
| `market_type` | `'binary'` (default) or `'multi'` |
| `probability` | Current YES probability (binary) or unused (multi) |
| `history` | JSONB array of `{t: ISO_timestamp, p: probability}` for charts |
| `version` | Optimistic locking counter — prevents stale-state overwrites |
| `status` | `'active'`, `'closed'`, `'resolved'`, `'pending'` |
| `resolution` | `'yes'`, `'no'`, `'void'`, or winning option index |

### RPC Functions (SECURITY DEFINER)

All trading and resolution is done through server-side RPCs to ensure atomicity and prevent race conditions:

| Function | Purpose |
|----------|---------|
| `place_prediction` | Atomic buy: debit balance, insert prediction, update market state, record transaction, push notification |
| `sell_position` | Atomic sell: credit balance, update prediction status, update market state, record transaction |
| `resolve_market` | Resolve binary market: set status/resolution, calculate payouts for all positions, credit winners |
| `resolve_multi_market` | Resolve multi-outcome market: same as above but for N options |
| `close_expired_markets` | Auto-close markets past their `closes_at` date |
| `notify_closing_soon` | Create notifications for markets closing within 24 hours |
| `approve_market` / `reject_market` | Admin market moderation workflow |
| `claim_referral` | Award referral bonuses to both referrer and referee |
| `claim_daily_bonus` | Daily login bonus (once per day per user) |
| `delete_market` | Admin-only: cascade-delete market and all related records |

### Row-Level Security (RLS)

All tables have RLS enabled. Key policies:
- **Read**: All authenticated users can read all rows in all tables
- **Write**: Users can only insert/update their own data (profiles, predictions, comments)
- **Market updates**: Handled through SECURITY DEFINER RPCs (bypasses RLS safely)
- **Admin actions**: Verified inside RPC functions (`IF NOT EXISTS (... is_admin = true)`)

## Features

### Core
- **Binary markets** (YES/NO) with LMSR pricing
- **Multi-outcome markets** (2-8 options) with generalized LMSR
- **Buy and sell** positions at market price
- **Real-time updates** via Supabase Realtime (markets, predictions, comments, notifications)
- **Probability history charts** rendered inline with SVG polylines
- **Market categories**: Product Launches, Competitor Intel, Sales Forecasts, Strategic Insights, Innovation & R&D, For Fun

### User Experience
- **Guided tour** (spotlight overlay with SVG cutout) for onboarding new users
- **Dark mode** with full theme support
- **Loading indicators**: top progress bar, skeleton states, spinner
- **Toast notifications** for all actions
- **Deep links** via URL hash (`#market=123`)
- **CSV export** for transactions, predictions, and markets
- **Responsive design** (mobile-friendly)

### Trading
- **Trade estimates**: shows shares received, cost per share, price impact before buying
- **Slippage warnings** for large trades (>5% or >15% price impact)
- **Position management**: view active positions, sell back at market price
- **Rate limiting**: 2-second cooldown between trades

### Social
- **Market comments** with pagination
- **User profiles** with trade history, accuracy stats, avatar customization
- **Leaderboard** (individual and by department)
- **Watchlist** for tracking markets
- **Referral system** with token bonuses
- **Daily login bonus**

### Admin
- **Admin dashboard** with tabs: Overview, Users, Markets, Audit Log, Quarterly Awards, Balance Reconciliation
- **Market approval workflow** (pending → approved/rejected)
- **Market resolution** (admin-only)
- **User management**: grant/revoke admin, adjust balances
- **Balance reconciliation**: detect and fix ledger discrepancies
- **Quarterly awards**: compute top traders, most active, best market creators
- **Audit trail**: all admin actions logged

## Market Lifecycle

```
Created → [Pending] → Active → Closed → Resolved
              ↓
           Rejected
```

1. **Created**: User fills out title, description, category, closing date, and market type
2. **Pending** (optional): If the creator is not an admin, the market goes to admin queue
3. **Active**: Open for trading. Users buy/sell shares.
4. **Closed**: Past `closes_at` date. No new trades. Existing positions can still be sold.
5. **Resolved**: Admin resolves as YES/NO/VOID (binary) or selects winning option (multi). Payouts processed automatically.

## Pages

| Page | Route | Description |
|------|-------|-------------|
| Login | `login` | Email/password sign-in and sign-up with department selection |
| Dashboard | `dashboard` | Welcome card (or tour CTA), active markets, activity feed |
| Markets | `markets` | All markets with category/status filters, search, sort |
| Market Detail | `market` | Full market view: chart, trading panel, positions, comments |
| Create Market | `create` | Market creation form with templates, binary/multi toggle |
| Leaderboard | `leaderboard` | Rankings by points, accuracy, and department |
| Notifications | `notifications` | User notification inbox |
| Profile | `profile` | User stats, positions, avatar, referral link, tour replay |
| Transactions | `transactions` | Token transaction ledger with CSV export |
| Admin | `admin` | Admin dashboard (visible to `is_admin` users only) |
| Analytics | `analytics` | Market analytics and platform stats |

## State Management

`AppState` (in `state.js`) is a singleton object that holds all application state and provides methods for all user actions. Components subscribe to state changes via `AppState.subscribe(render)`.

Key patterns:
- **Optimistic updates**: After a successful RPC call, state is updated immediately and `notify()` triggers a re-render. Background refreshes update data silently.
- **Non-blocking refreshes**: After trades, prediction lists refresh in the background (`Promise.all().then()`) to prevent the buy/sell button from getting stuck.
- **Navigation with async loading**: `navigate()` sets a `navigating` flag, renders skeleton UI, fetches data, then re-renders with real data.

## Schema Migrations

Run these in order in the Supabase SQL Editor:

| File | What it adds |
|------|-------------|
| `supabase-setup.sql` | Base schema: profiles, markets, predictions, comments, RLS, seed data |
| `supabase-migration-v2.sql` | LMSR fields (`q_yes`, `q_no`), `shares`/`entry_prob` on predictions, `place_prediction` RPC |
| `supabase-migration-v3.sql` | Notifications, transactions, watchlist tables; `resolve_market` RPC; sell position support |
| `supabase-migration-v4.sql` | Market `version` column (optimistic locking) |
| `supabase-migration-v5.sql` | `is_admin` flag, market approval workflow (`approve_market`/`reject_market` RPCs) |
| `supabase-migration-v6.sql` | Referral system (`referred_by`, `claim_referral` RPC) |
| `supabase-migration-v7.sql` | Daily login bonus (`last_bonus_date`, `claim_daily_bonus` RPC) |
| `supabase-migration-v8.sql` | Audit log table; `close_expired_markets` and `notify_closing_soon` RPCs |
| `supabase-migration-v9.sql` | Multi-outcome markets (`market_type`, `options`, `q_values`, `option_index`); multi RPCs |
| `supabase-migration-v10.sql` | JSONB probability history (replaces `REAL[]`) |
| `supabase-migration-v11.sql` | Soft-delete comments (`deleted_at`, `deleted_by`) |
| `supabase-migration-v12.sql` | `sell_position` RPC (atomic server-side selling) |
| `supabase-migration-v13.sql` | `delete_market` RPC (admin cascade delete) |

## Development

### Prerequisites
- A Supabase project (free tier works)
- A web browser

### Setup
1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run `supabase-setup.sql` in the SQL Editor
3. Run each migration file (`v2` through `v13`) in order
4. Update `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `js/supabase.js`
5. Open `index.html` in a browser

### Adding a new market category
Edit `CATEGORIES` in `js/data.js` and add a matching `.card-accent-{color}` CSS class in `index.html`.

### Making a user admin
In Supabase SQL Editor:
```sql
UPDATE profiles SET is_admin = true WHERE email = 'user@sharkninja.com';
```

### Seeding fun/engagement markets
Run `supabase-seed-fun-markets.sql` to add lighthearted markets for driving engagement.

## Security Notes

- All trading logic runs in SECURITY DEFINER RPCs (server-side, not client-manipulable)
- RLS prevents users from modifying other users' data
- Optimistic locking (`version` column) prevents stale-state overwrites on concurrent trades
- Admin checks are enforced server-side in RPCs, not just in the UI
- The anon key in `supabase.js` is intentionally public (it's a Supabase anon key, scoped by RLS)
