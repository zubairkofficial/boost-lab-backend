import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from 'src/models/user.model';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
dotenv.config();

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User) private userModel: typeof User,
    private jwtService: JwtService,
  ) {}

  async register(name: string, email: string, password: string, otp?: string) {
    if (!otp) {
      const userExists = await this.userModel.findOne({ where: { email } });
      if (userExists && userExists.status === 'active') {
        throw new BadRequestException('Email already exists');
      }

      const generatedOtp = Math.floor(
        100000 + Math.random() * 900000,
      ).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      // Hash the password before saving
      const hashedPassword = await bcrypt.hash(password, 10);

      if (userExists && userExists.status === 'pending') {
        await userExists.update({
          name,
          password: hashedPassword,
          otp: generatedOtp,
          otpExpiry: expiresAt,
        });
      } else {
        // Create a new pending user
        await this.userModel.create({
          name,
          email,
          password: hashedPassword,
          role: 'user',
          otp: generatedOtp,
          otpExpiry: expiresAt,
          status: 'pending',
        });
      }

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        secure: true,
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Your Registration OTP Code',
        text: `Your OTP code is ${generatedOtp}. It expires in 5 minutes.`,
      };
      await transporter.sendMail(mailOptions);
      return { message: 'OTP sent to email' };
    }

    const pendingUser = await this.userModel.findOne({
      where: { email, status: 'pending' },
    });

    if (!pendingUser) {
      throw new BadRequestException(
        'Registration not found or already verified',
      );
    }

    if (
      !pendingUser.otp ||
      pendingUser.otp !== otp ||
      !pendingUser.otpExpiry ||
      pendingUser.otpExpiry.getTime() < Date.now()
    ) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // OTP verified → activate the account
    await pendingUser.update({
      otp: null,
      otpExpiry: null,
      status: 'active',
    });

    return {
      id: pendingUser.id,
      name: pendingUser.name,
      email: pendingUser.email,
      role: pendingUser.role,
      message: 'Registered successfully',
    };
  }
  async login(email: string, password: string) {
    const user = await this.userModel.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isPasswordMatching = await bcrypt.compare(password, user.password);
    if (!isPasswordMatching) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const token = this.jwtService.sign(payload);

    return {
      message: 'Login successful',
      access_token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
  async updateRecord(
    adminId: number,
    userId: number,
    name?: string,
    email?: string,
    password?: string,
    role?: 'user' | 'admin',
  ) {
    const adminUser = await this.userModel.findByPk(adminId);
    if (!adminUser || adminUser.role !== 'admin') {
      throw new UnauthorizedException('Only admin can update user records');
    }

    const user = await this.userModel.findByPk(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const updateData: Partial<User> = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password) updateData.password = await bcrypt.hash(password, 10);
    if (role) updateData.role = role;

    await user.update(updateData);

    return {
      message: 'User record updated successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
  async deleteUser(id: number) {
    const user = await this.userModel.findByPk(id);
    if (!user) throw new BadRequestException('User not found');
    await user.destroy();
    return { message: 'User deleted successfully' };
  }
  async getAll() {
    return this.userModel.findAll();
  }
  async getUserById(id: number) {
    const user = await this.userModel.findByPk(id, {
      attributes: { exclude: ['password', 'otp', 'otpExpiry'] },
    });
    return user;
  }

  async changePassword(
    userId: number,
    oldPassword: string,
    newPassword: string,
  ) {
    const user = await this.userModel.findByPk(userId);
    if (!user) throw new BadRequestException('User not found');

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) throw new UnauthorizedException('Old password is incorrect');

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hashedPassword });

    return { message: 'Password changed successfully' };
  }
  async sendOtp(email: string) {
    const user = await this.userModel.findOne({ where: { email } });
    if (!user) {
      throw new BadRequestException('User with this email does not exist');
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await user.update({ otp, otpExpiry: expiresAt });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your OTP Code',
      text: `Your OTP code is ${otp}. It expires in 5 minutes.`,
    };
    await transporter.sendMail(mailOptions);
    return { message: 'OTP sent to email' };
  }
  async resetPassword(email: string, otp: string, newPassword: string) {
    const user = await this.userModel.findOne({ where: { email } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (
      !user.otp ||
      user.otp !== otp ||
      !user.otpExpiry ||
      user.otpExpiry.getTime() < Date.now()
    ) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await user.update({
      password: hashedPassword,
      otp: null,
      otpExpiry: null,
    });
    return { message: 'Password reset successfully' };
  }
}
