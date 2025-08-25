import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcryptjs';
import * as nodemailer from 'nodemailer';
import Stripe from 'stripe';
import { SubmitDto } from './dto/submit.dto';
import { JwtService } from '@nestjs/jwt';
import { SYSTEM_PROMPT } from '../utils/system-prompt';

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
      this.config.get<string>('SUPABASE_KEY')!,
    );
    console.log('Supabase client initialized');

    this.openai = new OpenAI({
      apiKey: this.config.get<string>('OPENAI_API_KEY')!,
    });
    console.log('OpenAI client initialized');

    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port: Number(this.config.get<string>('SMTP_PORT') || 587),
      secure: false,
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
    });
    console.log('SMTP transporter initialized');

    this.stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY')!, {
      apiVersion: '2022-11-15' as any,
    });
    console.log('Stripe client initialized');
  }

  async processSubmission(dto: SubmitDto) {
    console.log('Processing submission:', dto);
    const { name, email, password, answers } = dto;

    if (!answers || answers.length !== 5) {
      throw new BadRequestException('Provide exactly 5 answers');
    }

    const { data: existingUser } = await this.supabase
      .from('users')
      .select('email')
      .eq('email', email)
      .single();

    if (existingUser) {
      throw new BadRequestException('Email already exists');
    }

    const { data: authData, error: authError } =
      await this.supabase.auth.signUp({
        email,
        password,
      });
    if (authError) throw new BadRequestException(authError.message);

    const authUser = authData.user;
    if (!authUser) throw new BadRequestException('Unable to create user');

    const [hashedPassword, stripeCustomer] = await Promise.all([
      bcrypt.hash(password, 8),
      this.stripe.customers.create({ email, name }),
    ]);

    const { data: userData, error: userErr } = await this.supabase
      .from('users')
      .insert([
        {
          name,
          email,
          password: hashedPassword,
          stripe_customer_id: stripeCustomer.id,
          auth_uid: authUser.id,
        },
      ])
      .select();

    if (userErr) throw new BadRequestException(userErr.message);
    const userId = userData[0].id;
    const auth_uid = authUser.id;

    const token = this.jwtService.sign({
      email,
      name,
      stripe_customer_id: stripeCustomer.id,
    });

    this.handleBackgroundTasks(userId, auth_uid, name, email, answers);

    return {
      message: 'Submitted successfully. Your report will be ready soon.',
      token,
      user: {
        userId,
        name,
        email,
        stripe_customer_id: stripeCustomer.id,
      },
    };
  }

  private async handleBackgroundTasks(
    userId: string,
    auth_uid: string,
    name: string,
    email: string,
    answers: any[],
  ) {
    try {
      const userMessage = answers
        .map((a) => `${a.question}: ${a.choice}`)
        .join('\n');

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        temperature: 0.3,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
      });

      const htmlReport = completion.choices?.[0]?.message?.content || '';

      const { error: msgErr } = await this.supabase.from('messages').insert([
        {
          user_id: userId,
          auth_uid,
          email,
          answers,
          html_report: htmlReport,
        },
      ]);
      if (msgErr) {
        console.error('Error saving message:', msgErr);
        return;
      }

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

  /**
   * Fetch quiz results
   */
  async getQuizResultByEmail(email: string) {
    const { data, error } = await this.supabase
      .from('messages')
      .select('html_report')
      .eq('email', email)
      .single();

    if (error || !data) {
      throw new BadRequestException('No results found for this email');
    }

    return data.html_report;
  }

  /**
   * Login handler
   */
  async login(email: string, password: string) {
    const { data: user, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      throw new BadRequestException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new BadRequestException('Invalid email or password');
    }

    const token = this.jwtService.sign({
      email: user.email,
      name: user.name,
      stripe_customer_id: user.stripe_customer_id,
    });

    return {
      message: 'Login successful',
      token,
      user: {
        userId: user.id,
        name: user.name,
        email: user.email,
        stripe_customer_id: user.stripe_customer_id,
      },
    };
  }
}
