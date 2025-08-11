import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Param,
  Req,
  Headers,
  UseGuards,
  Delete,
  BadRequestException,
  Query,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}
  @Post('/register')
  async register(
    @Query('email') email: string,
    @Query('password') password: string,
  ) {
    if (!email || !password)
      throw new BadRequestException('Email and password are required');
    const result = await this.authService.register(email, password);
    return {
      message: 'Registration and login successful',
      user: result.user,
      access_token: result.access_token,
      refresh_token: result.refresh_token,
    };
  }

  @Post('/login')
  async login(
    @Query('email') qEmail: string,
    @Query('password') qPassword: string,
    @Body('email') bEmail: string,
    @Body('password') bPassword: string,
  ) {
    const email = qEmail || bEmail;
    const password = qPassword || bPassword;
    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }
    return this.authService.login(email, password);
  }

  @Post('logout')
  async logout() {
    return this.authService.logout();
  }

  @Get('/me')
  async profile(@Headers('authorization') authHeader: string) {
    const token = authHeader?.replace('Bearer ', '');
    return this.authService.getUserFromToken(token);
  }

  /** ✅ Forgot password */
  @Post('/forgot-password')
  forgotPassword(@Body('email') email: string) {
    return this.authService.sendResetLink(email);
  }

  /** ✅ Reset password (after clicking Supabase link) */
  @Post('/reset-password')
  resetPassword(@Body('newPassword') newPassword: string) {
    return this.authService.resetPassword(newPassword);
  }

  /** ✅ Change password (user must send token) */
  @Patch('/change-password')
  changePassword(
    @Headers('authorization') authHeader: string,
    @Body('newPassword') newPassword: string,
  ) {
    const token = authHeader?.replace('Bearer ', '');
    return this.authService.changePassword(token, newPassword);
  }
  @Get('/verify')
  verify(@Headers('authorization') authHeader: string) {
    const token = authHeader?.replace('Bearer ', '');
    return this.authService.getUserFromToken(token);
  }

  /** ✅ Admin: Get all users */
  @Get('/users')
  getAllUsers() {
    return this.authService.getAllUsers();
  }

  /** ✅ Admin: Update user metadata */
  @Patch('/admin-update/:userId')
  updateUser(@Param('userId') userId: string, @Body() body: any) {
    return this.authService.updateUser(userId, body);
  }

  /** ✅ Admin: Delete user */
  @Delete('/users/:userId')
  deleteUser(@Param('userId') userId: string) {
    return this.authService.deleteUser(userId);
  }
}
