jest.mock('redis', () => jest.requireActual('redis-mock'));

import { Request, Response } from 'express';
import { createClient, RedisClient } from 'redis';

import { REDIS_PACKAGE } from './constans';
import { ExpressCache } from './express-cache';

const MESSAGE_ERROR = {
  CLIENT_CLOSED: 'The client is closed',
};

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

describe('basic function', () => {
  let redisClient: RedisClient;

  beforeAll(async () => {
    redisClient = await createClient();
  });

  describe('middleware function', () => {
    describe('response from cache', () => {
      test('should return response from cache storage', async () => {
        const keyPrefix = 'express-cache:';
        const tagPrefix = 'product';
        const tag = 'abcd-1234-efgh';
        const expectedKey = keyPrefix + tagPrefix + tag;
        const cacheData = {
          httpStatusCode: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': '27',
          },
          body: {
            name: 'Foo',
            price: 100,
          },
        };

        const mockRequest = <Request>{
          query: {},
          header: jest.fn().mockImplementationOnce((...args) => {
            expect(args[0]).toEqual('if-none-match');
            return tag;
          }) as any,
        };

        const mockResponse = {} as Response;
        mockResponse.end = jest.fn().mockReturnValueOnce(true);
        mockResponse.set = jest.fn().mockReturnValueOnce(mockResponse);
        mockResponse.status = jest.fn().mockReturnValueOnce(mockResponse);

        const mockNext = jest.fn().mockReturnValueOnce(true);

        redisClient.get = jest.fn().mockImplementationOnce((key, callback) => {
          expect(key).toEqual(expectedKey);
          callback(null, JSON.stringify(cacheData));
        });

        const expressCache = new ExpressCache({
          keyPrefix,
          redis: {
            package: REDIS_PACKAGE.REDIS,
            client: redisClient,
          },
        });

        await expressCache.middleware({
          tagPrefix,
        })(mockRequest, mockResponse, mockNext);

        expect(redisClient.get).toBeCalledTimes(1);
        expect(redisClient.get).toBeCalledWith(expectedKey, expect.any(Function));
        expect(mockResponse.end).toBeCalledTimes(1);
        expect(mockResponse.end).toBeCalledWith(cacheData.body);
        expect(mockResponse.set).toBeCalledWith(cacheData.headers);
        expect(mockResponse.status).toBeCalledWith(cacheData.httpStatusCode);
        expect(mockNext).toBeCalledTimes(0);
      });

      test('should next when read empty cache', async () => {
        const keyPrefix = 'express-cache:';
        const tagPrefix = 'product';
        const tag = 'abcd-1234-efgh';
        const expectedKey = keyPrefix + tagPrefix + tag;

        const mockRequest = <Request>{
          query: {},
          header: jest.fn().mockImplementationOnce((...args) => {
            expect(args[0]).toEqual('if-none-match');
            return tag;
          }) as any,
        };

        const mockNext = jest.fn().mockReturnValueOnce(true);

        const mockResponse = {} as Response;

        redisClient.get = jest.fn().mockImplementationOnce((_, callback) => callback(null, ''));

        const expressCache = new ExpressCache({
          redis: {
            package: REDIS_PACKAGE.REDIS,
            client: redisClient,
          },
        });

        const middleware = expressCache.middleware({
          tagPrefix,
        });

        await middleware(mockRequest, mockResponse, mockNext);

        expect(redisClient.get).toBeCalledTimes(1);
        expect(redisClient.get).toBeCalledWith(expectedKey, expect.any(Function));
        expect(mockNext).toBeCalledTimes(1);
      });

      test('should throw when error read cache', async () => {
        const keyPrefix = 'express-cache:';
        const tagPrefix = 'product';
        const tag = 'abcd-1234-efgh';
        const expectedKey = keyPrefix + tagPrefix + tag;

        const mockRequest = <Request>{
          query: {},
          header: jest.fn().mockImplementationOnce((...args) => {
            expect(args[0]).toEqual('if-none-match');
            return tag;
          }) as any,
        };

        const mockNext = jest.fn().mockReturnValueOnce(true);

        const mockResponse = {} as Response;

        redisClient.get = jest
          .fn()
          .mockImplementationOnce((_, callback) => callback(new Error('The client is closed')));

        const expressCache = new ExpressCache({
          redis: {
            package: REDIS_PACKAGE.REDIS,
            client: redisClient,
          },
        });

        const middleware = expressCache.middleware({
          tagPrefix,
        });

        await expect(async () => await middleware(mockRequest, mockResponse, mockNext)).rejects.toThrow(
          MESSAGE_ERROR.CLIENT_CLOSED,
        );

        expect(redisClient.get).toBeCalledTimes(1);
        expect(redisClient.get).toBeCalledWith(expectedKey, expect.any(Function));
        expect(mockNext).toBeCalledTimes(0);
      });

      test('should call custom handle function when error read cache', async () => {
        const keyPrefix = 'express-cache:';
        const tagPrefix = 'product';
        const tag = 'abcd-1234-efgh';
        const expectedKey = keyPrefix + tagPrefix + tag;

        const mockRequest = <Request>{
          query: {},
          header: jest.fn().mockImplementationOnce((...args) => {
            expect(args[0]).toEqual('if-none-match');
            return tag;
          }) as any,
        };

        const mockNext = jest.fn().mockReturnValueOnce(true);
        const mockResponse = {} as Response;

        redisClient.get = jest
          .fn()
          .mockImplementationOnce((_, callback) => callback(new Error(MESSAGE_ERROR.CLIENT_CLOSED)));

        const logError = jest.fn();
        const readCacheErrHandler = (err: Error) => {
          logError(err);
        };

        const expressCache = new ExpressCache({
          redis: {
            package: REDIS_PACKAGE.REDIS,
            client: redisClient,
          },
          readCacheErrHandler,
        });

        const middleware = expressCache.middleware({
          tagPrefix,
        });

        await middleware(mockRequest, mockResponse, mockNext);
        expect(logError).toBeCalledTimes(1);
        expect(logError).toBeCalledWith(expect.any(Error));
        expect(redisClient.get).toBeCalledTimes(1);
        expect(redisClient.get).toBeCalledWith(expectedKey, expect.any(Function));
        expect(mockNext).toBeCalledTimes(0);
      });

      describe('read cache with different options', () => {
        test('should read cache with empty tag prefix', async () => {
          const keyPrefix = 'express-cache:';
          const tag = 'abcd-1234-efgh';
          const cacheData = {
            httpStatusCode: 200,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Content-Length': '27',
            },
            body: {
              name: 'Foo',
              price: 100,
            },
          };

          const mockRequest = <Request>{
            originalUrl: '/products',
            query: {
              page: 1,
              perPage: 10,
            } as any,
            header: jest.fn().mockImplementationOnce((...args) => {
              expect(args[0]).toEqual('if-none-match');
              return tag;
            }) as any,
          };

          const expectedKey = keyPrefix + mockRequest.originalUrl + JSON.stringify(mockRequest.query) + tag;

          const mockResponse = {} as Response;
          mockResponse.end = jest.fn().mockReturnValueOnce(true);
          mockResponse.set = jest.fn().mockReturnValueOnce(mockResponse);
          mockResponse.status = jest.fn().mockReturnValueOnce(mockResponse);

          const mockNext = jest.fn().mockReturnValueOnce(true);

          redisClient.get = jest.fn().mockImplementationOnce((key, callback) => {
            expect(key).toEqual(expectedKey);
            callback(null, JSON.stringify(cacheData));
          });

          const expressCache = new ExpressCache({
            keyPrefix,
            redis: {
              package: REDIS_PACKAGE.REDIS,
              client: redisClient,
            },
          });

          await expressCache.middleware()(mockRequest, mockResponse, mockNext);

          expect(redisClient.get).toBeCalledTimes(1);
          expect(redisClient.get).toBeCalledWith(expectedKey, expect.any(Function));
          expect(mockResponse.end).toBeCalledTimes(1);
          expect(mockResponse.end).toBeCalledWith(cacheData.body);
          expect(mockResponse.set).toBeCalledWith(cacheData.headers);
          expect(mockResponse.status).toBeCalledWith(cacheData.httpStatusCode);
          expect(mockNext).toBeCalledTimes(0);
        });

        test('should read cache with tag prefix function format', async () => {
          const keyPrefix = 'express-cache:';
          const tag = 'abcd-1234-efgh';
          const expectedKey = keyPrefix + 'product-1' + tag;
          const cacheData = {
            httpStatusCode: 200,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Content-Length': '27',
            },
            body: {
              name: 'Foo',
              price: 100,
            },
          };

          const mockRequest = <Request>{
            params: {
              id: 1,
            } as any,
            header: jest.fn().mockImplementationOnce((...args) => {
              expect(args[0]).toEqual('if-none-match');
              return tag;
            }) as any,
          };

          const mockResponse = {} as Response;
          mockResponse.end = jest.fn().mockReturnValueOnce(true);
          mockResponse.set = jest.fn().mockReturnValueOnce(mockResponse);
          mockResponse.status = jest.fn().mockReturnValueOnce(mockResponse);

          const mockNext = jest.fn().mockReturnValueOnce(true);

          redisClient.get = jest.fn().mockImplementationOnce((key, callback) => {
            expect(key).toEqual(expectedKey);
            callback(null, JSON.stringify(cacheData));
          });

          const expressCache = new ExpressCache({
            keyPrefix,
            redis: {
              package: REDIS_PACKAGE.REDIS,
              client: redisClient,
            },
          });

          const tagPrefix = (req: Request) => `product-${req.params.id}`;

          await expressCache.middleware({
            tagPrefix,
          })(mockRequest, mockResponse, mockNext);

          expect(redisClient.get).toBeCalledTimes(1);
          expect(redisClient.get).toBeCalledWith(expectedKey, expect.any(Function));
          expect(mockResponse.end).toBeCalledTimes(1);
          expect(mockResponse.end).toBeCalledWith(cacheData.body);
          expect(mockResponse.set).toBeCalledWith(cacheData.headers);
          expect(mockResponse.status).toBeCalledWith(cacheData.httpStatusCode);
          expect(mockNext).toBeCalledTimes(0);
        });
      });
    });

    describe('save response to cache storage', () => {
      test('should save response to cache storage when success response', async () => {
        const ttl = 1001;
        const keyPrefix = 'express-cache:';
        const tagPrefix = 'product';
        const expectedContainKey = keyPrefix + tagPrefix;

        const resBody = JSON.stringify({
          name: 'Foo',
          price: 100,
        });

        const cacheData = {
          httpStatusCode: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': resBody.length,
          },
          body: resBody,
        };

        const mockRequest = <Request>{
          query: {},
          header: jest.fn().mockImplementationOnce(() => null) as any,
        };

        const mockNext = jest.fn().mockReturnValueOnce(true);
        const mockResponse = {} as Response;
        mockResponse.statusCode = 200;
        mockResponse.header = jest.fn().mockReturnValueOnce(true);
        mockResponse.getHeaders = jest.fn().mockReturnValueOnce(cacheData.headers);
        mockResponse.end = jest.fn();

        redisClient.get = jest.fn().mockImplementationOnce((_, callback) => callback(null, null));
        redisClient.setex = jest.fn().mockImplementationOnce((_key, _expire, _value, callback) => callback(null));

        const expressCache = new ExpressCache({
          keyPrefix,
          ttl,
          redis: {
            package: REDIS_PACKAGE.REDIS,
            client: redisClient,
          },
        });

        await expressCache.middleware({
          tagPrefix,
        })(mockRequest, mockResponse, mockNext);

        await mockResponse.end(Buffer.from(cacheData.body));

        expect(redisClient.setex).toBeCalledTimes(1);
        expect(redisClient.setex).toBeCalledWith(
          expect.stringMatching(new RegExp(`^${expectedContainKey}`)),
          ttl,
          JSON.stringify(cacheData),
          expect.any(Function),
        );
        expect(mockNext).toBeCalledTimes(1);
      });

      test('should not save response to cache storage when unsuccess response', async () => {
        const mockRequest = <Request>{
          query: {},
          header: jest.fn().mockImplementationOnce(() => null) as any,
        };

        const mockNext = jest.fn().mockReturnValueOnce(true);
        const mockResponse = {} as Response;
        mockResponse.statusCode = 400;
        mockResponse.header = jest.fn();
        mockResponse.getHeaders = jest.fn();
        mockResponse.end = jest.fn();

        redisClient.setex = jest.fn();

        const expressCache = new ExpressCache({
          redis: {
            package: REDIS_PACKAGE.REDIS,
            client: redisClient,
          },
        });

        await expressCache.middleware()(mockRequest, mockResponse, mockNext);
        await mockResponse.end(Buffer.from('product not found'));

        expect(redisClient.setex).toBeCalledTimes(0);
        expect(mockResponse.header).toBeCalledTimes(0);
        expect(mockResponse.getHeaders).toBeCalledTimes(0);
        expect(mockNext).toBeCalledTimes(1);
      });

      test('should save response to cache storage with custom function isCanSaveFn', async () => {
        const ttl = 1001;
        const keyPrefix = 'express-cache:';
        const tagPrefix = 'product';
        const expectedContainKey = keyPrefix + tagPrefix;
        const statusCode = 400;

        const resBody = JSON.stringify({
          name: 'Foo',
          price: 100,
        });

        const cacheData = {
          httpStatusCode: statusCode,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': resBody.length,
          },
          body: resBody,
        };

        const mockRequest = <Request>{
          query: {},
          header: jest.fn().mockImplementationOnce(() => null) as any,
        };

        const mockNext = jest.fn().mockReturnValueOnce(true);
        const mockResponse = {} as Response;
        mockResponse.statusCode = statusCode;
        mockResponse.header = jest.fn().mockReturnValueOnce(true);
        mockResponse.getHeaders = jest.fn().mockReturnValueOnce(cacheData.headers);
        mockResponse.end = jest.fn();

        redisClient.get = jest.fn().mockImplementationOnce((_, callback) => callback(null, null));
        redisClient.setex = jest.fn().mockImplementationOnce((_key, _expire, _value, callback) => callback(null));

        const expressCache = new ExpressCache({
          keyPrefix,
          ttl,
          redis: {
            package: REDIS_PACKAGE.REDIS,
            client: redisClient,
          },
        });

        const isCanSaveFn = (httpStatusCode: number) => {
          expect(httpStatusCode).toEqual(statusCode);

          return httpStatusCode < 500;
        };

        await expressCache.middleware({
          tagPrefix,
          isCanSaveFn,
        })(mockRequest, mockResponse, mockNext);

        await mockResponse.end(Buffer.from(cacheData.body));

        expect(redisClient.setex).toBeCalledTimes(1);
        expect(redisClient.setex).toBeCalledWith(
          expect.stringMatching(new RegExp(`^${expectedContainKey}`)),
          ttl,
          JSON.stringify(cacheData),
          expect.any(Function),
        );
        expect(mockNext).toBeCalledTimes(1);
      });

      test('should throw when error store cache', async () => {
        const ttl = 1001;
        const keyPrefix = 'express-cache:';
        const tagPrefix = 'product';
        const expectedContainKey = keyPrefix + tagPrefix;

        const resBody = JSON.stringify({
          name: 'Foo',
          price: 100,
        });

        const cacheData = {
          httpStatusCode: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': resBody.length,
          },
          body: resBody,
        };

        const mockRequest = <Request>{
          query: {},
          header: jest.fn().mockImplementationOnce(() => null) as any,
        };

        const mockNext = jest.fn().mockReturnValueOnce(true);
        const mockResponse = {} as Response;
        mockResponse.statusCode = 200;
        mockResponse.header = jest.fn().mockReturnValueOnce(true);
        mockResponse.getHeaders = jest.fn().mockReturnValueOnce(cacheData.headers);
        mockResponse.end = jest.fn();

        redisClient.get = jest.fn().mockImplementationOnce((_, callback) => callback(null, null));
        redisClient.setex = jest
          .fn()
          .mockImplementationOnce((_key, _expire, _value, callback) =>
            callback(new Error(MESSAGE_ERROR.CLIENT_CLOSED)),
          );

        const expressCache = new ExpressCache({
          keyPrefix,
          ttl,
          redis: {
            package: REDIS_PACKAGE.REDIS,
            client: redisClient,
          },
        });

        await expressCache.middleware({
          tagPrefix,
        })(mockRequest, mockResponse, mockNext);

        await expect(async () => await mockResponse.end(Buffer.from(cacheData.body))).rejects.toThrow(
          MESSAGE_ERROR.CLIENT_CLOSED,
        );

        expect(redisClient.setex).toBeCalledTimes(1);
        expect(redisClient.setex).toBeCalledWith(
          expect.stringMatching(new RegExp(`^${expectedContainKey}`)),
          ttl,
          JSON.stringify(cacheData),
          expect.any(Function),
        );
        expect(mockNext).toBeCalledTimes(1);
      });

      test('should call custom handle function when error store cache', async () => {
        const ttl = 1001;
        const keyPrefix = 'express-cache:';
        const tagPrefix = 'product';
        const expectedContainKey = keyPrefix + tagPrefix;

        const resBody = JSON.stringify({
          name: 'Foo',
          price: 100,
        });

        const cacheData = {
          httpStatusCode: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': resBody.length,
          },
          body: resBody,
        };

        const mockRequest = <Request>{
          query: {},
          header: jest.fn().mockImplementationOnce(() => null) as any,
        };

        const mockNext = jest.fn().mockReturnValueOnce(true);
        const mockResponse = {} as Response;
        mockResponse.statusCode = 200;
        mockResponse.header = jest.fn().mockReturnValueOnce(true);
        mockResponse.getHeaders = jest.fn().mockReturnValueOnce(cacheData.headers);
        mockResponse.end = jest.fn();

        redisClient.setex = jest
          .fn()
          .mockImplementationOnce((_key, _expire, _value, callback) =>
            callback(new Error(MESSAGE_ERROR.CLIENT_CLOSED)),
          );

        const logError = jest.fn();

        const storeCacheErrHandler = (err: Error) => {
          logError(err);
        };

        const expressCache = new ExpressCache({
          keyPrefix,
          ttl,
          redis: {
            package: REDIS_PACKAGE.REDIS,
            client: redisClient,
          },
          storeCacheErrHandler,
        });

        const middleware = expressCache.middleware({
          tagPrefix,
        });

        await middleware(mockRequest, mockResponse, mockNext);
        await mockResponse.end(Buffer.from(cacheData.body));

        expect(logError).toBeCalledTimes(1);
        expect(logError).toBeCalledWith(expect.any(Error));
        expect(redisClient.setex).toBeCalledTimes(1);
        expect(redisClient.setex).toBeCalledWith(
          expect.stringMatching(new RegExp(`^${expectedContainKey}`)),
          ttl,
          JSON.stringify(cacheData),
          expect.any(Function),
        );
        expect(mockNext).toBeCalledTimes(1);
      });
    });
  });

  describe('clear function', () => {
    test('should clear cache when success response', async () => {
      const keyPrefix = 'express-cache:';
      const tagPattern = 'product*';
      const expectedPattern = keyPrefix + tagPattern;
      const existKeys = ['express-cache:product-all-abcde-1234', 'express-cache:product-1-abcde-1234'];

      const mockRequest = <Request>{};

      const mockResponse = {} as Response;
      mockResponse.statusCode = 200;
      mockResponse.end = jest.fn().mockReturnValueOnce(true);

      const mockNext = jest.fn().mockReturnValueOnce(true);

      redisClient.keys = jest.fn().mockImplementationOnce((pattern, callback) => {
        expect(pattern).toEqual(expectedPattern);
        callback(null, existKeys);
      });

      redisClient.del = jest.fn().mockImplementationOnce((keys, callback) => {
        expect(keys).toEqual(expect.arrayContaining(keys));
        callback(null);
      });

      const expressCache = new ExpressCache({
        keyPrefix,
        redis: {
          package: REDIS_PACKAGE.REDIS,
          client: redisClient,
        },
      });

      const clear = expressCache.clear({
        tagPattern,
      });

      await clear(mockRequest, mockResponse, mockNext);
      await mockResponse.end(Buffer.from('ok'));

      expect(redisClient.keys).toBeCalledTimes(1);
      expect(redisClient.keys).toBeCalledWith(expectedPattern, expect.any(Function));
      expect(redisClient.del).toBeCalledTimes(1);
      expect(redisClient.del).toBeCalledWith(expect.arrayContaining(existKeys), expect.any(Function));
      expect(mockNext).toBeCalledTimes(1);
    });

    test('should not clear cache when unsuccess response', async () => {
      const keyPrefix = 'express-cache:';
      const tagPattern = 'product*';
      const mockRequest = <Request>{};
      const mockResponse = {} as Response;
      const mockNext = jest.fn().mockReturnValueOnce(true);

      mockResponse.end = jest.fn().mockReturnValueOnce(true);

      redisClient.keys = jest.fn();
      redisClient.del = jest.fn();

      const expressCache = new ExpressCache({
        keyPrefix,
        redis: {
          package: REDIS_PACKAGE.REDIS,
          client: redisClient,
        },
      });

      const clear = expressCache.clear({
        tagPattern,
      });

      await clear(mockRequest, mockResponse, mockNext);
      mockResponse.statusCode = 400;
      await mockResponse.end(Buffer.from('product not found'));

      expect(redisClient.keys).toBeCalledTimes(0);
      expect(redisClient.del).toBeCalledTimes(0);
      expect(mockNext).toBeCalledTimes(1);
    });

    test('should throw when error clear cache', async () => {
      const keyPrefix = 'express-cache:';
      const tagPattern = 'product*';
      const expectedPattern = keyPrefix + tagPattern;
      const existKeys = ['express-cache:product-all-abcde-1234', 'express-cache:product-1-abcde-1234'];

      const mockRequest = <Request>{};

      const mockResponse = {} as Response;
      mockResponse.statusCode = 200;
      mockResponse.end = jest.fn().mockReturnValueOnce(true);

      const mockNext = jest.fn().mockReturnValueOnce(true);

      redisClient.keys = jest.fn().mockImplementationOnce((pattern, callback) => {
        expect(pattern).toEqual(expectedPattern);
        callback(null, existKeys);
      });

      redisClient.del = jest
        .fn()
        .mockImplementationOnce((_, callback) => callback(new Error(MESSAGE_ERROR.CLIENT_CLOSED)));

      const expressCache = new ExpressCache({
        keyPrefix,
        redis: {
          package: REDIS_PACKAGE.REDIS,
          client: redisClient,
        },
      });

      const clear = expressCache.clear({
        tagPattern,
      });

      await clear(mockRequest, mockResponse, mockNext);
      await expect(async () => await mockResponse.end(Buffer.from('ok'))).rejects.toThrow(MESSAGE_ERROR.CLIENT_CLOSED);

      expect(redisClient.keys).toBeCalledTimes(1);
      expect(redisClient.keys).toBeCalledWith(expectedPattern, expect.any(Function));
      expect(redisClient.del).toBeCalledTimes(1);
      expect(redisClient.del).toBeCalledWith(expect.arrayContaining(existKeys), expect.any(Function));
      expect(mockNext).toBeCalledTimes(1);
    });

    test('should call custom handle function when error clear cache', async () => {
      const keyPrefix = 'express-cache:';
      const tagPattern = 'product*';
      const expectedPattern = keyPrefix + tagPattern;
      const existKeys = ['express-cache:product-all-abcde-1234', 'express-cache:product-1-abcde-1234'];

      const mockRequest = <Request>{};

      const mockResponse = {} as Response;
      mockResponse.statusCode = 200;
      mockResponse.end = jest.fn().mockReturnValueOnce(true);

      const mockNext = jest.fn().mockReturnValueOnce(true);
      const logError = jest.fn();

      redisClient.keys = jest.fn().mockImplementationOnce((pattern, callback) => {
        expect(pattern).toEqual(expectedPattern);
        callback(null, existKeys);
      });

      redisClient.del = jest
        .fn()
        .mockImplementationOnce((_, callback) => callback(new Error(MESSAGE_ERROR.CLIENT_CLOSED)));

      const clearCacheErrHandler = (err: Error) => {
        logError(err);
      };

      const expressCache = new ExpressCache({
        keyPrefix,
        redis: {
          package: REDIS_PACKAGE.REDIS,
          client: redisClient,
        },
        clearCacheErrHandler,
      });

      const clear = expressCache.clear({
        tagPattern,
      });

      await clear(mockRequest, mockResponse, mockNext);
      await mockResponse.end(Buffer.from('ok'));

      expect(redisClient.keys).toBeCalledTimes(1);
      expect(redisClient.keys).toBeCalledWith(expectedPattern, expect.any(Function));
      expect(redisClient.del).toBeCalledTimes(1);
      expect(redisClient.del).toBeCalledWith(expect.arrayContaining(existKeys), expect.any(Function));
      expect(mockNext).toBeCalledTimes(1);
      expect(logError).toBeCalledTimes(1);
      expect(logError).toBeCalledWith(expect.any(Error));
    });

    describe('clear function with different option', () => {
      test('clear cache with option tag pattern format string', async () => {
        const keyPrefix = 'express-cache:';
        const tagPattern = 'product*';
        const expectedPattern = keyPrefix + tagPattern;
        const existKeys = ['express-cache:product-all-abcde-1234', 'express-cache:product-1-abcde-1234'];

        const mockRequest = <Request>{};

        const mockResponse = {} as Response;
        mockResponse.statusCode = 200;
        mockResponse.end = jest.fn().mockReturnValueOnce(true);

        const mockNext = jest.fn().mockReturnValueOnce(true);

        redisClient.keys = jest.fn().mockImplementationOnce((pattern, callback) => {
          expect(pattern).toEqual(expectedPattern);
          callback(null, existKeys);
        });

        redisClient.del = jest.fn().mockImplementationOnce((keys, callback) => {
          expect(keys).toEqual(expect.arrayContaining(keys));
          callback(null);
        });

        const expressCache = new ExpressCache({
          keyPrefix,
          redis: {
            package: REDIS_PACKAGE.REDIS,
            client: redisClient,
          },
        });

        const clear = expressCache.clear({
          tagPattern,
        });

        await clear(mockRequest, mockResponse, mockNext);
        await mockResponse.end(Buffer.from('ok'));

        expect(redisClient.keys).toBeCalledTimes(1);
        expect(redisClient.keys).toBeCalledWith(expectedPattern, expect.any(Function));
        expect(redisClient.del).toBeCalledTimes(1);
        expect(redisClient.del).toBeCalledWith(expect.arrayContaining(existKeys), expect.any(Function));
        expect(mockNext).toBeCalledTimes(1);
      });

      test('clear cache with option tag pattern format array string', async () => {
        const keyPrefix = 'express-cache:';
        const tagPatterns = ['product-all*', 'product-1*'];
        const expectedPattern = tagPatterns.map((t) => keyPrefix + t);
        const existKeys = ['express-cache:product-all-abcde-1234', 'express-cache:product-1-abcde-1234'];

        const mockRequest = <Request>{};

        const mockResponse = {} as Response;
        mockResponse.statusCode = 200;
        mockResponse.end = jest.fn().mockReturnValueOnce(true);

        const mockNext = jest.fn().mockReturnValueOnce(true);

        redisClient.keys = jest
          .fn()
          .mockImplementationOnce((pattern, callback) => {
            expect(pattern).toEqual(expectedPattern[0]);
            callback(null, [existKeys[0]]);
          })
          .mockImplementationOnce((pattern, callback) => {
            expect(pattern).toEqual(expectedPattern[1]);
            callback(null, [existKeys[1]]);
          });

        redisClient.del = jest.fn().mockImplementationOnce((keys, callback) => {
          expect(keys).toEqual(expect.arrayContaining(keys));
          callback(null, keys.length);
        });

        const expressCache = new ExpressCache({
          keyPrefix,
          redis: {
            package: REDIS_PACKAGE.REDIS,
            client: redisClient,
          },
        });

        const clear = expressCache.clear({
          tagPattern: tagPatterns,
        });

        await clear(mockRequest, mockResponse, mockNext);
        await mockResponse.end(Buffer.from('ok'));

        expect(redisClient.keys).toBeCalledTimes(2);
        expect(redisClient.keys).toBeCalledWith(expectedPattern[0], expect.any(Function));
        expect(redisClient.keys).toBeCalledWith(expectedPattern[1], expect.any(Function));
        expect(redisClient.del).toBeCalledTimes(1);
        expect(redisClient.del).toBeCalledWith(expect.arrayContaining(existKeys), expect.any(Function));
        expect(mockNext).toBeCalledTimes(1);
      });

      test('clear cache with option tag pattern format function', async () => {
        const expectedPattern = 'express-cache:product-1*';
        const existKeys = ['express-cache:product-all-abcde-1234', 'express-cache:product-1-abcde-1234'];

        const mockRequest = <Request>{
          params: {
            id: 1,
          } as any,
        };

        const mockResponse = {} as Response;
        mockResponse.statusCode = 200;
        mockResponse.end = jest.fn().mockReturnValueOnce(true);

        const mockNext = jest.fn().mockReturnValueOnce(true);

        redisClient.keys = jest.fn().mockImplementationOnce((pattern, callback) => {
          expect(pattern).toEqual(expectedPattern);
          callback(null, existKeys);
        });

        redisClient.del = jest.fn().mockImplementationOnce((keys, callback) => {
          expect(keys).toEqual(expect.arrayContaining(keys));
          callback(null);
        });

        const expressCache = new ExpressCache({
          redis: {
            package: REDIS_PACKAGE.REDIS,
            client: redisClient,
          },
        });

        const tagPatternFn = jest.fn().mockImplementationOnce((req: Request) => `product-${req.params.id}*`);

        const clear = expressCache.clear({
          tagPattern: tagPatternFn,
        });

        await clear(mockRequest, mockResponse, mockNext);
        await mockResponse.end(Buffer.from('ok'));

        expect(tagPatternFn).toBeCalledTimes(1);
        expect(redisClient.keys).toBeCalledTimes(1);
        expect(redisClient.keys).toBeCalledWith('express-cache:product-1*', expect.any(Function));
        expect(redisClient.del).toBeCalledTimes(1);
        expect(redisClient.del).toBeCalledWith(expect.arrayContaining(existKeys), expect.any(Function));
        expect(mockNext).toBeCalledTimes(1);
      });

      test('clear cache with option isCanClearFn', async () => {
        const keyPrefix = 'express-cache:';
        const tagPattern = 'product*';
        const expectedPattern = keyPrefix + tagPattern;
        const existKeys = ['express-cache:product-all-abcde-1234', 'express-cache:product-1-abcde-1234'];
        const statusCode = 201;

        const mockRequest = <Request>{};

        const mockResponse = {} as Response;
        mockResponse.statusCode = statusCode;
        mockResponse.end = jest.fn().mockReturnValueOnce(true);

        const mockNext = jest.fn().mockReturnValueOnce(true);

        redisClient.keys = jest.fn().mockImplementationOnce((pattern, callback) => {
          expect(pattern).toEqual(expectedPattern);
          callback(null, existKeys);
        });

        redisClient.del = jest.fn().mockImplementationOnce((keys, callback) => {
          expect(keys).toEqual(expect.arrayContaining(keys));
          callback(null);
        });

        const expressCache = new ExpressCache({
          keyPrefix,
          redis: {
            package: REDIS_PACKAGE.REDIS,
            client: redisClient,
          },
        });

        const isCanClearFn = (httpStatusCode: number) => {
          expect(httpStatusCode).toEqual(statusCode);
          return httpStatusCode >= 200 && httpStatusCode <= 299;
        };

        const clear = expressCache.clear({
          tagPattern,
          isCanClearFn,
        });

        await clear(mockRequest, mockResponse, mockNext);
        await mockResponse.end(Buffer.from('ok'));

        expect(redisClient.keys).toBeCalledTimes(1);
        expect(redisClient.keys).toBeCalledWith(expectedPattern, expect.any(Function));
        expect(redisClient.del).toBeCalledTimes(1);
        expect(redisClient.del).toBeCalledWith(expect.arrayContaining(existKeys), expect.any(Function));
        expect(mockNext).toBeCalledTimes(1);
      });
    });
  });
});
