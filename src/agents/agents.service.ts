import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { AgentDto } from './agent-dto/agent.dto';
import { stage2SystemPrompt } from './system-prompts/stage2-prompt';
import { InjectModel } from '@nestjs/sequelize';
import { MarketingStrategy } from '../models/marketing-strategy.model';
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
    const { email, audit_answers } = dto;

    const { data: messageData, error } = await this.supabase
      .from('messages')
      .select('html_report')
      .eq('email', email)
      .single();

    if (error || !messageData) {
      throw new BadRequestException('No identity report found for this email');
    }

    const identityReport = messageData.html_report;
    const auditFormatted = audit_answers
      .map((ans, idx) => `Q${idx + 1}: ${ans}`)
      .join('\n');

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.5,
      messages: [
        { role: 'system', content: stage2SystemPrompt },
        { role: 'user', content: `Identity Report:\n${identityReport}` },
        { role: 'user', content: `Audit Answers:\n${auditFormatted}` },
      ],
    });

    const strategyOutput = response.choices?.[0]?.message?.content || '';
    const user = await this.userModel.findOne({ where: { email } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const strategy = await this.strategyModel.create({
      userId: user.id,
      auditAnswers: audit_answers,
      strategyText: strategyOutput,
    });
    const strategyData = strategy.toJSON();
    return {
      message: 'Marketing strategy generated and saved successfully.',
      strategy: strategyData.strategyText,
    };
  }
}
