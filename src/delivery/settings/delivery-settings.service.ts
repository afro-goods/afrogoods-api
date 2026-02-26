import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DeliverySettings, DeliverySettingsDocument } from './schemas/delivery-settings.schema';
import { UpdateDeliverySettingsDto } from './dto/update-delivery-settings.dto';
import { EncryptionService } from '../../shared/services/encryption/encryption.service';

@Injectable()
export class DeliverySettingsService {
  private readonly logger = new Logger(DeliverySettingsService.name);

  constructor(
    @InjectModel(DeliverySettings.name)
    private deliverySettingsModel: Model<DeliverySettingsDocument>,
    private readonly encryptionService: EncryptionService,
  ) {}

  async getSettings(): Promise<DeliverySettings> {
    const settings = await this.deliverySettingsModel.findOne().exec();
    if (!settings) {
      // Return default settings if none exist
      return {
        deliveryAvailabilityEnabled: false,
        calendlyApiTokenEncrypted: '',
        calendlyEventTypeUri: '',
        cacheDurationMinutes: 60,
      } as DeliverySettings;
    }

    const result = settings.toObject();
    if (result.calendlyApiTokenEncrypted) {
      try {
        result.calendlyApiTokenEncrypted = this.encryptionService.decrypt(result.calendlyApiTokenEncrypted);
      } catch (error) {
        this.logger.error('Failed to decrypt Calendly API token', error.stack);
        result.calendlyApiTokenEncrypted = '';
      }
    }
    return result;
  }

  async updateSettings(updateDto: UpdateDeliverySettingsDto): Promise<DeliverySettings> {
    const updateData: any = { ...updateDto };

    if (updateDto.calendlyApiToken) {
      updateData.calendlyApiTokenEncrypted = this.encryptionService.encrypt(updateDto.calendlyApiToken);
      delete updateData.calendlyApiToken;
    }

    const settings = await this.deliverySettingsModel.findOneAndUpdate(
      {},
      { $set: updateData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).exec();

    const result = settings.toObject();
    if (result.calendlyApiTokenEncrypted) {
      try {
        result.calendlyApiTokenEncrypted = this.encryptionService.decrypt(result.calendlyApiTokenEncrypted);
      } catch (error) {
        this.logger.error('Failed to decrypt Calendly API token after update', error.stack);
        result.calendlyApiTokenEncrypted = '';
      }
    }
    return result;
  }
}
