import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { Config } from './infrastructure/config';
import { loadConfig } from './security/config';
import { configureApp } from './security/runtime';

// Canonical NestJS entrypoint: boots on import and listens (per the official
// "NestJS on Vercel" guide, the entry keeps the conventional bootstrap shape
// so the platform can serve it as a single function). `node dist/src/main.js`
// uses it locally. Tests import createApp from ./create-app and never import
// this module, so there are no side effects there.
async function bootstrap() {
  loadConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    logger: false,
    abortOnError: false,
  });
  configureApp(app);
  app.enableShutdownHooks();
  await app.init();
  const config = app.get(Config);
  await app.listen(config.value.PORT, config.localPostgresOnly ? '127.0.0.1' : '0.0.0.0');
}

void bootstrap().catch(() => {
  process.stderr.write('Server startup failed\n');
  process.exitCode = 1;
});
