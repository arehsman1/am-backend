# Matchmaking Platform

One Render deployment. One URL. Express API + React Admin Dashboard.

```
matchmaking-app/
├── app.js              ← Render starts here (root level — no path confusion)
├── package.json
├── .env.example
├── migrations/
│   └── schema.sql      ← Run once in Supabase SQL Editor
├── src/
│   ├── routes/         ← /auth /users /admin /media /reports /support /wallet
│   ├── controllers/
│   ├── middleware/      ← auth.js, roles.js, validate.js, upload.js
│   ├── services/
│   ├── config/          ← supabase.js
│   ├── cron/            ← expire requests, boosts, OTP cleanup
│   └── utils/
└── admin/              ← React admin dashboard (Vite)
    └── src/
        ├── pages/       ← Dashboard, Users, Media, Reports, Support, Promotions, Wallets
        └── components/
```

---

## Render Setup

| Setting | Value |
|---|---|
| Build Command | `npm run build` |
| Start Command | `npm start` |
| Root Directory | *(leave blank)* |
| Node Version | 18+ |

`npm run build` installs admin dependencies and builds React into `/public`.
`npm start` runs `node app.js` — found at the root, never inside `src/`.

---

## Local Development

```bash
# Install backend
npm install

# Run backend (API on :5000)
npm run dev

# Second terminal — admin UI with hot reload on :3000
npm run dev:admin
# Vite proxies /api → :5000 automatically
```

---

## Environment Variables

Copy `.env.example` → `.env` and fill in:

```env
PORT=5000
NODE_ENV=development
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key   # never expose to browser
PAYSTACK_SECRET_KEY=sk_test_...
JWT_SECRET=random_32+_chars
FRONTEND_URL=https://yourapp.onrender.com
```

See `.env.example` for email, SMS, and KYC provider keys.

---

## Database

Run `migrations/schema.sql` once in **Supabase SQL Editor**.

Safe to re-run — all statements use `CREATE TABLE IF NOT EXISTS` and `ON CONFLICT DO NOTHING`.

### Tables

| Table | Purpose |
|---|---|
| `profiles` | User data + role + verification + ban status |
| `wallets` | One per user, ₦ balance |
| `wallet_transactions` | Full deposit/spend ledger |
| `media` | Uploaded images/videos — starts as `pending` |
| `requests` | Connection requests, 12h expiry |
| `matches` | Created when request is accepted |
| `image_unlocks` | ₦400 unlocks per image per user |
| `boosts` | Active profile boosts (female only) |
| `notifications` | In-app notifications |
| `admin_requests` | Pending admin promotion requests |
| `reports` | User-submitted reports |
| `support_tickets` | Support conversations |
| `support_messages` | Thread messages |

---

## Role System

| Role | Level | Permissions |
|---|---|---|
| `user` | 0 | Default. Basic platform access. |
| `moderator` | 1 | Review media, action reports, reply to support |
| `admin` | 2 | All moderator powers + ban users + verify users + submit promotion requests |
| `owner` | 3 | All admin powers + approve/reject promotion requests + set any role |

**Rules enforced in backend middleware (`src/middleware/roles.js`):**
- Role checks happen server-side — frontend cannot override
- `owner` role cannot be set via API (set directly in DB)
- Admin cannot ban another admin — only the owner can
- Owner cannot be banned via API

### Setting the First Owner

After running migrations and your first signup:

```sql
-- Run in Supabase SQL Editor
UPDATE public.profiles
SET role = 'owner'
WHERE email = 'your-owner@email.com';
```

Only one owner should exist. Do not expose this via API.

---

## Admin Promotion Flow

```
1. Admin submits POST /admin/promotion-requests { target_user_id, reason }
   → Stored as pending in admin_requests table

2. Owner reviews GET /admin/promotion-requests
   → Sees all pending requests

3. Owner approves: PATCH /admin/promotion-requests/:id/approve
   → User role updated to 'admin'
   → Request marked approved

   OR Owner rejects: PATCH /admin/promotion-requests/:id/reject
   → Request permanently DELETED from database
```

---

## Media Moderation Flow

```
User uploads file
   ↓
File saved to Supabase Storage (private bucket)
Media record created with status = 'pending'
   ↓
Admin/moderator sees it in pending queue
   ↓
APPROVE → status = 'approved' → visible to all users
   OR
REJECT  → file deleted from storage
         record hard-deleted from database
```

Only `approved` media with `is_deleted = false` is returned to frontend.

---

## API Routes

All protected routes require `Authorization: Bearer <supabase_access_token>`.

### Auth — `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | No | Create account |
| POST | `/auth/login` | No | Login, returns access + refresh token |
| POST | `/auth/logout` | Yes | Invalidate session |
| GET | `/auth/me` | Yes | Current user profile |
| POST | `/auth/refresh` | No | Refresh access token |

### Users — `/api/users`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/users/explore` | Yes + Verified | Explore feed — all users, sorted |
| GET | `/users` | Admin | List all users with filters |
| GET | `/users/me` | Yes | Own full profile |
| PATCH | `/users/me` | Yes | Update profile (**gender locked**) |
| GET | `/users/:id` | Yes | View any user's profile |
| PATCH | `/users/:id/verify` | Admin | Verify or unverify a user |
| PATCH | `/users/:id/ban` | Admin | Ban or unban a user |

### Admin — `/api/admin`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/stats` | Admin | Platform statistics |
| POST | `/admin/promotion-requests` | Admin | Submit promotion request |
| GET | `/admin/promotion-requests` | Owner | View pending promotions |
| PATCH | `/admin/promotion-requests/:id/approve` | Owner | Approve → promotes user |
| PATCH | `/admin/promotion-requests/:id/reject` | Owner | Reject → deletes request |
| PATCH | `/admin/users/:id/role` | Owner | Set role directly |

### Media — `/api/media`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/media/upload` | Yes | Upload image/video → status: pending |
| GET | `/media/my` | Yes | Own uploads (all statuses) |
| DELETE | `/media/:id` | Yes | Delete own file |
| GET | `/media/profile/:userId` | Yes | Approved media for a profile |
| GET | `/media/admin/pending` | Moderator | All pending uploads |
| PATCH | `/media/admin/:id/approve` | Moderator | Approve media |
| PATCH | `/media/admin/:id/reject` | Moderator | Reject + delete file + record |

### Reports — `/api/reports`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/reports` | Yes | Submit a report |
| GET | `/reports/mine` | Yes | Own submitted reports |
| GET | `/reports` | Moderator | All reports (filterable) |
| PATCH | `/reports/:id/action` | Moderator | warn / ban / delete_content / close |

### Support — `/api/support`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/support/tickets` | Yes | Open a ticket (only way to contact admin) |
| GET | `/support/tickets` | Yes | Own tickets |
| GET | `/support/tickets/:id` | Yes | Thread view |
| POST | `/support/tickets/:id/reply` | Yes | Reply to thread |
| GET | `/support/admin/tickets` | Moderator | All tickets |
| PATCH | `/support/admin/tickets/:id/close` | Moderator | Close ticket |

### Wallet — `/api/wallet`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/wallet` | Yes | Own balance |
| POST | `/wallet/initialize` | Yes | Start Paystack payment |
| GET | `/wallet/verify/:reference` | Yes | Verify after redirect |
| POST | `/wallet/webhook` | No (HMAC) | Paystack webhook |

---

## Security

| Threat | Defence |
|---|---|
| Frontend passing fake user_id | `authenticate` middleware calls `supabase.auth.getUser(token)` — identity is server-derived |
| Non-admin accessing admin routes | `requireAdmin` / `requireOwner` middleware checks `req.user.role` |
| User changing their own role | Role not in `ALLOWED_UPDATE_FIELDS` — backend rejects silently |
| User changing gender | Gender not in `ALLOWED_UPDATE_FIELDS` — returns 400 error |
| Frontend bypassing API to write DB | Supabase RLS blocks all writes that don't match policies |
| Unverified user accessing explore | `requireVerified` middleware returns 403 |
| Uploading bypasses moderation | All uploads start as `pending` — never visible until admin approves |
| Rejected media staying in storage | `rejectMedia` hard-deletes from both Supabase Storage and the DB |
| Paystack double-credit | Webhook only processes `pending` transactions — idempotent |
| Admin promoting themselves | Promotion requires owner approval — admin cannot self-approve |
| Owner being banned | `banUser` controller checks `target.role === 'owner'` and returns 403 |

---

## Admin Dashboard Pages

Open `https://yourapp.onrender.com` after deploy.

| Page | Route | Who can access |
|---|---|---|
| Dashboard | `/` | All staff |
| Users | `/users` | Admin, Owner |
| Media | `/media` | Moderator, Admin, Owner |
| Reports | `/reports` | Moderator, Admin, Owner |
| Support | `/support` | Moderator, Admin, Owner |
| Promotions | `/promotions` | All staff (owner takes action) |
| Wallets | `/wallets` | Admin, Owner |

---

## Valid Intent Values

Enforced by backend — any other value returns 400:

- `Serious relationship`
- `Marriage minded`
- `Situationship / No strings attached`
- `Friendship`
- `ovn/st`

Conditional fields required for `Serious relationship` and `Marriage minded`:
`occupation`, `religion`, `genotype`, `blood_group`, `num_kids`, `marital_status`

---

## Boost Plans (female users only)

| Plan | Price | Duration |
|---|---|---|
| `basic` | ₦1,300 | 24 hours |
| `standard` | ₦3,000 | 72 hours |
| `premium` | ₦5,000 | 96 hours |

---

## Cron Jobs

| Job | Schedule | What it does |
|---|---|---|
| Expire requests | Every 30 min | Sets requests past 12h expiry to `expired` |
| Deactivate boosts | Every hour | Sets expired boosts to `is_active = false` |
| Clean OTP codes | Every hour | Deletes expired verification codes |

---

## Production Checklist

- [ ] `migrations/schema.sql` run in Supabase SQL Editor
- [ ] First owner set via SQL: `UPDATE profiles SET role = 'owner' WHERE email = '...'`
- [ ] Supabase storage bucket created and set to **private**
- [ ] `NODE_ENV=production` in Render env vars
- [ ] Live Paystack keys (`sk_live_` not `sk_test_`)
- [ ] `PAYSTACK_CALLBACK_URL` set to `https://yourapp.onrender.com/wallet/callback`
- [ ] Paystack webhook URL set in Paystack dashboard: `https://yourapp.onrender.com/api/wallet/webhook`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set in Render (never in browser code)
- [ ] Strong `JWT_SECRET` (32+ random characters)
