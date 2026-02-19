import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { PaymentSettingsService } from './payment-settings.service';
import { UpdatePaymentSettingsDto } from './dto/update-payment-settings.dto';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/interfaces/user.interface';

@Controller('payment-settings')
export class PaymentSettingsController {
  constructor(
    private readonly paymentSettingsService: PaymentSettingsService,
  ) {}

  @Get()
  async getSettings() {
    return this.paymentSettingsService.getSettings();
  }

  @Get('delivery-fees')
  async getDeliveryFees() {
    const settings = await this.paymentSettingsService.getSettings();
    return {
      express: settings.expressDeliveryFee,
      standard: settings.standardDeliveryFee,
    };
  }

  @Put()
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateSettings(@Body() updateDto: UpdatePaymentSettingsDto) {
    return this.paymentSettingsService.updateSettings(updateDto);
  }
}
