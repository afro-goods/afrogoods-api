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
  async getCart(@CurrentUser('_id') userId: string) {
    return this.cartService.getCart(new Types.ObjectId(userId));
  }

  @Post('add')
  async addToCart(
    @CurrentUser('_id') userId: string,
    @Body() dto: AddToCartDto,
  ) {
    return this.cartService.addToCart(dto, new Types.ObjectId(userId));
  }

  @Patch('increase/:productId')
  async increaseQuantity(
    @CurrentUser('_id') userId: string,
    @Param('productId') productId: string,
  ) {
    return this.cartService.changeQuantity(
      productId,
      1,
      new Types.ObjectId(userId),
    );
  }

  @Patch('decrease/:productId')
  async decreaseQuantity(
    @CurrentUser('_id') userId: string,
    @Param('productId') productId: string,
  ) {
    return this.cartService.changeQuantity(
      productId,
      -1,
      new Types.ObjectId(userId),
    );
  }

  @Delete('remove')
  async removeItem(
    @CurrentUser('_id') userId: string,
    @Body('productId') productId: string,
  ) {
    return this.cartService.removeItem(productId, new Types.ObjectId(userId));
  }

  @Delete('clear')
  async clearCart(@CurrentUser('_id') userId: string) {
    return this.cartService.clearCart(new Types.ObjectId(userId));
  }

  @Post('sync')
  async syncCart(@CurrentUser('_id') userId: string, @Body() dto: SyncCartDto) {
    return this.cartService.replaceCart(dto.items, userId);
  }
}
