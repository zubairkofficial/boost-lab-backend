import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Param,
  Req,
  UseGuards,
  Delete,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('/register')
  register(@Body() dto: { name: string; email: string; password: string }) {
    return this.authService.register(dto.name, dto.email, dto.password);
  }
  @Post('/register/send-otp')
  sendRegisterOtp(
    @Body() dto: { name: string; email: string; password: string },
  ) {
    return this.authService.register(dto.name, dto.email, dto.password);
  }
  @Post('/register/verify-otp')
  verifyRegisterOtp(
    @Body() dto: { name: string; email: string; password: string; otp: string },
  ) {
    return this.authService.register(
      dto.name,
      dto.email,
      dto.password,
      dto.otp,
    );
  }
  @Post('/login')
  login(@Body() dto: { email: string; password: string }) {
    return this.authService.login(dto.email, dto.password);
  }
  @Post('/forgot-password')
  async forgotPassword(@Body('email') email: string) {
    return this.authService.sendOtp(email);
  }
  @Post('/reset-password')
  async resetPassword(
    @Body('email') email: string,
    @Body('otp') otp: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.authService.resetPassword(email, otp, newPassword);
  }
  @UseGuards(AuthGuard('jwt'))
  @Patch('/change-password')
  async changePassword(
    @Req() req,
    @Body('oldPassword') oldPassword: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.authService.changePassword(
      req.user.id,
      oldPassword,
      newPassword,
    );
  }
  // get user profile
  @UseGuards(AuthGuard('jwt'))
  @Get('/me')
  async profile(@Req() req) {
    const user = await this.authService.getUserById(req.user.id);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return {
      statusCode: 200,
      message: 'User profile fetched successfully',
      data: user,
    };
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @Get('/users')
  getAllUsers() {
    return this.authService.getAll();
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @Patch('/admin-update/:userId')
  async adminUpdate(
    @Req() req,
    @Param('userId') userId: number,
    @Body() body: any,
  ) {
    return this.authService.updateRecord(
      req.user.id,
      userId,
      body.name,
      body.email,
      body.password,
      body.role,
    );
  }
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @Delete('/users/:id')
  async deleteUser(@Param('id') id: number) {
    return this.authService.deleteUser(id);
  }
}
