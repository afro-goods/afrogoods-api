import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  UseGuards,
  Param,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { CartService } from './cart.service';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { SyncCartDto } from './dto/sync-cart.dto';

@Controller('cart')
@UseGuards(FirebaseAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(@CurrentUser('id') userId: string) {
    return this.cartService.getCart(new Types.ObjectId(userId));
  }

  @Post('add')
  async addToCart(
    @CurrentUser('id') userId: string,
    @Body() dto: AddToCartDto,
  ) {
    return this.cartService.addToCart(new Types.ObjectId(userId), dto);
  }

  @Patch('increase/:productId')
  async increaseQuantity(
    @CurrentUser('id') userId: string,
    @Param('productId') productId: string,
  ) {
    return this.cartService.changeQuantity(
      new Types.ObjectId(userId),
      productId,
      1,
    );
  }

  @Patch('decrease/:productId')
  async decreaseQuantity(
    @CurrentUser('id') userId: string,
    @Param('productId') productId: string,
  ) {
    return this.cartService.changeQuantity(
      new Types.ObjectId(userId),
      productId,
      -1,
    );
  }

  @Delete('remove')
  async removeItem(
    @CurrentUser('id') userId: string,
    @Body('productId') productId: string,
  ) {
    return this.cartService.removeItem(new Types.ObjectId(userId), productId);
  }

  @Delete('clear')
  async clearCart(@CurrentUser('id') userId: string) {
    return this.cartService.clearCart(new Types.ObjectId(userId));
  }

  @Post('sync')
  async syncCart(@CurrentUser('id') userId: string, @Body() dto: SyncCartDto) {
    return this.cartService.replaceCart(userId, dto.items);
  }
}