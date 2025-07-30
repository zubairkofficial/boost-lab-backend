import { Module } from '@nestjs/common';
import { TestResultService } from './test-result.service';
import { TestResultController } from './test-result.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { TestResult } from 'src/models/test.model';

@Module({
   imports: [SequelizeModule.forFeature([TestResult])], // ← required
  controllers: [TestResultController],
  providers: [TestResultService],
   exports: [TestResultService], // if other modules need the service
})
export class TestResultModule {}
