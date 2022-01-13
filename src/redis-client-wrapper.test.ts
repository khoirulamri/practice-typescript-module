jest.mock('redis', () => jest.requireActual('redis-mock'));
jest.mock('ioredis', () => require('ioredis-mock/jest'));

import IORedis from 'ioredis';
import redis from 'redis';

import { REDIS_PACKAGE } from './constans';
import { IORedisWrapper, RedisClientWrapper, RedisWrapper } from './redis-client-wrapper';

describe('wrapper redis package', () => {
  const messageError = 'redis-error-message';
  let redisClient: redis.RedisClient;
  beforeAll(async () => {
    redisClient = await redis.createClient();
  });

  test('should return wrapper instance of RedisWrapper', async () => {
    const wrapper = new RedisClientWrapper(REDIS_PACKAGE.REDIS, redisClient).getWrapper();
    expect(wrapper).toBeInstanceOf(RedisWrapper);
  });

  describe('basic method', () => {
    test('should be able to call redis set method with success', async () => {
      const key = 'foo';
      const value = 'bar';
      const mode = 'EX';
      const expire = 100;

      redisClient.set = jest.fn().mockImplementationOnce((...args) => args[4](null));

      const wrapper = new RedisClientWrapper(REDIS_PACKAGE.REDIS, redisClient).getWrapper();
      await wrapper.set(key, value, { [mode]: 100 });
      expect(redisClient.set).toBeCalledTimes(1);
      expect(redisClient.set).toBeCalledWith(key, value, mode, expire, expect.any(Function));
    });

    test('should be able to call redis set method with error', async () => {
      const key = 'foo';
      const value = 'bar';
      const mode = 'EX';
      const expire = 100;

      redisClient.set = jest.fn().mockImplementationOnce((...args) => args[4](new Error(messageError)));

      const wrapper = new RedisClientWrapper(REDIS_PACKAGE.REDIS, redisClient).getWrapper();
      expect(async () => await wrapper.set(key, value, { [mode]: expire })).rejects.toThrow(messageError);

      expect(redisClient.set).toBeCalledTimes(1);
      expect(redisClient.set).toBeCalledWith(key, value, mode, expire, expect.any(Function));
    });

    test('should be able to call redis get method with success', async () => {
      const key = 'foo';
      const value = 'bar';

      redisClient.get = jest.fn().mockImplementationOnce((_, callback) => callback(null, value));

      const wrapper = new RedisClientWrapper(REDIS_PACKAGE.REDIS, redisClient).getWrapper();
      const result = await wrapper.get(key);
      expect(result).toEqual(value);
      expect(redisClient.get).toBeCalledTimes(1);
      expect(redisClient.get).toBeCalledWith(key, expect.any(Function));
    });

    test('should be able to call redis get method with error', async () => {
      const key = 'foo';

      redisClient.get = jest.fn().mockImplementationOnce((_, callback) => callback(new Error(messageError)));

      const wrapper = new RedisClientWrapper(REDIS_PACKAGE.REDIS, redisClient).getWrapper();
      expect(async () => await wrapper.get(key)).rejects.toThrow(messageError);
      expect(redisClient.get).toBeCalledTimes(1);
      expect(redisClient.get).toBeCalledWith(key, expect.any(Function));
    });

    test('should be able to call redis del method with success', async () => {
      const key1 = 'foo';
      const key2 = 'bar';

      redisClient.del = jest.fn().mockImplementationOnce((keys, callback) => {
        expect(keys).toHaveLength(2);
        callback(null, 2);
      });

      const wrapper = new RedisClientWrapper(REDIS_PACKAGE.REDIS, redisClient).getWrapper();
      const result = await wrapper.del(key1, key2);
      expect(result).toEqual(2);
      expect(redisClient.del).toBeCalledTimes(1);
      expect(redisClient.del).toBeCalledWith(expect.arrayContaining([key1, key2]), expect.any(Function));
    });

    test('should be able to call redis del method with error', async () => {
      const key1 = 'foo';
      const key2 = 'bar';

      redisClient.del = jest.fn().mockImplementationOnce((keys, callback) => {
        expect(keys).toHaveLength(2);
        callback(new Error(messageError));
      });

      const wrapper = new RedisClientWrapper(REDIS_PACKAGE.REDIS, redisClient).getWrapper();
      expect(async () => await wrapper.del(key1, key2)).rejects.toThrow(messageError);
      expect(redisClient.del).toBeCalledTimes(1);
      expect(redisClient.del).toBeCalledWith(expect.arrayContaining([key1, key2]), expect.any(Function));
    });

    test('should be able to call redis keys method with success', async () => {
      const pattern = 'foo*';
      const foundKey = ['foobar', 'foobir', 'foobur', 'foober', 'foobor'];

      redisClient.keys = jest.fn().mockImplementationOnce((key, callback) => {
        expect(key).toEqual(pattern);
        callback(null, foundKey);
      });

      const wrapper = new RedisClientWrapper(REDIS_PACKAGE.REDIS, redisClient).getWrapper();
      const keys = await wrapper.keys(pattern);
      expect(keys).toEqual(expect.arrayContaining(foundKey));
      expect(redisClient.keys).toBeCalledTimes(1);
      expect(redisClient.keys).toBeCalledWith(pattern, expect.any(Function));
    });

    test('should be able to call redis keys method with error', async () => {
      const pattern = 'foo*';

      redisClient.keys = jest.fn().mockImplementationOnce((key, callback) => {
        expect(key).toEqual(pattern);
        callback(new Error(messageError));
      });

      const wrapper = new RedisClientWrapper(REDIS_PACKAGE.REDIS, redisClient).getWrapper();
      expect(async () => await wrapper.keys(pattern)).rejects.toThrow(messageError);
      expect(redisClient.keys).toBeCalledTimes(1);
      expect(redisClient.keys).toBeCalledWith(pattern, expect.any(Function));
    });
  });
});

describe('wrapper ioredis package', () => {
  let ioRedisClient: IORedis.Redis;

  beforeAll(() => {
    ioRedisClient = new IORedis();
  });

  test('should return wrapper instance of IORedisWrapper', () => {
    const wrapper = new RedisClientWrapper(REDIS_PACKAGE.IOREDIS, ioRedisClient).getWrapper();
    expect(wrapper).toBeInstanceOf(IORedisWrapper);
  });

  describe('basic method', () => {
    test('should be able to call ioredis set method', async () => {
      const key = 'foo';
      const value = 'bar';
      const mode = 'EX';
      const expire = 100;

      ioRedisClient.set = jest.fn().mockReturnValueOnce(true);

      const wrapper = new RedisClientWrapper(REDIS_PACKAGE.IOREDIS, ioRedisClient).getWrapper();
      await wrapper.set(key, value, { [mode]: 100 });
      expect(ioRedisClient.set).toBeCalledTimes(1);
      expect(ioRedisClient.set).toBeCalledWith(key, value, mode, expire);
    });

    test('should be able to call ioredis get method', async () => {
      const key = 'foo';
      const value = 'bar';

      ioRedisClient.get = jest.fn().mockReturnValueOnce(value);

      const wrapper = new RedisClientWrapper(REDIS_PACKAGE.IOREDIS, ioRedisClient).getWrapper();
      const result = await wrapper.get(key);
      expect(result).toEqual(value);
      expect(ioRedisClient.get).toBeCalledTimes(1);
      expect(ioRedisClient.get).toBeCalledWith(key);
    });

    test('should be able to call ioredis del method', async () => {
      const key1 = 'foo';
      const key2 = 'bar';

      ioRedisClient.del = jest.fn().mockReturnValueOnce(2);

      const wrapper = new RedisClientWrapper(REDIS_PACKAGE.IOREDIS, ioRedisClient).getWrapper();
      const result = await wrapper.del(key1, key2);
      expect(result).toEqual(2);
      expect(ioRedisClient.del).toBeCalledTimes(1);
      expect(ioRedisClient.del).toBeCalledWith(key1, key2);
    });

    test('should be able to call ioredis keys method', async () => {
      const pattern = 'foo*';
      const foundKey = ['foobar', 'foobir', 'foobur', 'foober', 'foobor'];

      ioRedisClient.keys = jest.fn().mockReturnValueOnce(foundKey);

      const wrapper = new RedisClientWrapper(REDIS_PACKAGE.IOREDIS, ioRedisClient).getWrapper();
      const keys = await wrapper.keys(pattern);
      expect(keys).toEqual(expect.arrayContaining(foundKey));
      expect(ioRedisClient.keys).toBeCalledTimes(1);
      expect(ioRedisClient.keys).toBeCalledWith(pattern);
    });
  });
});

test('should throw empty client', () => {
  expect(() => new RedisClientWrapper(REDIS_PACKAGE.IOREDIS, null).getWrapper()).toThrow('redis client is required');
});

test('should throw unsupport package redis', () => {
  const client = new Object();
  expect(() => new RedisClientWrapper('other-package' as any, client).getWrapper()).toThrow(
    'redis client only support from packages: redis, ioredis',
  );
});
