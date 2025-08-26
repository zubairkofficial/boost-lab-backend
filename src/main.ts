import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Sequelize } from 'sequelize-typescript';
import * as bodyParser from 'body-parser';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  });

  app.use(
    '/api/v1/plans/webhook',
    bodyParser.raw({ type: 'application/json' }),
  );

  app.use(bodyParser.json());
  app.setGlobalPrefix('api/v1');
  const sequelize = app.get(Sequelize);
  await app.listen(process.env.PORT || 3000);
}
bootstrap();
