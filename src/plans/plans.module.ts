import { Module } from '@nestjs/common';
import { PlansService } from './plans.service';
import { PlansController } from './plans.controller';
import { Plan } from './../models/plans.model';
import { SequelizeModule } from '@nestjs/sequelize';

@Module({
  imports: [SequelizeModule.forFeature([Plan])],
  providers: [PlansService],
  controllers: [PlansController]
})
export class PlansModule {}
