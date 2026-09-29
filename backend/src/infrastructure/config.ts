import 'dotenv/config';
import { Injectable } from '@nestjs/common';
import { resolve, sep } from 'node:path';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOCAL_POSTGRES_ONLY: z.enum(['true', 'false']).default('false'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().min(1).default('filmnama-api'),
  JWT_AUDIENCE: z.string().min(1).default('filmnama-admin'),
  CSRF_SECRET: z.string().min(32),
  ALLOWED_ORIGINS: z.string().min(1),
  NEXT_REVALIDATE_URL: z.string().url(),
  NEXT_REVALIDATE_SECRET: z.string().min(32),
  TRUST_PROXY: z.string().default(''),
  ADMIN_IP_ALLOWLIST: z.string().default(''),
  SWAGGER_ENABLED: z.enum(['true', 'false']).default('false'),
  MEDIA_DIR: z.string().min(1).max(500).default('uploads'),
});

@Injectable()
export class Config {
  readonly value = schema.parse(process.env);
  readonly production = this.value.NODE_ENV === 'production';
  readonly localPostgresOnly?: boolean = this.value.LOCAL_POSTGRES_ONLY === 'true' && this.value.NODE_ENV === 'development';
  readonly origins = this.value.ALLOWED_ORIGINS.split(',').map((origin) => {
    const url = new URL(origin.trim());
    if (url.origin !== origin.trim() || !['http:', 'https:'].includes(url.protocol) || (this.production && url.protocol !== 'https:')) throw new Error('Invalid allowed origin');
    return url.origin;
  });
  readonly proxies = this.value.TRUST_PROXY.split(',').map((x) => x.trim()).filter(Boolean);
  readonly adminIps = this.value.ADMIN_IP_ALLOWLIST.split(',').map((x) => x.trim()).filter(Boolean);
  readonly mediaDir = resolveMediaDir(this.value.MEDIA_DIR);
  constructor() {
    if (this.value.LOCAL_POSTGRES_ONLY === 'true' && !this.localPostgresOnly) throw new Error('LOCAL_POSTGRES_ONLY requires development');
    const webhook = new URL(this.value.NEXT_REVALIDATE_URL);
    if (!['http:', 'https:'].includes(webhook.protocol) || webhook.username || webhook.password || webhook.hash || (this.production && webhook.protocol !== 'https:')) throw new Error('Invalid revalidation URL');
    if (this.value.JWT_SECRET === this.value.CSRF_SECRET || this.value.JWT_SECRET === this.value.NEXT_REVALIDATE_SECRET || this.value.CSRF_SECRET === this.value.NEXT_REVALIDATE_SECRET) throw new Error('Secrets must be distinct');
    if (!/^postgres(?:ql)?:/.test(this.value.DATABASE_URL) || !/^rediss?:/.test(this.value.REDIS_URL)) throw new Error('Invalid infrastructure URL');
  }
}

export function backendDir(): string {
  // All npm scripts run with cwd=backend; MEDIA_DIR is resolved against it so
  // the default `uploads` becomes `<backend>/uploads`.
  return resolve(process.cwd());
}

export function resolveMediaDir(raw: string): string {
  const base = backendDir();
  const resolved = resolve(base, raw);
  if (resolved !== base && !resolved.startsWith(base + sep)) throw new Error('Invalid media directory');
  return resolved;
}
