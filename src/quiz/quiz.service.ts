import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as nodemailer from 'nodemailer';
import Stripe from 'stripe';
import { HandleBackgroundTasksDto, SubmitDto } from './dto/submit.dto';
import { JwtService } from '@nestjs/jwt';
import { SYSTEM_PROMPT } from './quiz-system-prompt';

@Injectable()
export class QuizService {
  private supabase: SupabaseClient;
  private openai: OpenAI;
  private transporter: nodemailer.Transporter;
  private stripe: Stripe;

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    this.supabase = createClient(
      this.config.get<string>('SUPABASE_URL')!,
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    this.openai = new OpenAI({
      apiKey: this.config.get<string>('OPENAI_API_KEY')!,
    });
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port: Number(this.config.get<string>('SMTP_PORT') || 587),
      secure: false,
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
    });

    this.stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY')!, {
      apiVersion: '2022-11-15' as any,
    });
  }

  async processSubmission(dto: SubmitDto) {
    const { name, email, password, answers } = dto;

    if (!answers || answers.length !== 5) {
      throw new BadRequestException('Provide exactly 5 answers');
    }

    const [authResult, stripeCustomer] = await Promise.all([
      this.supabase.auth.signUp({ email, password }),
      this.stripe.customers.create({ email, name }),
    ]);

    if (authResult.error)
      throw new BadRequestException(authResult.error.message);
    const authUser = authResult.data.user;
    if (!authUser) throw new BadRequestException('Unable to create user');

    const { data: userData, error: userErr } = await this.supabase
      .from('users')
      .insert([ 
        {
          name,
          email,
          stripe_customer_id: stripeCustomer.id,
          auth_uid: authUser.id,
        },
      ])
      .select();
    if (userErr) throw new BadRequestException(userErr.message);

    const userId = userData[0].id;

    // Sign JWT
    const token = this.jwtService.sign({
      email,
      name,
      stripe_customer_id: stripeCustomer.id,
    });

    // Fire background tasks asynchronously
    this.handleBackgroundTasks({
      userId,
      auth_uid: authUser.id,
      name,
      email,
      answers,
    });

    return {
      message: 'Submitted successfully. Your report will be ready soon.',
      token,
      user: { userId, name, email, stripe_customer_id: stripeCustomer.id },
    };
  }

  async handleBackgroundTasks(dto: HandleBackgroundTasksDto) {
    const { userId, auth_uid, name, email, answers } = dto;

    try {
      const userMessage =
        `User Name: ${name}\n` +
        answers.map((a) => `${a.question}: ${a.choice}`).join('\n');

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        temperature: 0.3,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
      });

      const modelHtml = completion.choices?.[0]?.message?.content || '';
      const htmlReport = modelHtml;

      const { error: msgErr } = await this.supabase.from('messages').insert([
        {
          user_id: userId,
          auth_uid,
          email,
          answers,
          html_report: htmlReport,
        },
      ]);
      if (msgErr) console.error('Error saving message:', msgErr);

      if (htmlReport) {
        await this.transporter.sendMail({
          from: `"BOOSTLAB" <${this.config.get<string>('SMTP_USER')}>`,
          to: this.config.get<string>('ADMIN_EMAIL'),
          subject: `New Photography Quiz Submission – ${name}`,
          html: htmlReport,
        });
      }

      console.log('Background tasks completed successfully for', email);
    } catch (err) {
      console.error('Background processing failed:', err);
    }
  }

  async getQuizResultByEmail(email: string) {
    const { data, error } = await this.supabase
      .from('messages')
      .select('html_report')
      .eq('email', email)
      .single();
    if (error || !data)
      throw new BadRequestException('No results found for this email');
    return data.html_report;
  }

  async login(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user)
      throw new BadRequestException('Invalid email or password');

    const { data: userRow, error: userErr } = await this.supabase
      .from('users')
      .select('*')
      .eq('auth_uid', data.user.id)
      .single();
    if (userErr || !userRow)
      throw new BadRequestException('User profile not found');

    const token = this.jwtService.sign({
      email: data.user.email,
      name: userRow.name,
      stripe_customer_id: userRow.stripe_customer_id,
    });

    return {
      message: 'Login successful',
      token,
      user: {
        userId: userRow.id,
        name: userRow.name,
        email: data.user.email,
        stripe_customer_id: userRow.stripe_customer_id,
      },
    };
  }
}
