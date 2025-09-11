import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule } from '@nestjs/config';
import { Plan } from '../models/plans.model';
import { Subscription } from '../models/subscription.model';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { ScheduleModule } from '@nestjs/schedule';
import { QuizService } from 'src/quiz/quiz.service';
import { JwtModule } from '@nestjs/jwt';
import { User } from 'src/models/user.model';

@Module({
  imports: [
    ConfigModule,
    SequelizeModule.forFeature([Plan, Subscription, User]),
    JwtModule.register({}),
    ScheduleModule.forRoot(),
  ],
  controllers: [PlansController],
  providers: [PlansService, QuizService],

  exports: [PlansService],
})
export class PlansModule {}
