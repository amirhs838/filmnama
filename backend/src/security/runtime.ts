import { ForbiddenException, UnsupportedMediaTypeException } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { json, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { Logger } from 'nestjs-pino';
import { Config } from '../infrastructure/config';
import { ipMatcher, validateRuntimeConfig } from './config';
import { isPublicLeadsPath, isPublicSearchPath, RateLimiter } from './rate-limiter';

export function configureApp(app: NestExpressApplication) {
  const config = app.get(Config);
  validateRuntimeConfig(config);
  const allowedIp = ipMatcher(config.adminIps);
  const limiter = app.get(RateLimiter);
  const server = app.getHttpAdapter().getInstance() as { set: (key: string, value: unknown) => void; disable: (key: string) => void };
  server.set('trust proxy', config.proxies.length ? ipMatcher(config.proxies) : false);
  server.disable('x-powered-by');
  server.disable('etag');
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api/v1');
  app.use((req: Request, res: Response, next: NextFunction) => {
    req.id = randomUUID();
    res.setHeader('X-Request-Id', req.id);
    let path: string;
    try { path = decodeURIComponent(req.path); } catch { path = '/auth'; }
    if (/(?:^|\/)(?:admin|auth)(?:\/|$)/i.test(path) || isPublicLeadsPath(req.path) || isPublicSearchPath(req.path) || /^\/api\/v1\/public\/(?:posts|instructors|categories|tags|albums|works|settings|search)(?:\/|$)/i.test(req.path)) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    }
    next();
  });
  app.use(helmet({ strictTransportSecurity: config.production ? { maxAge: 31536000, includeSubDomains: true } : false }));
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (config.production && !req.secure) return next(new ForbiddenException());
    if (config.adminIps.length && /(?:^|\/)(?:admin|auth)(?:\/|$)/i.test(req.path) && !allowedIp(req.ip ?? '')) return next(new ForbiddenException());
    if (req.headers.origin !== undefined && !config.origins.includes(req.headers.origin)) return next(new ForbiddenException());
    next();
  });
  app.use((req: Request, res: Response, next: NextFunction) => { void limiter.check(req, res).then(() => next(), next); });
  app.enableCors({
    origin: config.origins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
    maxAge: 600,
  });
  app.use(cookieParser());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    // JSON-only mutating guard. The single exemption is the binary upload
    // endpoint, which must be multipart/form-data; every other mutating route
    // (including POST /admin/media metadata) stays strict JSON.
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const isUpload = req.method === 'POST' && req.path === '/api/v1/admin/media/upload';
      if (isUpload) {
        if (!req.is('multipart/form-data')) return next(new UnsupportedMediaTypeException());
        return next();
      }
      if (!req.is('application/json')) return next(new UnsupportedMediaTypeException());
    }
    next();
  });
  const authJson = json({ limit: '4kb', strict: true, inflate: false });
  const publicJson = json({ limit: '128kb', strict: true, inflate: false });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const parser = /^\/api\/v1\/auth(?:\/|$)/i.test(req.path) ? authJson : publicJson;
    parser(req, res, next);
  });
  if (config.value.SWAGGER_ENABLED === 'true') {
    const options = new DocumentBuilder().setTitle('Filmnama API').setVersion('1').addBearerAuth().addCookieAuth('refresh').build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, options));
  }
  return app;
}
