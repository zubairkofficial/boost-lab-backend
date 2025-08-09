import { Injectable } from '@nestjs/common';
import { CreateTestResultDto } from './dto/create-test-result.dto';
import { UpdateTestResultDto } from './dto/update-test-result.dto';
import { Repository } from 'sequelize-typescript';
import { TestResult } from 'src/models/test.model';
import { InjectModel } from '@nestjs/sequelize';

@Injectable()
export class TestResultService {
  constructor(  
    @InjectModel(TestResult)
    private readonly testResultModel: typeof TestResult, ){
 
  }
  create(createTestResultDto: CreateTestResultDto) {
    return 'This action adds a new testResult';
  }

  // findAll() {
  //   return `This action returns all testResult`;
  // }

  async getTestResult(email:string) {
   try {
    const result=await this.testResultModel.findOne({where:{sender:email}})
  return result
  } catch (error) {
    throw new Error(error.message)
   }
  }

  update(id: number, updateTestResultDto: UpdateTestResultDto) {
    return `This action updates a #${id} testResult`;
  }

  remove(id: number) {
    return `This action removes a #${id} testResult`;
  }
}
