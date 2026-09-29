import { Global, Injectable, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import Redis from 'ioredis';
import { Config } from './config';

@Injectable()
export class Database extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
  async serial<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await this.$transaction(operation, { isolationLevel: 'Serializable', timeout: 15000 }); }
      catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 4) continue;
        throw error;
      }
    }
  }
}

@Injectable()
export class RedisStore implements OnModuleDestroy {
  readonly client: Redis;
  readonly disabled: boolean;
  constructor(config: Config) {
    this.disabled = !!config.localPostgresOnly;
    this.client = new Redis(config.value.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 3000, commandTimeout: 3000, ...(this.disabled ? { lazyConnect: true, enableOfflineQueue: false } : {}) });
    this.client.on('error', () => undefined);
  }
  async onModuleDestroy() { this.client.disconnect(); }
}

@Global()
@Module({ providers: [Config, Database, RedisStore], exports: [Config, Database, RedisStore] })
export class InfrastructureModule {}
