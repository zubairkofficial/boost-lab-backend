import { Test, TestingModule } from '@nestjs/testing';
import { Stage3Service } from './stage3.service';

describe('Stage3Service', () => {
  let service: Stage3Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [Stage3Service],
    }).compile();

    service = module.get<Stage3Service>(Stage3Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
