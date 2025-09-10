import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AgentDto } from './stage2.dto';
import { AgentsService } from './stage2.service';
import { MarketingStrategy } from '../../models/marketing-strategy.model';

@Controller('agent')
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    @InjectModel(MarketingStrategy)
    private readonly strategyModel: typeof MarketingStrategy,
  ) {}

  @Post('strategy')
  async generateStrategy(@Body() dto: AgentDto) {
    return this.agentsService.generateStrategy(dto);
  }

  @Get('chat/:email')
  async getChat(@Param('email') email: string) {
    return this.agentsService.getChatHistory(email);
  }

  @Get('strategy/:userId')
  async getStrategy(@Param('userId') userId: number) {
    const strategy = await this.strategyModel.findOne({ where: { userId } });
    if (!strategy) {
      return { success: false, strategy: null };
    }
    return { success: true, strategy: strategy.strategyText };
  }
}
