import { HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { hash } from '../common/validation';
import { RedisStore } from '../infrastructure/infrastructure.module';

export function isPublicLeadsPath(path: string) {
  try { return /^\/api\/v1\/public\/leads\/?$/i.test(decodeURIComponent(path)); }
  catch { return false; }
}

export function isPublicSearchPath(path: string) {
  try { return /^\/api\/v1\/public\/search\/?$/i.test(decodeURIComponent(path)); }
  catch { return false; }
}

export const rateLimitScript = `
local denied = 0
local retry = 0
for i, key in ipairs(KEYS) do
  local limit = tonumber(ARGV[(i - 1) * 2 + 1])
  local window = tonumber(ARGV[(i - 1) * 2 + 2])
  local count = redis.call('INCR', key)
  local ttl = redis.call('PTTL', key)
  if count == 1 or ttl < 0 then
    redis.call('PEXPIRE', key, window)
    ttl = window
  end
  if count > limit then
    denied = 1
    retry = math.max(retry, ttl)
  end
end
return {denied, retry}
`;

@Injectable()
export class RateLimiter {
  private readonly windows = new Map<string, { count: number; expiresAt: number }>();
  private localCheck(keys: string[], args: number[]): number[] {
    const now = Date.now();
    for (const [key, entry] of this.windows) {
      if (entry.expiresAt <= now) this.windows.delete(key);
    }
    const missing = keys.filter((key) => !this.windows.has(key)).length;
    if (this.windows.size + missing > 10000) throw new Error('Rate limiter capacity exceeded');
    let denied = 0;
    let retry = 0;
    for (const [index, key] of keys.entries()) {
      const limit = args[index * 2]!;
      const window = args[index * 2 + 1]!;
      const entry = this.windows.get(key) ?? { count: 0, expiresAt: now + window };
      entry.count = Math.min(entry.count + 1, limit + 1);
      this.windows.set(key, entry);
      if (entry.count > limit) {
        denied = 1;
        retry = Math.max(retry, entry.expiresAt - now);
      }
    }
    return [denied, retry];
  }
  constructor(private readonly redis: RedisStore, private readonly logger: PinoLogger) {}
  async check(req: Request, res: Response) {
    const ip = hash(req.ip ?? req.socket.remoteAddress ?? 'unknown');
    const keys = ['rate:{api}:global', `rate:{api}:ip:${ip}`];
    const args = [3000, 60000, 120, 60000];
    if (/^\/api\/v1\/auth(?:\/|$)/i.test(req.path)) {
      keys.push(`rate:{api}:auth:${ip}`);
      args.push(30, 60000);
      if (/^\/api\/v1\/auth\/login\/?$/i.test(req.path)) {
        keys.push(`rate:{api}:login:${ip}`, 'rate:{api}:login-global');
        args.push(10, 900000, 100, 60000);
      }
    }
    if (req.method === 'POST' && isPublicLeadsPath(req.path)) {
      keys.push(`rate:{api}:leads:${ip}`, 'rate:{api}:leads-global');
      args.push(10, 900000, 100, 60000);
    }
    // Search throttle runs BEFORE validation (middleware order in runtime.ts):
    // even 400s count, which prevents validation-bypass probing. Budgets are
    // 60/min per IP + 600/min global, hashed IP keys like existing policies.
    if (req.method === 'GET' && isPublicSearchPath(req.path)) {
      keys.push(`rate:{api}:search:${ip}`, 'rate:{api}:search-global');
      args.push(60, 60000, 600, 60000);
    }
    let result: unknown;
    try {
      result = this.redis.disabled ? this.localCheck(keys, args) : await this.redis.client.eval(rateLimitScript, keys.length, ...keys, ...args);
      if (!Array.isArray(result) || result.length !== 2 || ![0, 1].includes(result[0] as number) || typeof result[1] !== 'number' || !Number.isFinite(result[1])) throw new Error();
    } catch {
      this.logger.warn({ event: 'rate_limit_unavailable', requestId: req.id }, 'Rate limiter unavailable');
      throw new ServiceUnavailableException();
    }
    const [denied, ttl] = result as number[];
    if (denied) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil(ttl! / 1000)));
      throw new HttpException('Too many requests', 429);
    }
  }
}
