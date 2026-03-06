export const NEW_USER_WELCOME_IMAGE_QUOTA = 3;
export const NEW_USER_WELCOME_VIP_DAYS = 3;

export function generateRandomCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let result = '';
  for (let i = 0; i < bytes.length; i += 1) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

export function getWelcomeVipExpireDateISO(baseDate = new Date()): string {
  const expireDate = new Date(baseDate.getTime() + NEW_USER_WELCOME_VIP_DAYS * 24 * 60 * 60 * 1000);
  return expireDate.toISOString();
}
