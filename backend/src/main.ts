import { Config } from './infrastructure/config';
import { createApp } from './create-app';

// Canonical NestJS entrypoint (see Vercel "NestJS on Vercel"): the module
// boots on import and listens; Vercel uses it to serve the app as a single
// function, `node dist/src/main.js` uses it locally. Tests import createApp
// from ./create-app so they never trigger this side effect.
async function bootstrap() {
  const app = await createApp();
  const config = app.get(Config);
  await app.listen(config.value.PORT, config.localPostgresOnly ? '127.0.0.1' : '0.0.0.0');
}

void bootstrap().catch(() => {
  process.stderr.write('Server startup failed\n');
  process.exitCode = 1;
});
