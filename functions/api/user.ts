import { generateRandomCode, getWelcomeVipExpireDateISO, NEW_USER_WELCOME_IMAGE_QUOTA } from '../../utils/user';

interface Env {
  DB: any;
}

interface UserRow {
  user_id: string;
  credits?: number | null;
  invite_code?: string | null;
  image_quota?: number | null;
  vip_expire_date?: string | null;
}

const CORS_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
  });
}

function normalizeInviteCode(value: string | null): string | null {
  if (!value) return null;
  const clean = value.trim().toUpperCase();
  return clean || null;
}

async function getUsersColumns(env: Env): Promise<Set<string>> {
  const names = new Set<string>();
  const tableInfo = await env.DB.prepare('PRAGMA table_info(Users)').all();
  const rows = Array.isArray(tableInfo?.results) ? tableInfo.results : [];
  for (const row of rows) {
    const name = typeof row?.name === 'string' ? row.name.trim() : '';
    if (name) names.add(name);
  }
  return names;
}

async function createUniqueInviteCode(env: Env, length = 6): Promise<string> {
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

function buildUserSelectColumns(usersColumns: Set<string>): string[] {
  const columns = ['user_id', 'credits'];
  if (usersColumns.has('invite_code')) columns.push('invite_code');
  if (usersColumns.has('image_quota')) columns.push('image_quota');
  if (usersColumns.has('vip_expire_date')) columns.push('vip_expire_date');
  return columns;
}

async function fetchUserById(env: Env, userId: string, selectColumns: string[]): Promise<UserRow | null> {
  const userSql = `SELECT ${selectColumns.join(', ')} FROM Users WHERE user_id = ?1`;
  return (await env.DB
    .prepare(userSql)
    .bind(userId)
    .first()) as UserRow | null;
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId')?.trim();
    const inviteCode = normalizeInviteCode(url.searchParams.get('inviteCode'));

    if (!userId) {
      return json(
        {
          success: false,
          error: 'MISSING_USER_ID',
          message: '缺少 userId 参数',
        },
        400
      );
    }

    const usersColumns = await getUsersColumns(env);
    const hasInviteCode = usersColumns.has('invite_code');
    const hasInvitedBy = usersColumns.has('invited_by');
    const hasImageQuota = usersColumns.has('image_quota');
    const hasVipExpireDate = usersColumns.has('vip_expire_date');

    const selectColumns = buildUserSelectColumns(usersColumns);
    let user = await fetchUserById(env, userId, selectColumns);

    if (!user) {
      const newInviteCode = hasInviteCode ? await createUniqueInviteCode(env, 6) : null;
      const welcomeVipExpireDate = getWelcomeVipExpireDateISO();
      let invitedBy: string | null = null;

      if (hasInviteCode && inviteCode) {
        const inviter = (await env.DB
          .prepare('SELECT user_id FROM Users WHERE invite_code = ?1')
          .bind(inviteCode)
          .first()) as { user_id: string } | null;
        if (inviter?.user_id) {
          invitedBy = inviter.user_id;
        }
      }

      const insertColumns: string[] = ['user_id', 'credits'];
      const insertValues: Array<string | number | null> = [userId, 10];

      if (hasInviteCode) {
        insertColumns.push('invite_code');
        insertValues.push(newInviteCode);
      }
      if (hasInvitedBy) {
        insertColumns.push('invited_by');
        insertValues.push(invitedBy);
      }
      if (hasImageQuota) {
        insertColumns.push('image_quota');
        insertValues.push(NEW_USER_WELCOME_IMAGE_QUOTA);
      }
      if (hasVipExpireDate) {
        insertColumns.push('vip_expire_date');
        insertValues.push(welcomeVipExpireDate);
      }

      const placeholders = insertColumns.map((_, idx) => `?${idx + 1}`).join(', ');

      try {
        await env.DB
          .prepare(`INSERT INTO Users (${insertColumns.join(', ')}) VALUES (${placeholders})`)
          .bind(...insertValues)
          .run();
      } catch (insertErr: any) {
        if (!String(insertErr?.message || '').toLowerCase().includes('unique')) {
          throw insertErr;
        }
        user = await fetchUserById(env, userId, selectColumns);
        if (!user) throw insertErr;
      }

      if (hasInviteCode && invitedBy) {
        await env.DB
          .prepare('UPDATE Users SET credits = credits + 10 WHERE user_id = ?1')
          .bind(invitedBy)
          .run();
      }

      if (!user) {
        return json({
          success: true,
          credits: 10,
          invite_code: newInviteCode,
          image_quota: hasImageQuota ? NEW_USER_WELCOME_IMAGE_QUOTA : null,
          vip_expire_date: hasVipExpireDate ? welcomeVipExpireDate : null,
          isNewUser: true,
        });
      }
    }

    // 兼容历史脏数据：如果用户是旧逻辑插入且缺少新字段，补发新人资产。
    let inviteCodeValue = hasInviteCode ? (user.invite_code || null) : null;
    let imageQuotaValue = hasImageQuota ? Number(user.image_quota) : null;
    let vipExpireDateValue = hasVipExpireDate ? (user.vip_expire_date || null) : null;

    const updateFragments: string[] = [];
    const updateValues: Array<string | number> = [];

    if (hasInviteCode && !inviteCodeValue) {
      inviteCodeValue = await createUniqueInviteCode(env, 6);
      updateFragments.push(`invite_code = ?${updateValues.length + 1}`);
      updateValues.push(inviteCodeValue);
    }

    if (hasImageQuota && !Number.isFinite(Number(imageQuotaValue))) {
      imageQuotaValue = NEW_USER_WELCOME_IMAGE_QUOTA;
      updateFragments.push(`image_quota = ?${updateValues.length + 1}`);
      updateValues.push(imageQuotaValue);
    }

    if (hasVipExpireDate && !vipExpireDateValue) {
      vipExpireDateValue = getWelcomeVipExpireDateISO();
      updateFragments.push(`vip_expire_date = ?${updateValues.length + 1}`);
      updateValues.push(vipExpireDateValue);
    }

    if (updateFragments.length > 0) {
      updateValues.push(userId);
      await env.DB
        .prepare(`UPDATE Users SET ${updateFragments.join(', ')} WHERE user_id = ?${updateValues.length}`)
        .bind(...updateValues)
        .run();
    }

    const credits = Number(user.credits ?? 10);
    return json({
      success: true,
      credits: Number.isFinite(credits) ? credits : 10,
      invite_code: hasInviteCode ? inviteCodeValue : null,
      image_quota: hasImageQuota ? Number(imageQuotaValue ?? NEW_USER_WELCOME_IMAGE_QUOTA) : null,
      vip_expire_date: hasVipExpireDate ? (vipExpireDateValue || null) : null,
    });
  } catch (error: any) {
    console.error('[/api/user] unexpected error:', error);
    return json(
      {
        success: false,
        error: 'SERVER_ERROR',
        message: error?.message || '服务端异常',
      },
      500
    );
  }
}
