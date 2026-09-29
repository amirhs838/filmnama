import 'reflect-metadata';
import { Request, Response } from 'express';
import serverlessExpress from '@vendia/serverless-express';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/security/runtime';

/*
 * Vercel serverless entry: boots the Express app once per warm instance and
 * serves every /api/* route through it (see vercel.json rewrites).
 */
let cached: ReturnType<typeof serverlessExpress> | undefined;

async function handler() {
  if (!cached) {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      bodyParser: false,
      logger: false,
      abortOnError: false,
    });
    configureApp(app);
    app.enableShutdownHooks();
    await app.init();
    const express = app.getHttpAdapter().getInstance();
    cached = serverlessExpress({ app: express });
  }
  return cached;
}

export default async function (req: Request, res: Response) {
  const handle = await handler();
  return handle(req, res);
}
