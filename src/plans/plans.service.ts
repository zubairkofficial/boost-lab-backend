import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Cron, Interval } from '@nestjs/schedule';
import { Plan } from './../models/plans.model';
import { Subscription } from '../models/subscription.model';
import { CreatePlanDto, UpdatePlanDto } from './dto/dto';
import { Op } from 'sequelize';

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
      currency: 'eur',
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
    autoRenew: boolean,
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
        autoRenew: autoRenew.toString(),
      },
    });

    return { url: session.url! };
  }

  async handleSuccessfulPayment(session: Stripe.Checkout.Session) {
    const { userId, planId, autoRenew } = session.metadata!;
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
      autoRenew: autoRenew === 'true',
    });

    await this.planModel.sequelize?.models.User.update(
      { planId: parseInt(planId) },
      { where: { id: parseInt(userId) } },
    );

    console.log(
      `Subscription and user plan updated: user ${userId}, plan ${planId}, autoRenew: ${autoRenew}`,
    );
  }

  async handleSubscriptionCancelled(subscription: Stripe.Subscription) {
    const dbSubscription = await this.subscriptionModel.findOne({
      where: { stripeSessionId: subscription.id },
    });

    if (dbSubscription) {
      dbSubscription.status = 'cancelled';
      dbSubscription.autoRenew = false;
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

    const now = new Date();
    if (subscription.expiresAt <= now) {
      if (subscription.autoRenew) {
        await this.renewSubscription(subscription);
        return this.getActiveSubscription(userId);
      } else {
        subscription.status = 'cancelled';
        subscription.autoRenew = false;
        await subscription.save();
        throw new NotFoundException('No active subscription found (expired)');
      }
    }

    return subscription;
  }

  async renewSubscription(subscription: Subscription) {
    const plan = await this.planModel.findByPk(subscription.planId);
    if (!plan) return;

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: `${process.env.PAYMENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.PAYMENT_URL}/cancel`,
      metadata: {
        userId: subscription.userId.toString(),
        planId: plan.id.toString(),
        autoRenew: 'true',
      },
    });

    console.log(`Auto-renew session created: ${session.id}`);
    const currentExpiry = subscription.expiresAt || new Date();
    const newExpiry = new Date(currentExpiry);
    newExpiry.setMonth(newExpiry.getMonth() + plan.duration);

    subscription.expiresAt = newExpiry;
    await subscription.save();

    console.log(
      `Subscription updated for user ${subscription.userId} with new expiry ${subscription.expiresAt}`,
    );
  }

  @Interval(10000)
  async handleInterval() {
    console.log('🤌 Checking for expired subscriptions every 10 seconds');
    await this.autoRenewExpiredSubscriptions();
  }
  async autoRenewExpiredSubscriptions() {
    const now = new Date();
    const expiredSubscriptions = await this.subscriptionModel.findAll({
      where: {
        status: 'active',
        expiresAt: { [Op.lte]: now },
        autoRenew: true,
      },
    });

    for (const sub of expiredSubscriptions) {
      await this.renewSubscription(sub);
      console.log(`Auto-renew triggered for subscription: ${sub.id}`);
    }
  }

  async cancelUserSubscription(userId: number) {
    const subscription = await this.subscriptionModel.findOne({
      where: { userId, status: 'active' },
    });

    if (!subscription)
      throw new NotFoundException('Active subscription not found');

    subscription.status = 'cancelled';
    subscription.autoRenew = false;
    await subscription.save();

    return {
      message: 'Subscription cancelled successfully',
      subscription,
    };
  }

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
