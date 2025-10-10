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
import { MailerService } from '@nestjs-modules/mailer';
import { User } from 'src/models/user.model';

@Injectable()
export class PlansService {
  private stripe: Stripe;

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    @InjectModel(Plan)
    private readonly planModel: typeof Plan,
    @InjectModel(Subscription)
    private readonly subscriptionModel: typeof Subscription,
    @InjectModel(User) private readonly userModel: typeof User,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is missing in environment variables');
    }

    this.stripe = new Stripe(secretKey);
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
  ): Promise<{ url: string }> {
    if (!stripePriceId || !userId) {
      throw new Error('stripePriceId and userId are required');
    }

    const plan = await this.planModel.findOne({ where: { stripePriceId } });
    if (!plan) throw new NotFoundException('Plan not found for Stripe ID');

    const user = await this.userModel.findByPk(userId);
    if (!user || !user.stripeCustomerId) {
      throw new HttpException(
        'User or Stripe customer ID not found',
        HttpStatus.BAD_REQUEST,
      );
    }

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
      customer: user.stripeCustomerId,
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
    const { userId, planId } = session.metadata ?? {};
    if (!userId || !planId) return;

    try {
      let subscription = await this.subscriptionModel.findOne({
        where: { stripeSessionId: session.id },
      });

      if (!subscription) {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        subscription = await this.subscriptionModel.create({
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
          `Subscription created: user ${userId}, plan ${planId}, session ${session.id}`,
        );
      } else {
        console.log(
          `Subscription already exists for session ${session.id}. Skipping creation, but sending email anyway.`,
        );
      }

      const user: any =
        await this.planModel.sequelize?.models.User.findByPk(userId);
      if (user && user.email) {
        try {
          await this.sendWelcomeEmail(user.name, user.email);
          console.log(`"🤌🤌"Welcome email sent to ${user.email}`);
        } catch (err: any) {
          console.error('Failed to send welcome email:', err.message ?? err);
        }
      } else {
        console.warn('User not found or email missing:', userId);
      }

      return subscription;
    } catch (err: any) {
      console.error('Error in handleSuccessfulPayment:', err.message ?? err);
    }
  }

  async sendWelcomeEmail(name: string, email: string) {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Welcome to BOOSTLAB – Your Account is Ready 🚀',
        html: `
        <p>Hi ${name},</p>
        <p>Thanks for joining BOOSTLAB! 🎉<br/>
        Your personal account has been created successfully.</p>
        <p>
          🔗 <a href="https://app.boostlab.ph/auth/login">Go to login</a><br/>
          📧 Email: ${email}<br/>
          🔑 Password: <i>the one you set during registration</i>
        </p>
        <p>Let’s build something amazing together.</p>
        <p>If you ever forget your password, you can reset it from the login screen.</p>
        <p>— The BOOSTLAB Team</p>
      `,
      });
      console.log(`sendWelcomeEmail executed for ${email}`);
    } catch (err: any) {
      console.error('sendWelcomeEmail failed:', err.message ?? err);
      throw err;
    }
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

    if (!subscription)
      throw new NotFoundException('No active subscription found');

    const now = new Date();
    if (subscription.expiresAt <= now) {
      subscription.status = 'cancelled';
      await subscription.save();
      throw new NotFoundException('No active subscription found (expired)');
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

  async getInvoiceHistory(userId: number, limit = 10) {
    const user: any =
      await this.planModel.sequelize?.models.User.findByPk(userId);
    if (!user || !user.stripe_customer_id)
      throw new HttpException(
        'Stripe customer ID missing',
        HttpStatus.BAD_REQUEST,
      );

    const invoices = await this.stripe.invoices.list({
      customer: user.stripe_customer_id,
      limit,
      expand: ['data.payment_intent.payment_method'],
    });

    return invoices.data.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      amountDue: invoice.amount_due,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      invoicePdf: invoice.invoice_pdf,
      createdAt: new Date(invoice.created * 1000),
    }));
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

  async createCustomerPortalSession(
    customerId: string,
  ): Promise<{ url: string }> {
    if (!customerId) {
      throw new HttpException(
        'Customer ID is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${this.configService.get('PAYMENT_URL')}/personal-account`,
    });

    return { url: session.url! };
  }
}
