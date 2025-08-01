// plans.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Plan } from './../models/plans.model';
import { CreatePlanDto, UpdatePlanDto } from './dto/dto';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2025-06-30.basil',
});
console.log(process.env.STRIPE_SECRET_KEY);

@Injectable()
export class PlansService {
  constructor(
    @InjectModel(Plan)
    private readonly planModel: typeof Plan,
  ) {}

  async create(dto: CreatePlanDto): Promise<Plan> {
    const product = await stripe.products.create({
      name: dto.name,
      description: dto.description,
    });

    const price = await stripe.prices.create({
      unit_amount: Math.round(dto.price * 100),
      currency: 'usd',
      recurring: { interval: 'month' },
      product: product.id,
    });

    const newPlan = await this.planModel.create({
      ...dto,
      stripePriceId: price.id,
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

  // ✅ New: Create Stripe Checkout Session
  async createCheckoutSession(stripePriceId: string): Promise<{ url: string }> {
    if (!stripePriceId) {
      throw new Error('stripePriceId is required');
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

    return { url: session.url! };
  }
}
