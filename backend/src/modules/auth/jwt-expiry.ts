export function jwtExpirySecondsFromHours(hoursValue: string | undefined): number {
  const hours = Number(hoursValue);
  if (!hoursValue?.trim() || !Number.isSafeInteger(hours) || hours <= 0) {
    throw new Error('JWT_EXPIRES_IN must be configured as a positive whole number of hours');
  }
  return hours * 60 * 60;
}
