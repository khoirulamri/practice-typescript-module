import IORedis from 'ioredis';
import Redis from 'redis';

import { REDIS_PACKAGE } from './constans';

export interface RedisClient {
  del(...keys: string[]): Promise<number>;
  get(key: string): Promise<string | null>;
  keys(key: string): Promise<string[]>;
  set(key: string, value: string, opts?: { EX: number }): Promise<void>;
}

export class RedisWrapper implements RedisClient {
  private client: Redis.RedisClient;
  constructor(client: Redis.RedisClient) {
    this.client = client;
  }

  del(...keys: string[]): Promise<number> {
    return new Promise((resolve, reject) => {
      this.client.del(keys, (err, data) => {
        if (err) {
          return reject(err);
        }

        return resolve(data);
      });
    });
  }

  get(key: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      this.client.get(key, (err, data) => {
        if (err) {
          return reject(err);
        }

        return resolve(data);
      });
    });
  }

  keys(key: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.client.keys(key, (err, data) => {
        if (err) {
          return reject(err);
        }

        return resolve(data);
      });
    });
  }

  set(key: string, value: string, opts: { EX: number }): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.set(key, value, 'EX', opts.EX, (err) => {
        if (err) {
          return reject(err);
        }

        return resolve();
      });
    });
  }
}
export class IORedisWrapper implements RedisClient {
  private client: IORedis.Redis;
  constructor(client: IORedis.Redis) {
    this.client = client;
  }

  async del(...keys: string[]): Promise<number> {
    return await this.client.del(...keys);
  }

  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  async keys(key: string): Promise<string[]> {
    return await this.client.keys(key);
  }

  async set(key: string, value: string, opts: { EX: number }): Promise<void> {
    await this.client.set(key, value, 'EX', opts.EX);
  }
}

// add other wrapper

export class RedisClientWrapper {
  private clientWrapper: RedisClient;

  constructor(packageName: REDIS_PACKAGE, client: any) {
    if (!client) {
      throw new Error('redis client is required');
    }

    if (packageName === REDIS_PACKAGE.REDIS) {
      this.clientWrapper = new RedisWrapper(client);
    } else if (packageName === REDIS_PACKAGE.IOREDIS) {
      this.clientWrapper = new IORedisWrapper(client);
    } else {
      throw new Error('redis client only support from packages: redis, ioredis');
    }
  }

  getWrapper() {
    return this.clientWrapper;
  }
}
