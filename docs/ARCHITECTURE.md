# Architecture & Technical Reference

## System Overview

```
┌──────────────────────────────────────────────┐
│                  Browser                      │
│                                               │
│  index.html                                   │
│  ├── data.js      (constants)                 │
│  ├── amm.js       (LMSR math)                │
│  ├── supabase.js  (API layer)                │
│  ├── state.js     (AppState singleton)        │
│  ├── components.js (UI + Tour)               │
│  ├── pages.js     (page renderers)           │
│  └── app.js       (render loop + handlers)   │
│                                               │
│  AppState.subscribe(render)                   │
│  AppState.notify() → render() → DOM update   │
└──────────────┬───────────────────────────────┘
               │ supabase-js SDK
               ▼
┌──────────────────────────────────────────────┐
│             Supabase                          │
│                                               │
│  ┌─────────┐  ┌──────────┐  ┌────────────┐  │
│  │  Auth    │  │ Postgres │  │  Realtime   │  │
│  │ (email/  │  │ (RLS +   │  │ (postgres   │  │
│  │  pw)     │  │  RPCs)   │  │  changes)   │  │
│  └─────────┘  └──────────┘  └────────────┘  │
└──────────────────────────────────────────────┘
```

## Data Flow

### Trading Flow (Buy)

```
User clicks "Buy YES"
  → handlePrediction()           [app.js]
    → AppState.placePrediction() [state.js]
      → DB.placePrediction()     [supabase.js]
        → RPC place_prediction   [Postgres]
          ├── Debit user balance
          ├── Insert prediction row
          ├── Update market (q_yes/q_no, probability, volume, traders, history)
          ├── Insert transaction record
          └── Insert notification for market watchers
      ← Returns prediction ID
    → Optimistic state update (balance, market data)
    → notify() → render()
    → Background: refresh predictions list (non-blocking)
```

### Sell Flow

```
User clicks "Sell"
  → handleSellPosition()        [app.js]
    → showModal() for confirm
    → AppState.sellPosition()   [state.js]
      → AMM.sellRevenue()       [amm.js] (calculate expected revenue)
      → DB.sellPositionRPC()    [supabase.js]
        → RPC sell_position     [Postgres]
          ├── Credit user balance
          ├── Update prediction status → 'sold'
          ├── Update market (q_yes/q_no, probability, volume, history)
          └── Insert transaction record
      ← Returns revenue amount
    → Optimistic state update
    → notify() → render()
```

### Resolution Flow

```
Admin clicks "Resolve YES"
  → handleResolveMarket()       [app.js]
    → showModal() for confirm
    → AppState.resolveMarket()  [state.js]
      → DB.resolveMarket()      [supabase.js]
        → RPC resolve_market    [Postgres]
          ├── Set market status → 'resolved', resolution → 'yes'
          ├── For each active prediction:
          │   ├── Calculate payout (winning shares × 1 token)
          │   ├── Update prediction status → 'won' or 'lost'
          │   ├── Credit winner balance
          │   ├── Update winner points/accuracy
          │   └── Insert payout transaction
          └── Insert notification for all participants
```

## State Management Pattern

`AppState` is a pub/sub singleton. The entire app re-renders on every state change.

```
AppState.notify()
  → listeners.forEach(fn => fn())
    → render()                     [app.js]
      → Pages.{currentPage}()     [pages.js]
        → Components.{widget}()   [components.js]
      → app.innerHTML = result
```

### Why full re-render?

For a hackathon prototype, full innerHTML replacement is simple and effective:
- No virtual DOM overhead or framework complexity
- Tailwind utility classes mean no style recalculation issues
- Charts re-render via `setTimeout(0)` (inline scripts don't execute in innerHTML)
- Performance is fine for the expected user count (~100-500 employees)

## Realtime Subscriptions

```javascript
// Market price changes (global)
DB.subscribeToMarkets(payload => {
    // Update local market data, re-render
});

// New predictions on current market
DB.subscribeToPredictions(marketId, payload => {
    // Add to selectedMarketPredictions, re-render
});

// New comments on current market
DB.subscribeToComments(marketId, payload => {
    // Add to selectedMarketComments, re-render
});

// Notifications for current user
DB.subscribeToNotifications(userId, payload => {
    // Increment unread count, re-render header badge
});
```

Subscriptions are managed per-page. When navigating away from a market detail page, old market-specific channels are unsubscribed.

## LMSR Implementation Details

### Binary markets

The state is two quantities: `q_yes` and `q_no` (both start at 0).

```
Cost function:    C(qY, qN) = b × ln(e^(qY/b) + e^(qN/b))
Buy cost:         cost = C(qY + shares, qN) - C(qY, qN)     [for YES]
YES probability:  p = sigmoid((qY - qN) / b) = 1 / (1 + e^(-(qY-qN)/b))
```

Log-sum-exp trick is used for numerical stability (subtracting max before exp).

### Multi-outcome markets

The state is an array: `q_values = [q0, q1, ..., qN]` (all start at 0).

```
Cost function:    C(q) = b × ln(Σ e^(qi/b))
Buy cost:         cost = C(q with qi+shares) - C(q)
Probabilities:    softmax(q / b)  →  always sum to 1
```

### Shares-for-budget calculation

Since cost is monotonically increasing in shares, binary search finds the exact number of shares purchasable for a given budget (60 iterations for ~18 decimal digits of precision).

## Security Model

### Row-Level Security (RLS)

Every table has RLS enabled. The general pattern:
- `SELECT`: All authenticated users can read everything (transparency is a feature)
- `INSERT`: Users can only insert rows where `user_id = auth.uid()`
- `UPDATE`: Users can only update their own profile
- Market/prediction mutations go through RPCs (which use `SECURITY DEFINER` to bypass RLS)

### SECURITY DEFINER RPCs

Critical operations run as the database owner (not the calling user), ensuring:
1. **Atomicity**: Balance debit + prediction insert + market update happen in one transaction
2. **Integrity**: Server calculates shares/cost (client can't send fake numbers)
3. **Consistency**: Optimistic locking via `version` column prevents concurrent trade conflicts

### Admin verification

Admin-only operations check `is_admin` inside the RPC:
```sql
IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_resolved_by AND is_admin = true) THEN
    RAISE EXCEPTION 'Only admins can resolve markets';
END IF;
```

This is enforced server-side — the UI hides admin controls, but the actual protection is in Postgres.

## Navigation & Routing

Navigation is hash-based with in-memory state:

```javascript
AppState.navigate('market', { marketId: 42 })
  → Sets currentPage = 'market'
  → Sets navigating = true (shows progress bar + skeleton)
  → Clears previous page state
  → notify() → render skeleton
  → Fetches market data, predictions, comments
  → Sets navigating = false
  → notify() → render full page
```

Deep links via URL hash: `#market=42` is parsed on init to navigate directly to a market.

## Guided Tour System

The `Tour` object in `components.js` provides an interactive walkthrough:

1. **SVG overlay**: Full-screen SVG with a mask that cuts out the target element (spotlight effect)
2. **Tooltip**: Positioned above or below the target with an arrow
3. **Steps**: Balance display → Markets nav → Market cards → Create → Leaderboard → Notifications
4. **Controls**: Next/Back/Skip buttons, keyboard support (Escape to exit, Arrow keys to navigate)
5. **Persistence**: Completion stored in `localStorage('sn_onboarded')`

## Dark Mode

Dark mode is implemented with:
1. A `dark` class on `<html>` (toggled via `AppState.toggleDarkMode()`)
2. CSS overrides in `<style id="dark-mode-overrides">` that use `html.dark .class` selectors with `!important`
3. Persisted in `localStorage('sn_darkMode')`

The overrides load after Tailwind CDN, so they win specificity battles.
