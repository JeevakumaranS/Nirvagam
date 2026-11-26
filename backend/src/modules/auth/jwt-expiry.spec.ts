import { jwtExpirySecondsFromConfig } from './jwt-expiry';

describe('jwt expiry configuration', () => {
  it.each([
    ['168', 168 * 60 * 60],
    ['15m', 15 * 60],
    ['7d', 7 * 24 * 60 * 60],
    ['30s', 30],
  ])('converts %s to seconds for JWT signing', (value, seconds) => {
    expect(jwtExpirySecondsFromConfig(value)).toBe(seconds);
  });

  it.each([undefined, '', '0', '-1', '1.5', '7x', '9007199254740991d'])(
    'rejects invalid expiry values: %s',
    (value) => {
      expect(() => jwtExpirySecondsFromConfig(value)).toThrow(
        'JWT_EXPIRES_IN must be a positive whole number of hours or a duration such as 15m or 7d'
      );
    }
  );
});
