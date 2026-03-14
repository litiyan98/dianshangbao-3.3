-- Referral / growth schema for Cloudflare D1
-- Prerequisite:
-- 1. Existing Users / Orders tables already created
-- 2. Existing schema-v2.sql already applied (invite_code / invited_by)

CREATE TABLE IF NOT EXISTS ReferralBindings (
  id TEXT PRIMARY KEY,
  invite_code TEXT NOT NULL,
  referrer_user_id TEXT NOT NULL,
  referred_user_id TEXT NOT NULL UNIQUE,
  bind_source TEXT NOT NULL DEFAULT 'landing',
  status TEXT NOT NULL DEFAULT 'BOUND',
  bound_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_referral_bindings_referrer_user_id ON ReferralBindings(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_bindings_invite_code ON ReferralBindings(invite_code);

CREATE TABLE IF NOT EXISTS InviteLinks (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  invite_code TEXT NOT NULL,
  label TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'landing',
  is_default INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invite_links_owner_user_id ON InviteLinks(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invite_links_invite_code ON InviteLinks(invite_code);

CREATE TABLE IF NOT EXISTS ReferralRewardRules (
  package_type TEXT PRIMARY KEY,
  package_name TEXT NOT NULL,
  buyer_bonus_tokens INTEGER NOT NULL DEFAULT 0,
  referrer_bonus_tokens INTEGER NOT NULL DEFAULT 0,
  unlock_copy_cooldown INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ReferralRewardGrants (
  id TEXT PRIMARY KEY,
  paid_order_id TEXT NOT NULL UNIQUE,
  referrer_user_id TEXT NOT NULL,
  referred_user_id TEXT NOT NULL,
  package_type TEXT NOT NULL,
  buyer_bonus_tokens INTEGER NOT NULL DEFAULT 0,
  referrer_bonus_tokens INTEGER NOT NULL DEFAULT 0,
  unlock_copy_cooldown INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING',
  granted_at TEXT,
  reversed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_referral_reward_grants_referrer ON ReferralRewardGrants(referrer_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_reward_grants_referred ON ReferralRewardGrants(referred_user_id, created_at DESC);

INSERT OR REPLACE INTO ReferralRewardRules (
  package_type, package_name, buyer_bonus_tokens, referrer_bonus_tokens, unlock_copy_cooldown, status, updated_at
) VALUES
  ('starter_15_quota_7d_vip', 'Starter / 探索版', 3, 5, 0, 'ACTIVE', CURRENT_TIMESTAMP),
  ('standard_80_quota_30d_vip', 'Advanced / 专业版', 12, 18, 1, 'ACTIVE', CURRENT_TIMESTAMP),
  ('enterprise_400_quota_90d_vip', 'Ultra / 尊享版', 25, 35, 1, 'ACTIVE', CURRENT_TIMESTAMP);
