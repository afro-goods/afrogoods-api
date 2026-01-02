import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Req,
  Body,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrderStatus } from './schemas/orders.schema';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';

@Controller('orders')
@UseGuards(FirebaseAuthGuard) 
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // CUSTOMER

  @Post()
  create(@Req() req) {
    // FirebaseAuthGuard attaches user to req.user
    return this.ordersService.create(req.user.id);
  }

  @Get('my')
  findMyOrders(@Req() req) {
    return this.ordersService.findMyOrders(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req) {
    return this.ordersService.findOne(id, req.user.id);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @Req() req) {
    return this.ordersService.cancelByUser(id, req.user.id);
  }

  @Post(':id/mock-pay')
  mockPay(@Param('id') id: string, @Req() req) {
    return this.ordersService.mockPay(id, req.user.id);
  }

  // =========================
  // ADMIN (protect later with RoleGuard)
  // =========================

  @Get()
  findAll() {
    return this.ordersService.findAll();
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: OrderStatus,
  ) {
    return this.ordersService.updateStatus(id, status);
  }
}
