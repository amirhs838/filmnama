import { Config } from './infrastructure/config';
import { createApp } from './create-app';

// Local and persistent-host entrypoint: boots and listens. Tests import
// createApp from ./create-app so they never trigger this side effect.
async function bootstrap() {
  const app = await createApp();
  const config = app.get(Config);
  await app.listen(config.value.PORT, config.localPostgresOnly ? '127.0.0.1' : '0.0.0.0');
}

if (require.main === module) {
  void bootstrap().catch(() => {
    process.stderr.write('Server startup failed\n');
    process.exitCode = 1;
  });
}
