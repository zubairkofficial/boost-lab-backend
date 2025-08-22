import { Controller, Post, Body } from '@nestjs/common';
import { AgentDto } from './agent-dto/agent.dto';
import { AgentsService } from './agents.service';

@Controller('agent')
export class AgentsController {
  constructor(private readonly agentService: AgentsService) {}

  @Post('strategy')
  generateStrategy(@Body() dto: AgentDto) {
    return this.agentService.generateStrategy(dto);
  }
}
