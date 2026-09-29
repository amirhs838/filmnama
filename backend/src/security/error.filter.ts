import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

const messages: Record<number, string> = {
  400: 'Invalid request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not found',
  405: 'Method not allowed', 409: 'Conflict', 413: 'Payload too large',
  415: 'Unsupported media type', 429: 'Too many requests', 503: 'Service unavailable',
};

@Catch()
@Injectable()
export class ErrorFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}
  catch(error: unknown, host: ArgumentsHost) {
    const req = host.switchToHttp().getRequest<Request>();
    const res = host.switchToHttp().getResponse<Response>();
    let status = 500;
    if (error instanceof HttpException) status = error.getStatus();
    else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002' || error.code === 'P2003') status = 409;
      if (error.code === 'P2025') status = 404;
      if (error.code === 'P2024' || error.code === 'P2034') status = 503;
    } else if (error && typeof error === 'object' && 'type' in error) {
      if (error.type === 'entity.too.large') status = 413;
      if (error.type === 'entity.parse.failed' || error.type === 'request.aborted' || error.type === 'request.size.invalid') status = 400;
      if (error.type === 'encoding.unsupported' || error.type === 'charset.unsupported') status = 415;
    }
    if (status < 400 || status > 599) status = 500;
    if (status >= 500) this.logger.error({ event: 'request_failed', statusCode: status, requestId: req.id }, 'Request failed');
    if (res.headersSent) return;
    res.setHeader('Cache-Control', 'no-store');
    res.status(status).json({ statusCode: status, message: messages[status] ?? 'Internal server error', requestId: req.id });
  }
}
