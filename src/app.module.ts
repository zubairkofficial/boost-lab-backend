import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { User } from './models/user.model';
import { StripePaymentModule } from './stripe-payment/stripe-payment.module';
import { PlansModule } from './plans/plans.module';
import { TestResultModule } from './test-result/test-result.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: false,
    }),
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        dialect: configService.get<'postgres'>('DB_DIALECT'),
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        autoLoadModels: true,
        synchronize: true,
        models: [User],
      }),
    }),
    AuthModule,
    StripePaymentModule,
    PlansModule,
    TestResultModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
