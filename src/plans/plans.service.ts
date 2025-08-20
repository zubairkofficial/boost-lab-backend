// src/plans/plans.service.ts

import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Plan } from './../models/plans.model';
import { Subscription } from '../models/subscription.model';
import { CreatePlanDto, UpdatePlanDto } from './dto/dto';

@Injectable()
export class PlansService {
  private stripe: Stripe;

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(Plan)
    private readonly planModel: typeof Plan,
    @InjectModel(Subscription)
    private readonly subscriptionModel: typeof Subscription,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is missing in environment variables');
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-06-30.basil',
    });
  }

  async create(dto: CreatePlanDto): Promise<Plan> {
    const product = await this.stripe.products.create({
      name: dto.name,
      description: Array.isArray(dto.description)
        ? dto.description.join(' | ')
        : dto.description,
    });

    const price = await this.stripe.prices.create({
      unit_amount: Math.round(dto.price * 100),
      currency: 'usd',
      recurring: {
        interval: 'month',
        interval_count: dto.duration,
      },
      product: product.id,
    });

    const now = new Date();
    const validTill = new Date(now.setMonth(now.getMonth() + dto.duration));

    return this.planModel.create({
      ...dto,
      stripePriceId: price.id,
      validTill,
      duration: dto.duration,
    });
  }

  async findAll(): Promise<Plan[]> {
    return this.planModel.findAll();
  }

  async findOne(id: string): Promise<Plan> {
    const plan = await this.planModel.findByPk(id);
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async update(id: string, dto: UpdatePlanDto): Promise<Plan> {
    const plan = await this.findOne(id);
    await plan.update(dto);
    return plan;
  }

  async remove(id: string): Promise<Plan> {
    const plan = await this.findOne(id);
    await plan.destroy();
    return plan;
  }

  async removeAll(): Promise<number> {
    return this.planModel.destroy({ where: {}, truncate: true });
  }

  async createCheckoutSession(
    stripePriceId: string,
    userId: number,
  ): Promise<{ url: string }> {
    if (!stripePriceId || !userId) {
      throw new Error('stripePriceId and userId are required');
    }

    const plan = await this.planModel.findOne({ where: { stripePriceId } });
    if (!plan) throw new NotFoundException('Plan not found for Stripe ID');

    const existingSubscription = await this.subscriptionModel.findOne({
      where: { userId, status: 'active' },
    });

    if (existingSubscription) {
      throw new HttpException(
        'You already have an active subscription. Please cancel it before subscribing to a new plan.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],

      success_url: `${process.env.PAYMENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.PAYMENT_URL}/cancel`,
      metadata: {
        userId: userId.toString(),
        planId: plan.id.toString(),
      },
    });

    return { url: session.url! };
  }

  async handleSuccessfulPayment(session: Stripe.Checkout.Session) {
    const { userId, planId } = session.metadata!;

    if (!userId || !planId) {
      console.error('Missing metadata:', session.id);
      return;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await this.subscriptionModel.upsert({
      userId: parseInt(userId),
      planId: parseInt(planId),
      status: 'active',
      subscribedAt: now,
      expiresAt,
      stripeSessionId: session.id,
    });

    await this.planModel.sequelize?.models.User.update(
      { planId: parseInt(planId) },
      { where: { id: parseInt(userId) } },
    );

    console.log(
      `Subscription and user plan updated: user ${userId}, plan ${planId}`,
    );
  }

  async handleSubscriptionCancelled(subscription: Stripe.Subscription) {
    const dbSubscription = await this.subscriptionModel.findOne({
      where: { stripeSessionId: subscription.id },
    });

    if (dbSubscription) {
      dbSubscription.status = 'cancelled';
      await dbSubscription.save();
      console.log(`Subscription cancelled for session ${subscription.id}`);
    }
  }

  async getActiveSubscription(userId: number) {
    const subscription = await this.subscriptionModel.findOne({
      where: { userId, status: 'active' },
      include: [Plan],
    });

    if (!subscription) {
      throw new NotFoundException('No active subscription found');
    }

    return subscription;
  }

  async cancelUserSubscription(userId: number) {
    const subscription = await this.subscriptionModel.findOne({
      where: { userId, status: 'active' },
    });

    if (!subscription)
      throw new NotFoundException('Active subscription not found');

    subscription.status = 'cancelled';
    await subscription.save();

    return {
      message: 'Subscription cancelled successfully',
      subscription,
    };
  }

  // async getPaymentHistory(userId: number, limit = 10) {
  //   const charges = await this.stripe.charges.list({ limit });
  //   const userCharges = charges.data.filter(
  //     (charge) =>
  //       charge.metadata?.userId && charge.metadata.userId == userId.toString(),
  //   );
  //   const enriched = await Promise.all(
  //     userCharges.map(async (charge) => {
  //       let email: string | null = null;
  //       if (charge.customer) {
  //         const customer = await this.stripe.customers.retrieve(
  //           charge.customer as string,
  //         );
  //         if (!('deleted' in customer)) email = customer.email;
  //       }

  //       const paymentMethod = charge.payment_method_details?.type ?? 'N/A';

  //       return {
  //         id: charge.id,
  //         amount: charge.amount,
  //         currency: charge.currency,
  //         status: charge.status,
  //         receiptUrl: charge.receipt_url,
  //         createdAt: new Date(charge.created * 1000),
  //         email,
  //         paymentMethod,
  //         description: charge.description,
  //       };
  //     }),
  //   );

  //   return enriched;
  // }

  async getInvoiceHistory(limit = 10) {
    const invoices = await this.stripe.invoices.list({
      limit,
      expand: ['data.payment_intent.payment_method'],
    });

    const enriched = await Promise.all(
      invoices.data.map(async (invoice) => {
        let email: string | null = null;
        let billingName: string | null = null;
        let paymentMethod: string | null = 'N/A';

        if (typeof invoice.customer === 'string') {
          try {
            const customer = await this.stripe.customers.retrieve(
              invoice.customer,
            );
            if (!('deleted' in customer)) {
              email = customer.email;
              billingName = customer.name || null;
            }
          } catch (err) {
            console.error(
              `Error retrieving customer ${invoice.customer}:`,
              err,
            );
          }
        }

        const intent = (invoice as any).payment_intent as Stripe.PaymentIntent;
        if (
          intent &&
          typeof intent.payment_method === 'object' &&
          intent.payment_method &&
          'type' in intent.payment_method
        ) {
          paymentMethod = (intent.payment_method as Stripe.PaymentMethod).type;
        }

        return {
          id: invoice.id,
          number: invoice.number,
          amountDue: invoice.amount_due,
          amountPaid: invoice.amount_paid,
          currency: invoice.currency,
          status: invoice.status,
          hostedInvoiceUrl: invoice.hosted_invoice_url,
          invoicePdf: invoice.invoice_pdf,
          createdAt: new Date(invoice.created * 1000),
          email,
          billingName,
          paymentMethod,
        };
      }),
    );

    return enriched.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async verifyPaymentSuccess(sessionId: string) {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);
      return session.payment_status === 'paid';
    } catch (error) {
      console.error('Error verifying payment:', error);
      return false;
    }
  }
}
