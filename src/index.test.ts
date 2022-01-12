jest.mock('redis', () => jest.requireActual('redis-mock'));

import redis from 'redis';

import ExpressCache from './index';

describe('class construction options', () => {
  test('can instantiate class with required options', async () => {
    const client = await redis.createClient();

    const expressCache = new ExpressCache({
      redis: {
        packageName: 'redis',
        client,
      },
    });

    expect(expressCache).toEqual(expect.any(ExpressCache));
  });
});
