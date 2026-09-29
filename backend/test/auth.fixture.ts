import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { Role } from '@prisma/client';
import { AuthModule } from '../src/auth/auth.module';
import { AuthRepository } from '../src/auth/auth.repository';
import { hash } from '../src/common/validation';
import { Config } from '../src/infrastructure/config';
import { Database, InfrastructureModule, RedisStore } from '../src/infrastructure/infrastructure.module';
import { HealthModule } from '../src/health/health.module';
import { SecurityModule } from '../src/security/security.module';
import { configureApp } from '../src/security/runtime';

export const origin = 'https://admin.example.test';
export function testConfig(overrides: Partial<Config['value']> = {}): Config {
  const value = { NODE_ENV: 'test' as const, PORT: 4000, DATABASE_URL: 'postgresql://localhost/test', REDIS_URL: 'redis://localhost', JWT_SECRET: 'j'.repeat(32), CSRF_SECRET: 'c'.repeat(32), JWT_ISSUER: 'test', JWT_AUDIENCE: 'test-admin', ALLOWED_ORIGINS: origin, NEXT_REVALIDATE_URL: 'https://web.example.test/revalidate', NEXT_REVALIDATE_SECRET: 'r'.repeat(32), TRUST_PROXY: '', ADMIN_IP_ALLOWLIST: '', SWAGGER_ENABLED: 'false' as const, ...overrides };
  return { production: value.NODE_ENV === 'production', origins: [origin], proxies: value.TRUST_PROXY.split(',').map((x) => x.trim()).filter(Boolean), adminIps: value.ADMIN_IP_ALLOWLIST.split(',').map((x) => x.trim()).filter(Boolean), value } as Config;
}
export const cookies = (response: { headers: Record<string, unknown> }) => response.headers['set-cookie'] as string[];

type Session = { id: string; userId: string; familyId: string; tokenHash: string; csrfHash: string; expiresAt: Date; consumedAt?: Date; revokedAt?: Date };
export async function fixture(options: { config?: Config; role?: Role } = {}) {
  const config = options.config ?? testConfig();
  const role: Role = options.role ?? 'SUPER_ADMIN';
  const user = { id: 'cmf0000000000000000000001', email: 'admin@example.test', passwordHash: await argon2.hash('correct-password'), role, active: true, deletedAt: null, lockedUntil: null };
  const sessions: Session[] = [];
  let failures = 0;
  const repo = {
    findUser: async (email: string) => email === user.email ? user : null,
    failure: async () => { failures++; },
    login: async (_id: string, _passwordHash: string, data: Omit<Session, 'id'>) => {
      const session = { ...data, id: randomUUID() };
      sessions.push(session);
      return { user, session };
    },
    liveSession: async (id: string, userId: string) => {
      const session = sessions.find((s) => s.id === id && s.userId === userId && !s.revokedAt && !s.consumedAt && s.expiresAt > new Date());
      return session && user.active ? { ...session, user } : null;
    },
    rotate: async (token: string, csrf: string, replacement: Pick<Session, 'tokenHash' | 'csrfHash'>) => {
      const current = sessions.find((s) => s.tokenHash === hash(token));
      if (!current || current.csrfHash !== hash(csrf)) return null;
      if (current.consumedAt || current.revokedAt) {
        sessions.filter((s) => s.familyId === current.familyId).forEach((s) => { s.revokedAt = new Date(); });
        return null;
      }
      if (!user.active || current.expiresAt <= new Date()) return null;
      current.consumedAt = new Date();
      const session = { ...current, ...replacement, id: randomUUID(), consumedAt: undefined };
      sessions.push(session);
      return { user, session };
    },
    logout: async (token: string, csrf: string) => {
      const session = sessions.find((s) => s.tokenHash === hash(token) && s.csrfHash === hash(csrf));
      if (!session) throw new Error('Invalid session');
      sessions.filter((s) => s.familyId === session.familyId).forEach((s) => { s.revokedAt = new Date(); });
    },
    changeUser: async (_actor: string, id: string, role: Role, active: boolean) => ({ id, role, active }),
  };
  const redis = { client: { eval: async () => [0, 0] } };
  const module = await Test.createTestingModule({ imports: [InfrastructureModule, SecurityModule, AuthModule, HealthModule] })
    .overrideProvider(Config).useValue(config)
    .overrideProvider(Database).useValue({})
    .overrideProvider(RedisStore).useValue(redis)
    .overrideProvider(AuthRepository).useValue(repo)
    .compile();
  const app = module.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: false });
  configureApp(app);
  await app.init();
  return { app, config, user, sessions, redis, repo, failures: () => failures };
}
