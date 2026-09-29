import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Role } from '@prisma/client';
import { Config } from '../infrastructure/config';
import { hash, safeEqual, signature } from '../common/validation';
import { AuthService } from './auth.service';
import { ipMatcher } from '../security/config';

export interface AuthRequest extends Request { user: { id: string; role: Role; sessionId: string; csrfHash: string } }
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
export function cookieNames(production: boolean) { return { refresh: production ? '__Host-refresh' : 'refresh', csrf: production ? '__Host-csrf' : 'csrf' }; }
export function cookie(req: Request, name: string): string { const cookies = req.cookies as Record<string, unknown> | undefined; return typeof cookies?.[name] === 'string' ? cookies[name] : ''; }
@Injectable()
export class AdminIpGuard implements CanActivate {
  private readonly allowed: (ip: string) => boolean;
  constructor(private readonly config: Config) { this.allowed = ipMatcher(config.adminIps); }
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    if (this.config.adminIps.length && !this.allowed(req.ip ?? '')) throw new ForbiddenException();
    return true;
  }
}
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(private readonly config: Config) {}
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    if (!this.config.origins.includes(req.headers.origin ?? '')) throw new ForbiddenException('Origin denied');
    return true;
  }
}
@Injectable()
export class LoginCsrfGuard implements CanActivate {
  constructor(private readonly config: Config) {}
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const token = cookie(req, cookieNames(this.config.production).csrf);
    const [nonce, timestamp, mac, extra] = token.split('.');
    const age = Date.now() - Number(timestamp);
    if (!nonce || !/^[A-Za-z0-9_-]{43}$/.test(nonce) || !timestamp || !/^\d{13}$/.test(timestamp) || !mac || !/^[a-f0-9]{64}$/.test(mac) || extra !== undefined || !Number.isFinite(age) || age < 0 || age > 600000 || !safeEqual(token, req.get('x-csrf-token') ?? '') || !safeEqual(mac, signature(this.config.value.CSRF_SECRET, `${nonce}.${timestamp}`))) throw new ForbiddenException('Invalid CSRF token');
    return true;
  }
}
@Injectable()
export class SessionCsrfGuard implements CanActivate {
  constructor(private readonly config: Config) {}
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const token = cookie(req, cookieNames(this.config.production).csrf);
    if (!/^[A-Za-z0-9_-]{43}$/.test(token) || !safeEqual(token, req.get('x-csrf-token') ?? '')) throw new ForbiddenException('Invalid CSRF token');
    if (!/^[A-Za-z0-9_-]{43}$/.test(cookie(req, cookieNames(this.config.production).refresh))) throw new UnauthorizedException();
    return true;
  }
}
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(private readonly auth: AuthService, private readonly reflector: Reflector, private readonly config: Config) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    if (this.config.adminIps.length && !ipMatcher(this.config.adminIps)(req.ip ?? '')) throw new ForbiddenException();
    const bearer = req.get('authorization');
    if (!bearer?.startsWith('Bearer ')) throw new UnauthorizedException();
    req.user = await this.auth.authenticate(bearer.slice(7));
    const roles = this.reflector.getAllAndOverride<Role[]>('roles', [context.getHandler(), context.getClass()]) ?? [];
    if (!roles.includes(req.user.role)) throw new ForbiddenException();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (!this.config.origins.includes(req.get('origin') ?? '')) throw new ForbiddenException('Origin denied');
      const csrf = req.get('x-csrf-token') ?? '';
      if (!csrf || !safeEqual(hash(csrf), req.user.csrfHash)) throw new ForbiddenException('Invalid CSRF token');
    }
    return true;
  }
}
