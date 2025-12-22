import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  UseGuards,
  Req,
  Param,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { CartService } from './cart.service';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { AddToCartDto } from './dto/add-to-cart.dto';

@Controller('cart')
@UseGuards(FirebaseAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(@Req() req) {
    return this.cartService.getCart(new Types.ObjectId(req.user.id));
  }

  @Post('add')
  async addToCart(@Req() req, @Body() dto: AddToCartDto) {
    return this.cartService.addToCart(new Types.ObjectId(req.user.id), dto);
  }

  @Patch('increase/:productId')
  async increaseQuantity(
    @Req() req,
    @Param('productId') productId: string,
  ) {
    return this.cartService.changeQuantity(
      new Types.ObjectId(req.user.id),
      productId,
      1,
    );
  }

  @Patch('decrease/:productId')
  async decreaseQuantity(
    @Req() req,
    @Param('productId') productId: string,
  ) {
    return this.cartService.changeQuantity(
      new Types.ObjectId(req.user.id),
      productId,
      -1,
    );
  }

  @Delete('remove')
  async removeItem(@Req() req, @Body('productId') productId: string) {
    return this.cartService.removeItem(new Types.ObjectId(req.user.id), productId);
  }
}
