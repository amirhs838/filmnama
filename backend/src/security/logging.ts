import { randomUUID } from 'node:crypto';
import { IncomingMessage } from 'node:http';
import { Params } from 'nestjs-pino';

export const loggingOptions: Params = {
  forRoutes: ['{*path}'],
  pinoHttp: {
    genReqId: (req, res) => {
      const id = typeof req.id === 'string' ? req.id : randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    redact: {
      paths: ['req.headers', 'req.body', 'req.cookies', 'req.query', 'res.headers', 'body', 'headers', 'cookies', 'authorization', 'password', 'passwordHash', 'secret', 'token', 'accessToken', 'refresh', 'csrf', 'csrfToken', '*.password', '*.passwordHash', '*.secret', '*.token', '*.accessToken', '*.refresh', '*.csrf', '*.csrfToken'],
      remove: true,
    },
    wrapSerializers: false,
    serializers: {
      req: (req: IncomingMessage & { id?: string }) => ({ id: req.id, method: req.method }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      err: () => ({ message: 'Request failed' }),
    },
    customSuccessMessage: () => 'Request completed',
    customErrorMessage: () => 'Request failed',
  },
};
