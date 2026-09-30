import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { loadConfig } from './security/config';
import { configureApp } from './security/runtime';

// Standard NestJS entrypoint (zero-config deploy): create the app and listen.
// Tests import createApp from ./create-app and never import this module,
// so there are no side effects there.
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
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap().catch((error: unknown) => {
  const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`Server startup failed: ${detail}\n`);
  process.exitCode = 1;
});
