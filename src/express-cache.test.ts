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
});
