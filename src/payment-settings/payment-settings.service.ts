import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PaymentSettings,
  PaymentSettingsDocument,
} from './schemas/payment-settings.schema';
import { UpdatePaymentSettingsDto } from './dto/update-payment-settings.dto';

@Injectable()
export class PaymentSettingsService {
  constructor(
    @InjectModel(PaymentSettings.name)
    private paymentSettingsModel: Model<PaymentSettingsDocument>,
  ) {}

  async getSettings(): Promise<PaymentSettings> {
    let settings = await this.paymentSettingsModel.findOne({
      settingsType: 'default',
    });
    if (!settings) {
      settings = await this.paymentSettingsModel.create({
        settingsType: 'default',
        eTransferEmail: 'admin@afrogoods.com', // Default value
        whatsappNumber: '1234567890', // Default value
        paymentInstructions: 'Please send e-transfer to the email above.',
      });
    }
    return settings;
  }

  async updateSettings(
    updateDto: UpdatePaymentSettingsDto,
  ): Promise<PaymentSettings> {
    const settings = await this.paymentSettingsModel.findOneAndUpdate(
      { settingsType: 'default' },
      { $set: updateDto },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    return settings;
  }
}
