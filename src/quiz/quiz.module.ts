import { Module } from '@nestjs/common';
import { QuizService } from './quiz.service';
import { QuizController } from './quiz.controller';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TestResultService } from './test.service';
import { TestController } from './test.controller';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'supersecret',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [QuizController, TestController],
  providers: [QuizService, TestResultService],
})
export class QuizModule {}
