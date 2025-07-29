// plans.controller.ts
import { Controller, Get, Post, Body, Param, Patch, Delete } from '@nestjs/common';
import { PlansService } from './plans.service';
import { CreatePlanDto, UpdatePlanDto } from './dto/dto';

@Controller('plans')
export class PlansController {
  constructor(private readonly planService: PlansService) {}

  @Post('create')
  create(@Body() dto: CreatePlanDto) {
    return this.planService.create(dto);
  }

  @Get('getall')
  findAll() {
    return this.planService.findAll();
  }

  @Get('get/:id')
  findOne(@Param('id') id: string) {
    return this.planService.findOne(id);
  }

  @Patch('update/:id')
  update(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.planService.update(id, dto);
  }

  @Delete('delete/:id')
  remove(@Param('id') id: string) {
    return this.planService.remove(id);
  }

  // ✅ New Checkout Session route
  @Post('checkout-session')
  async createCheckoutSession(@Body() body: { stripePriceId: string }) {
    return this.planService.createCheckoutSession(body.stripePriceId);
  }
}
