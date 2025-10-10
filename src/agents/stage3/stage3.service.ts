import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { Stage3Chat } from '../../models/stage3Chat.model';
import { ChatDto } from './stage3.dto';
import { STAGE3_SYSTEM_PROMPT } from './stage3-prompt';
import { User } from '../../models/user.model';
import { MarketingStrategy } from '../../models/marketing-strategy.model';

@Injectable()
export class Stage3Service {
  private openai: OpenAI;

  constructor(
    private config: ConfigService,
    @InjectModel(Stage3Chat) private stage3ChatModel: typeof Stage3Chat,
    @InjectModel(User) private userModel: typeof User,
    @InjectModel(MarketingStrategy)
    private strategyModel: typeof MarketingStrategy,
  ) {
    this.openai = new OpenAI({
      apiKey: this.config.get<string>('OPENAI_API_KEY'),
    });
  }

  async generateResponse(userId: number, chatDto: ChatDto): Promise<string> {
    const user = await this.userModel.findByPk(userId);
    console.log(user);
    if (!user) throw new BadRequestException('User not found');
    const stage2 = await this.strategyModel.findOne({
      where: { userId },
      attributes: ['strategyText'],
      raw: true,
    });

    if (!stage2 || !stage2.strategyText) {
      throw new BadRequestException(
        'No Stage 2 strategy found. Please complete Stage 2 first.',
      );
    }

    const strategyText = stage2.strategyText;
    const existingHistory = await this.stage3ChatModel.count({
      where: { userId },
    });
    if (existingHistory === 0) {
      await this.stage3ChatModel.create({
        userId,
        sender: 'bot',
        message: `Here is your Stage 2 marketing strategy we’ll build upon:\n\n${strategyText}`,
      });
    }

    await this.stage3ChatModel.create({
      userId,
      sender: 'user',
      message: chatDto.message,
    });

    const history = await this.stage3ChatModel.findAll({
      where: { userId },
      order: [['createdAt', 'ASC']],
    });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: STAGE3_SYSTEM_PROMPT },
      {
        role: 'system',
        content: `Here is the user’s completed Stage 2 marketing strategy. 
                  Use ONLY this data to create content in Stage 3. 
                  Do not re-ask these questions:\n\n${strategyText}`,
      },
      ...history.map(
        (msg): OpenAI.Chat.ChatCompletionMessageParam => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.message,
        }),
      ),
    ];
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.6,
      messages,
    });

    const reply = completion.choices[0].message.content ?? '';
    await this.stage3ChatModel.create({
      userId,
      sender: 'bot',
      message: reply,
    });
    return reply;
  }
  async getHistory(userId: number) {
    return this.stage3ChatModel.findAll({
      where: { userId },
      order: [['createdAt', 'ASC']],
    });
  }
}
