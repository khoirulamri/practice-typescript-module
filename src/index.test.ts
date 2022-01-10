import ExpressCache from './index';

jest.mock('redis', () => jest.requireActual('redis-mock'));

import redis from 'redis';

describe('class construction options', () => {
  test('can instantiate class with required options', async () => {
    const client = await redis.createClient();
    console.log('save',await client.set('product-','test redis'));
console.log(await client.keys('product*'));
    const expressCache = new ExpressCache({
      redisClient: client
    });

    expect(expressCache).toEqual(expect.any(ExpressCache));
  });
});

// describe('error handler', () => {

//   test('should throw error on read cache from redis', async () => {
//     redis.
//     const client = await redis.createClient();
    

//     const expressCache = new ExpressCache({
//       redisClient: client
//     });

//     await client.disconnect();
//   })
// });