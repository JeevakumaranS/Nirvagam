export function jwtExpirySecondsFromConfig(value: string | undefined): number {
  const normalizedValue = value?.trim();
  const match = normalizedValue?.match(/^(\d+)([smhd])?$/i);
  const amount = match ? Number(match[1]) : NaN;
  const unit = match?.[2]?.toLowerCase();
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 60 * 60, d: 24 * 60 * 60 };
  const multiplier = unit ? multipliers[unit] : 60 * 60;

  if (!Number.isSafeInteger(amount) || amount <= 0 || multiplier === undefined) {
    throw new Error(
      'JWT_EXPIRES_IN must be a positive whole number of hours or a duration such as 15m or 7d'
    );
  }

  const seconds = amount * multiplier;
  if (!Number.isSafeInteger(seconds)) {
    throw new Error(
      'JWT_EXPIRES_IN must be a positive whole number of hours or a duration such as 15m or 7d'
    );
  }

  return seconds;
}
