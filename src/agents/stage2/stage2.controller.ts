import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { AgentDto } from './stage2.dto';
import { AgentsService } from './stage2.service';

@Controller('agent')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post('strategy')
  async generateStrategy(@Body() dto: AgentDto) {
    return this.agentsService.generateStrategy(dto);
  }

  @Get('chat/:email')
  async getChat(@Param('email') email: string) {
    return this.agentsService.getChatHistory(email);
  }
}
