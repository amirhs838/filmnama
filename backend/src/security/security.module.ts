import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { ErrorFilter } from './error.filter';
import { loggingOptions } from './logging';
import { RateLimiter } from './rate-limiter';

@Module({
  imports: [LoggerModule.forRoot(loggingOptions)],
  providers: [RateLimiter, { provide: APP_FILTER, useClass: ErrorFilter }],
  exports: [RateLimiter],
})
export class SecurityModule {}
