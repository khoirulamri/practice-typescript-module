jest.mock('redis', () => jest.requireActual('redis-mock'));

import { createClient } from 'redis';

import { REDIS_PACKAGE } from './constans';
import { ExpressCache } from './express-cache';

describe('class construction options', () => {
  test('can instantiate class with required options', async () => {
    const client = await createClient();

    const expressCache = new ExpressCache({
      redis: {
        package: REDIS_PACKAGE.REDIS,
        client,
      },
    });

    expect(expressCache).toEqual(expect.any(ExpressCache));
  });

  test('should throw redis options is required', async () => {
    const init = () =>
      new ExpressCache({
        redis: null as any,
      });

    expect(init).toThrow('redis options is required');
  });

  test('should throw redis package is required', async () => {
    const init = () =>
      new ExpressCache({
        redis: {
          package: null as any,
          client: null as any,
        },
      });

    expect(init).toThrow('redis package is required');
  });

  test('should throw redis client is required', async () => {
    const init = () =>
      new ExpressCache({
        redis: {
          package: REDIS_PACKAGE.REDIS,
          client: null as any,
        },
      });

    expect(init).toThrow('redis client is required');
  });
});
