import { Controller, Post, Body, Get, Patch, Param, Req, Headers, UseGuards, Delete } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /** ✅ Register */
  @Post('/register')
  register(@Body() dto: { name: string; email: string; password: string }) {
    return this.authService.register(dto.name, dto.email, dto.password);
  }

  /** ✅ Login */
  @Post('/login')
  login(@Body() dto: { email: string; password: string }) {
    return this.authService.login(dto.email, dto.password);
  }

  /** ✅ Get profile using Supabase token */
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
    @Body('newPassword') newPassword: string
  ) {
    const token = authHeader?.replace('Bearer ', '');
    return this.authService.changePassword(token, newPassword);
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
