import { jwtExpirySecondsFromHours } from './jwt-expiry';

describe('jwt expiry configuration', () => {
  it('converts configured hours to the seconds expected by JWT signing', () => {
    expect(jwtExpirySecondsFromHours('168')).toBe(168 * 60 * 60);
  });

  it.each([undefined, '', '0', '-1', '7d', '1.5'])(
    'rejects invalid hour values: %s',
    (value) => {
      expect(() => jwtExpirySecondsFromHours(value)).toThrow(
        'JWT_EXPIRES_IN must be configured as a positive whole number of hours'
      );
    }
  );
});
