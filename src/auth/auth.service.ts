import {
  BadRequestException,
  Injectable,
  Redirect,
  UnauthorizedException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';
import { User } from './../models/user.model';
import Stripe from 'stripe';
import { Plan } from 'src/models/plans.model';
import { InjectModel } from '@nestjs/sequelize';
import { Subscription } from 'src/models/subscription.model';
import * as jwt from 'jsonwebtoken';

dotenv.config();
@Injectable()
export class AuthService {
  private supabase: SupabaseClient;
  private stripe: Stripe;

  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
  ) {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_KEY!,
    );
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-06-30.basil',
    });
  }
  async register(email: string, password: string) {
    try {
      const customer = await this.stripe.customers.create({ email });
      const supabaseResponse = await this.supabase.auth.signUp({
        email,
        password,
      });

      if (supabaseResponse.error) {
        throw new BadRequestException(supabaseResponse.error.message);
      }
      const newUser = await User.create({
        supabaseId: supabaseResponse.data.user?.id,
        stripeCustomerId: customer.id,
      });

      const signInResponse = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInResponse.error) {
        throw new BadRequestException(signInResponse.error.message);
      }

      return {
        message: 'Registration and login successful.',
        user: signInResponse.data.user,
        access_token: signInResponse.data.session?.access_token,
        refresh_token: signInResponse.data.session?.refresh_token,
      };
  
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async getUserFromToken(token: string) {
    const { data, error } = await this.supabase.auth.getUser(token);
    if (error || !data.user)
      throw new UnauthorizedException('Invalid or expired token');
    return data.user;
  }

  async sendResetLink(email: string) {
    const { data, error } = await this.supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${process.env.VITE_BASE_URL}/auth/reset-password`,
      },
    );

    if (error) throw new BadRequestException(error.message);

    return { message: 'Password reset email sent' };
  }

  async resetPassword(newPassword: string) {
    const {
      data: { user },
      error: getUserError,
    } = await this.supabase.auth.getUser();
    if (getUserError || !user)
      throw new UnauthorizedException('Not authenticated');

    const { error } = await this.supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw new BadRequestException(error.message);

    return { message: 'Password reset successfully' };
  }

  async changePassword(token: string, newPassword: string) {
    const {
      data: { user },
      error: verifyError,
    } = await this.supabase.auth.getUser(token);
    if (verifyError || !user)
      throw new UnauthorizedException('Invalid session');

    const { error } = await this.supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw new BadRequestException(error.message);

    return { message: 'Password changed successfully' };
  }

  /* Get all users (admin-only, via Supabase admin API) */
  async getAllUsers() {
    const { data, error } = await this.supabase.auth.admin.listUsers();
    if (error) throw new BadRequestException(error.message);
    return data.users;
  }

  /* Delete user (admin only) */
  async deleteUser(userId: string) {
    const { data, error } = await this.supabase.auth.admin.deleteUser(userId);
    if (error) throw new BadRequestException(error.message);
    return { message: 'User deleted successfully', data };
  }

  /* Update user role or metadata (admin only) */
  async updateUser(userId: string, metadata: any) {
    const { data, error } = await this.supabase.auth.admin.updateUserById(
      userId,
      {
        user_metadata: metadata,
      },
    );
    if (error) throw new BadRequestException(error.message);
    return { message: 'User updated successfully', data };
  }

  /* Resend confirmation email */
  async resendConfirmationEmail(email: string) {
    const { data, error } = await this.supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: `${process.env.VITE_BASE_URL}/auth/login`,
      },
    });

    if (error) throw new BadRequestException(error.message);

    return { message: 'Confirmation email sent successfully' };
  }

  async logout(): Promise<{ message: string }> {
    const { error } = await this.supabase.auth.signOut();
    if (error) {
      throw new BadRequestException('Failed to log out');
    }
    return { message: 'Logout successful' };
  }
}
