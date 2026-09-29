import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { Config } from './infrastructure/config';
import { createApp } from './create-app';

// Canonical NestJS entrypoint (see Vercel "NestJS on Vercel"): the module
// boots on import and listens; Vercel uses it to serve the app as a single
// function, `node dist/src/main.js` uses it locally. Tests import createApp
// from ./create-app so they never trigger this side effect.
// NOTE: @nestjs/core is imported (and used) here on purpose — Vercel detects
// the NestJS entrypoint by a direct Nest import in this file.
async function bootstrap() {
  const app = await createApp(() =>
    NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false, logger: false, abortOnError: false }),
  );
  const config = app.get(Config);
  await app.listen(config.value.PORT, config.localPostgresOnly ? '127.0.0.1' : '0.0.0.0');
}

void bootstrap().catch(() => {
  process.stderr.write('Server startup failed\n');
  process.exitCode = 1;
});
