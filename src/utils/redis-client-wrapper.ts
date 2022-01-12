import IORedis from 'ioredis';
import Redis from 'redis';

export interface RedisClient {
  del(...keys: string[]): Promise<number>;
  get(key: string): Promise<string | null>;
  keys(key: string): Promise<string[]>;
  set(key: string, value: string, opts: { EX: number }): Promise<void>;
}

class RedisWrapper implements RedisClient {
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

class IORedisWrapper implements RedisClient {
  private client: IORedis.Redis;
  constructor(client: IORedis.Redis) {
    this.client = client;
  }

  async del(...keys: string[]): Promise<number> {
    try {
      return await this.client.del(...keys);
    } catch (err) {
      console.log('===err del', err);
    }

    return 0;
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (err) {
      console.log('===err get', err);
    }
    return null;
  }

  async keys(key: string): Promise<string[]> {
    try {
      return await this.client.keys(key);
    } catch (err) {
      console.log('===err keys', err);
    }

    return [];
  }

  async set(key: string, value: string, opts: { EX: number }): Promise<void> {
    try {
      await this.client.set(key, value, 'EX', opts.EX);
    } catch (err) {
      console.log('===err set', err);
    }
  }
}

// add other wrapper

export class RedisClientWrapper {
  private clientWrapper: RedisClient;

  constructor(packageName: string, client: any) {
    if (packageName === 'redis') {
      this.clientWrapper = new RedisWrapper(client);
    } else if (packageName === 'ioredis') {
      this.clientWrapper = new IORedisWrapper(client);
    } else {
      throw new Error('redis client only support from packages: redis, ioredis');
    }
  }

  getWrapper() {
    return this.clientWrapper;
  }
}
