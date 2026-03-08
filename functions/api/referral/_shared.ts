import { generateRandomCode } from '../../../utils/user';

interface Env {
  DB: any;
}

export interface ReferralRewardRule {
  package_type: string;
  package_name: string;
  buyer_bonus_tokens: number;
  referrer_bonus_tokens: number;
  unlock_copy_cooldown: number;
  status: string;
}

const DEFAULT_REFERRAL_REWARD_RULES: ReferralRewardRule[] = [
  {
    package_type: 'starter_15_quota_7d_vip',
    package_name: 'Starter / 探索版',
    buyer_bonus_tokens: 3,
    referrer_bonus_tokens: 5,
    unlock_copy_cooldown: 0,
    status: 'ACTIVE',
  },
  {
    package_type: 'standard_80_quota_30d_vip',
    package_name: 'Advanced / 专业版',
    buyer_bonus_tokens: 12,
    referrer_bonus_tokens: 18,
    unlock_copy_cooldown: 1,
    status: 'ACTIVE',
  },
  {
    package_type: 'enterprise_400_quota_90d_vip',
    package_name: 'Ultra / 尊享版',
    buyer_bonus_tokens: 25,
    referrer_bonus_tokens: 35,
    unlock_copy_cooldown: 1,
    status: 'ACTIVE',
  },
];

export function normalizeInviteCode(value: string | null): string | null {
  if (!value) return null;
  const clean = value.trim().toUpperCase();
  return clean || null;
}

export function normalizePackageType(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

export async function tableExists(env: Env, tableName: string): Promise<boolean> {
  const row = await env.DB
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?1")
    .bind(tableName)
    .first();
  return Boolean(row?.name);
}

export async function getUsersColumns(env: Env): Promise<Set<string>> {
  const names = new Set<string>();
  const tableInfo = await env.DB.prepare('PRAGMA table_info(Users)').all();
  const rows = Array.isArray(tableInfo?.results) ? tableInfo.results : [];
  for (const row of rows) {
    const name = typeof row?.name === 'string' ? row.name.trim() : '';
    if (name) names.add(name);
  }
  return names;
}

export async function createUniqueInviteCode(env: Env, length = 6): Promise<string> {
  for (let i = 0; i < 80; i += 1) {
    const code = generateRandomCode(length);
    const exists = await env.DB
      .prepare('SELECT user_id FROM Users WHERE invite_code = ?1')
      .bind(code)
      .first();
    if (!exists) return code;
  }
  throw new Error('邀请码生成失败，请重试');
}

export async function resolveInviterByCode(env: Env, inviteCode: string | null, referredUserId: string): Promise<{ user_id: string; invite_code: string } | null> {
  const normalizedCode = normalizeInviteCode(inviteCode);
  if (!normalizedCode) return null;
  const inviter = (await env.DB
    .prepare('SELECT user_id, invite_code FROM Users WHERE invite_code = ?1')
    .bind(normalizedCode)
    .first()) as { user_id: string; invite_code: string } | null;
  if (!inviter?.user_id) return null;
  if (inviter.user_id === referredUserId) return null;
  return inviter;
}

export async function ensureReferralBinding(
  env: Env,
  binding: {
    inviteCode: string;
    referrerUserId: string;
    referredUserId: string;
    bindSource?: string;
  },
): Promise<void> {
  if (!(await tableExists(env, 'ReferralBindings'))) return;

  const existing = await env.DB
    .prepare('SELECT id FROM ReferralBindings WHERE referred_user_id = ?1')
    .bind(binding.referredUserId)
    .first();
  if (existing?.id) return;

  await env.DB
    .prepare(
      `INSERT INTO ReferralBindings (
        id, invite_code, referrer_user_id, referred_user_id, bind_source, status, bound_at, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, 'BOUND', datetime('now'), datetime('now'), datetime('now'))`
    )
    .bind(
      crypto.randomUUID(),
      binding.inviteCode,
      binding.referrerUserId,
      binding.referredUserId,
      binding.bindSource || 'landing',
    )
    .run();
}

export async function countPaidOrders(env: Env, userId: string, excludeOutTradeNo?: string): Promise<number> {
  const row = (await env.DB
    .prepare(
      `SELECT COUNT(1) AS total
       FROM Orders
       WHERE user_id = ?1
         AND status IN ('SUCCESS', 'PAID', 'COMPLETED')
         ${excludeOutTradeNo ? 'AND out_trade_no != ?2' : ''}`
    )
    .bind(...(excludeOutTradeNo ? [userId, excludeOutTradeNo] : [userId]))
    .first()) as { total?: number | null } | null;
  return Number(row?.total || 0);
}

export async function getReferralRewardRules(env: Env): Promise<ReferralRewardRule[]> {
  if (!(await tableExists(env, 'ReferralRewardRules'))) {
    return DEFAULT_REFERRAL_REWARD_RULES;
  }

  const result = await env.DB
    .prepare(
      `SELECT package_type, package_name, buyer_bonus_tokens, referrer_bonus_tokens, unlock_copy_cooldown, status
       FROM ReferralRewardRules
       WHERE status = 'ACTIVE'
       ORDER BY rowid ASC`
    )
    .all();
  const rows = Array.isArray(result?.results) ? result.results : [];
  if (!rows.length) return DEFAULT_REFERRAL_REWARD_RULES;

  return rows.map((row: any) => ({
    package_type: String(row.package_type || ''),
    package_name: String(row.package_name || ''),
    buyer_bonus_tokens: Number(row.buyer_bonus_tokens || 0),
    referrer_bonus_tokens: Number(row.referrer_bonus_tokens || 0),
    unlock_copy_cooldown: Number(row.unlock_copy_cooldown || 0),
    status: String(row.status || 'ACTIVE'),
  }));
}

export async function getReferralRewardRule(env: Env, packageType: string): Promise<ReferralRewardRule | null> {
  const normalized = normalizePackageType(packageType);
  const rules = await getReferralRewardRules(env);
  const exact = rules.find((rule) => normalizePackageType(rule.package_type) === normalized);
  if (exact) return exact;
  if (normalized.includes('starter') || normalized.includes('15_quota') || normalized.includes('9.9')) {
    return rules.find((rule) => normalizePackageType(rule.package_type).includes('starter')) || null;
  }
  if (normalized.includes('standard') || normalized.includes('80_quota') || normalized.includes('99')) {
    return rules.find((rule) => normalizePackageType(rule.package_type).includes('standard')) || null;
  }
  if (normalized.includes('enterprise') || normalized.includes('400_quota') || normalized.includes('199')) {
    return rules.find((rule) => normalizePackageType(rule.package_type).includes('enterprise')) || null;
  }
  return null;
}

async function creditUserTokens(env: Env, userId: string, tokenAmount: number): Promise<void> {
  if (!tokenAmount || tokenAmount <= 0) return;

  const userColumns = await getUsersColumns(env);
  const hasCredits = userColumns.has('credits');
  const hasImageQuota = userColumns.has('image_quota');

  const insertColumns = ['user_id'];
  const insertValues: Array<string | number> = [userId];
  const updateFragments: string[] = [];

  if (hasCredits) {
    insertColumns.push('credits');
    insertValues.push(tokenAmount);
    updateFragments.push(`credits = COALESCE(Users.credits, 0) + ${tokenAmount}`);
  }

  if (hasImageQuota) {
    insertColumns.push('image_quota');
    insertValues.push(tokenAmount);
    updateFragments.push(`image_quota = COALESCE(Users.image_quota, 0) + ${tokenAmount}`);
  }

  if (insertColumns.length === 1) {
    await env.DB
      .prepare('INSERT OR IGNORE INTO Users (user_id) VALUES (?1)')
      .bind(userId)
      .run();
    return;
  }

  await env.DB
    .prepare(
      `INSERT INTO Users (${insertColumns.join(', ')})
       VALUES (${insertColumns.map((_, index) => `?${index + 1}`).join(', ')})
       ON CONFLICT(user_id) DO UPDATE SET ${updateFragments.join(', ')}`
    )
    .bind(...insertValues)
    .run();
}

async function getBindingForUser(env: Env, referredUserId: string): Promise<{ referrer_user_id: string; invite_code?: string | null } | null> {
  if (await tableExists(env, 'ReferralBindings')) {
    const binding = (await env.DB
      .prepare('SELECT referrer_user_id, invite_code FROM ReferralBindings WHERE referred_user_id = ?1 LIMIT 1')
      .bind(referredUserId)
      .first()) as { referrer_user_id?: string | null; invite_code?: string | null } | null;
    if (binding?.referrer_user_id) {
      return {
        referrer_user_id: String(binding.referrer_user_id),
        invite_code: binding.invite_code ? String(binding.invite_code) : null,
      };
    }
  }

  const userColumns = await getUsersColumns(env);
  if (!userColumns.has('invited_by')) return null;
  const user = (await env.DB
    .prepare('SELECT invited_by FROM Users WHERE user_id = ?1')
    .bind(referredUserId)
    .first()) as { invited_by?: string | null } | null;
  if (!user?.invited_by) return null;
  return { referrer_user_id: String(user.invited_by) };
}

export async function grantReferralRewardsForFirstPaidOrder(
  env: Env,
  input: {
    paidOrderId: string;
    referredUserId: string;
    packageType: string;
  },
): Promise<{
  granted: boolean;
  buyerBonusTokens: number;
  referrerBonusTokens: number;
  referrerUserId: string | null;
  unlockCopyCooldown: boolean;
}> {
  const binding = await getBindingForUser(env, input.referredUserId);
  if (!binding?.referrer_user_id || binding.referrer_user_id === input.referredUserId) {
    return { granted: false, buyerBonusTokens: 0, referrerBonusTokens: 0, referrerUserId: null, unlockCopyCooldown: false };
  }

  const priorPaidCount = await countPaidOrders(env, input.referredUserId, input.paidOrderId);
  if (priorPaidCount > 0) {
    return { granted: false, buyerBonusTokens: 0, referrerBonusTokens: 0, referrerUserId: binding.referrer_user_id, unlockCopyCooldown: false };
  }

  const rule = await getReferralRewardRule(env, input.packageType);
  if (!rule || String(rule.status || '').toUpperCase() !== 'ACTIVE') {
    return { granted: false, buyerBonusTokens: 0, referrerBonusTokens: 0, referrerUserId: binding.referrer_user_id, unlockCopyCooldown: false };
  }

  if (!(await tableExists(env, 'ReferralRewardGrants'))) {
    return { granted: false, buyerBonusTokens: 0, referrerBonusTokens: 0, referrerUserId: binding.referrer_user_id, unlockCopyCooldown: false };
  }

  const grantId = crypto.randomUUID();
  try {
    await env.DB
      .prepare(
        `INSERT INTO ReferralRewardGrants (
          id, paid_order_id, referrer_user_id, referred_user_id, package_type,
          buyer_bonus_tokens, referrer_bonus_tokens, unlock_copy_cooldown, status, created_at, granted_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'PENDING', datetime('now'), NULL)`
      )
      .bind(
        grantId,
        input.paidOrderId,
        binding.referrer_user_id,
        input.referredUserId,
        rule.package_type,
        rule.buyer_bonus_tokens,
        rule.referrer_bonus_tokens,
        rule.unlock_copy_cooldown,
      )
      .run();
  } catch (error: any) {
    if (String(error?.message || '').toLowerCase().includes('unique')) {
      return {
        granted: false,
        buyerBonusTokens: 0,
        referrerBonusTokens: 0,
        referrerUserId: binding.referrer_user_id,
        unlockCopyCooldown: false,
      };
    }
    throw error;
  }

  await creditUserTokens(env, input.referredUserId, rule.buyer_bonus_tokens);
  await creditUserTokens(env, binding.referrer_user_id, rule.referrer_bonus_tokens);

  await env.DB
    .prepare("UPDATE ReferralRewardGrants SET status = 'RELEASED', granted_at = datetime('now') WHERE id = ?1")
    .bind(grantId)
    .run();

  return {
    granted: true,
    buyerBonusTokens: rule.buyer_bonus_tokens,
    referrerBonusTokens: rule.referrer_bonus_tokens,
    referrerUserId: binding.referrer_user_id,
    unlockCopyCooldown: Number(rule.unlock_copy_cooldown || 0) > 0,
  };
}
