import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Sequelize } from 'sequelize-typescript';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: 'http://localhost:5173',
    credentials: true,
  });

  const sequelize = app.get(Sequelize);
  await sequelize.sync({ alter: true });

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
