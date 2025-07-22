import { Module } from '@nestjs/common';
import { StripePaymentService } from './stripe-payment.service';
import { StripePaymentController } from './stripe-payment.controller';

@Module({
  providers: [StripePaymentService],
  controllers: [StripePaymentController]
})
export class StripePaymentModule {}
