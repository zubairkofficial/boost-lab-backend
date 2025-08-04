// plans.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Plan } from './../models/plans.model';
import { CreatePlanDto, UpdatePlanDto } from './dto/dto';
import Stripe from 'stripe';

// ✅ Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2025-06-30.basil',
});

@Injectable()
export class PlansService {
  constructor(
    @InjectModel(Plan)
    private readonly planModel: typeof Plan,
  ) {}

  // ✅ Create a new plan
  async create(dto: CreatePlanDto): Promise<Plan> {
    // Create Stripe product
    const product = await stripe.products.create({
      name: dto.name,
      description: dto.description,
    });

    // Create Stripe price
    const price = await stripe.prices.create({
      unit_amount: Math.round(dto.price * 100),
      currency: 'usd',
      recurring: { interval: 'month' },
      product: product.id,
    });

    // ✅ Set 30-day validity
    const now = new Date();
    const validTill = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Create DB record
    const newPlan = await this.planModel.create({
      ...dto,
      stripePriceId: price.id,
      validTill,
    });

    return newPlan;
  }

  // ✅ Get all plans
  async findAll(): Promise<Plan[]> {
    return this.planModel.findAll();
  }

  // ✅ Get one plan by ID
  async findOne(id: string): Promise<Plan> {
    const plan = await this.planModel.findByPk(id);
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  // ✅ Update plan
  async update(id: string, dto: UpdatePlanDto): Promise<Plan> {
    const plan = await this.findOne(id);
    await plan.update(dto);
    return plan;
  }

  // ✅ Delete plan
  async remove(id: string): Promise<Plan> {
    const plan = await this.findOne(id);
    await plan.destroy();
    return plan;
  }

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
