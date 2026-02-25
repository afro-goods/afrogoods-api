import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '@nestjs/cache-manager';
import {
  DeliverySettings,
  DeliverySettingsSchema,
} from './settings/schemas/delivery-settings.schema';
import { DeliverySettingsService } from './settings/delivery-settings.service';
import { DeliveryAvailabilityService } from './availability/delivery-availability.service';
import { CalendlyApiClient } from './availability/calendly-api-client';
import { RateLimiter } from './availability/rate-limiter';
import { CircuitBreaker } from './availability/circuit-breaker';
import { DeliveryController } from './delivery.controller';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DeliverySettings.name, schema: DeliverySettingsSchema },
    ]),
    HttpModule.register({
      timeout: 3000,
      maxRedirects: 5,
    }),
    CacheModule.register({
      ttl: 3600000, // 1 hour default
      max: 100, // maximum number of items in cache
    }),
    SharedModule,
  ],
  providers: [
    DeliverySettingsService,
    DeliveryAvailabilityService,
    CalendlyApiClient,
    RateLimiter,
    CircuitBreaker,
  ],
  controllers: [DeliveryController],
  exports: [DeliveryAvailabilityService],
})
export class DeliveryModule {}
