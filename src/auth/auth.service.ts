import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { User } from './../models/user.model';
import Stripe from 'stripe';

dotenv.config();

@Injectable()
export class AuthService {
  private supabase: SupabaseClient;
  private stripe: Stripe;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_KEY!,
    );
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-06-30.basil',
    });
  }

  async register(
    name: string,
    email: string,
    password: string,
    planId?: number,
  ) {
    try {
      // Check if email already exists
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        throw new BadRequestException('Email already exists');
      }
  
      // Step 1 & 2: Create Stripe Customer and Register on Supabase in parallel
      const [customer, supabaseResponse] = await Promise.all([
        this.stripe.customers.create({ name, email }), // Step 1: Create Stripe Customer
        this.supabase.auth.signUp({ // Step 2: Register on Supabase
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: `${process.env.BASE_URL}/auth/login`,
          },
        }),
      ]);
  
      if (supabaseResponse.error) throw new BadRequestException(supabaseResponse.error.message);
  
      // Step 3: Save to your own DB
      await User.create({
        name,
        email,
        password, // hash in production!
        stripeCustomerId: customer.id,
        planId: planId || null,
      });
  
      return {
        message: 'Registration successful. Please check your email.',
        user: supabaseResponse.data.user,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
  

  /** ✅ Login user with Supabase */
  async login(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw new UnauthorizedException(error.message);

    return {
      message: 'Login successful',
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
      user: data.user,
    };
  }

  /** ✅ Get user profile from Supabase token */
  async getUserFromToken(token: string) {
    const { data, error } = await this.supabase.auth.getUser(token);
    if (error || !data.user)
      throw new UnauthorizedException('Invalid or expired token');
    return data.user;
  }

  /** ✅ Send password reset email */
  async sendResetLink(email: string) {
    const { data, error } = await this.supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${process.env.BASE_URL}/auth/reset-password`,
      },
    );

    if (error) throw new BadRequestException(error.message);

    return { message: 'Password reset email sent' };
  }

  /** ✅ Reset password (user already verified via link) */
  async resetPassword(newPassword: string) {
    // When the user clicks the Supabase reset link, they are auto-authenticated
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

  /** ✅ Change password (user must be logged in) */
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

  /** ✅ Get all users (admin-only, via Supabase admin API) */
  async getAllUsers() {
    const { data, error } = await this.supabase.auth.admin.listUsers();
    if (error) throw new BadRequestException(error.message);
    return data.users;
  }

  /** ✅ Delete user (admin only) */
  async deleteUser(userId: string) {
    const { data, error } = await this.supabase.auth.admin.deleteUser(userId);
    if (error) throw new BadRequestException(error.message);
    return { message: 'User deleted successfully', data };
  }

  /** ✅ Update user role or metadata (admin only) */
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

  /** ✅ Resend confirmation email */
  async resendConfirmationEmail(email: string) {
    const { data, error } = await this.supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: `${process.env.BASE_URL}/auth/login`,
      },
    });

    if (error) throw new BadRequestException(error.message);

    return { message: 'Confirmation email sent successfully' };
  }
}

// import {
//   BadRequestException,
//   Injectable,
//   UnauthorizedException,
// } from '@nestjs/common';
// import { InjectModel } from '@nestjs/sequelize';
// import { User } from 'src/models/user.model';
// import * as bcrypt from 'bcrypt';
// import { JwtService } from '@nestjs/jwt';
// import * as nodemailer from 'nodemailer';
// import * as dotenv from 'dotenv';
// dotenv.config();

// @Injectable()
// export class AuthService {
//   constructor(
//     @InjectModel(User) private userModel: typeof User,
//     private jwtService: JwtService,
//   ) {}

//   async register(name: string, email: string, password: string, otp?: string) {
//     if (!otp) {
//       const userExists = await this.userModel.findOne({ where: { email } });
//       if (userExists && userExists.status === 'active') {
//         throw new BadRequestException('Email already exists');
//       }

//       const generatedOtp = Math.floor(
//         100000 + Math.random() * 900000,
//       ).toString();
//       const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

//       // Hash the password before saving
//       const hashedPassword = await bcrypt.hash(password, 10);

//       if (userExists && userExists.status === 'pending') {
//         await userExists.update({
//           name,
//           password: hashedPassword,
//           otp: generatedOtp,
//           otpExpiry: expiresAt,
//         });
//       } else {
//         // Create a new pending user
//         await this.userModel.create({
//           name,
//           email,
//           password: hashedPassword,
//           role: 'user',
//           otp: generatedOtp,
//           otpExpiry: expiresAt,
//           status: 'pending',
//         });
//       }

//       const transporter = nodemailer.createTransport({
//         service: 'gmail',
//         auth: {
//           user: process.env.EMAIL_USER,
//           pass: process.env.EMAIL_PASS,
//         },
//         secure: true,
//       });

//       const mailOptions = {
//         from: process.env.EMAIL_USER,
//         to: email,
//         subject: 'Your Registration OTP Code',
//         text: `Your OTP code is ${generatedOtp}. It expires in 5 minutes.`,
//       };
//       await transporter.sendMail(mailOptions);
//       return { message: 'OTP sent to email' };
//     }

//     const pendingUser = await this.userModel.findOne({
//       where: { email, status: 'pending' },
//     });

//     if (!pendingUser) {
//       throw new BadRequestException(
//         'Registration not found or already verified',
//       );
//     }

//     if (
//       !pendingUser.otp ||
//       pendingUser.otp !== otp ||
//       !pendingUser.otpExpiry ||
//       pendingUser.otpExpiry.getTime() < Date.now()
//     ) {
//       throw new BadRequestException('Invalid or expired OTP');
//     }

//     // OTP verified → activate the account
//     await pendingUser.update({
//       otp: null,
//       otpExpiry: null,
//       status: 'active',
//     });

//     return {
//       id: pendingUser.id,
//       name: pendingUser.name,
//       email: pendingUser.email,
//       role: pendingUser.role,
//       message: 'Registered successfully',
//     };
//   }
//   async login(email: string, password: string) {
//     const user = await this.userModel.findOne({ where: { email } });
//     if (!user) {
//       throw new UnauthorizedException('User not found');
//     }

//     const isPasswordMatching = await bcrypt.compare(password, user.password);
//     if (!isPasswordMatching) {
//       throw new UnauthorizedException('Invalid credentials');
//     }

//     const payload = {
//       sub: user.id,
//       email: user.email,
//       role: user.role,
//     };
//     const token = this.jwtService.sign(payload);

//     return {
//       message: 'Login successful',
//       access_token: token,
//       user: {
//         id: user.id,
//         name: user.name,
//         email: user.email,
//         role: user.role,
//       },
//     };
//   }

//   async updateRecord(
//     adminId: number,
//     userId: number,
//     name?: string,
//     email?: string,
//     password?: string,
//     role?: 'user' | 'admin',
//   ) {
//     const adminUser = await this.userModel.findByPk(adminId);
//     if (!adminUser || adminUser.role !== 'admin') {
//       throw new UnauthorizedException('Only admin can update user records');
//     }

//     const user = await this.userModel.findByPk(userId);
//     if (!user) {
//       throw new BadRequestException('User not found');
//     }

//     const updateData: Partial<User> = {};
//     if (name) updateData.name = name;
//     if (email) updateData.email = email;
//     if (password) updateData.password = await bcrypt.hash(password, 10);
//     if (role) updateData.role = role;

//     await user.update(updateData);

//     return {
//       message: 'User record updated successfully',
//       user: {
//         id: user.id,
//         name: user.name,
//         email: user.email,
//         role: user.role,
//       },
//     };
//   }
//   async deleteUser(id: number) {
//     const user = await this.userModel.findByPk(id);
//     if (!user) throw new BadRequestException('User not found');
//     await user.destroy();
//     return { message: 'User deleted successfully' };
//   }
//   async getAll() {
//     return this.userModel.findAll();
//   }
//   async getUserById(id: number) {
//     const user = await this.userModel.findByPk(id, {
//       attributes: { exclude: ['password', 'otp', 'otpExpiry'] },
//     });
//     return user;
//   }

//   async changePassword(
//     userId: number,
//     oldPassword: string,
//     newPassword: string,
//   ) {
//     const user = await this.userModel.findByPk(userId);
//     if (!user) throw new BadRequestException('User not found');

//     const isMatch = await bcrypt.compare(oldPassword, user.password);
//     if (!isMatch) throw new UnauthorizedException('Old password is incorrect');

//     const hashedPassword = await bcrypt.hash(newPassword, 10);
//     await user.update({ password: hashedPassword });

//     return { message: 'Password changed successfully' };
//   }
//   async sendOtp(email: string) {
//     const user = await this.userModel.findOne({ where: { email } });
//     if (!user) {
//       throw new BadRequestException('User with this email does not exist');
//     }
//     const otp = Math.floor(100000 + Math.random() * 900000).toString();
//     const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
//     await user.update({ otp, otpExpiry: expiresAt });

//     const transporter = nodemailer.createTransport({
//       service: 'gmail',
//       auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS,
//       },
//     });

//     const mailOptions = {
//       from: process.env.EMAIL_USER,
//       to: email,
//       subject: 'Your OTP Code',
//       text: `Your OTP code is ${otp}. It expires in 5 minutes.`,
//     };
//     await transporter.sendMail(mailOptions);
//     return { message: 'OTP sent to email' };
//   }
//   async resetPassword(email: string, otp: string, newPassword: string) {
//     const user = await this.userModel.findOne({ where: { email } });
//     if (!user) {
//       throw new BadRequestException('User not found');
//     }
//     if (
//       !user.otp ||
//       user.otp !== otp ||
//       !user.otpExpiry ||
//       user.otpExpiry.getTime() < Date.now()
//     ) {
//       throw new BadRequestException('Invalid or expired OTP');
//     }
//     const hashedPassword = await bcrypt.hash(newPassword, 10);
//     await user.update({
//       password: hashedPassword,
//       otp: null,
//       otpExpiry: null,
//     });
//     return { message: 'Password reset successfully' };
//   }

//  // Send password reset link with token
//   async sendResetLink(email: string) {
//     console.log('Attempting to send reset link to:', email);
//     console.log('Using EMAIL_USER:', process.env.EMAIL_USER);
//     console.log('Using EMAIL_PASS:', process.env.EMAIL_PASS ? '*' : 'undefined');
//     // ...existing code...
//     const user = await this.userModel.findOne({ where: { email } });
//     if (!user) {
//       throw new BadRequestException('User with this email does not exist');
//     }
//     // Generate secure token
//     const token = Math.random().toString(36).substr(2) + Date.now().toString(36);
//     const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry
//     await user.update({ resetToken: token, resetTokenExpiry: expiresAt });
//     const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5174'}/auth/reset-password?token=${token}`;
//     console.log('Generated reset URL:', resetUrl);
//     const transporter = nodemailer.createTransport({
//       service: 'gmail',
//       auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS,
//       },
//     });
//     const mailOptions = {
//       from: process.env.EMAIL_USER,
//       to: email,
//       subject: 'Password Reset Link',
//       text: `Click the link to reset your password: ${resetUrl}\nThis link expires in 1 hour.`,
//     };
//     try {
//       const info = await transporter.sendMail(mailOptions);
//       if (info.accepted && info.accepted.length > 0) {
//         console.log('Reset email sent successfully to:', info.accepted.join(', '));
//       } else {
//         console.error('Reset email not accepted:', info);
//         throw new BadRequestException('Email not accepted by server');
//       }
//     } catch (err) {
//       console.error('Error sending reset email:', err);
//       throw new BadRequestException('Failed to send reset email');
//     }
//     return { message: 'Password reset link sent to email' };
//   }

//   // Reset password using token
//   async resetPasswordWithToken(token: string, newPassword: string) {
//     const user = await this.userModel.findOne({ where: { resetToken: token } });
//     if (!user) {
//       throw new BadRequestException('Invalid or expired reset token');
//     }
//     if (!user.resetTokenExpiry || user.resetTokenExpiry.getTime() < Date.now()) {
//       throw new BadRequestException('Reset token has expired');
//     }
//     const hashedPassword = await bcrypt.hash(newPassword, 10);
//     await user.update({ password: hashedPassword, resetToken: null, resetTokenExpiry: null });
//     return { message: 'Password reset successfully' };
//   }
// }
