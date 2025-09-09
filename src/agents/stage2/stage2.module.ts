import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { AgentsService } from './stage2.service';
import { AgentsController } from './stage2.controller';
import { MarketingStrategy } from '../../models/marketing-strategy.model';
import { User } from '../../models/user.model';
import { StrategyChat } from 'src/models/stage2Chat.model';

@Module({
  imports: [
    ConfigModule,
    SequelizeModule.forFeature([MarketingStrategy, User, StrategyChat]),
  ],
  controllers: [AgentsController],
  providers: [AgentsService],
})
export class AgentsModule {}
