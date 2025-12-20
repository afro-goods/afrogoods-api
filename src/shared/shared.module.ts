// src/modules/media/media.module.ts or app.module.ts
import { Module, Logger } from '@nestjs/common';
import { MediaService } from './services/media/services/media.service';
import { MediaProvider } from './services/media/constants/media.constant';
import { RedisService } from './services/storage/services/redis.service';
import { RedisProvider } from './services/storage/providers/redis.provider';
import { EmailProcessor } from './services/workers/email.worker';
import { PaymentProcessor } from './services/workers/payment.worker';

@Module({
  providers: [
    MediaProvider,
    MediaService,
    RedisProvider,
    RedisService,
    EmailProcessor,
    PaymentProcessor,
    Logger,
  ],
  exports: [MediaService, RedisService],
})
export class SharedModule {}
