import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentSettingsController } from './payment-settings.controller';
import { PaymentSettingsService } from './payment-settings.service';
import {
  PaymentSettings,
  PaymentSettingsSchema,
} from './schemas/payment-settings.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PaymentSettings.name, schema: PaymentSettingsSchema },
    ]),
  ],
  controllers: [PaymentSettingsController],
  providers: [PaymentSettingsService],
  exports: [PaymentSettingsService],
})
export class PaymentSettingsModule {}
