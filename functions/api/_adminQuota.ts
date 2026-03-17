interface AdminQuotaEnv {
  DB: any;
}

type AdminAccessResult = {
  isAdmin: boolean;
  phone: string | null;
  source: 'd1' | 'phone_whitelist' | null;
};

export const ADMIN_DAILY_TOKEN_QUOTA = 999;
export const ADMIN_VIP_EXPIRE_AT = '2099-12-31T23:59:59.000Z';

const ADMIN_PHONES = new Set([
  '13361139506',
  '18963270965',
  '13375642444',
]);

export function isAdminPhone(value: unknown): boolean {
  const normalized = normalizePhone(value);
  return Boolean(normalized && ADMIN_PHONES.has(normalized));
}

async function hasAdminAccountsTable(env: AdminQuotaEnv): Promise<boolean> {
  const row = (await env.DB
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'AdminAccounts'")
    .first()) as { name?: string | null } | null;
  return row?.name === 'AdminAccounts';
}

export async function resolveAdminAccess(
  env: AdminQuotaEnv,
  input: { userId?: string | null; phone?: string | null },
): Promise<AdminAccessResult> {
  const userId = String(input.userId || '').trim();
  const normalizedPhone = normalizePhone(input.phone);

  if (await hasAdminAccountsTable(env)) {
    const matchers: string[] = [];
    const values: string[] = [];

    if (userId) {
      matchers.push(`user_id = ?${values.length + 1}`);
      values.push(userId);
    }

    if (normalizedPhone) {
      matchers.push(`phone = ?${values.length + 1}`);
      values.push(normalizedPhone);
    }

    if (matchers.length > 0) {
      const row = (await env.DB
        .prepare(`
          SELECT user_id, phone
          FROM AdminAccounts
          WHERE status = 'ACTIVE'
            AND (${matchers.join(' OR ')})
          LIMIT 1
        `)
        .bind(...values)
        .first()) as { user_id?: string | null; phone?: string | null } | null;

      if (row) {
        return {
          isAdmin: true,
          phone: normalizePhone(row.phone) || normalizedPhone || null,
          source: 'd1',
        };
      }
    }
  }

  if (normalizedPhone && ADMIN_PHONES.has(normalizedPhone)) {
    return { isAdmin: true, phone: normalizedPhone, source: 'phone_whitelist' };
  }

  return { isAdmin: false, phone: null, source: null };
}

export function normalizePhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 11 && digits.startsWith('1')) return digits;
  if (digits.length === 13 && digits.startsWith('86')) return digits.slice(2);
  if (digits.length > 11) {
    const tail = digits.slice(-11);
    if (tail.startsWith('1')) return tail;
  }
  return null;
}

export function extractPhoneFromClaims(payload: Record<string, unknown> | null | undefined): string | null {
  if (!payload) return null;
  const candidates = [
    payload.phone_number,
    payload.phone,
    payload.mobile,
    payload.username,
    payload.preferred_username,
  ];
  for (const item of candidates) {
    const normalized = normalizePhone(typeof item === 'string' ? item : null);
    if (normalized) return normalized;
  }
  return null;
}

function getShanghaiDateKey(baseDate = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(baseDate);
}

async function ensureAdminQuotaTable(env: AdminQuotaEnv): Promise<void> {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS AdminQuotaState (
      user_id TEXT PRIMARY KEY,
      phone TEXT NOT NULL,
      quota_date TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_admin_quota_state_phone ON AdminQuotaState(phone)').run();
}

async function getUsersColumns(env: AdminQuotaEnv): Promise<Set<string>> {
  const result = await env.DB.prepare('PRAGMA table_info(Users)').all();
  const rows = Array.isArray(result?.results) ? result.results : [];
  return new Set(rows.map((row: any) => String(row?.name || '')).filter(Boolean));
}

async function upsertAdminQuotaState(env: AdminQuotaEnv, userId: string, phone: string, quotaDate: string): Promise<void> {
  await env.DB
    .prepare(`
      INSERT INTO AdminQuotaState (user_id, phone, quota_date, updated_at)
      VALUES (?1, ?2, ?3, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        phone = excluded.phone,
        quota_date = excluded.quota_date,
        updated_at = datetime('now')
    `)
    .bind(userId, phone, quotaDate)
    .run();
}

type AdminQuotaStateRow = {
  phone?: string | null;
  quota_date?: string | null;
};

export async function ensureAdminDailyQuota(
  env: AdminQuotaEnv,
  input: { userId: string; phone?: string | null },
): Promise<{ isAdmin: boolean; phone: string | null; refreshed: boolean }> {
  const userId = String(input.userId || '').trim();
  if (!userId) return { isAdmin: false, phone: null, refreshed: false };

  await ensureAdminQuotaTable(env);

  const currentState = (await env.DB
    .prepare('SELECT phone, quota_date FROM AdminQuotaState WHERE user_id = ?1 LIMIT 1')
    .bind(userId)
    .first()) as AdminQuotaStateRow | null;

  const resolvedAdmin = await resolveAdminAccess(env, {
    userId,
    phone: normalizePhone(input.phone) || normalizePhone(currentState?.phone || null),
  });
  const resolvedPhone = resolvedAdmin.phone;

  if (!resolvedAdmin.isAdmin || !resolvedPhone) {
    return { isAdmin: false, phone: null, refreshed: false };
  }

  const today = getShanghaiDateKey();
  const needsRefresh = currentState?.quota_date !== today || currentState?.phone !== resolvedPhone;
  if (!needsRefresh) {
    return { isAdmin: true, phone: resolvedPhone, refreshed: false };
  }

  const userColumns = await getUsersColumns(env);
  const hasImageQuota = userColumns.has('image_quota');
  const hasVipExpireDate = userColumns.has('vip_expire_date');

  await env.DB
    .prepare('INSERT OR IGNORE INTO Users (user_id, credits) VALUES (?1, ?2)')
    .bind(userId, ADMIN_DAILY_TOKEN_QUOTA)
    .run();

  const updateFragments = ['credits = ?2'];
  const updateValues: Array<string | number> = [userId, ADMIN_DAILY_TOKEN_QUOTA];

  if (hasImageQuota) {
    updateFragments.push(`image_quota = ?${updateValues.length + 1}`);
    updateValues.push(ADMIN_DAILY_TOKEN_QUOTA);
  }

  if (hasVipExpireDate) {
    updateFragments.push(`vip_expire_date = ?${updateValues.length + 1}`);
    updateValues.push(ADMIN_VIP_EXPIRE_AT);
  }

  await env.DB
    .prepare(`UPDATE Users SET ${updateFragments.join(', ')} WHERE user_id = ?1`)
    .bind(...updateValues)
    .run();

  await upsertAdminQuotaState(env, userId, resolvedPhone, today);
  return { isAdmin: true, phone: resolvedPhone, refreshed: true };
}
