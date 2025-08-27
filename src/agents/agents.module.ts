import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { MarketingStrategy } from '../models/marketing-strategy.model';
import { User } from '../models/user.model'; 

@Module({
  imports: [
    ConfigModule,
    SequelizeModule.forFeature([MarketingStrategy, User]), 
  ],
  controllers: [AgentsController],
  providers: [AgentsService],
})
export class AgentsModule {}
