import { Controller, Post, Body } from '@nestjs/common';
import { QuizService } from './quiz.service';
import { SubmitDto } from './dto/submit.dto';
import { Get, Param } from '@nestjs/common';

@Controller('auth')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Post('register')
  async submitQuiz(@Body() dto: SubmitDto) {
    console.log('Received DTO:', dto);

    try {
      const result = await this.quizService.processSubmission(dto);
      console.log('Processed result:', result);
      return {
        statusCode: 200,
        ...result,
      };
    } catch (error) {
      console.error('Error processing submission:', error);
      throw error;
    }
  }

  @Get('results/:email')
  async getResults(@Param('email') email: string) {
    return {
      statusCode: 200,
      html_report: await this.quizService.getQuizResultByEmail(email),
    };
  }

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    console.log('Login body:', body);
    return this.quizService.login(body.email, body.password);
  }
}
