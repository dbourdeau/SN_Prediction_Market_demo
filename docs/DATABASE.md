# Database Schema Reference

## Entity Relationship

```
auth.users (Supabase managed)
    │
    ▼ (trigger: handle_new_user)
profiles ──┬──< predictions ──> markets
            ├──< comments ────> markets
            ├──< transactions
            ├──< notifications
            ├──< watchlist ───> markets
            └──< audit_log
```

## Tables

### profiles

Extends Supabase `auth.users`. Auto-created on signup via trigger.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID (PK) | — | References `auth.users(id)` |
| `email` | TEXT (UNIQUE) | — | User email |
| `name` | TEXT | — | Display name |
| `department` | TEXT | `'General'` | SharkNinja department |
| `avatar` | TEXT | `'XX'` | Emoji or 2-letter initials |
| `balance` | INTEGER | `500` | Current token balance |
| `points` | INTEGER | `0` | Lifetime points (from correct predictions) |
| `accuracy` | REAL | `0` | Win rate (0.0–1.0) |
| `trades` | INTEGER | `0` | Total trades placed |
| `is_admin` | BOOLEAN | `false` | Admin access flag |
| `referred_by` | UUID | NULL | Referrer's user ID |
| `last_bonus_date` | DATE | NULL | Last daily bonus claim date |
| `created_at` | TIMESTAMPTZ | `now()` | Account creation |

### markets

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | SERIAL (PK) | — | Auto-increment integer |
| `title` | TEXT | — | Market question |
| `description` | TEXT | — | Resolution criteria and context |
| `category` | TEXT | `'strategy'` | One of: `product_launch`, `competitor`, `sales`, `strategy`, `innovation`, `fun` |
| `market_type` | TEXT | `'binary'` | `'binary'` or `'multi'` |
| `probability` | REAL | `0.50` | Current YES probability (binary markets) |
| `q_yes` | REAL | `0` | LMSR YES share quantity (binary) |
| `q_no` | REAL | `0` | LMSR NO share quantity (binary) |
| `q_values` | REAL[] | `NULL` | LMSR share quantities array (multi-outcome) |
| `options` | JSONB | `NULL` | Array of `{"label": "Option name"}` (multi-outcome) |
| `volume` | INTEGER | `0` | Total tokens traded |
| `traders` | INTEGER | `0` | Unique trader count |
| `status` | TEXT | `'active'` | `'active'`, `'closed'`, `'resolved'`, `'pending'` |
| `resolution` | TEXT | `NULL` | `'yes'`, `'no'`, `'void'`, or winning option index |
| `trending` | BOOLEAN | `false` | Featured on dashboard |
| `history` | JSONB | `[{"t":"...","p":0.5}]` | Probability history for charts |
| `version` | INTEGER | `0` | Optimistic locking counter |
| `created_by` | UUID (FK) | — | Creator's profile ID |
| `created_by_name` | TEXT | `'Unknown'` | Denormalized creator name |
| `created_at` | TIMESTAMPTZ | `now()` | Creation timestamp |
| `closes_at` | DATE | — | Market closing date |

### predictions

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | SERIAL (PK) | — | Auto-increment integer |
| `user_id` | UUID (FK) | — | Trader's profile ID |
| `market_id` | INTEGER (FK) | — | Market being traded |
| `direction` | TEXT | — | `'yes'` or `'no'` (binary); option label (multi) |
| `option_index` | INTEGER | `NULL` | Index into `markets.options` (multi-outcome only) |
| `amount` | INTEGER | — | Tokens spent (min 10) |
| `shares` | REAL | — | Shares received from AMM |
| `entry_prob` | REAL | — | Market probability at time of trade |
| `status` | TEXT | `'active'` | `'active'`, `'won'`, `'lost'`, `'sold'`, `'void'` |
| `payout` | REAL | `NULL` | Tokens received on resolution |
| `created_at` | TIMESTAMPTZ | `now()` | Trade timestamp |

### comments

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | SERIAL (PK) | — | Auto-increment integer |
| `user_id` | UUID (FK) | — | Author's profile ID |
| `market_id` | INTEGER (FK) | — | Market being discussed |
| `text` | TEXT | — | Comment body |
| `deleted_at` | TIMESTAMPTZ | `NULL` | Soft-delete timestamp |
| `deleted_by` | UUID | `NULL` | Who deleted the comment |
| `created_at` | TIMESTAMPTZ | `now()` | Posted timestamp |

### notifications

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | SERIAL (PK) | — | Auto-increment integer |
| `user_id` | UUID (FK) | — | Recipient |
| `type` | TEXT | — | Notification type (e.g., `'resolution'`, `'payout'`, `'closing_soon'`) |
| `title` | TEXT | — | Short title |
| `message` | TEXT | — | Notification body |
| `market_id` | INTEGER | `NULL` | Related market (for deep linking) |
| `is_read` | BOOLEAN | `false` | Read status |
| `created_at` | TIMESTAMPTZ | `now()` | Created timestamp |

### transactions

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | SERIAL (PK) | — | Auto-increment integer |
| `user_id` | UUID (FK) | — | Account holder |
| `type` | TEXT | — | `'buy'`, `'sell'`, `'payout'`, `'bonus'`, `'referral'`, `'admin_adjust'` |
| `amount` | REAL | — | Signed amount (+/−) |
| `balance_after` | REAL | `NULL` | Balance after this transaction |
| `market_id` | INTEGER | `NULL` | Related market |
| `description` | TEXT | `NULL` | Human-readable description |
| `created_at` | TIMESTAMPTZ | `now()` | Transaction timestamp |

### watchlist

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL (PK) | Auto-increment |
| `user_id` | UUID (FK) | User watching |
| `market_id` | INTEGER (FK) | Market being watched |
| `created_at` | TIMESTAMPTZ | When added |

Unique constraint on `(user_id, market_id)`.

### audit_log

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL (PK) | Auto-increment |
| `actor_id` | UUID (FK) | Admin who performed the action |
| `action` | TEXT | Action name (e.g., `'resolve_market'`, `'delete_market'`, `'grant_admin'`) |
| `target_type` | TEXT | Entity type (`'market'`, `'user'`, etc.) |
| `target_id` | TEXT | Entity ID |
| `details` | JSONB | Additional context |
| `created_at` | TIMESTAMPTZ | When the action occurred |

## RPC Functions

### place_prediction

```sql
place_prediction(
    p_user_id UUID,
    p_market_id INTEGER,
    p_direction TEXT,        -- 'yes' or 'no'
    p_amount INTEGER,
    p_option_index INTEGER,  -- NULL for binary, 0-N for multi
    p_version INTEGER        -- optimistic lock
)
```

Returns the new prediction ID. Raises exception on insufficient balance, wrong version, or closed market.

### sell_position

```sql
sell_position(
    p_prediction_id INTEGER,
    p_user_id UUID,
    p_version INTEGER
)
```

Returns the revenue amount. Raises exception if prediction is not active or not owned by caller.

### resolve_market / resolve_multi_market

```sql
resolve_market(p_market_id INTEGER, p_resolution TEXT, p_resolved_by UUID)
resolve_multi_market(p_market_id INTEGER, p_winning_index INTEGER, p_resolved_by UUID)
```

Processes all active predictions, calculates payouts, updates balances. Admin-only (checked server-side).

### Utility RPCs

| Function | Parameters | Description |
|----------|-----------|-------------|
| `close_expired_markets` | (none) | Sets status='closed' for markets past closes_at |
| `notify_closing_soon` | (none) | Creates notifications for markets closing within 24h |
| `approve_market` | `(p_market_id, p_approved_by)` | Sets pending market to active |
| `reject_market` | `(p_market_id, p_rejected_by, p_reason)` | Rejects pending market |
| `claim_referral` | `(p_user_id, p_referrer_id)` | Awards referral bonus to both users |
| `claim_daily_bonus` | `(p_user_id)` | Awards daily login bonus (once per day) |
| `delete_market` | `(p_market_id, p_deleted_by)` | Cascade-deletes market (admin-only) |

## Migration Order

Run in Supabase SQL Editor, in order:

1. `supabase-setup.sql`
2. `supabase-migration-v2.sql` through `supabase-migration-v13.sql`

Each migration is idempotent where possible (uses `CREATE OR REPLACE`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, etc.).
