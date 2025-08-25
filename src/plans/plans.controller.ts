import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Req,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PlansService } from './plans.service';
import { CreatePlanDto, UpdatePlanDto } from './dto/dto';
import Stripe from 'stripe';
import { Request, Response } from 'express';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2025-06-30' as any,
});

@Controller('plans')
export class PlansController {
  constructor(private readonly planService: PlansService) {}

  @Post('create')
  create(@Body() dto: CreatePlanDto) {
    return this.planService.create(dto);
  }

  @Get('getall')
  findAll() {
    return this.planService.findAll();
  }

  @Get('get/:id')
  findOne(@Param('id') id: string) {
    return this.planService.findOne(id);
  }

  @Patch('update/:id')
  update(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.planService.update(id, dto);
  }

  @Delete('delete/:id')
  remove(@Param('id') id: string) {
    return this.planService.remove(id);
  }

  @Delete('delete')
  removeAll() {
    return this.planService.removeAll();
  }

  @Get('invoice-history')
  async getInvoiceHistory() {
    return this.planService.getInvoiceHistory();
  }

  @Post('checkout-session')
  async createCheckoutSession(
    @Body() body: { stripePriceId: string; id: number; autoRenew?: boolean },
  ) {
    return this.planService.createCheckoutSession(body.stripePriceId, body.id);
  }

  @Post('webhook/test')
  async testWebhook(@Body() body: any) {
    await this.planService.handleSuccessfulPayment(body);
    return { message: 'Test webhook triggered', session: body };
  }

  @Post('webhook')
  async handleWebhook(@Req() req: Request, @Res() res: Response) {
    const signature = req.headers['stripe-signature'] as string;
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
      console.log('✅ Webhook received:', event.type);

      switch (event.type) {
        case 'checkout.session.completed':
          const session = event.data.object as Stripe.Checkout.Session;
          await this.planService.handleSuccessfulPayment(session);
          break;

        case 'customer.subscription.deleted':
          const subscription = event.data.object as Stripe.Subscription;
          await this.planService.handleSubscriptionCancelled(subscription);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return res.json({ received: true });
    } catch (err: any) {
      console.error('❌ Webhook error:', err.message);
      return res.status(400).send(`Webhook error: ${err.message}`);
    }
  }

  @Get('active-subscription/:userId')
  getActiveSubscription(@Param('userId') userId: number) {
    return this.planService.getActiveSubscription(userId);
  }

  @Get('verify-payment/:sessionId')
  async verifyPayment(@Param('sessionId') sessionId: string) {
    const isPaid = await this.planService.verifyPaymentSuccess(sessionId);
    return { isPaid };
  }

  @Post('cancel-subscription/:userId')
  async cancelSubscription(@Param('userId') userId: number) {
    return this.planService.cancelUserSubscription(userId);
  }
}
