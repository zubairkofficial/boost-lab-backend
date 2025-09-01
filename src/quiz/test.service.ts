import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as nodemailer from 'nodemailer';
import { SubmitTestDto } from './dto/submit-test.dto';
import { JwtService } from '@nestjs/jwt';
import { SYSTEM_PROMPT } from '../utils/system-prompt';

@Injectable()
export class TestResultService {
  private supabase: SupabaseClient;
  private openai: OpenAI;
  private transporter: nodemailer.Transporter;

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
  }

  async submitTest(dto: SubmitTestDto) {
    const { email, answers } = dto;

    if (!answers || answers.length !== 5) {
      throw new BadRequestException('Provide exactly 5 answers');
    }

    // Fetch previous submission
    const { data: prevData, error: prevError } = await this.supabase
      .from('messages')
      .select('id, html_report')
      .eq('email', email)
      .single();

    if (prevError) {
      throw new BadRequestException('Previous test not found');
    }

    const prevHtml = prevData.html_report || '';

    // Construct user message for AI
    const userMessage =
      `User Email: ${email}\nPrevious Report:\n${prevHtml}\n` +
      answers.map((a) => `${a.question}: ${a.choice}`).join('\n');

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.3,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    });

    const newHtmlReport = completion.choices?.[0]?.message?.content || '';

    // Convert class instances to plain objects
    const plainAnswers = answers.map((a) => ({
      question: a.question,
      choice: a.choice,
    }));

    console.log('Saving answers:', plainAnswers); // Debug check

    // Update Supabase record
    const { error: updateErr } = await this.supabase
      .from('messages')
      .update({ answers: plainAnswers, html_report: newHtmlReport })
      .eq('id', prevData.id);

    if (updateErr) {
      throw new BadRequestException(updateErr.message);
    }

    // Send updated report via email
    if (newHtmlReport) {
      await this.transporter.sendMail({
        from: `"BOOSTLAB" <${this.config.get<string>('SMTP_USER')}>`,
        to: this.config.get<string>('ADMIN_EMAIL'),
        subject: `Updated Photography Quiz Submission – ${email}`,
        html: newHtmlReport,
      });
    }

    return {
      message: 'Test submitted successfully',
      redirect: '/personal-account',
    };
  }
}
