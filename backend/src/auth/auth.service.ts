import { Injectable, UnauthorizedException } from '@nestjs/common';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { PinoLogger } from 'nestjs-pino';
import { Config } from '../infrastructure/config';
import { hash, randomToken } from '../common/validation';
import { AuthRepository } from './auth.repository';

export const passwordOptions = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 };
@Injectable()
export class AuthService {
  private readonly dummy = argon2.hash(randomToken(), passwordOptions);
  constructor(private readonly repo: AuthRepository, private readonly config: Config, private readonly logger: PinoLogger) {}
  private access(userId: string, sessionId: string) {
    return jwt.sign({ sid: sessionId }, this.config.value.JWT_SECRET, { algorithm: 'HS256', subject: userId, issuer: this.config.value.JWT_ISSUER, audience: this.config.value.JWT_AUDIENCE, expiresIn: '15m' });
  }
  async login(email: string, password: string) {
    const user = await this.repo.findUser(email);
    let valid = false;
    try { valid = await argon2.verify(user?.passwordHash ?? await this.dummy, password); }
    catch { this.logger.error({ event: 'password_verification_failed' }, 'Authentication verification failed'); }
    if (!valid || !user || !user.active || user.deletedAt || (user.lockedUntil && user.lockedUntil > new Date())) {
      this.logger.warn({ event: 'login_failed' }, 'Authentication denied');
      await this.repo.failure(user?.id);
      throw new UnauthorizedException('Invalid credentials');
    }
    const refresh = randomToken(); const csrf = randomToken();
    const result = await this.repo.login(user.id, user.passwordHash, { userId: user.id, familyId: randomUUID(), tokenHash: hash(refresh), csrfHash: hash(csrf), expiresAt: new Date(Date.now() + 7 * 86400000) });
    return { accessToken: this.access(user.id, result.session.id), refresh, csrf, expiresIn: 900, role: result.user.role, expiresAt: result.session.expiresAt };
  }
  async rotate(token: string, oldCsrf: string) {
    const refresh = randomToken(); const csrf = randomToken();
    const result = await this.repo.rotate(token, oldCsrf, { tokenHash: hash(refresh), csrfHash: hash(csrf) });
    if (!result) throw new UnauthorizedException();
    return { accessToken: this.access(result.user.id, result.session.id), refresh, csrf, expiresIn: 900, role: result.user.role, expiresAt: result.session.expiresAt };
  }
  async authenticate(token: string) {
    let payload: jwt.JwtPayload;
    try {
      const decoded = jwt.verify(token, this.config.value.JWT_SECRET, { algorithms: ['HS256'], issuer: this.config.value.JWT_ISSUER, audience: this.config.value.JWT_AUDIENCE, maxAge: '15m' });
      if (typeof decoded === 'string' || typeof decoded.sub !== 'string' || typeof decoded.sid !== 'string' || typeof decoded.exp !== 'number') throw new Error();
      payload = decoded;
    } catch { throw new UnauthorizedException(); }
    const session = await this.repo.liveSession(payload.sid as string, payload.sub!);
    if (!session) throw new UnauthorizedException();
    return { id: session.user.id, role: session.user.role, sessionId: session.id, csrfHash: session.csrfHash };
  }
  logout(token: string, csrf: string) { return this.repo.logout(token, csrf); }
  changeUser(actor: string, id: string, role: 'SUPER_ADMIN' | 'CONTENT_MANAGER' | 'BLOG_EDITOR', active: boolean) { return this.repo.changeUser(actor, id, role, active); }
}
