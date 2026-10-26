import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join, extname } from 'node:path';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';

export async function createApplication() {
  const production = process.env.NODE_ENV === 'production';
  if (production && !process.env.DATABASE_URL) throw new Error('DATABASE_URL is required in production');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableShutdownHooks();
  if (production) {
    app.setGlobalPrefix('api');
    const frontend = join(__dirname, '../../frontend/dist');
    app.useStaticAssets(frontend);
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method === 'GET' && req.path !== '/api' && !req.path.startsWith('/api/') && !extname(req.path)) {
        res.sendFile(join(frontend, 'index.html'));
      } else {
        next();
      }
    });
  }
  return app;
}

async function bootstrap() {
  const app = await createApplication();
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535');
  await app.listen(port, process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
}

if (require.main === module) bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
