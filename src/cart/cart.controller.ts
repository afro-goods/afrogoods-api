import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  UseGuards,
  Param,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { CartService } from './cart.service';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { SyncCartDto } from './dto/sync-cart.dto';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  private validateGuestSession(guestSessionId?: string): string {
    if (!guestSessionId) {
      throw new BadRequestException('Guest session ID is required');
    }
    return guestSessionId;
  }

  /* ---------------- AUTHENTICATED USER ENDPOINTS ---------------- */

  @Get()
  @UseGuards(FirebaseAuthGuard)
  async getCart(@CurrentUser('_id') userId: string) {
    return this.cartService.getCartForUser(new Types.ObjectId(userId));
  }

  @Post('add')
  @UseGuards(FirebaseAuthGuard)
  async addToCart(
    @CurrentUser('_id') userId: string,
    @Body() dto: AddToCartDto,
  ) {
    return this.cartService.addToCartForUser(new Types.ObjectId(userId), dto);
  }

  @Patch('increase/:productId')
  @UseGuards(FirebaseAuthGuard)
  async increaseQuantity(
    @CurrentUser('_id') userId: string,
    @Param('productId') productId: string,
  ) {
    return this.cartService.changeQuantityForUser(
      new Types.ObjectId(userId),
      productId,
      1,
    );
  }

  @Patch('decrease/:productId')
  @UseGuards(FirebaseAuthGuard)
  async decreaseQuantity(
    @CurrentUser('_id') userId: string,
    @Param('productId') productId: string,
  ) {
    return this.cartService.changeQuantityForUser(
      new Types.ObjectId(userId),
      productId,
      -1,
    );
  }

  @Delete('remove')
  @UseGuards(FirebaseAuthGuard)
  async removeItem(
    @CurrentUser('_id') userId: string,
    @Body('productId') productId: string,
  ) {
    return this.cartService.removeItemForUser(
      new Types.ObjectId(userId),
      productId,
    );
  }

  @Delete('clear')
  @UseGuards(FirebaseAuthGuard)
  async clearCart(@CurrentUser('_id') userId: string) {
    return this.cartService.clearCartForUser(new Types.ObjectId(userId));
  }

  @Post('sync')
  @UseGuards(FirebaseAuthGuard)
  async syncCart(@CurrentUser('_id') userId: string, @Body() dto: SyncCartDto) {
    return this.cartService.replaceCartForUser(userId, dto.items);
  }

  /* ---------------- GUEST USER ENDPOINTS ---------------- */

  @Get('guest')
  async getGuestCart(@Headers('x-guest-session-id') guestSessionId?: string) {
    const sessionId = this.validateGuestSession(guestSessionId);
    return this.cartService.getCartForGuest(sessionId);
  }

  @Post('guest/add')
  async addToGuestCart(
    @Headers('x-guest-session-id') guestSessionId: string,
    @Body() dto: AddToCartDto,
  ) {
    const sessionId = this.validateGuestSession(guestSessionId);
    return this.cartService.addToCartForGuest(sessionId, dto);
  }

  @Patch('guest/increase/:productId')
  async increaseGuestQuantity(
    @Headers('x-guest-session-id') guestSessionId: string,
    @Param('productId') productId: string,
  ) {
    const sessionId = this.validateGuestSession(guestSessionId);
    return this.cartService.changeQuantityForGuest(sessionId, productId, 1);
  }

  @Patch('guest/decrease/:productId')
  async decreaseGuestQuantity(
    @Headers('x-guest-session-id') guestSessionId: string,
    @Param('productId') productId: string,
  ) {
    const sessionId = this.validateGuestSession(guestSessionId);
    return this.cartService.changeQuantityForGuest(sessionId, productId, -1);
  }

  @Delete('guest/remove')
  async removeGuestItem(
    @Headers('x-guest-session-id') guestSessionId: string,
    @Body('productId') productId: string,
  ) {
    const sessionId = this.validateGuestSession(guestSessionId);
    return this.cartService.removeItemForGuest(sessionId, productId);
  }

  @Delete('guest/clear')
  async clearGuestCart(@Headers('x-guest-session-id') guestSessionId: string) {
    const sessionId = this.validateGuestSession(guestSessionId);
    return this.cartService.clearCartForGuest(sessionId);
  }

  @Post('guest/sync')
  async syncGuestCart(
    @Headers('x-guest-session-id') guestSessionId: string,
    @Body() dto: SyncCartDto,
  ) {
    const sessionId = this.validateGuestSession(guestSessionId);
    return this.cartService.replaceCartForGuest(sessionId, dto.items);
  }

  @Patch('guest/extend-expiration')
  async extendGuestCartExpiration(
    @Headers('x-guest-session-id') guestSessionId: string,
  ) {
    const sessionId = this.validateGuestSession(guestSessionId);
    await this.cartService.extendGuestCartExpiration(sessionId);
    return { message: 'Cart expiration extended successfully' };
  }
}
