import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getWelcomeVipExpireDateISO, NEW_USER_WELCOME_IMAGE_QUOTA } from '../../utils/user';
import { ensureAdminDailyQuota, extractPhoneFromClaims, normalizePhone } from './_adminQuota';
import {
  countPaidOrders,
  createUniqueInviteCode,
  ensureReferralBinding,
  getUsersColumns,
  normalizeInviteCode,
  resolveInviterByCode,
} from './referral/_shared';

interface Env {
  DB: any;
  AUTHING_DOMAIN?: string;
}

interface UserRow {
  user_id: string;
  credits?: number | null;
  invite_code?: string | null;
  image_quota?: number | null;
  vip_expire_date?: string | null;
  invited_by?: string | null;
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

function buildUserSelectColumns(usersColumns: Set<string>): string[] {
  const columns = ['user_id', 'credits'];
  if (usersColumns.has('invite_code')) columns.push('invite_code');
  if (usersColumns.has('image_quota')) columns.push('image_quota');
  if (usersColumns.has('vip_expire_date')) columns.push('vip_expire_date');
  if (usersColumns.has('invited_by')) columns.push('invited_by');
  return columns;
}

async function fetchUserById(env: Env, userId: string, selectColumns: string[]): Promise<UserRow | null> {
  const userSql = `SELECT ${selectColumns.join(', ')} FROM Users WHERE user_id = ?1`;
  return (await env.DB.prepare(userSql).bind(userId).first()) as UserRow | null;
}

async function tryResolveVerifiedPhone(request: Request, env: Env): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const authingDomain = env.AUTHING_DOMAIN || 'YOUR_AUTHING_DOMAIN';
  if (!authingDomain || authingDomain.includes('YOUR_AUTHING_DOMAIN')) {
    return null;
  }

  try {
    const token = authHeader.split(' ')[1];
    const cleanDomain = authingDomain.replace(/^https?:\/\//, '');
    const JWKS = createRemoteJWKSet(new URL(`https://${cleanDomain}/oidc/.well-known/jwks.json`));
    const { payload } = await jwtVerify(token, JWKS);
    return extractPhoneFromClaims(payload as Record<string, unknown>);
  } catch (error: any) {
    console.warn('[/api/user] JWT verify failed, skip phone sync:', error?.message || error);
    return null;
  }
}

async function tryBindInviteForExistingUser(
  env: Env,
  options: {
    userId: string;
    inviteCode: string | null;
    currentInvitedBy: string | null;
    hasInviteCode: boolean;
    hasInvitedBy: boolean;
  },
): Promise<string | null> {
  if (!options.hasInviteCode || !options.hasInvitedBy) return options.currentInvitedBy;
  if (!options.inviteCode || options.currentInvitedBy) return options.currentInvitedBy;

  const paidCount = await countPaidOrders(env, options.userId);
  if (paidCount > 0) return options.currentInvitedBy;

  const inviter = await resolveInviterByCode(env, options.inviteCode, options.userId);
  if (!inviter?.user_id) return options.currentInvitedBy;

  await env.DB
    .prepare('UPDATE Users SET invited_by = ?1 WHERE user_id = ?2 AND (invited_by IS NULL OR invited_by = "")')
    .bind(inviter.user_id, options.userId)
    .run();

  await ensureReferralBinding(env, {
    inviteCode: inviter.invite_code,
    referrerUserId: inviter.user_id,
    referredUserId: options.userId,
    bindSource: 'landing',
  });

  return inviter.user_id;
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
    const providedPhone = normalizePhone(url.searchParams.get('phone'));
    const verifiedPhone = await tryResolveVerifiedPhone(request, env);
    const adminPhone = verifiedPhone || providedPhone;

    if (!userId) {
      return json(
        {
          success: false,
          error: 'MISSING_USER_ID',
          message: '缺少 userId 参数',
        },
        400,
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
      const inviter = hasInviteCode ? await resolveInviterByCode(env, inviteCode, userId) : null;
      const invitedBy = inviter?.user_id || null;

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

      if (inviter?.user_id && inviter.invite_code) {
        await ensureReferralBinding(env, {
          inviteCode: inviter.invite_code,
          referrerUserId: inviter.user_id,
          referredUserId: userId,
          bindSource: 'landing',
        });
      }

      if (!user) {
        if (adminPhone) {
          await ensureAdminDailyQuota(env, { userId, phone: adminPhone });
        }
        const freshUser = await fetchUserById(env, userId, selectColumns);
        return json({
          success: true,
          credits: Number(freshUser?.credits ?? 10),
          invite_code: hasInviteCode ? (freshUser?.invite_code || newInviteCode) : null,
          image_quota: hasImageQuota ? Number(freshUser?.image_quota ?? NEW_USER_WELCOME_IMAGE_QUOTA) : null,
          vip_expire_date: hasVipExpireDate ? freshUser?.vip_expire_date || welcomeVipExpireDate : null,
          isNewUser: true,
        });
      }
    }

    let inviteCodeValue = hasInviteCode ? user.invite_code || null : null;
    let imageQuotaValue = hasImageQuota ? Number(user.image_quota) : null;
    let vipExpireDateValue = hasVipExpireDate ? user.vip_expire_date || null : null;
    let invitedByValue = hasInvitedBy ? user.invited_by || null : null;

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

    invitedByValue = await tryBindInviteForExistingUser(env, {
      userId,
      inviteCode,
      currentInvitedBy: invitedByValue,
      hasInviteCode,
      hasInvitedBy,
    });

    if (adminPhone) {
      const adminResult = await ensureAdminDailyQuota(env, { userId, phone: adminPhone });
      if (adminResult.isAdmin) {
        user = await fetchUserById(env, userId, selectColumns);
        inviteCodeValue = hasInviteCode ? user?.invite_code || inviteCodeValue : null;
        imageQuotaValue = hasImageQuota ? Number(user?.image_quota ?? imageQuotaValue) : null;
        vipExpireDateValue = hasVipExpireDate ? user?.vip_expire_date || vipExpireDateValue : null;
      }
    }

    const credits = Number(user?.credits ?? 10);
    return json({
      success: true,
      credits: Number.isFinite(credits) ? credits : 10,
      invite_code: hasInviteCode ? inviteCodeValue : null,
      image_quota: hasImageQuota ? Number(imageQuotaValue ?? NEW_USER_WELCOME_IMAGE_QUOTA) : null,
      vip_expire_date: hasVipExpireDate ? vipExpireDateValue || null : null,
      invited_by: hasInvitedBy ? invitedByValue : null,
    });
  } catch (error: any) {
    console.error('[/api/user] unexpected error:', error);
    return json(
      {
        success: false,
        error: 'SERVER_ERROR',
        message: error?.message || '服务端异常',
      },
      500,
    );
  }
}
