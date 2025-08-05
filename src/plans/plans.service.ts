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

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.CLIENT_URL}/success`,
      cancel_url: `${process.env.CLIENT_URL}/cancel`,
    });

    // Get plan from DB
    const plan = await this.planModel.findOne({ where: { stripePriceId } });
    if (!plan) throw new NotFoundException('Plan not found for Stripe ID');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days validity

    await this.subscriptionModel.create({
      userId,
      planId: plan.id,
      status: 'active',
      subscribedAt: now,
      expiresAt,
      stripeSessionId: session.id,
    });

    return { url: session.url! };
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
}
