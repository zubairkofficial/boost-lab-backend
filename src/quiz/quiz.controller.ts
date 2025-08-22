import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { QuizService } from './quiz.service';
import { SubmitDto } from './dto/submit.dto';

@Controller('auth')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Post('register')
  async submitQuiz(@Body() dto: SubmitDto) {
    try {
      const result = await this.quizService.processSubmission(dto);
      return {
        statusCode: 200,
        ...result,
      };
    } catch (error) {
      console.error('Error processing submission:', error);
      throw new BadRequestException(error.message);
    }
  }

  @Get('results/:email')
  async getResults(@Param('email') email: string) {
    try {
      const html_report = await this.quizService.getQuizResultByEmail(email);
      return { statusCode: 200, html_report };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    try {
      return await this.quizService.login(body.email, body.password);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
