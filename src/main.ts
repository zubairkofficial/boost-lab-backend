import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Sequelize } from 'sequelize-typescript';
import { seedAdmin } from './auth/Seeder/admin-seeder';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const sequelize = app.get(Sequelize);
  await sequelize.sync({ alter: true });

  await seedAdmin(); // Now it works!

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
