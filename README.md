# SharkPool — SharkNinja Internal Prediction Market

SharkPool is a prediction market platform for SharkNinja employees to forecast business outcomes: product launches, competitive moves, sales targets, and strategic decisions. Users trade virtual tokens on the likelihood of future events, surfacing collective intelligence across the organization.

Built as a lightweight single-page app for the SharkNinja AI Hackathon 2026.

## Quick Start

1. Open `index.html` in a browser (or serve via any static file server)
2. Sign in with your email and choose a department
3. You start with **500 tokens** — trade on markets, earn tokens for correct predictions
4. Create your own markets for others to trade on

No build step, no Node.js, no bundler. Runs entirely in the browser with Supabase as the backend.

## Architecture

```
index.html          → Single HTML entry point (Tailwind CDN, dark mode CSS)
js/
  data.js           → Constants: categories, market templates, avatars, departments
  amm.js            → LMSR automated market maker (pricing engine)
  supabase.js       → Supabase client, Auth helpers, DB/RPC wrappers, realtime subscriptions
  state.js          → Central state management (AppState singleton)
  components.js     → Reusable UI components (header, cards, charts, tour)
  pages.js          → Page renderers (all pages)
  app.js            → Render loop, event handlers, init
  ai.js             → AI module: research, briefing, resolution suggestion, market analysis
  chat.js           → Chat/discussion helpers
schema.sql          → Complete database schema — single source of truth, run on a fresh project
docs/
  ARCHITECTURE.md   → System diagram and data flows
  DATABASE.md       → Full schema reference
```

Scripts load in order: `data.js → amm.js → supabase.js → state.js → components.js → pages.js → app.js → ai.js → chat.js`. Each file builds on globals from the previous ones — no imports, no modules, no bundler.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS, HTML, Tailwind CSS (CDN) |
| Backend | Supabase (Postgres, Auth, Realtime, RLS, RPCs) |
| AI | Claude API (called directly from the browser via `anthropic-dangerous-direct-browser-access`) |
| Pricing | LMSR (Logarithmic Market Scoring Rule) with `b=200` |
| Hosting | Any static file server — no build step |

## How the Market Maker Works

SharkPool uses an **LMSR (Logarithmic Market Scoring Rule)** automated market maker — the same algorithm used by prediction markets like Polymarket.

### Key concepts

- **Liquidity parameter `b=200`**: Controls price sensitivity. A 50-token trade moves price ~0.6%. Higher `b` = more stable prices.
- **Binary markets**: Two share pools (`q_yes`, `q_no`). Price = `sigmoid((q_yes - q_no) / b)`.
- **Multi-outcome markets**: N share pools. Prices = `softmax(q_values / b)`. Probabilities always sum to 1.
- **Cost function**: `C(q) = b * ln(Σ exp(q_i / b))`. Trade cost = `C(after) - C(before)`.
- **Shares for budget**: Binary search (60 iterations) over the cost function.
- **Payouts**: Winning shares pay 1 token each. Buy 80 YES shares for 50 tokens → 30 profit if YES wins.

### Example trade

Starting state: `q_yes=0, q_no=0` → price = 50%.
- User buys 50 tokens of YES → gets ~73 shares → new price shifts to ~56%
- If YES wins: user receives 73 tokens (23 profit)
- If NO wins: user loses the 50 tokens

## Database Schema

### Tables

| Table | Description |
|-------|------------|
| `profiles` | User accounts (extends `auth.users`). Balance, points, Brier score, department, avatar, `is_admin` flag |
| `markets` | Prediction markets. Title, description, category, LMSR state, priority flag, dept tag, research cache |
| `predictions` | User positions. Direction, amount, shares, entry probability, status, option index for multi-outcome |
| `comments` | Market discussion threads. Soft-delete via `deleted_at` |
| `notifications` | Per-user notification feed (resolution, payout, comment, closing-soon, welcome) |
| `transactions` | Token ledger (buy, sell, payout, void_refund, admin_adjust, signup_bonus) |
| `watchlist` | User market watchlist |
| `audit_log` | Admin action log |
| `app_config` | Server-side config (Anthropic API key, Intel briefing cache) — no RLS read policy |

### Key columns on `markets`

| Column | Purpose |
|--------|---------|
| `q_yes` / `q_no` | LMSR share quantities (binary markets) |
| `q_values` | LMSR share quantities array (multi-outcome markets) |
| `options` | JSONB array of `{label}` objects (multi-outcome markets) |
| `probabilities` | Current probability array (multi-outcome markets) |
| `market_type` | `'binary'` (default) or `'multi'` |
| `probability` | Current YES probability (binary markets) |
| `history` | JSONB array of `{t: ISO_timestamp, p: probability}` for charts — capped at 100 entries |
| `version` | Optimistic locking counter — prevents stale-state overwrites on concurrent trades |
| `status` | `'active'`, `'closed'`, `'resolved'`, `'pending'` |
| `resolution` | `'yes'`, `'no'`, `'void'`, or winning option index (multi) |
| `is_priority` | Float to top of market list, shown with amber badge |
| `target_dept` | Optional dept audience tag (e.g. `'Sales'`) — enables dept filter pill |
| `source_url` | Optional link to the source of truth for resolution |
| `research_cache` | JSONB — cached AI web research result |
| `research_cached_at` | Timestamp of last research run |

### Key columns on `profiles`

| Column | Purpose |
|--------|---------|
| `balance` | Current token balance (min 0) |
| `points` | Cumulative earnings score |
| `accuracy` | Win rate (resolved predictions won / total) |
| `brier_score` | Rolling mean Brier score — `(forecast − outcome)²` lower is better; `NULL` until 5+ resolved bets |
| `brier_n` | Count of resolved predictions included in `brier_score` |

### RPC Functions (SECURITY DEFINER)

All trading and resolution runs through server-side RPCs to ensure atomicity and prevent race conditions.

**Trading**

| Function | Purpose |
|----------|---------|
| `place_prediction` | Atomic buy: debit balance, insert prediction, update market state, record transaction, push notifications |
| `sell_position` | Atomic sell: credit balance, update prediction status, update market state, record transaction |

**Resolution**

| Function | Purpose |
|----------|---------|
| `resolve_market` | Resolve binary market: set status/resolution, pay winners, update Brier scores, notify participants and watchlist users |
| `resolve_multi_market` | Same for multi-outcome markets |

**Admin & Lifecycle**

| Function | Purpose |
|----------|---------|
| `close_expired_markets` | Auto-close markets past their `closes_at` date |
| `notify_closing_soon` | Create notifications for markets closing within 24 hours |
| `approve_market` / `reject_market` | Market moderation workflow |
| `claim_referral` | Award referral bonuses to referrer and referee |
| `claim_daily_bonus` | Daily login bonus (once per day) |
| `delete_market` | Admin-only cascade delete |
| `get_platform_stats` | Aggregate analytics |

**AI Support**

| Function | Purpose |
|----------|---------|
| `get_ai_key` | Returns Anthropic API key (auth required) |
| `get_briefing_cache` | Returns last Intel briefing from `app_config` |
| `set_briefing_cache` | Saves Intel briefing to `app_config` (admin only) |

### Row-Level Security (RLS)

All tables have RLS enabled. Key policies:
- **Read**: All authenticated users can read markets, profiles, predictions, and comments (transparency is a feature)
- **Write**: Users can only insert/update their own data
- **Market updates**: Go through SECURITY DEFINER RPCs (bypass RLS safely)
- **Admin actions**: Verified inside RPCs via `is_admin` check — the UI hides controls, but Postgres enforces them
- **`app_config`**: No read policy — only accessible via SECURITY DEFINER functions

## AI Features

The Anthropic API key is stored in `app_config` and fetched client-side via `get_ai_key()` (never hardcoded). All AI calls are made directly from the browser.

### Per-Market: Web Research

On any market detail page, the **Web Research** tab runs a live web search agentic loop (Claude Sonnet + `web_search_20250305`, up to 5 iterations). Returns:
- Verdict: `likely_yes` / `likely_no` / `uncertain`
- Estimated probability and probability range
- Bull case / bear case
- Key findings
- Research synthesis
- Divergence alert when web estimate differs from crowd by ≥15pts

Results are cached in `markets.research_cache` (DB-persisted). Re-opening the tab loads the cached result instantly with a "Last run: Xm ago" label.

### Per-Market: Platform Analysis

The **Platform Analysis** tab uses Claude Sonnet to analyze platform activity for the selected market — trade patterns, volume trends, crowd sentiment, and the user's current position. Runs on demand.

### Admin: AI Resolution Suggestion

In the admin resolution queue, each expired market has an **AI Suggest** button. It runs Claude Sonnet + web search to suggest a resolution verdict (`yes` / `no` / `uncertain`) with confidence, reasoning, and caveats. One-click resolve buttons appear inline.

### Intel Briefing

A weekly AI-generated market intelligence briefing (the **Intel** page). Covers active markets by category with sentiment, signals, and key insights. Visible to all users; the **Generate** button is admin-only. The briefing is cached in `app_config` via `set_briefing_cache()` so all users see the same last-generated version. Auto-generates on Monday for admins when the cache is stale.

### Market Creation Helpers (Haiku)

- **Suggest markets** — generates market ideas from a topic and category
- **Draft resolution criteria** — suggests clear, verifiable resolution criteria for a market title
- **Review market quality** — flags ambiguous wording, missing criteria, or category mismatches

## Features

### Core
- **Binary markets** (YES/NO) with LMSR pricing
- **Multi-outcome markets** (2–8 options) with generalized LMSR
- **Buy and sell** positions at market price with pre-trade estimate (shares, cost per share, price impact)
- **Real-time updates** via Supabase Realtime (markets, predictions, comments, notifications)
- **Probability history charts** — SVG polyline rendered inline
- **Market categories**: Product Launches, Competitor Intel, Sales Forecasts, Strategic Insights, Innovation & R&D, For Fun
- **Priority markets** — amber badge + float to top of list (`is_priority` flag)
- **Department filter** — pill row appears automatically when active markets have `target_dept` set
- **Source of truth URL** — optional link on each market for resolution reference

### User Experience
- **Guided onboarding tour** — spotlight overlay (SVG cutout) walking through key UI elements
- **Dark mode** — full theme support via `html.dark` class, persisted in `localStorage`
- **Animated probability counter** — eased 3-second count-up on market detail
- **Animated stat counters** on dashboard
- **Loading indicators** — top progress bar, skeleton states, spinner
- **Toast notifications** for all actions
- **Deep links** via URL hash (`#market=123`)
- **CSV export** for transactions, predictions, and markets
- **Responsive design** — mobile-friendly layout

### Trading
- **Slippage warnings** for large trades (>5% or >15% price impact)
- **Position management** — view active positions, sell back at current market price
- **Rate limiting** — 2-second cooldown between trades

### Social & Engagement
- **Market discussion** with comments (paginated, soft-delete)
- **User profiles** — trade history, win rate, Brier score, avatar customization
- **Leaderboard** — individual (sortable by Points or Brier Score) and by department
- **Watchlist** — follow markets, get notified on resolution
- **Referral system** with token bonuses
- **Daily login bonus**
- **Achievements** (earned badges)

### Admin
- **Admin panel** with tabs: Overview, Users, Markets, Audit Log, Quarterly Awards, Balance Reconciliation
- **Market approval workflow** (pending → approved / rejected)
- **Resolution queue** — expired markets sorted by trading volume, with AI-suggest per market
- **Resolution digest** — watchers notified on resolution with market outcome and payout
- **User management** — grant/revoke admin, adjust balances
- **Balance reconciliation** — detect and fix ledger discrepancies
- **Quarterly awards** — compute top traders, most active, best market creators
- **Audit trail** — all admin actions logged with actor, target, and timestamp

### Scoring
- **Points** — tokens earned from correct predictions (cumulative)
- **Win rate** — fraction of resolved predictions that paid out
- **Brier score** — rolling mean of `(forecast_probability − outcome)²`; lower is better; unlocks after 5 resolved bets; sortable on leaderboard; color-coded on profiles

## Market Lifecycle

```
Created → [Pending] → Active → Closed → Resolved
              ↓
           Rejected
```

1. **Created**: User fills out title, description, category, closing date, market type, optional dept tag and source URL
2. **Pending** (if non-admin): goes to admin approval queue
3. **Active**: Open for trading
4. **Closed**: Past `closes_at`. No new trades; existing positions can still be sold
5. **Resolved**: Admin resolves as YES/NO/VOID (binary) or selects winning option (multi). Payouts and Brier scores computed automatically. Watchlist users and position holders notified.

## Pages

| Page | Route | Description |
|------|-------|-------------|
| Login | `login` | Email/password sign-in and sign-up |
| Dashboard | `dashboard` | Gradient stat cards, hero featured market, activity feed, top leaderboard |
| Markets | `markets` | All markets with category/dept/status filters, search, sort |
| Market Detail | `market` | Chart, trading panel, positions, Platform Analysis tab, Web Research tab, comments |
| Create Market | `create` | Market creation form with templates, binary/multi toggle, AI helpers |
| Leaderboard | `leaderboard` | Individual (Points or Brier Score sort) and department rankings |
| Intel | `briefing` | Weekly AI-generated market intelligence briefing |
| Notifications | `notifications` | User notification inbox |
| Profile | `profile` | User stats (balance, points, win rate, trades, Brier score), positions, avatar |
| Transactions | `transactions` | Token ledger with CSV export |
| Analytics | `analytics` | Platform-wide stats and market analytics |
| Admin | `admin` | Admin dashboard (admin users only) |

## State Management

`AppState` (in `state.js`) is a pub/sub singleton holding all app state. Components subscribe via `AppState.subscribe(render)`. `AppState.notify()` triggers a full `innerHTML` re-render.

Key patterns:
- **Optimistic updates** — state updated immediately after RPC returns, background refresh follows
- **`_renderLocked`** — blocks `notify()` during long-running AI operations so realtime events don't wipe in-progress results
- **`_activeAITab`** — persists which AI tab (Analysis / Web Research) is active across re-renders
- **Navigation** — hash-based with in-memory state; skeleton renders on navigate, full render on data load

## Setup

### Prerequisites
- A Supabase project (free tier works)
- A web browser
- An Anthropic API key

### Steps
1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run `schema.sql` in the Supabase SQL Editor (complete schema — one file, no migrations)
3. Set your API key:
   ```sql
   INSERT INTO app_config (key, value) VALUES ('anthropic_api_key', 'sk-ant-...');
   ```
4. Update `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `js/supabase.js`
5. Open `index.html` in a browser
6. Make yourself an admin:
   ```sql
   UPDATE profiles SET is_admin = true WHERE email = 'you@sharkninja.com';
   ```

## Security Notes

- All trading logic runs in SECURITY DEFINER RPCs — client can't send fake share counts or prices
- RLS prevents users from modifying other users' data
- Optimistic locking (`version` column) prevents concurrent trade conflicts
- Admin checks are enforced server-side in Postgres, not just in the UI
- The Anthropic API key is stored in `app_config` (no RLS read policy) and fetched via `get_ai_key()` — never hardcoded in JS
- The Supabase anon key in `supabase.js` is intentionally public (scoped by RLS)
