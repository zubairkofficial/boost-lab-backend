import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule } from '@nestjs/config';

import { Stage3Service } from './stage3.service';
import { Stage3Controller } from './stage3.controller';

import { Stage3Chat } from '../../models/stage3Chat.model';
import { User } from '../../models/user.model';
import { MarketingStrategy } from 'src/models/marketing-strategy.model';

@Module({
  imports: [
    ConfigModule,
    SequelizeModule.forFeature([Stage3Chat, User, MarketingStrategy]),
  ],
  providers: [Stage3Service],
  controllers: [Stage3Controller],
  exports: [Stage3Service],
})
export class Stage3Module {}
