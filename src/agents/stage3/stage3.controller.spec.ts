import { Test, TestingModule } from '@nestjs/testing';
import { Stage3Controller } from './stage3.controller';

describe('Stage3Controller', () => {
  let controller: Stage3Controller;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [Stage3Controller],
    }).compile();

    controller = module.get<Stage3Controller>(Stage3Controller);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
