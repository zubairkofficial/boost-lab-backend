import { Test, TestingModule } from '@nestjs/testing';
import { StripePaymentController } from './stripe-payment.controller';

describe('StripePaymentController', () => {
  let controller: StripePaymentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StripePaymentController],
    }).compile();

    controller = module.get<StripePaymentController>(StripePaymentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
