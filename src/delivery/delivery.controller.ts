import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { DeliveryAvailabilityService } from './availability/delivery-availability.service';
import { DeliverySettingsService } from './settings/delivery-settings.service';
import { UpdateDeliverySettingsDto } from './settings/dto/update-delivery-settings.dto';
import { AvailabilityStatusDto } from './availability/dto/availability-status.dto';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enum/user.enum';

@Controller('delivery')
export class DeliveryController {
  constructor(
    private readonly availabilityService: DeliveryAvailabilityService,
    private readonly deliverySettingsService: DeliverySettingsService,
  ) {}

  @Get('availability')
  async getAvailability(): Promise<AvailabilityStatusDto> {
    return this.availabilityService.getAvailabilityStatus();
  }

  @Get('settings')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getSettings() {
    return this.deliverySettingsService.getSettings();
  }

  @Put('settings')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateSettings(@Body() updateDto: UpdateDeliverySettingsDto) {
    return this.deliverySettingsService.updateSettings(updateDto);
  }
}
