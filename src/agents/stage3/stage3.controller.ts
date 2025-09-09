import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  ParseIntPipe,
} from '@nestjs/common';
import { Stage3Service } from './stage3.service';
import { ChatDto } from './stage3.dto';

@Controller('stage3')
export class Stage3Controller {
  constructor(private readonly stage3Service: Stage3Service) {}

  @Post(':userId/chat')
  async chat(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() chatDto: ChatDto,
  ) {
    const reply = await this.stage3Service.generateResponse(userId, chatDto);
    return {
      success: true,
      userId,
      userMessage: chatDto.message,
      botReply: reply,
    };
  }

  @Get(':userId/history')
  async history(@Param('userId', ParseIntPipe) userId: number) {
    const history = await this.stage3Service.getHistory(userId);
    return {
      success: true,
      userId,
      history,
    };
  }
}
