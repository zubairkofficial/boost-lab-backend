import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
  } from '@nestjs/common';
  import { Request } from 'express';
  import { AuthService } from './auth.service';
  
  @Injectable()
  export class AuthGuard implements CanActivate {
    constructor(private readonly authService: AuthService) {}
  
    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest<Request>();
      const authHeader = request.headers['authorization'];
  
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedException('Authorization token missing');
      }
  
      const token = authHeader.replace('Bearer ', '').trim();
  
      try {
        const user = await this.authService.getUserFromToken(token);
        if (!user) throw new UnauthorizedException('Invalid token');
        request['user'] = user; // user ko request object mein inject kar rahe hain
        return true;
      } catch (error) {
        throw new UnauthorizedException(error.message || 'Unauthorized');
      }
    }
  }
  