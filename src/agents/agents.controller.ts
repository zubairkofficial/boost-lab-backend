import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { AgentDto } from './agent-dto/agent.dto';
import { AgentsService } from './agents.service';

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
