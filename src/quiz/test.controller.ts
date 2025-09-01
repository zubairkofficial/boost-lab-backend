import { Controller, Post, Body } from '@nestjs/common';
import { TestResultService } from './test.service';
import { SubmitTestDto } from './dto/submit-test.dto';

@Controller('test')
export class TestController {
  constructor(private readonly testResultService: TestResultService) {}

  @Post('submit')
  submitTest(@Body() dto: SubmitTestDto) {
    return this.testResultService.submitTest(dto);
  }
}
