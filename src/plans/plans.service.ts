import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Plan } from './../models/plans.model';
import { CreatePlanDto, UpdatePlanDto } from './dto/dto';
import Stripe from 'stripe';
import { Subscription } from '../models/subscription.model';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2025-06-30.basil',
});

@Injectable()
export class PlansService {
  constructor(
    @InjectModel(Plan)
    private readonly planModel: typeof Plan,
    @InjectModel(Subscription)
    private readonly subscriptionModel: typeof Subscription,
  ) {}

  async create(dto: CreatePlanDto): Promise<Plan> {
    const product = await stripe.products.create({
      name: dto.name,
      description: Array.isArray(dto.description)
        ? dto.description.join(' | ')
        : dto.description,
    });

    const price = await stripe.prices.create({
      unit_amount: Math.round(dto.price * 100),
      currency: 'usd',
      recurring: { interval: 'month' },
      product: product.id,
    });

    const now = new Date();
    const validTill = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const newPlan = await this.planModel.create({
      ...dto,
      stripePriceId: price.id,
      validTill,
    });

    return newPlan;
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

    // Get plan from DB first
    const plan = await this.planModel.findOne({ where: { stripePriceId } });
    if (!plan) throw new NotFoundException('Plan not found for Stripe ID');

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/cancel`,
      metadata: {
        userId: userId.toString(),
        planId: plan.id.toString(),
      },
    });

    // Don't create subscription here - wait for webhook confirmation
    return { url: session.url! };
  }

  async handleSuccessfulPayment(session: Stripe.Checkout.Session) {
    const { userId, planId } = session.metadata!;
    
    if (!userId || !planId) {
      console.error('Missing metadata in session:', session.id);
      return;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days validity

    // Create or update subscription
    await this.subscriptionModel.upsert({
      userId: parseInt(userId),
      planId: parseInt(planId),
      status: 'active',
      subscribedAt: now,
      expiresAt,
      stripeSessionId: session.id,
    });

    console.log(`Subscription activated for user ${userId}, plan ${planId}`);
  }

  async handleSubscriptionCancelled(subscription: Stripe.Subscription) {
    // Find subscription by Stripe subscription ID and mark as cancelled
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

  async verifyPaymentSuccess(sessionId: string) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      return session.payment_status === 'paid';
    } catch (error) {
      console.error('Error verifying payment:', error);
      return false;
    }
  }
}
