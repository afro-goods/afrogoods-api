import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { AttributesService } from './attributes.service';

@Controller('attributes')
@UseGuards(FirebaseAuthGuard)
export class AttributesController {
  constructor(private readonly attributesService: AttributesService) {}

  /**
   * Get attributes for a specific product
   */
  @Get('product/:productId')
  async getProductAttributes(@Param('productId') productId: string) {
    return this.attributesService.getProductAttributes(productId);
  }
}
