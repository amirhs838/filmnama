import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { Config } from './infrastructure/config';
import { loadConfig } from './security/config';
import { configureApp } from './security/runtime';

export async function createApp(factory?: () => Promise<NestExpressApplication>) {
  let app: NestExpressApplication | undefined;
  try {
    if (!factory) loadConfig();
    app = factory ? await factory() : await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false, logger: false, abortOnError: false });
    configureApp(app);
    app.enableShutdownHooks();
    await app.init();
    return app;
  } catch (error) {
    if (app) await app.close().catch(() => undefined);
    throw new Error('Server initialization failed', { cause: error });
  }
}

export async function bootstrap() {
  const app = await createApp();
  const config = app.get(Config);
  await app.listen(config.value.PORT, config.localPostgresOnly ? '127.0.0.1' : '0.0.0.0');
  return app;
}
