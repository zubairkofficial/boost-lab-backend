import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PlansModule } from './plans/plans.module';
import { Plan } from './models/plans.model';
import { Subscription } from './models/subscription.model';
import { QuizModule } from './quiz/quiz.module';
import { User } from './models/user.model';
import { ScheduleModule } from '@nestjs/schedule';
import { AgentsModule } from './agents/stage2/stage2.module';
import { Stage3Controller } from './agents/stage3/stage3.controller';
import { Stage3Module } from './agents/stage3/stage3.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
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
        models: [User, Plan, Subscription],
      }),
    }),

    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        transport: {
          host: configService.get<string>('SMTP_HOST'),
          port: configService.get<number>('SMTP_PORT'),
          auth: {
            user: configService.get<string>('EMAIL_USER'),
            pass: configService.get<string>('EMAIL_PASS'),
          },
        },
        defaults: {
          from: '"BOOSTLAB" <no-reply@boostlab.com>',
        },
        template: {
          dir: join(__dirname, 'templates'),
          adapter: new HandlebarsAdapter(),
          options: { strict: true },
        },
      }),
    }),

    PlansModule,
    QuizModule,
    ScheduleModule.forRoot(),
    AgentsModule,
    Stage3Module,
  ],
  controllers: [AppController, Stage3Controller],
  providers: [AppService],
})
export class AppModule {}
