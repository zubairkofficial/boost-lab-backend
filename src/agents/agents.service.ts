import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { AgentDto } from './agent-dto/agent.dto';
import { SYSTEM_PROMPT } from '../agents/system-prompts/stage2-prompt';
import { InjectModel } from '@nestjs/sequelize';
import { MarketingStrategy } from '../models/marketing-strategy-model/marketing-strategy.model';
import { User } from '../models/user.model';

@Injectable()
export class AgentsService {
  private supabase: SupabaseClient;
  private openai: OpenAI;

  constructor(
    private config: ConfigService,
    @InjectModel(MarketingStrategy)
    private strategyModel: typeof MarketingStrategy,
    @InjectModel(User)
    private userModel: typeof User,
  ) {
    this.supabase = createClient(
      this.config.get<string>('SUPABASE_URL')!,
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    this.openai = new OpenAI({
      apiKey: this.config.get<string>('OPENAI_API_KEY')!,
    });
  }

  async generateStrategy(dto: AgentDto) {

    const { data: messageData, error } = await this.supabase
      .from('messages')
      .select('html_report')
      .eq('email', dto.email)
      .single();

    if (error || !messageData) {
      throw new BadRequestException('No identity report found for this email');
    }

    const identityReport = messageData.html_report;
    const user_message = dto.audit_answers?.length
      ? dto.audit_answers.join('\n')
      : 'No additional user input provided.';

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.5,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Identity Report:\n${identityReport}` },
        { role: 'user', content: `User Input:\n${user_message}` },
      ],
    });

    const strategyOutput = response.choices?.[0]?.message?.content || '';

    return {
      message: 'Response generated successfully.',
      strategy: strategyOutput,
    };
  }
}
