import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { config } from './config';
import { json, urlencoded } from 'express';
import { ValidationPipe } from '@nestjs/common';

const origins: Record<string, string[]> = {
  production: [''],
  development: [
    'http://192.168.0.198:5173',
    'http://192.168.0.198:5174',
    'http://192.168.18.2:5173',
    'http://192.168.18.2:5174',
    'http://localhost:5173',
    'http://localhost:5174',
  ],
  test: ['http://localhost:3000'],
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set global API prefix
  app.setGlobalPrefix('api');

  // Body size limits; store raw body for Stripe webhook signature verification
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.use(
    json({
      limit: '50mb',
      verify: (req: any, _res: any, buf: Buffer) => {
        if (req.originalUrl === '/api/webhooks/stripe') {
          req.rawBody = buf;
        }
      },
    }),
  );
  app.use(urlencoded({ extended: false, limit: '50mb' }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS
  app.enableCors({
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    origin: origins[config.env.name] ?? false,
  });

  // Listen on all interfaces (0.0.0.0) to allow mobile access
  await app.listen(config.server.port, '0.0.0.0');
}

void bootstrap();
