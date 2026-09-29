import { Injectable, Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { Job, Queue, Worker } from 'bullmq';
import { validRevalidationPath } from '../common/validation';
import { Config } from './config';
import { Database, InfrastructureModule } from './infrastructure.module';

export function signRevalidation(secret: string, timestamp: string, body: string) {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export function revalidationBody(paths: unknown) {
  if (!Array.isArray(paths) || !paths.length || paths.length > 100 || !paths.every((path) => typeof path === 'string' && validRevalidationPath(path))) throw new Error('Invalid revalidation paths');
  const body = JSON.stringify({ paths });
  if (Buffer.byteLength(body, 'utf8') > 16 * 1024) throw new Error('Invalid revalidation body');
  return body;
}

class RevalidationQueue extends Queue {
  override async close() {
    await this.connection.close(true);
    await super.close();
  }
}

@Injectable()
export class RevalidationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RevalidationService.name);
  private queue?: RevalidationQueue;
  private worker?: Worker;
  private interval?: NodeJS.Timeout;
  private dispatching = false;
  private stopped = false;
  private readonly abort = new AbortController();
  constructor(private readonly config: Config, private readonly db: Database) {}

  onModuleInit() {
    if (this.config.localPostgresOnly) {
      this.interval = setInterval(() => { void this.dispatch(); }, 5000);
      this.interval.unref();
      void this.dispatch();
      return;
    }
    const url = new URL(this.config.value.REDIS_URL);
    const connection = {
      host: url.hostname.replace(/^\[|\]$/g, ''), port: Number(url.port || 6379),
      username: decodeURIComponent(url.username) || undefined,
      password: decodeURIComponent(url.password) || undefined,
      db: Number(url.pathname.slice(1) || 0),
      ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
      connectTimeout: 3000,
    };
    this.queue = new RevalidationQueue('revalidation', { connection: { ...connection, maxRetriesPerRequest: 1, commandTimeout: 3000 } });
    this.queue.on('error', () => this.logger.error('Revalidation queue error'));
    this.worker = new Worker('revalidation', (job) => this.deliver(job), { connection: { ...connection, maxRetriesPerRequest: null }, concurrency: 1 });
    this.worker.on('error', () => this.logger.error('Revalidation worker error'));
    this.worker.on('failed', () => this.logger.warn('Revalidation delivery failed'));
    this.interval = setInterval(() => { void this.dispatch(); }, 5000);
    this.interval.unref();
    void this.dispatch();
  }

  async dispatch(queue: Pick<Queue, 'getJob' | 'add'> | undefined = this.queue) {
    if ((!this.config.localPostgresOnly && !queue) || this.stopped || this.dispatching) return;
    this.dispatching = true;
    try {
      const rows = await this.db.revalidationOutbox.findMany({ where: { deliveredAt: null }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 100 });
      for (const row of rows) {
        if (this.stopped) break;
        try {
          if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,127}$/.test(row.id)) throw new Error('Invalid outbox id');
          if (this.config.localPostgresOnly) await this.deliver({ id: row.id });
          else if (queue) {
            const job = await queue.getJob(row.id);
            if (!job) await queue.add('deliver', {}, { jobId: row.id, attempts: 5, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: true, removeOnFail: false });
            else if (await job.getState() === 'failed' && job.finishedOn !== undefined && Date.now() - job.finishedOn >= 60000) await job.retry();
          }
        } catch (error) { this.logger.warn(`Revalidation dispatch failed: ${error instanceof Error ? error.message : String(error)}`); }
      }
    } catch { this.logger.warn('Revalidation dispatch failed'); }
    finally { this.dispatching = false; }
  }

  async deliver(job: Pick<Job, 'id'>) {
    try {
      if (this.stopped || !job.id || !/^[a-zA-Z][a-zA-Z0-9_-]{0,127}$/.test(job.id)) throw new Error('Invalid outbox job');
      const row = await this.db.revalidationOutbox.findUnique({ where: { id: job.id } });
      if (!row || row.deliveredAt) return;
      const body = revalidationBody(row.paths);
      const timestamp = String(Math.floor(Date.now() / 1000));
      const response = await fetch(this.config.value.NEXT_REVALIDATE_URL, {
        method: 'POST', redirect: 'error', signal: AbortSignal.any([this.abort.signal, AbortSignal.timeout(5000)]), body,
        headers: { 'content-type': 'application/json', 'x-revalidate-timestamp': timestamp, 'x-revalidate-signature': signRevalidation(this.config.value.NEXT_REVALIDATE_SECRET, timestamp, body) },
      });
      await response.body?.cancel();
      if (!response.ok || this.stopped) throw new Error('Webhook failed');
      const result = await this.db.revalidationOutbox.updateMany({ where: { id: row.id, version: row.version, deliveredAt: null }, data: { deliveredAt: new Date() } });
      if (result.count !== 1) throw new Error('Outbox changed');
    } catch { throw new Error('Revalidation delivery failed'); }
  }

  async onModuleDestroy() {
    this.stopped = true;
    clearInterval(this.interval);
    this.abort.abort();
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        Promise.allSettled([this.worker?.close(true), this.queue?.close()]),
        new Promise<void>((resolve) => { timer = setTimeout(resolve, 6000); }),
      ]);
    } finally { clearTimeout(timer); }
  }
}

@Module({ imports: [InfrastructureModule], providers: [RevalidationService], exports: [RevalidationService] })
export class RevalidationModule {}
