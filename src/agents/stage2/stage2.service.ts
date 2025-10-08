import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { AgentDto } from './stage2.dto';
import { SYSTEM_PROMPT } from './stage2-prompt';
import { InjectModel } from '@nestjs/sequelize';
import { MarketingStrategy } from '../../models/marketing-strategy.model';
import { User } from '../../models/user.model';
import { StrategyChat } from '../../models/stage2Chat.model';

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
    @InjectModel(StrategyChat)
    private strategyChatModel: typeof StrategyChat,
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

    const user = await this.userModel.findOne({ where: { email } });
    if (!user) {
      throw new BadRequestException('User not found for this email');
    }

    const { data: messageData, error } = await this.supabase
      .from('messages')
      .select('html_report')
      .eq('email', email)
      .single();

    if (error || !messageData) {
      throw new BadRequestException('No identity report found for this email');
    }

    const identityReport = messageData.html_report;

    const user_message = audit_answers?.length
      ? audit_answers.join('\n')
      : 'No additional user input provided.';

    await this.strategyChatModel.create({
      userId: user.id,
      sender: 'user',
      message: user_message,
    });

    const history = await this.strategyChatModel.findAll({
      where: { userId: user.id },
      order: [['createdAt', 'ASC']],
    });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Identity Report:\n${identityReport}` },
      ...history.map(
        (msg) =>
          ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.message,
          }) as OpenAI.Chat.ChatCompletionMessageParam,
      ),
    ];

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.5,
      messages,
    });

    const strategyOutput = response.choices?.[0]?.message?.content || '';
    await this.strategyChatModel.create({
      userId: user.id,
      sender: 'bot',
      message: strategyOutput,
    });

    if (strategyOutput.includes('Stage 3: Content & Branding')) {
      const existing = await this.strategyModel.findOne({
        where: { userId: user.id },
      });

      await this.strategyModel.upsert({
        userId: user.id,
        strategyText: strategyOutput,
      });
    }

    return {
      success: true,
      message: 'Response generated successfully.',
      strategy: strategyOutput,
    };
  }

  async getChatHistory(email: string) {
    const user = await this.userModel.findOne({ where: { email } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const history = await this.strategyChatModel.findAll({
      where: { userId: user.id },
      order: [['createdAt', 'ASC']],
    });

    const cleanedHistory = history.map((msg) => ({
      id: msg.id,
      sender: msg.sender as 'user' | 'bot',
      message: msg.message,
      createdAt: msg.createdAt,
    }));

    return {
      success: true,
      email,
      history: cleanedHistory,
    };
  }
}
