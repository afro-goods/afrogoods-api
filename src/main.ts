import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { config } from './config';
import { json, urlencoded } from 'express';
import { ValidationPipe } from '@nestjs/common';

const origins: Record<string, string[]> = {
  production: [''],
  development: ['http://localhost:3000', 'http://localhost:5173'],
  test: ['http://localhost:3000'],
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Body size limits
  app.use(json({ limit: '50mb' }));
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

  await app.listen(config.server.port);
}

void bootstrap();
