import 'reflect-metadata';
// Direct @nestjs/core import: marks this file as the NestJS entrypoint for
// @vercel/nestjs detection (it scans entrypoint content for '@nestjs/core').
import '@nestjs/core';
import { Request, Response } from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';
import { createApp, bootstrap } from './create-app';

/*
 * Canonical NestJS entrypoint (local + Vercel).
 *
 * - Local (`node dist/src/main.js`): boots the app and listens (see below).
 * - Vercel (@vercel/nestjs, entrypoint src/main): the platform imports this
 *   module and calls the default export per request. There is no `listen()`
 *   on serverless — instead the initialized Express instance handles
 *   (req, res) directly. The app is created once per warm instance and
 *   reused across invocations.
 */
let cachedExpress: ((req: Request, res: Response) => void) | undefined;
let inflight: Promise<(req: Request, res: Response) => void> | undefined;

async function getExpressHandler(): Promise<(req: Request, res: Response) => void> {
  if (cachedExpress) return cachedExpress;
  if (!inflight) {
    inflight = createApp().then((app: NestExpressApplication) => {
      const express = app.getHttpAdapter().getInstance() as (req: Request, res: Response) => void;
      cachedExpress = express;
      return express;
    }).finally(() => { inflight = undefined; });
  }
  return inflight;
}

export default async function handler(req: Request, res: Response): Promise<void> {
  const express = await getExpressHandler();
  return express(req, res);
}

// Disable Vercel's default body parsing: the app registers its own
// express.json() parsers (with per-route limits) in configureApp.
export const config = { api: { bodyParser: false } };

// Local/dev only: listen on a TCP port. On Vercel (process.env.VERCEL is set)
// the platform invokes the default export instead — never listen().
if (!process.env.VERCEL) {
  void bootstrap().catch((error: unknown) => {
    const detail = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`Server startup failed: ${detail}\n`);
    process.exitCode = 1;
  });
}
