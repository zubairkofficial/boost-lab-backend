import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Plan } from '../models/plans.model';
import { Subscription } from '../models/subscription.model';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';

@Module({
  imports: [SequelizeModule.forFeature([Plan, Subscription])],
  controllers: [PlansController],
  providers: [PlansService],
})
export class PlansModule {}
