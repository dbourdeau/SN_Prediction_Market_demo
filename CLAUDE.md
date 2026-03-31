# SharkPool — Claude Code Instructions

## Project Overview
Internal prediction market platform for SharkNinja employees. Lets employees forecast on product launches, strategy, competitor intel, and sales. Built for an AI hackathon but intended as a real production tool.

**Goal:** Capture collective intelligence to improve leadership forecasting.

## Tech Stack
- **Frontend:** Vanilla HTML/CSS/JS — no build step, no Node.js, no npm
- **Styles:** Tailwind CSS via CDN only
- **Backend:** Supabase (Postgres + Auth + Realtime + RLS)
- **AI:** Claude API called directly from the browser using `anthropic-dangerous-direct-browser-access`
- **Hosting:** Static file hosting (GitHub Pages or similar)

## File Structure
```
index.html          — Single HTML shell; loads all JS/CSS
js/
  data.js           — Constants: CATEGORIES, DEPARTMENTS, config
  amm.js            — LMSR AMM math (b=200)
  supabase.js       — All DB calls (DB object)
  state.js          — AppState singleton, all business logic
  components.js     — Reusable UI: header, charts, modal, esc()
  pages.js          — Page renderers (Pages object)
  app.js            — render() loop + all event handlers
  ai.js             — AI module: suggestMarkets(), summarizeMarket()
docs/
  ARCHITECTURE.md   — System diagram and data flows
  DATABASE.md       — Full schema reference
schema.sql     — Complete database schema (single source of truth, run on fresh project)
```

## Architecture

### Rendering Model
Pure client-side SPA. `AppState.notify()` calls `render()` which innerHTML-replaces the entire `<main>`. No virtual DOM, no diffing.

```
User action → handler in app.js → AppState mutation → notify() → render() → DOM
```

### State
`AppState` (state.js) is a global singleton holding all app state: user, session, markets, predictions, leaderboard, etc. It loads data from Supabase on init and after mutations.

### XSS Protection
All user-generated content must be escaped with `esc()` (components.js). Never use raw string interpolation for user data in HTML templates. `escAttr()` exists for onclick attribute strings.

### AI Module
`AI` object in ai.js fetches the API key via `supabaseClient.rpc('get_ai_key')` (SECURITY DEFINER, requires auth), then calls the Anthropic API directly from the browser. The API key lives in the `app_config` table — never hardcode it.

## Key Conventions

### No Framework
- No React, Vue, Angular, etc.
- No imports/exports — all files are plain `<script>` tags
- All globals are accessible on `window`

### SQL Schema
- `schema.sql` is the single source of truth for the full database schema
- For schema changes: update `schema.sql` directly (add columns/functions with `IF NOT EXISTS`)
- Always use `IF NOT EXISTS` / `IF EXISTS` for safety
- RLS is enabled on all user-facing tables

### Tailwind
- CDN only — no custom config, no JIT purging
- Stick to standard Tailwind classes
- Custom CSS goes in `<style>` in index.html

### Dark Mode
- Triggered by `html.dark` class
- Add `dark:` variants when adding new UI
- Prefer explicit Tailwind color classes over inherited values for dark mode reliability

### Market Types
- `binary` — yes/no, uses `probability`, `q_yes`, `q_no`, `logit`
- `multi` — multiple options, uses `options` (JSONB), `probabilities` (JSONB), `q_values` (JSONB)

## Database — Key Tables
| Table | Purpose |
|---|---|
| `markets` | All markets (binary + multi) |
| `predictions` | Open positions |
| `transactions` | Trade history |
| `profiles` | User profiles, balance, score |
| `comments` | Market discussion |
| `notifications` | Per-user notification feed |
| `achievements` | Earned badges |
| `app_config` | Server-side config (API keys) — no RLS read policy |

## Important RPCs (Postgres Functions)
- `place_prediction(market_id, side, amount)` — atomic trade execution
- `sell_prediction(prediction_id, amount)` — sell a position
- `resolve_market(market_id, resolution)` — admin only
- `get_platform_stats()` — analytics
- `get_ai_key()` — returns Anthropic API key (auth required, SECURITY DEFINER)

## Supabase Project
- URL: `uanjytnrxniwmddpvxsa.supabase.co`
- Free tier — no outbound HTTP from Postgres functions (use browser-side calls instead)
- No CLI deployed — Edge Functions cannot be used without CLI deployment

## Things to Avoid
- Do not add a build system, bundler, or package.json
- Do not use `npm install` or reference node_modules
- Do not hardcode the Anthropic API key anywhere in JS files
- Do not modify existing migration SQL files
- Do not use `http` extension in Postgres functions (blocked on free tier)
- Do not add error handling for impossible cases — trust Supabase's guarantees
