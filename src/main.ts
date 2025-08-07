import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Sequelize } from 'sequelize-typescript';
import { seedAdmin } from './auth/Seeder/admin-seeder';
import * as bodyParser from 'body-parser';
import { RawBodyMiddleware } from './middleware/raw-body.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(
    '/api/v1/plans/webhook',
    bodyParser.raw({ type: 'application/json' }),
  );
  app.enableCors();
  app.setGlobalPrefix('api/v1');

  const sequelize = app.get(Sequelize);
  await sequelize.sync({ alter: true });

  await seedAdmin();

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
