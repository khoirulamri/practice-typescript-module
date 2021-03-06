import tagGenerator from 'etag';
import { Request, Response, NextFunction } from 'express';

import { REDIS_PACKAGE } from './constans';
import { RedisClient, RedisClientWrapper } from './redis-client-wrapper';
import { responseEndOverrider } from './response-end-overrider';

export interface ExpressCacheErrorHandler {
  (error: Error, req: Request, res: Response, next: NextFunction): void;
}

export interface ExpressCacheOptions {
  /**
   * saved cache name on redis
   * format name: [key-prefix]:[tag-prefix][tag]
   * Default is "expch"
   */
  keyPrefix?: string;
  /**
   * Time to live in second. Default ttl is 60 second or 1 hour
   */
  ttl?: number;
  /**
   * Redis Client
   */
  redis: {
    package: REDIS_PACKAGE;
    client: any;
  };
  /**
   * Header Cache Name on Request. Default is "if-none-match":
   */
  requestHeaderName?: string;
  /**
   * Header Cache Name on Response. Default is "etag"
   */
  responseHeaderName?: string;
  /**
   * Triggered function if read cache is error
   * Default function is throw error
   */
  readCacheErrHandler?: ExpressCacheErrorHandler;
  /**
   * Triggered function if store cache is error
   * Default function is throw error
   */
  storeCacheErrHandler?: ExpressCacheErrorHandler;
  /**
   * Triggered function if clear cache is error
   * Default function is throw error
   */
  clearCacheErrHandler?: ExpressCacheErrorHandler;
}

export interface ExpressCacheMiddlewareOptions {
  /**
   * tag prefix for cache name
   * Default: string from req.path
   */
  tagPrefix?: string | ((req: Request) => string);
  /**
   * validate whether data can be cached
   * By default the data will be saved if the http status code is 200-299
   */
  isCanSaveFn?: ExpressCacheValidateFunction;
}

export interface ExpressCacheClearOptions {
  /**
   * tag pattern for cache key
   * Default: string from req.path with asterix
   * Example: users-*
   */
  tagPattern?: string | string[] | ((req: Request) => string | string[]);
  /**
   * validate whether cache can be cleared
   * By default the data will be clear if the http status code is 200-299
   */
  isCanClearFn?: ExpressCacheValidateFunction;
}

interface DataCache {
  httpStatusCode: number;
  headers: any;
  body: any;
}

type ExpressCacheRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;
type ExpressCacheValidateFunction = (httpStatusCode: number, res: Response, req: Request) => boolean;

export class ExpressCache {
  private keyPrefix: string;
  private tagPrefix: string;
  private ttl: number;
  private wrappedRedisClient: RedisClient;
  private requestHeaderName: string;
  private responseHeaderName: string;
  private readCacheErrHandler: ExpressCacheErrorHandler = (err) => {
    throw err;
  };
  private storeCacheErrHandler: ExpressCacheErrorHandler = (err) => {
    throw err;
  };
  private clearCacheErrHandler: ExpressCacheErrorHandler = (err) => {
    throw err;
  };

  constructor(opts: ExpressCacheOptions) {
    if (!opts.redis) {
      throw new Error('redis options is required');
    }

    if (!opts.redis.package) {
      throw new Error('redis package is required');
    }

    if (!opts.redis.client) {
      throw new Error('redis client is required');
    }

    this.wrappedRedisClient = new RedisClientWrapper(opts.redis.package, opts.redis.client).getWrapper();
    this.keyPrefix = opts.keyPrefix || 'express-cache:';
    this.ttl = opts.ttl || 60;
    this.requestHeaderName = opts.requestHeaderName || 'if-none-match';
    this.responseHeaderName = opts.responseHeaderName || 'etag';
    this.tagPrefix = '';

    if (opts.readCacheErrHandler && typeof opts.readCacheErrHandler === 'function') {
      this.readCacheErrHandler = opts.readCacheErrHandler;
    }

    if (opts.storeCacheErrHandler && typeof opts.storeCacheErrHandler === 'function') {
      this.storeCacheErrHandler = opts.storeCacheErrHandler;
    }

    if (opts.clearCacheErrHandler && typeof opts.clearCacheErrHandler === 'function') {
      this.clearCacheErrHandler = opts.clearCacheErrHandler;
    }
  }

  middleware(opts?: ExpressCacheMiddlewareOptions): ExpressCacheRequestHandler {
    let isCanSaveFn: (httpStatusCode: number, res: Response, req: Request) => boolean = (httpStatusCode: number) =>
      httpStatusCode >= 200 && httpStatusCode <= 299;

    if (opts && opts.isCanSaveFn && typeof opts.isCanSaveFn === 'function') {
      isCanSaveFn = opts.isCanSaveFn;
    }

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (opts && opts.tagPrefix && typeof opts.tagPrefix === 'string') {
        this.tagPrefix = opts.tagPrefix;
      } else if (opts && opts.tagPrefix && typeof opts.tagPrefix === 'function') {
        this.tagPrefix = opts.tagPrefix(req);
      } else {
        const queryString = Object.keys(req.query).length > 0 ? JSON.stringify(req.query) : '';
        this.tagPrefix = req.originalUrl + queryString;
      }

      // response from cache
      try {
        const tag = req.header(this.requestHeaderName) as string;
        if (tag) {
          const key = this.getKey(tag);
          const dataCache = await this.getCache(key);
          if (dataCache) {
            res.status(dataCache.httpStatusCode).set(dataCache.headers).end(dataCache.body);
            return;
          }
        }
      } catch (err: Error | any) {
        await this.readCacheErrHandler(err, req, res, next);
        return;
      }

      // store response to cache
      const fn = async (resBody: string) => {
        const isAllowSaveCache = await isCanSaveFn(res.statusCode, res, req);

        if (!isAllowSaveCache) {
          return;
        }

        try {
          const tag = tagGenerator(resBody, { weak: false });
          res.header(this.responseHeaderName, tag);

          const data: DataCache = {
            httpStatusCode: res.statusCode,
            headers: res.getHeaders(),
            body: resBody,
          };

          const key = this.getKey(tag);
          await this.wrappedRedisClient.setex(key, this.ttl, JSON.stringify(data));
        } catch (err: Error | any) {
          await this.storeCacheErrHandler(err, req, res, next);
        }
      };

      responseEndOverrider(res, fn);
      next();
    };
  }

  private getKey(tag: string): string {
    return this.keyPrefix + this.tagPrefix + tag;
  }

  private async getCache(key: string): Promise<DataCache | null> {
    const data = await this.wrappedRedisClient.get(key);
    if (!data) {
      return null;
    }

    const cache: DataCache = JSON.parse(data);
    return cache;
  }

  clear(opts: ExpressCacheClearOptions): ExpressCacheRequestHandler {
    const keyPatterns: string[] = [];
    let isCanClearFn: (httpStatusCode: number, res: Response, req: Request) => boolean = (httpStatusCode: number) =>
      httpStatusCode >= 200 && httpStatusCode <= 299;

    if (opts.isCanClearFn && typeof opts.isCanClearFn === 'function') {
      isCanClearFn = opts.isCanClearFn;
    }

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (opts.tagPattern && typeof opts.tagPattern === 'function') {
        opts.tagPattern = await opts.tagPattern(req);
      }

      if (opts.tagPattern && typeof opts.tagPattern === 'string') {
        const keyPattern = this.keyPrefix + opts.tagPattern;
        keyPatterns.push(keyPattern);
      } else if (Array.isArray(opts.tagPattern) && opts.tagPattern.length > 0) {
        for (const tp of opts.tagPattern) {
          const keyPattern = this.keyPrefix + tp;
          keyPatterns.push(keyPattern);
        }
      }
      if (keyPatterns.length > 0) {
        const fn = async () => {
          const isCanClear = await isCanClearFn(res.statusCode, res, req);
          if (!isCanClear) {
            return;
          }

          try {
            const results = await Promise.all<Promise<string[]>[]>(
              keyPatterns.map<Promise<string[]>>((keyPattern) => this.wrappedRedisClient.keys(keyPattern)),
            );

            const keys: string[] = ([] as string[]).concat(...results);
            if (keys.length > 0) {
              await this.wrappedRedisClient.del(...keys);
            }
          } catch (err: Error | any) {
            await this.clearCacheErrHandler(err, req, res, next);
          }
        };

        responseEndOverrider(res, fn);
      }

      next();
    };
  }
}
