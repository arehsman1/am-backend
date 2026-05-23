-- ============================================================
-- MATCHMAKING APP — CLEAN PRODUCTION MIGRATION V2
-- SAFE FOR SIGNUP + BACKEND-FIRST ARCHITECTURE
-- ============================================================

-- ─────────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────
-- PROFILES (FIXED FOR SAFE SIGNUP)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email            TEXT,
  full_name        TEXT,
  age              SMALLINT CHECK (age >= 18 AND age <= 100),
  date_of_birth   DATE,
  gender           TEXT CHECK (gender IN ('male','female','other')),
  location_city    TEXT,
  location_country TEXT,
  bio              TEXT CHECK (length(bio) <= 500),
  intent           TEXT CHECK (intent IN (
    'Serious relationship','Marriage minded',
    'Situationship / No strings attached','Friendship','ovn/st'
  )),
  profile_picture  TEXT,
  phone_number     TEXT,

  occupation       TEXT,
  religion         TEXT,
  genotype         TEXT,
  blood_group      TEXT,
  num_kids         SMALLINT,
  marital_status   TEXT,

  role             TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user','moderator','admin','owner')),

  is_verified      BOOLEAN NOT NULL DEFAULT FALSE,
  is_banned        BOOLEAN NOT NULL DEFAULT FALSE,

  ban_reason       TEXT,
  last_active_at   TIMESTAMPTZ,

  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_verified ON public.profiles(is_verified);

-- ─────────────────────────────────────────────
-- WALLETS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wallets (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance    NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency   CHAR(3) DEFAULT 'NGN',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- WALLET TRANSACTIONS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id),
  type TEXT CHECK (type IN ('deposit','spend','refund')),
  amount NUMERIC(15,2),
  balance_before NUMERIC(15,2),
  balance_after NUMERIC(15,2),
  reference TEXT UNIQUE,
  paystack_ref TEXT,
  status TEXT DEFAULT 'pending',
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- MEDIA
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id),
  type TEXT CHECK (type IN ('image','video')),
  storage_path TEXT,
  original_name TEXT,
  mimetype TEXT,
  size_bytes BIGINT,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  is_primary BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  moderated_by UUID REFERENCES public.profiles(id),
  moderated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- REQUESTS (FIXED)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES public.profiles(id),
  receiver_id UUID REFERENCES public.profiles(id),
  status TEXT DEFAULT 'new'
    CHECK (status IN ('new','accepted','declined','expired','cancelled')),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '12 hours',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FIX: prevent duplicate active requests safely
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_request
ON public.requests(sender_id, receiver_id)
WHERE status = 'new';

-- ─────────────────────────────────────────────
-- MATCHES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user1_id UUID REFERENCES public.profiles(id),
  user2_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- BOOSTS
CREATE TABLE IF NOT EXISTS public.boosts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_name TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boosts_user_active
ON public.boosts(user_id, is_active, expires_at);

-- ─────────────────────────────────────────────
-- REPORTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID REFERENCES public.profiles(id),
  reported_user_id UUID REFERENCES public.profiles(id),
  reason TEXT,
  description TEXT,
  status TEXT DEFAULT 'open',
  admin_note TEXT,
  actioned_by UUID REFERENCES public.profiles(id),
  actioned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- SUPPORT SYSTEM
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id),
  subject TEXT,
  status TEXT DEFAULT 'open',
  closed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES public.support_tickets(id),
  sender_id UUID REFERENCES public.profiles(id),
  sender_role TEXT CHECK (sender_role IN ('user','admin')),
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- ADMIN REQUESTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requested_by UUID REFERENCES public.profiles(id),
  target_user_id UUID REFERENCES public.profiles(id),
  reason TEXT,
  status TEXT DEFAULT 'pending',
  actioned_by UUID REFERENCES public.profiles(id),
  actioned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- VERIFICATION / OTP CODES
CREATE TABLE IF NOT EXISTS public.verification_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  purpose TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- APP CONFIG
CREATE TABLE IF NOT EXISTS public.app_config (
  id TEXT PRIMARY KEY,
  value TEXT,
  description TEXT,
  is_secret BOOLEAN DEFAULT FALSE,
  updated_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- COMPATIBILITY ALTERATIONS
-- These keep the script safe when an older version of this schema already ran.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age SMALLINT CHECK (age >= 18 AND age <= 100);

ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS paystack_ref TEXT;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.media ADD COLUMN IF NOT EXISTS original_name TEXT;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS mimetype TEXT;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS size_bytes BIGINT;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;

ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS admin_note TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS actioned_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS actioned_at TIMESTAMPTZ;

ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS sender_role TEXT CHECK (sender_role IN ('user','admin'));

ALTER TABLE public.admin_requests ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE public.admin_requests ADD COLUMN IF NOT EXISTS actioned_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.admin_requests ADD COLUMN IF NOT EXISTS actioned_at TIMESTAMPTZ;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_intent_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_intent_check
  CHECK (intent IS NULL OR intent IN (
    'Serious relationship','Marriage minded',
    'Situationship / No strings attached','Friendship','ovn/st'
  ));

INSERT INTO public.app_config (id, value, description, is_secret)
VALUES
  ('site_name', 'AmoreMatch', 'Public site name', false),
  ('site_logo_url', '', 'Public logo URL', false),
  ('site_favicon_url', '', 'Public favicon URL', false),
  ('seo_title', 'AmoreMatch', 'SEO title', false),
  ('seo_description', '', 'SEO description', false),
  ('seo_keywords', '', 'SEO keywords', false),
  ('seo_og_image', '', 'SEO Open Graph image', false)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.credit_wallet_deposit(
  p_user_id UUID,
  p_amount NUMERIC,
  p_reference TEXT
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet public.wallets%ROWTYPE;
  v_txn public.wallet_transactions%ROWTYPE;
  v_new_balance NUMERIC(15,2);
BEGIN
  SELECT *
  INTO v_txn
  FROM public.wallet_transactions
  WHERE user_id = p_user_id
    AND reference = p_reference
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
  END IF;

  v_new_balance := v_wallet.balance + p_amount;

  UPDATE public.wallets
  SET balance = v_new_balance,
      updated_at = NOW()
  WHERE id = v_wallet.id;

  UPDATE public.wallet_transactions
  SET status = 'success',
      amount = p_amount,
      balance_before = v_wallet.balance,
      balance_after = v_new_balance
  WHERE id = v_txn.id;

  RETURN v_new_balance;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.credit_wallet_deposit(UUID, NUMERIC, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credit_wallet_deposit(UUID, NUMERIC, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.credit_wallet_deposit(UUID, NUMERIC, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.credit_wallet_deposit(UUID, NUMERIC, TEXT) TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────
-- SIGNUP TRIGGER (FIXED SAFE VERSION)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN

  INSERT INTO public.profiles (id, email, role, is_verified, is_banned)
  VALUES (NEW.id, NEW.email, 'user', FALSE, FALSE)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.wallets (user_id, balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────
-- ADMIN HELPER
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin','owner')
  );
$$;
